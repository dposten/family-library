from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

import httpx

from auth import get_current_user
from database import get_db
from models import Book, Loan, User, UserBook
from schemas import BookCreate, BookLookup, BookOut, BookStatusUpdate

router = APIRouter(prefix="/api/books", tags=["books"])


# ── Open Library helpers ──────────────────────────────────────────────────────

async def _fetch_open_library(isbn: str) -> dict | None:
    url = f"https://openlibrary.org/isbn/{isbn}.json"
    async with httpx.AsyncClient(timeout=10) as client:
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
        async with httpx.AsyncClient(timeout=10) as client:
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

    return {
        "isbn": isbn,
        "title": title,
        "subtitle": subtitle,
        "author": author,
        "publisher": publisher,
        "year": year,
        "description": description or None,
        "cover_url": cover_url,
    }


async def _fetch_google_books(isbn: str) -> dict | None:
    url = f"https://www.googleapis.com/books/v1/volumes?q=isbn:{isbn}"
    async with httpx.AsyncClient(timeout=10) as client:
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
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/lookup", response_model=BookLookup)
async def lookup_isbn(isbn: str = Query(..., min_length=10)):
    data = await _fetch_open_library(isbn)
    if not data:
        data = await _fetch_google_books(isbn)
    if not data:
        raise HTTPException(status_code=404, detail="Book not found for this ISBN")
    return BookLookup(**data)


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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Book).options(joinedload(Book.added_by))

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
        ).filter(
            or_(
                UserBook.status == status,
                (status == "unread") & UserBook.id.is_(None),
            )
        )

    books = query.order_by(Book.title).all()
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
    book = db.query(Book).options(joinedload(Book.added_by)).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
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
