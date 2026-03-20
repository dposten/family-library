from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import User
from schemas import UserOut

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.query(User).order_by(User.username).all()
