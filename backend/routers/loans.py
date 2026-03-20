from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from auth import get_current_user
from database import get_db
from models import Book, Loan, User
from schemas import LoanCreate, LoanOut

router = APIRouter(prefix="/api/loans", tags=["loans"])


def _loan_out(loan: Loan, db: Session) -> LoanOut:
    loan_with_rels = (
        db.query(Loan)
        .options(
            joinedload(Loan.book),
            joinedload(Loan.loaned_to),
            joinedload(Loan.loaned_by),
        )
        .filter(Loan.id == loan.id)
        .first()
    )
    return LoanOut.model_validate(loan_with_rels)


@router.get("", response_model=list[LoanOut])
def list_loans(
    active_only: bool = True,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(Loan).options(
        joinedload(Loan.book),
        joinedload(Loan.loaned_to),
        joinedload(Loan.loaned_by),
    )
    if active_only:
        query = query.filter(Loan.returned_at.is_(None))
    return query.order_by(Loan.loaned_at.desc()).all()


@router.post("", response_model=LoanOut, status_code=status.HTTP_201_CREATED)
def create_loan(
    payload: LoanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    book = db.get(Book, payload.book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    borrower = db.get(User, payload.loaned_to_user_id)
    if not borrower:
        raise HTTPException(status_code=404, detail="User not found")

    # Check no active loan
    existing = (
        db.query(Loan)
        .filter(Loan.book_id == payload.book_id, Loan.returned_at.is_(None))
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Book is already loaned out")

    loan = Loan(
        book_id=payload.book_id,
        loaned_to_user_id=payload.loaned_to_user_id,
        loaned_by_user_id=current_user.id,
    )
    db.add(loan)
    db.commit()
    db.refresh(loan)
    return _loan_out(loan, db)


@router.put("/{loan_id}/return", response_model=LoanOut)
def return_loan(
    loan_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    loan = db.get(Loan, loan_id)
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    if loan.returned_at:
        raise HTTPException(status_code=400, detail="Loan already returned")
    loan.returned_at = datetime.now(timezone.utc)
    db.commit()
    return _loan_out(loan, db)
