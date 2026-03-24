import os
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload, selectinload

import httpx

from auth import get_current_user
from database import get_db
from models import Book, Loan, Note, Tag, User, UserBook
from schemas import BookCreate, BookLookup, BookOut, BookStatusUpdate, NoteCreate, NoteOut, TagOut
from pydantic import BaseModel

class PrivacyUpdate(BaseModel):
    is_private: bool

COVERS_DIR = Path("/app/data/covers")
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}

router = APIRouter(prefix="/api/books", tags=["books"])


# ── Open Library helpers ──────────────────────────────────────────────────────

async def _fetch_open_library(isbn: str) -> dict | None:
    url = f"https://openlibrary.org/isbn/{isbn}.json"
    async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
        r = await client.get(url)
        if r.status_code != 200:
            return None
        data = r.json()

    title = data.get("title", "")
    subtitle = data.get("subtitle")

    # Author names live in /authors/{key}.json — fetch first one
    author = None
    authors_list = data.get("authors", [])
    if authors_list:
        author_key = authors_list[0].get("key", "")
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            ar = await client.get(f"https://openlibrary.org{author_key}.json")
            if ar.status_code == 200:
                author = ar.json().get("name")

    publishers = data.get("publishers", [])
    publisher = publishers[0] if publishers else None

    publish_dates = data.get("publish_date", "")
    year = None
    if publish_dates:
        import re
        m = re.search(r"\d{4}", publish_dates)
        if m:
            year = int(m.group())

    description_raw = data.get("description", "")
    description = (
        description_raw.get("value", "") if isinstance(description_raw, dict) else description_raw
    )

    cover_url = f"https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg"

    # Collect subjects from all available fields
    subjects: list[str] = []
    for key in ("subjects", "subject_places", "subject_times", "subject_people"):
        for entry in data.get(key, []):
            if isinstance(entry, str):
                subjects.append(entry)
            elif isinstance(entry, dict) and "name" in entry:
                subjects.append(entry["name"])

    return {
        "isbn": isbn,
        "title": title,
        "subtitle": subtitle,
        "author": author,
        "publisher": publisher,
        "year": year,
        "description": description or None,
        "cover_url": cover_url,
        "subjects": subjects,
    }


async def _fetch_google_books(isbn: str) -> dict | None:
    url = f"https://www.googleapis.com/books/v1/volumes?q=isbn:{isbn}"
    async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
        r = await client.get(url)
        if r.status_code != 200:
            return None
        data = r.json()

    items = data.get("items", [])
    if not items:
        return None

    info = items[0].get("volumeInfo", {})
    isbn13 = next(
        (i["identifier"] for i in info.get("industryIdentifiers", []) if i["type"] == "ISBN_13"),
        isbn,
    )
    cover_url = info.get("imageLinks", {}).get("thumbnail")

    published = info.get("publishedDate", "")
    year = None
    if published:
        import re
        m = re.search(r"\d{4}", published)
        if m:
            year = int(m.group())

    return {
        "isbn": isbn13,
        "title": info.get("title", ""),
        "subtitle": info.get("subtitle"),
        "author": ", ".join(info.get("authors", [])) or None,
        "publisher": info.get("publisher"),
        "year": year,
        "description": info.get("description"),
        "cover_url": cover_url,
        "subjects": info.get("categories", []),
    }


def _match_subjects_to_tags(subjects: list[str], tags: list[Tag]) -> list[int]:
    """Case-insensitive substring match of Open Library subjects against predefined tags."""
    import re
    if not subjects:
        return []
    subjects_blob = " | ".join(s.lower() for s in subjects)
    matched: list[int] = []
    for tag in tags:
        # Strip parenthetical suffixes for matching, e.g. "Young Adult (13–18)" → "young adult"
        tag_core = re.sub(r"\s*\([^)]+\)", "", tag.name).strip().lower()
        if tag_core and tag_core in subjects_blob:
            matched.append(tag.id)
    return matched


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/tags", response_model=list[TagOut])
def list_tags(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Tag).order_by(Tag.category, Tag.name).all()


