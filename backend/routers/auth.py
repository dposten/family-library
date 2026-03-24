import os

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import create_access_token, hash_password, verify_password, get_current_user
from database import get_db
from models import User
from schemas import Token, UserCreate, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])

_ALLOW_REGISTRATION = os.getenv("ALLOW_REGISTRATION", "true").strip().lower() != "false"


@router.get("/config")
def auth_config():
    return {"registration_enabled": _ALLOW_REGISTRATION}


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    if not _ALLOW_REGISTRATION:
        raise HTTPException(status_code=403, detail="Registration is disabled")
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")
    # First user becomes admin
    is_first = db.query(User).count() == 0
    user = User(
        username=payload.username,
        password_hash=hash_password(payload.password),
        is_admin=is_first,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(user.id, user.username)
    return Token(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=Token)
def login(payload: UserCreate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    token = create_access_token(user.id, user.username)
    return Token(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user
