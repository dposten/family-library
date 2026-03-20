from datetime import datetime
from pydantic import BaseModel, field_validator


# ── Auth ──────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str
    password: str

class UserOut(BaseModel):
    id: int
    username: str
    is_admin: bool
    created_at: datetime
    model_config = {"from_attributes": True}

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ── Books ─────────────────────────────────────────────────────────────────────

class BookLookup(BaseModel):
    isbn: str
    title: str
    subtitle: str | None = None
    author: str | None = None
    publisher: str | None = None
    year: int | None = None
    description: str | None = None
    cover_url: str | None = None

class BookCreate(BaseModel):
    isbn: str | None = None
    title: str
    subtitle: str | None = None
    author: str | None = None
    publisher: str | None = None
    year: int | None = None
    description: str | None = None
    cover_url: str | None = None

class BookOut(BaseModel):
    id: int
    isbn: str | None
    title: str
    subtitle: str | None
    author: str | None
    publisher: str | None
    year: int | None
    description: str | None
    cover_url: str | None
    added_at: datetime
    added_by: UserOut | None = None
    active_loan: "LoanOut | None" = None
    my_status: str | None = None
    model_config = {"from_attributes": True}

class BookStatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in ("unread", "reading", "read"):
            raise ValueError("status must be unread, reading, or read")
        return v


# ── Loans ─────────────────────────────────────────────────────────────────────

class LoanCreate(BaseModel):
    book_id: int
    loaned_to_user_id: int

class LoanOut(BaseModel):
    id: int
    book_id: int
    loaned_to_user_id: int
    loaned_by_user_id: int
    loaned_at: datetime
    returned_at: datetime | None
    book: BookOut | None = None
    loaned_to: UserOut | None = None
    loaned_by: UserOut | None = None
    model_config = {"from_attributes": True}


# Fix forward references
BookOut.model_rebuild()
