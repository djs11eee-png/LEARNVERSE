from __future__ import annotations

import json
import re
from datetime import date, datetime, timedelta, timezone

from ..catalog import catalog
from ..db import DatabaseManager
from ..schemas.auth import StudentProfilePayload
from ..schemas.sync import (
    ActivityEntry,
    CourseRecordPayload,
    GuardianSyncPayload,
    ProgressSyncPayload,
    UnionSyncRequest,
    UnionSyncResponse,
    VaultSyncResponse,
)

DATE_KEY_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
DAILY_PACK_RE = re.compile(r"^day/(\d{4}-\d{2}-\d{2})$")
CST_TZ = timezone(timedelta(hours=8))
MIN_VALID_DATE = date(2025, 1, 1)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _today_cst() -> date:
    return datetime.now(CST_TZ).date()


def _is_valid_study_day(day_str: str) -> bool:
    if not isinstance(day_str, str) or not DATE_KEY_RE.match(day_str):
        return False
    try:
        parsed = date.fromisoformat(day_str)
    except ValueError:
        return False
    return MIN_VALID_DATE <= parsed <= (_today_cst() + timedelta(days=1))


def _is_valid_pack_key(pack_key: str, completed_rooms: set[str]) -> bool:
    """
    Validates whether a pack_key is legitimately earnable:
    1. 'welcome' is always valid (1 per user).
    2. 'lesson/<courseId>/<lessonId>' is ONLY valid if it is a real chapter AND
       that chapter is present in the user's merged completed chapters (`completed_rooms`).
    3. 'day/YYYY-MM-DD' is ONLY valid if it is a valid calendar date not in the future.
    """
    if pack_key == "welcome":
        return True
    if pack_key.startswith("lesson/"):
        room = pack_key[len("lesson/") :]
        return catalog.is_valid_room(room) and room in completed_rooms
    m = DAILY_PACK_RE.match(pack_key)
    if m:
        return _is_valid_study_day(m.group(1))
    return False