@router.get("/lookup", response_model=BookLookup)
async def lookup_isbn(
    isbn: str = Query(..., min_length=10),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    data = await _fetch_open_library(isbn)
    if not data:
        data = await _fetch_google_books(isbn)
    if not data:
        raise HTTPException(status_code=404, detail="Book not found for this ISBN")
    subjects = data.pop("subjects", [])
    all_tags = db.query(Tag).all()
    suggested_tag_ids = _match_subjects_to_tags(subjects, all_tags)
    return BookLookup(**data, suggested_tag_ids=suggested_tag_ids)


def _book_to_out(book: Book, current_user: User, db: Session) -> BookOut:
    active_loan = (
        db.query(Loan)
        .options(joinedload(Loan.loaned_to), joinedload(Loan.loaned_by))
        .filter(Loan.book_id == book.id, Loan.returned_at.is_(None))
        .first()
    )
    user_book = (
        db.query(UserBook)
        .filter(UserBook.user_id == current_user.id, UserBook.book_id == book.id)
        .first()
    )
    out = BookOut.model_validate(book)
    out.active_loan = active_loan
    out.my_status = user_book.status if user_book else "unread"
    return out


@router.get("", response_model=list[BookOut])
def list_books(
    q: str | None = Query(None),
    status: str | None = Query(None),
    tags: str | None = Query(None),
    sort: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Book).options(joinedload(Book.added_by), selectinload(Book.tags))

    # Exclude private books that belong to other users
    query = query.filter(
        or_(Book.is_private == False, Book.added_by_user_id == current_user.id)
    )

    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(Book.title.ilike(like), Book.author.ilike(like), Book.isbn.ilike(like))
        )

    if status:
        query = query.join(
            UserBook,
            (UserBook.book_id == Book.id) & (UserBook.user_id == current_user.id),
            isouter=True,
        )
        if status == "unread":
            query = query.filter(or_(UserBook.status == "unread", UserBook.id.is_(None)))
        else:
            query = query.filter(UserBook.status == status)

    if tags:
        tag_ids = [int(t) for t in tags.split(",") if t.strip().isdigit()]
        for tag_id in tag_ids:
            query = query.filter(Book.tags.any(Tag.id == tag_id))

    if sort == "title_desc":
        query = query.order_by(Book.title.desc())
    elif sort == "author":
        query = query.order_by(Book.author)
    elif sort == "year_desc":
        query = query.order_by(Book.year.desc())
    elif sort == "year_asc":
        query = query.order_by(Book.year.asc())
    elif sort == "newest":
        query = query.order_by(Book.added_at.desc())
    else:
        query = query.order_by(Book.title)

    books = query.all()
    return [_book_to_out(b, current_user, db) for b in books]


