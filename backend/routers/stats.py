from fastapi import APIRouter, Depends
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Book, Tag, User, book_tags

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("")
def get_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    visible = or_(Book.is_private == False, Book.added_by_user_id == current_user.id)

    # Total visible books
    total = db.query(func.count(Book.id)).filter(visible).scalar()

    # Books added per user
    per_user = (
        db.query(User.username, func.count(Book.id).label("count"))
        .join(Book, Book.added_by_user_id == User.id)
        .filter(visible)
        .group_by(User.id)
        .order_by(func.count(Book.id).desc())
        .all()
    )

    # Books by tag (all categories)
    by_tag = (
        db.query(Tag.name, Tag.category, func.count(book_tags.c.book_id).label("count"))
        .join(book_tags, Tag.id == book_tags.c.tag_id)
        .join(Book, Book.id == book_tags.c.book_id)
        .filter(visible)
        .group_by(Tag.id)
        .order_by(Tag.category, func.count(book_tags.c.book_id).desc())
        .all()
    )

    # Books added per month (SQLite strftime)
    by_month = (
        db.query(
            func.strftime("%Y-%m", Book.added_at).label("month"),
            func.count(Book.id).label("count"),
        )
        .filter(visible)
        .group_by("month")
        .order_by("month")
        .all()
    )

    return {
        "total": total,
        "per_user": [{"username": u, "count": c} for u, c in per_user],
        "by_tag": [{"name": n, "category": cat, "count": c} for n, cat, c in by_tag],
        "by_month": [{"month": m, "count": c} for m, c in by_month],
    }
