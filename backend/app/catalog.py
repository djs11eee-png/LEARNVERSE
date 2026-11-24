from __future__ import annotations

import json
import random
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class CardMeta:
    id: str
    number: str
    slot: int
    course_id: str
    lesson_id: str
    galaxy: str
    finish: str
    title: str


@dataclass(frozen=True)
class CourseMeta:
    id: str
    title: str
    difficulty: str
    lesson_ids: tuple[str, ...]


class AuthoritativeCatalog:
    """
    Loads the authoritative LEARNVERSE curriculum (32 courses, 128 chapters)
    and Card Vault catalog (90 cards across 5 slots) to validate discussion rooms,
    course/lesson progress, and prevent card-pack farming or slot-forging attacks.
    """

    def __init__(self, manifest_path: Path | None = None) -> None:
        if manifest_path is None:
            manifest_path = Path(__file__).resolve().parent / "data" / "catalog_manifest.json"
        raw = json.loads(manifest_path.read_text(encoding="utf-8"))

        self.courses: dict[str, CourseMeta] = {}
        self.course_lessons: dict[str, frozenset[str]] = {}
        for c in raw.get("courses", []):
            lesson_ids = tuple(lesson["id"] for lesson in c.get("lessons", []))
            self.courses[c["id"]] = CourseMeta(
                id=c["id"],
                title=c.get("title", c["id"]),
                difficulty=c.get("difficulty", "Beginner"),
                lesson_ids=lesson_ids,
            )
            self.course_lessons[c["id"]] = frozenset(lesson_ids)

        self.valid_rooms: frozenset[str] = frozenset(raw.get("rooms", []))
        self.valid_lesson_pack_keys: frozenset[str] = frozenset(
            f"lesson/{room}" for room in self.valid_rooms
        )

        self.cards_by_id: dict[str, CardMeta] = {}
        for card in raw.get("cards", []):
            meta = CardMeta(
                id=card["id"],
                number=card["number"],
                slot=int(card["slot"]),
                course_id=card["courseId"],
                lesson_id=card["lessonId"],
                galaxy=card["galaxy"],
                finish=card["finish"],
                title=card["title"],
            )
            self.cards_by_id[meta.id] = meta

    def is_valid_room(self, room: str) -> bool:
        return room in self.valid_rooms

    def is_valid_course(self, course_id: str) -> bool:
        return course_id in self.courses

    def filter_valid_lessons(self, course_id: str, lesson_ids: list[str] | set[str]) -> list[str]:
        valid = self.course_lessons.get(course_id)
        if not valid:
            return []
        # Preserve deterministic order matching course lesson sequence
        course_order = self.courses[course_id].lesson_ids
        provided = {item for item in lesson_ids if isinstance(item, str) and item in valid}
        return [lid for lid in course_order if lid in provided]

    def validate_pack_cards(self, card_ids: unknown) -> list[str] | None:
        """
        Mirrors frontend `readIds` in `src/cards/rewards.ts`:
        Every pack MUST contain exactly 5 valid cards where card[i].slot == i + 1 (slots 1..5).
        """
        if not isinstance(card_ids, list) or len(card_ids) != 5:
            return None
        validated: list[str] = []
        for idx, cid in enumerate(card_ids):
            if not isinstance(cid, str):
                return None
            card = self.cards_by_id.get(cid)
            if card is None or card.slot != idx + 1:
                return None
            validated.append(cid)
        return validated

    def choose_cards_for_pack(
        self,
        pack_key: str,
        earned_keys: set[str],
        owned_card_ids: set[str],
        rng: random.Random | None = None,
    ) -> list[str]:
        """
        Server-side deterministic/authoritative mirror of `chooseCards` in `src/cards/rewards.ts`.
        Used when the server reserves an offer for an earned pack.
        """
        if pack_key not in earned_keys:
            return []
        chooser = rng or random.SystemRandom()
        source_course_id: str | None = None
        if pack_key.startswith("lesson/"):
            parts = pack_key.split("/", 2)
            if len(parts) == 3 and f"{parts[1]}/{parts[2]}" in self.valid_rooms:
                source_course_id = parts[1]

        relevant = source_course_id is not None and any(
            c.course_id == source_course_id for c in self.cards_by_id.values()
        )
        first_lessons = {
            f"lesson/{c.id}/{c.lesson_ids[0]}"
            for c in self.courses.values()
            if (c.difficulty == "Beginner" or c.id == source_course_id) and c.lesson_ids
        }
        eligible = [
            card
            for card in self.cards_by_id.values()
            if f"lesson/{card.course_id}/{card.lesson_id}" in earned_keys
            or f"lesson/{card.course_id}/{card.lesson_id}" in first_lessons
        ]

        def rank(card: CardMeta) -> int:
            chapter = f"lesson/{card.course_id}/{card.lesson_id}"
            score = 0 if card.id in owned_card_ids else 8
            if chapter == pack_key:
                score += 4
            elif chapter in earned_keys:
                score += 2
            return score

        chosen: list[str] = []
        for slot in (1, 2, 3, 4, 5):
            slot_pool = [c for c in eligible if c.slot == slot]
            course_pool = (
                [c for c in slot_pool if c.course_id == source_course_id]
                if relevant
                else []
            )
            options = course_pool if course_pool else slot_pool
            if not options:
                return []
            best = max(rank(c) for c in options)
            choices = [c for c in options if rank(c) == best]
            chosen.append(chooser.choice(choices).id)
        return chosen


catalog = AuthoritativeCatalog()
