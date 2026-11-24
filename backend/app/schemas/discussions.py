from __future__ import annotations

from pydantic import BaseModel, Field


class DiscussionPostItem(BaseModel):
    id: int
    name: str
    body: str
    created: str


class DiscussionReplyPage(BaseModel):
    replies: list[DiscussionPostItem]
    olderRepliesBefore: int | None = None


class DiscussionThreadItem(DiscussionPostItem, DiscussionReplyPage):
    pass


class DiscussionListingResponse(BaseModel):
    threads: list[DiscussionThreadItem]
    nextBefore: int | None = None


class AdminDiscussionPurgeRequest(BaseModel):
    room: str | None = Field(default=None, max_length=128)
    client_ip: str | None = Field(default=None, max_length=64)
    keyword: str | None = Field(default=None, max_length=64)
    hard_delete: bool = False