class SyncService:
    """
    High-Robustness Idempotent Union Sync Engine (Lazy Auth -> Cloud Account).
    - Guarantees mathematical idempotency: f(f(state)) == f(state).
    - Enforces Write-Once Immutable Latch on Card Vault packs (`user_vault_packs`)
      to eliminate pack-rerolling and duplicate-sync card farming exploits.
    """

    def __init__(self, db: DatabaseManager) -> None:
        self.db = db

    def union_sync(self, user_id: int, req: UnionSyncRequest) -> UnionSyncResponse:
        now_iso = _now_iso()
        rejected_packs: list[str] = []

        with self.db.write_transaction() as conn:
            # 1. Merge Student Profile if provided
            user_row = conn.execute(
                """
                SELECT nickname, avatar, welcome_state, student_path, student_choice
                FROM users WHERE id = ?
                """,
                (user_id,),
            ).fetchone()
            if user_row is None:
                raise LookupError("用户不存在。")

            nickname = user_row["nickname"]
            avatar = user_row["avatar"]
            welcome_state = user_row["welcome_state"]
            student_path = user_row["student_path"]
            student_choice = user_row["student_choice"]

            if req.profile is not None:
                if req.profile.nickname.strip():
                    nickname = req.profile.nickname.strip()[:24]
                if req.profile.avatar:
                    avatar = req.profile.avatar
                # Progress welcome state forward: new < skipped < finished
                rank_map = {"new": 0, "skipped": 1, "finished": 2}
                if rank_map.get(req.profile.welcome, 0) >= rank_map.get(
                    welcome_state, 0
                ):
                    welcome_state = req.profile.welcome
                if req.profile.path is not None:
                    student_path = req.profile.path
                if req.profile.choice.strip():
                    student_choice = req.profile.choice.strip()[:64]

                conn.execute(
                    """
                    UPDATE users
                    SET nickname = ?, avatar = ?, welcome_state = ?,
                        student_path = ?, student_choice = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (
                        nickname,
                        avatar,
                        welcome_state,
                        student_path,
                        student_choice,
                        now_iso,
                        user_id,
                    ),
                )

            # 2. Load & Union Per-Course Workspace Records
            existing_course_rows = conn.execute(
                """
                SELECT course_id, completed_lessons_json, verified_lessons_json,
                       last_lesson, project_completed, transfer_completed
                FROM user_course_records WHERE user_id = ?
                """,
                (user_id,),
            ).fetchall()

            merged_courses: dict[str, CourseRecordPayload] = {}
            for row in existing_course_rows:
                cid = row["course_id"]
                if not catalog.is_valid_course(cid):
                    continue
                merged_courses[cid] = CourseRecordPayload(
                    completed=catalog.filter_valid_lessons(
                        cid, json.loads(row["completed_lessons_json"] or "[]")
                    ),
                    verified=catalog.filter_valid_lessons(
                        cid, json.loads(row["verified_lessons_json"] or "[]")
                    ),
                    lastLesson=row["last_lesson"] or "",
                    projectCompleted=bool(row["project_completed"]),
                    transferCompleted=bool(row["transfer_completed"]),
                )

            for cid, incoming in req.courses.items():
                if not catalog.is_valid_course(cid):
                    continue
                current = merged_courses.get(cid, CourseRecordPayload())
                union_completed = catalog.filter_valid_lessons(
                    cid, set(current.completed) | set(incoming.completed)
                )
                union_verified = catalog.filter_valid_lessons(
                    cid, set(current.verified) | set(incoming.verified)
                )
                valid_lessons = catalog.course_lessons[cid]
                last_lesson = (
                    incoming.lastLesson
                    if incoming.lastLesson in valid_lessons
                    else (current.lastLesson if current.lastLesson in valid_lessons else "")
                )
                merged_rec = CourseRecordPayload(
                    completed=union_completed,
                    verified=union_verified,
                    lastLesson=last_lesson,
                    projectCompleted=current.projectCompleted or incoming.projectCompleted,
                    transferCompleted=current.transferCompleted
                    or incoming.transferCompleted,
                )
                merged_courses[cid] = merged_rec
                conn.execute(
                    """
                    INSERT INTO user_course_records (
                        user_id, course_id, completed_lessons_json, verified_lessons_json,
                        last_lesson, project_completed, transfer_completed, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(user_id, course_id) DO UPDATE SET
                        completed_lessons_json = excluded.completed_lessons_json,
                        verified_lessons_json = excluded.verified_lessons_json,
                        last_lesson = excluded.last_lesson,
                        project_completed = excluded.project_completed,
                        transfer_completed = excluded.transfer_completed,
                        updated_at = excluded.updated_at
                    """,
                    (
                        user_id,
                        cid,
                        json.dumps(merged_rec.completed),
                        json.dumps(merged_rec.verified),
                        merged_rec.lastLesson,
                        1 if merged_rec.projectCompleted else 0,
                        1 if merged_rec.transferCompleted else 0,
                        now_iso,
                    ),
                )

            # Build authoritative set of completed chapters (`courseId/lessonId`)
            completed_rooms: set[str] = set()
            fully_completed_courses: set[str] = set()
            for cid, rec in merged_courses.items():
                for lid in rec.completed:
                    completed_rooms.add(f"{cid}/{lid}")
                course_meta = catalog.courses.get(cid)
                if course_meta and len(rec.completed) == len(course_meta.lesson_ids):
                    fully_completed_courses.add(cid)

            # 3. Load & Union Overall Learning Progress
            prog_row = conn.execute(
                "SELECT * FROM user_progress WHERE user_id = ?", (user_id,)
            ).fetchone()

            if prog_row:
                srv_completed = set(
                    json.loads(prog_row["completed_courses_json"] or "[]")
                )
                srv_started = list(json.loads(prog_row["started_courses_json"] or "[]"))
                srv_favorites = list(json.loads(prog_row["favorites_json"] or "[]"))
                srv_minutes = int(prog_row["minutes"] or 0)
                srv_activity_raw = json.loads(prog_row["activity_json"] or "[]")
                srv_active_course = prog_row["active_course"]
                srv_active_route = prog_row["active_route"]
                srv_study_days = set(json.loads(prog_row["study_days_json"] or "[]"))
            else:
                srv_completed = set()
                srv_started = []
                srv_favorites = []
                srv_minutes = 0
                srv_activity_raw = []
                srv_active_course = None
                srv_active_route = None
                srv_study_days = set()

            inc_prog = req.progress
            union_completed_courses = sorted(
                cid
                for cid in (
                    srv_completed
                    | set(inc_prog.completed)
                    | fully_completed_courses
                )
                if catalog.is_valid_course(cid)
            )

            seen_started: set[str] = set()
            union_started_courses: list[str] = []
            for cid in [*inc_prog.started, *srv_started, *merged_courses.keys()]:
                if (
                    isinstance(cid, str)
                    and catalog.is_valid_course(cid)
                    and cid not in seen_started
                ):
                    seen_started.add(cid)
                    union_started_courses.append(cid)

            unfav_set = {
                item.strip()[:128]
                for item in req.unfavorited
                if isinstance(item, str) and item.strip()
            }
            seen_fav: set[str] = set()
            union_favorites: list[str] = []
            for fav in [*srv_favorites, *inc_prog.favorites]:
                if isinstance(fav, str):
                    cleaned_fav = fav.strip()[:128]
                    if (
                        cleaned_fav
                        and cleaned_fav not in unfav_set
                        and cleaned_fav not in seen_fav
                    ):
                        seen_fav.add(cleaned_fav)
                        union_favorites.append(cleaned_fav)
                        if len(union_favorites) >= 200:
                            break

            union_study_days = sorted(
                {
                    day
                    for day in (srv_study_days | set(inc_prog.studyDays))
                    if _is_valid_study_day(day)
                },
                reverse=True,
            )

            # Deduplicate activity log entries & prevent replay minute inflation
            activity_map: dict[tuple[str, str, int, str], ActivityEntry] = {}
            srv_time_keys: set[tuple[str, int]] = set()
            for item in srv_activity_raw:
                try:
                    act = ActivityEntry(**item)
                except Exception:
                    continue
                key = (act.type, act.id or "", act.minutes or 0, act.timestamp)
                activity_map[key] = act
                if act.type == "time-logged" and act.minutes:
                    srv_time_keys.add((act.timestamp, act.minutes))

            new_logged_minutes = 0
            for act in inc_prog.activity:
                key = (act.type, act.id or "", act.minutes or 0, act.timestamp)
                if key not in activity_map:
                    activity_map[key] = act
                    if (
                        act.type == "time-logged"
                        and act.minutes
                        and (act.timestamp, act.minutes) not in srv_time_keys
                    ):
                        new_logged_minutes += act.minutes

            merged_activity = sorted(
                activity_map.values(),
                key=lambda a: a.timestamp,
                reverse=True,
            )[:30]

            # Idempotent minutes calculation:
            # If the client has local offline minutes not yet on server, max() or verified delta applies;
            # repeating the exact same request produces 0 new_logged_minutes and keeps minutes identical.
            if prog_row is None:
                merged_minutes = max(inc_prog.minutes, new_logged_minutes)
            else:
                merged_minutes = max(
                    srv_minutes + new_logged_minutes,
                    inc_prog.minutes,
                )
            merged_minutes = min(merged_minutes, 10_000_000)

            active_course = (
                inc_prog.activeCourse
                if (inc_prog.activeCourse and catalog.is_valid_course(inc_prog.activeCourse))
                else srv_active_course
            )
            active_route = (
                inc_prog.activeRoute.strip()[:64]
                if (inc_prog.activeRoute and inc_prog.activeRoute.strip())
                else srv_active_route
            )

            conn.execute(
                """
                INSERT INTO user_progress (
                    user_id, completed_courses_json, started_courses_json, favorites_json,
                    minutes, activity_json, active_course, active_route, study_days_json, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    completed_courses_json = excluded.completed_courses_json,
                    started_courses_json = excluded.started_courses_json,
                    favorites_json = excluded.favorites_json,
                    minutes = excluded.minutes,
                    activity_json = excluded.activity_json,
                    active_course = excluded.active_course,
                    active_route = excluded.active_route,
                    study_days_json = excluded.study_days_json,
                    updated_at = excluded.updated_at
                """,
                (
                    user_id,
                    json.dumps(union_completed_courses),
                    json.dumps(union_started_courses),
                    json.dumps(union_favorites),
                    merged_minutes,
                    json.dumps([a.model_dump(exclude_none=True) for a in merged_activity]),
                    active_course,
                    active_route,
                    json.dumps(union_study_days),
                    now_iso,
                ),
            )

            # 4. Card Vault Union with Anti-Pack-Farming Protection
            existing_earned_rows = conn.execute(
                "SELECT pack_key FROM user_vault_earned WHERE user_id = ?", (user_id,)
            ).fetchall()
            existing_earned_set: set[str] = {
                r["pack_key"] for r in existing_earned_rows
            }
            earned_set: set[str] = {"welcome"} | existing_earned_set
            # Auto-grant earned pack for every completed chapter
            for room in completed_rooms:
                earned_set.add(f"lesson/{room}")

            # Validate incoming client earned keys
            for candidate_key in req.vault.earned:
                if not isinstance(candidate_key, str) or len(candidate_key) > 96:
                    rejected_packs.append(str(candidate_key)[:96])
                    continue
                if _is_valid_pack_key(candidate_key, completed_rooms):
                    earned_set.add(candidate_key)
                else:
                    rejected_packs.append(candidate_key)

            new_earned_keys = sorted(earned_set - existing_earned_set)
            if new_earned_keys:
                conn.executemany(
                    """
                    INSERT OR IGNORE INTO user_vault_earned (user_id, pack_key, earned_at)
                    VALUES (?, ?, ?)
                    """,
                    [(user_id, pk, now_iso) for pk in new_earned_keys],
                )

            # Load existing write-once packs (`offered` or `opened`)
            pack_rows = conn.execute(
                """
                SELECT pack_key, status, cards_json
                FROM user_vault_packs WHERE user_id = ?
                """,
                (user_id,),
            ).fetchall()
            server_packs: dict[str, tuple[str, list[str]]] = {}
            for r in pack_rows:
                cards = catalog.validate_pack_cards(json.loads(r["cards_json"]))
                if cards:
                    server_packs[r["pack_key"]] = (r["status"], cards)

            # Process incoming `offers` (Write-Once: never overwrite an existing offer or opened pack)
            for pk, card_list in req.vault.offers.items():
                if pk not in earned_set:
                    if pk not in rejected_packs:
                        rejected_packs.append(pk)
                    continue
                validated_cards = catalog.validate_pack_cards(card_list)
                if not validated_cards:
                    if pk not in rejected_packs:
                        rejected_packs.append(pk)
                    continue
                if pk in server_packs:
                    existing_status, existing_cards = server_packs[pk]
                    if existing_cards != validated_cards and pk not in rejected_packs:
                        rejected_packs.append(pk)
                    continue
                server_packs[pk] = ("offered", validated_cards)
                conn.execute(
                    """
                    INSERT OR IGNORE INTO user_vault_packs (
                        user_id, pack_key, status, cards_json, created_at
                    ) VALUES (?, ?, 'offered', ?, ?)
                    """,
                    (user_id, pk, json.dumps(validated_cards), now_iso),
                )

            # Process incoming `opened` packs (Write-Once Latch: prevents pack rerolling!)
            for pk, card_list in req.vault.opened.items():
                if pk not in earned_set:
                    if pk not in rejected_packs:
                        rejected_packs.append(pk)
                    continue
                validated_cards = catalog.validate_pack_cards(card_list)
                if not validated_cards:
                    if pk not in rejected_packs:
                        rejected_packs.append(pk)
                    continue

                if pk in server_packs:
                    existing_status, existing_cards = server_packs[pk]
                    if existing_status == "opened":
                        # Already opened on server! Reject any attempt to swap/reroll cards.
                        if existing_cards != validated_cards and pk not in rejected_packs:
                            rejected_packs.append(pk)
                        continue
                    # Transition from 'offered' -> 'opened', enforcing the original offered cards!
                    if existing_cards != validated_cards and pk not in rejected_packs:
                        rejected_packs.append(pk)
                    server_packs[pk] = ("opened", existing_cards)
                    conn.execute(
                        """
                        UPDATE user_vault_packs
                        SET status = 'opened', opened_at = ?
                        WHERE user_id = ? AND pack_key = ?
                        """,
                        (now_iso, user_id, pk),
                    )
                else:
                    server_packs[pk] = ("opened", validated_cards)
                    conn.execute(
                        """
                        INSERT INTO user_vault_packs (
                            user_id, pack_key, status, cards_json, created_at, opened_at
                        ) VALUES (?, ?, 'opened', ?, ?, ?)
                        """,
                        (user_id, pk, json.dumps(validated_cards), now_iso, now_iso),
                    )

            # Process Card Vault personal notes
            note_rows = conn.execute(
                "SELECT card_id, note FROM user_vault_notes WHERE user_id = ?",
                (user_id,),
            ).fetchall()
            merged_notes: dict[str, str] = {
                r["card_id"]: r["note"]
                for r in note_rows
                if r["card_id"] in catalog.cards_by_id
            }

            for card_id, note_text in req.vault.notes.items():
                if card_id not in catalog.cards_by_id or not isinstance(note_text, str):
                    continue
                sanitized_note = note_text.replace("\x00", "").strip()[:600]
                if not sanitized_note and card_id in merged_notes:
                    # Preserve non-empty server note during union sync
                    continue
                if sanitized_note:
                    merged_notes[card_id] = sanitized_note
                    conn.execute(
                        """
                        INSERT INTO user_vault_notes (user_id, card_id, note, updated_at)
                        VALUES (?, ?, ?, ?)
                        ON CONFLICT(user_id, card_id) DO UPDATE SET
                            note = excluded.note,
                            updated_at = excluded.updated_at
                        """,
                        (user_id, card_id, sanitized_note, now_iso),
                    )

            guardian_row = conn.execute(
                """
                SELECT rank, github_login, ai_daily_bonus, claimed_at
                FROM user_guardian_claims WHERE user_id = ?
                """,
                (user_id,),
            ).fetchone()

        guardian_payload = (
            GuardianSyncPayload(
                rank=int(guardian_row["rank"]),
                githubUser=str(guardian_row["github_login"]),
                claimedAt=str(guardian_row["claimed_at"]),
                aiDailyBonus=int(guardian_row["ai_daily_bonus"]),
            )
            if guardian_row is not None
            else None
        )

        # Build deterministic response
        opened_map: dict[str, list[str]] = {}
        offers_map: dict[str, list[str]] = {}
        owned_set: set[str] = set()
        for pk, (status, cards) in sorted(server_packs.items()):
            if status == "opened":
                opened_map[pk] = cards
                owned_set.update(cards)
            else:
                offers_map[pk] = cards

        sorted_earned = ["welcome"] + sorted(k for k in earned_set if k != "welcome")
        pending_keys = [k for k in sorted_earned if k not in opened_map]

        return UnionSyncResponse(
            synced_at=now_iso,
            profile=StudentProfilePayload(
                nickname=nickname,
                avatar=avatar,
                welcome=welcome_state,
                path=student_path,
                choice=student_choice,
            ),
            progress=ProgressSyncPayload(
                completed=union_completed_courses,
                started=union_started_courses,
                favorites=union_favorites,
                minutes=merged_minutes,
                activity=merged_activity,
                activeCourse=active_course,
                activeRoute=active_route,
                studyDays=union_study_days,
            ),
            courses=merged_courses,
            vault=VaultSyncResponse(
                earned=sorted_earned,
                opened=opened_map,
                offers=offers_map,
                owned=sorted(owned_set),
                pending=pending_keys,
                notes=merged_notes,
                rejected_packs=rejected_packs,
            ),
            guardian=guardian_payload,
        )

    def get_state(self, user_id: int) -> UnionSyncResponse:
        """Returns the current cloud state for an authenticated user using a read-only snapshot."""
        now_iso = _now_iso()
        with self.db.read_connection() as conn:
            user_row = conn.execute(
                """
                SELECT nickname, avatar, welcome_state, student_path, student_choice
                FROM users WHERE id = ?
                """,
                (user_id,),
            ).fetchone()
            if user_row is None:
                raise LookupError("用户不存在。")

            existing_course_rows = conn.execute(
                """
                SELECT course_id, completed_lessons_json, verified_lessons_json,
                       last_lesson, project_completed, transfer_completed
                FROM user_course_records WHERE user_id = ?
                """,
                (user_id,),
            ).fetchall()

            prog_row = conn.execute(
                "SELECT * FROM user_progress WHERE user_id = ?", (user_id,)
            ).fetchone()

            existing_earned_rows = conn.execute(
                "SELECT pack_key FROM user_vault_earned WHERE user_id = ?", (user_id,)
            ).fetchall()

            pack_rows = conn.execute(
                """
                SELECT pack_key, status, cards_json
                FROM user_vault_packs WHERE user_id = ?
                """,
                (user_id,),
            ).fetchall()

            note_rows = conn.execute(
                "SELECT card_id, note FROM user_vault_notes WHERE user_id = ?",
                (user_id,),
            ).fetchall()

            guardian_row = conn.execute(
                """
                SELECT rank, github_login, ai_daily_bonus, claimed_at
                FROM user_guardian_claims WHERE user_id = ?
                """,
                (user_id,),
            ).fetchone()

        guardian_payload = (
            GuardianSyncPayload(
                rank=int(guardian_row["rank"]),
                githubUser=str(guardian_row["github_login"]),
                claimedAt=str(guardian_row["claimed_at"]),
                aiDailyBonus=int(guardian_row["ai_daily_bonus"]),
            )
            if guardian_row is not None
            else None
        )

        merged_courses: dict[str, CourseRecordPayload] = {}
        completed_rooms: set[str] = set()
        fully_completed_courses: set[str] = set()
        for row in existing_course_rows:
            cid = row["course_id"]
            if not catalog.is_valid_course(cid):
                continue
            completed_lessons = catalog.filter_valid_lessons(
                cid, json.loads(row["completed_lessons_json"] or "[]")
            )
            verified_lessons = catalog.filter_valid_lessons(
                cid, json.loads(row["verified_lessons_json"] or "[]")
            )
            valid_lessons = catalog.course_lessons[cid]
            raw_last = row["last_lesson"] or ""
            last_lesson = raw_last if raw_last in valid_lessons else ""
            rec = CourseRecordPayload(
                completed=completed_lessons,
                verified=verified_lessons,
                lastLesson=last_lesson,
                projectCompleted=bool(row["project_completed"]),
                transferCompleted=bool(row["transfer_completed"]),
            )
            merged_courses[cid] = rec
            for lid in completed_lessons:
                completed_rooms.add(f"{cid}/{lid}")
            course_meta = catalog.courses.get(cid)
            if course_meta and len(completed_lessons) == len(course_meta.lesson_ids):
                fully_completed_courses.add(cid)

        if prog_row:
            srv_completed = set(
                json.loads(prog_row["completed_courses_json"] or "[]")
            )
            srv_started = list(json.loads(prog_row["started_courses_json"] or "[]"))
            srv_favorites = list(json.loads(prog_row["favorites_json"] or "[]"))
            srv_minutes = min(max(int(prog_row["minutes"] or 0), 0), 10_000_000)
            srv_activity_raw = json.loads(prog_row["activity_json"] or "[]")
            srv_active_course = prog_row["active_course"]
            srv_active_route = prog_row["active_route"]
            srv_study_days = set(json.loads(prog_row["study_days_json"] or "[]"))
        else:
            srv_completed = set()
            srv_started = []
            srv_favorites = []
            srv_minutes = 0
            srv_activity_raw = []
            srv_active_course = None
            srv_active_route = None
            srv_study_days = set()

        union_completed_courses = sorted(
            cid
            for cid in (srv_completed | fully_completed_courses)
            if catalog.is_valid_course(cid)
        )

        seen_started: set[str] = set()
        union_started_courses: list[str] = []
        for cid in [*srv_started, *merged_courses.keys()]:
            if (
                isinstance(cid, str)
                and catalog.is_valid_course(cid)
                and cid not in seen_started
            ):
                seen_started.add(cid)
                union_started_courses.append(cid)

        seen_fav: set[str] = set()
        union_favorites: list[str] = []
        for fav in srv_favorites:
            if isinstance(fav, str):
                cleaned_fav = fav.strip()[:128]
                if cleaned_fav and cleaned_fav not in seen_fav:
                    seen_fav.add(cleaned_fav)
                    union_favorites.append(cleaned_fav)
                    if len(union_favorites) >= 200:
                        break

        union_study_days = sorted(
            {day for day in srv_study_days if _is_valid_study_day(day)},
            reverse=True,
        )

        activity_map: dict[tuple[str, str, int, str], ActivityEntry] = {}
        for item in srv_activity_raw:
            try:
                act = ActivityEntry(**item)
            except Exception:
                continue
            key = (act.type, act.id or "", act.minutes or 0, act.timestamp)
            activity_map[key] = act

        merged_activity = sorted(
            activity_map.values(),
            key=lambda a: a.timestamp,
            reverse=True,
        )[:30]

        earned_set: set[str] = {"welcome"} | {
            r["pack_key"] for r in existing_earned_rows
        }
        for room in completed_rooms:
            earned_set.add(f"lesson/{room}")

        server_packs: dict[str, tuple[str, list[str]]] = {}
        for r in pack_rows:
            cards = catalog.validate_pack_cards(json.loads(r["cards_json"]))
            if cards:
                server_packs[r["pack_key"]] = (r["status"], cards)

        merged_notes: dict[str, str] = {
            r["card_id"]: r["note"]
            for r in note_rows
            if r["card_id"] in catalog.cards_by_id
        }

        opened_map: dict[str, list[str]] = {}
        offers_map: dict[str, list[str]] = {}
        owned_set: set[str] = set()
        for pk, (status, cards) in sorted(server_packs.items()):
            if status == "opened":
                opened_map[pk] = cards
                owned_set.update(cards)
            else:
                offers_map[pk] = cards

        sorted_earned = ["welcome"] + sorted(k for k in earned_set if k != "welcome")
        pending_keys = [k for k in sorted_earned if k not in opened_map]

        return UnionSyncResponse(
            synced_at=now_iso,
            profile=StudentProfilePayload(
                nickname=user_row["nickname"],
                avatar=user_row["avatar"],
                welcome=user_row["welcome_state"],
                path=user_row["student_path"],
                choice=user_row["student_choice"],
            ),
            progress=ProgressSyncPayload(
                completed=union_completed_courses,
                started=union_started_courses,
                favorites=union_favorites,
                minutes=srv_minutes,
                activity=merged_activity,
                activeCourse=srv_active_course,
                activeRoute=srv_active_route,
                studyDays=union_study_days,
            ),
            courses=merged_courses,
            vault=VaultSyncResponse(
                earned=sorted_earned,
                opened=opened_map,
                offers=offers_map,
                owned=sorted(owned_set),
                pending=pending_keys,
                notes=merged_notes,
                rejected_packs=[],
            ),
            guardian=guardian_payload,
        )