@router.post("", response_model=BookOut, status_code=status.HTTP_201_CREATED)
def add_book(
    payload: BookCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.isbn:
        existing = db.query(Book).filter(Book.isbn == payload.isbn).first()
        if existing:
            raise HTTPException(status_code=409, detail="Book with this ISBN already exists")
    book = Book(**payload.model_dump(), added_by_user_id=current_user.id)
    db.add(book)
    db.commit()
    db.refresh(book)
    return _book_to_out(book, current_user, db)


@router.post("/scan", response_model=BookOut, status_code=status.HTTP_201_CREATED)
def scan_add(
    payload: BookCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Confirm-add after ISBN lookup (same as POST /api/books but named for scan flow)."""
    if payload.isbn:
        existing = db.query(Book).filter(Book.isbn == payload.isbn).first()
        if existing:
            raise HTTPException(status_code=409, detail="Book with this ISBN already in catalog")
    book = Book(**payload.model_dump(), added_by_user_id=current_user.id)
    db.add(book)
    db.commit()
    db.refresh(book)
    return _book_to_out(book, current_user, db)


@router.get("/{book_id}", response_model=BookOut)
def get_book(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    book = (
        db.query(Book)
        .options(joinedload(Book.added_by), selectinload(Book.tags))
        .filter(Book.id == book_id)
        .first()
    )
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    if book.is_private and book.added_by_user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Book not found")
    return _book_to_out(book, current_user, db)


@router.patch("/{book_id}/privacy", response_model=BookOut)
def set_privacy(
    book_id: int,
    payload: PrivacyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    book = db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    if book.added_by_user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only the owner can change privacy")
    book.is_private = payload.is_private
    db.commit()
    db.refresh(book)
    return _book_to_out(book, current_user, db)


@router.post("/{book_id}/tags/{tag_id}", response_model=BookOut)
def add_book_tag(
    book_id: int,
    tag_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    book = (
        db.query(Book)
        .options(joinedload(Book.added_by), selectinload(Book.tags))
        .filter(Book.id == book_id)
        .first()
    )
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    tag = db.get(Tag, tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    if tag not in book.tags:
        book.tags.append(tag)
        db.commit()
    book = (
        db.query(Book)
        .options(joinedload(Book.added_by), selectinload(Book.tags))
        .filter(Book.id == book_id)
        .first()
    )
    return _book_to_out(book, current_user, db)


@router.delete("/{book_id}/tags/{tag_id}", response_model=BookOut)
def remove_book_tag(
    book_id: int,
    tag_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    book = (
        db.query(Book)
        .options(joinedload(Book.added_by), selectinload(Book.tags))
        .filter(Book.id == book_id)
        .first()
    )
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    tag = db.get(Tag, tag_id)
    if tag and tag in book.tags:
        book.tags.remove(tag)
        db.commit()
    book = (
        db.query(Book)
        .options(joinedload(Book.added_by), selectinload(Book.tags))
        .filter(Book.id == book_id)
        .first()
    )
    return _book_to_out(book, current_user, db)


@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_book(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    book = db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    db.delete(book)
    db.commit()


@router.put("/{book_id}/status", response_model=BookOut)
def update_status(
    book_id: int,
    payload: BookStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    book = db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    user_book = (
        db.query(UserBook)
        .filter(UserBook.user_id == current_user.id, UserBook.book_id == book_id)
        .first()
    )
    if user_book:
        user_book.status = payload.status
    else:
        user_book = UserBook(user_id=current_user.id, book_id=book_id, status=payload.status)
        db.add(user_book)
    db.commit()
    return _book_to_out(book, current_user, db)


# ── Cover upload ───────────────────────────────────────────────────────────────

@router.post("/{book_id}/cover", response_model=BookOut)
async def upload_cover(
    book_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    book = db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="File must be jpg, jpeg, png, or webp")

    # Remove any previous cover file for this book
    for old_ext in ALLOWED_EXTENSIONS:
        old_path = COVERS_DIR / f"{book_id}.{old_ext}"
        if old_path.exists():
            old_path.unlink()

    cover_path = COVERS_DIR / f"{book_id}.{ext}"
    contents = await file.read()
    cover_path.write_bytes(contents)

    book.cover_url = f"/covers/{book_id}.{ext}"
    db.commit()
    db.refresh(book)
    return _book_to_out(book, current_user, db)


# ── Metadata refresh ───────────────────────────────────────────────────────────

@router.put("/{book_id}/refresh", response_model=BookOut)
async def refresh_metadata(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    book = db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    if not book.isbn:
        raise HTTPException(status_code=400, detail="Book has no ISBN — cannot refresh metadata")

    data = await _fetch_open_library(book.isbn)
    if not data:
        data = await _fetch_google_books(book.isbn)
    if not data:
        raise HTTPException(status_code=404, detail="No metadata found for this ISBN")

    book.title = data["title"] or book.title
    book.subtitle = data.get("subtitle")
    book.author = data.get("author")
    book.publisher = data.get("publisher")
    book.year = data.get("year")
    book.description = data.get("description")

    # Don't overwrite a locally uploaded cover
    if not (book.cover_url and book.cover_url.startswith("/covers/")):
        book.cover_url = data.get("cover_url")

    db.commit()
    db.refresh(book)
    return _book_to_out(book, current_user, db)


# ── Notes ──────────────────────────────────────────────────────────────────────

@router.get("/{book_id}/notes", response_model=list[NoteOut])
def get_notes(
    book_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    book = db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return (
        db.query(Note)
        .options(joinedload(Note.author))
        .filter(Note.book_id == book_id)
        .order_by(Note.created_at)
        .all()
    )


@router.post("/{book_id}/notes", response_model=NoteOut, status_code=status.HTTP_201_CREATED)
def add_note(
    book_id: int,
    payload: NoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    book = db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    note = Note(book_id=book_id, user_id=current_user.id, content=payload.content)
    db.add(note)
    db.commit()
    db.refresh(note)
    # Re-fetch with author joined
    return db.query(Note).options(joinedload(Note.author)).filter(Note.id == note.id).first()


@router.put("/{book_id}/notes/{note_id}", response_model=NoteOut)
def edit_note(
    book_id: int,
    note_id: int,
    payload: NoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    note = db.query(Note).filter(Note.id == note_id, Note.book_id == book_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    if note.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not allowed to edit this note")
    note.content = payload.content
    db.commit()
    return db.query(Note).options(joinedload(Note.author)).filter(Note.id == note_id).first()


@router.delete("/{book_id}/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(
    book_id: int,
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    note = db.query(Note).filter(Note.id == note_id, Note.book_id == book_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    if note.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not allowed to delete this note")
    db.delete(note)
    db.commit()
