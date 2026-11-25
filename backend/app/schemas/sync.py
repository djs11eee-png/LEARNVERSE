from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from .auth import StudentProfilePayload


class ActivityEntry(BaseModel):
    type: Literal[
        "course-started",
        "course-completed",
        "course-reopened",
        "route-selected",
        "time-logged",
    ]
    id: str | None = Field(default=None, max_length=64)
    minutes: int | None = Field(default=None, ge=1, le=1440)
    timestamp: str = Field(..., max_length=64)


class ProgressSyncPayload(BaseModel):
    completed: list[str] = Field(default_factory=list, max_length=64)
    started: list[str] = Field(default_factory=list, max_length=64)
    favorites: list[str] = Field(default_factory=list, max_length=256)
    minutes: int = Field(default=0, ge=0, le=10_000_000)
    activity: list[ActivityEntry] = Field(default_factory=list, max_length=60)
    activeCourse: str | None = Field(default=None, max_length=64)
    activeRoute: str | None = Field(default=None, max_length=64)
    studyDays: list[str] = Field(default_factory=list, max_length=4000)


class CourseRecordPayload(BaseModel):
    completed: list[str] = Field(default_factory=list, max_length=32)
    verified: list[str] = Field(default_factory=list, max_length=32)
    lastLesson: str = Field(default="", max_length=64)
    projectCompleted: bool = False
    transferCompleted: bool = False


class VaultSyncPayload(BaseModel):
    earned: list[str] = Field(default_factory=list, max_length=512)
    opened: dict[str, list[str]] = Field(default_factory=dict)
    offers: dict[str, list[str]] = Field(default_factory=dict)
    notes: dict[str, str] = Field(default_factory=dict)


class UnionSyncRequest(BaseModel):
    profile: StudentProfilePayload | None = None
    progress: ProgressSyncPayload = Field(default_factory=ProgressSyncPayload)
    unfavorited: list[str] = Field(default_factory=list, max_length=256)
    courses: dict[str, CourseRecordPayload] = Field(default_factory=dict)
    vault: VaultSyncPayload = Field(default_factory=VaultSyncPayload)


class VaultSyncResponse(BaseModel):
    earned: list[str]
    opened: dict[str, list[str]]
    offers: dict[str, list[str]]
    owned: list[str]
    pending: list[str]
    notes: dict[str, str]
    rejected_packs: list[str] = Field(default_factory=list)


class GuardianSyncPayload(BaseModel):
    rank: int
    githubUser: str
    claimedAt: str
    aiDailyBonus: int


class AIQuotaSyncPayload(BaseModel):
    usedToday: int
    dailyLimit: int
    remainingToday: int
    isGenesisGuardian: bool
    dailyBonus: int


class UnionSyncResponse(BaseModel):
    synced_at: str
    profile: StudentProfilePayload
    progress: ProgressSyncPayload
    courses: dict[str, CourseRecordPayload]
    vault: VaultSyncResponse
    guardian: GuardianSyncPayload | None = None
    ai_quota: AIQuotaSyncPayload | None = None
