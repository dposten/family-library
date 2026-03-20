from datetime import datetime
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    books_added: Mapped[list["Book"]] = relationship("Book", back_populates="added_by")
    user_books: Mapped[list["UserBook"]] = relationship("UserBook", back_populates="user")
    loans_received: Mapped[list["Loan"]] = relationship("Loan", foreign_keys="Loan.loaned_to_user_id", back_populates="loaned_to")
    loans_given: Mapped[list["Loan"]] = relationship("Loan", foreign_keys="Loan.loaned_by_user_id", back_populates="loaned_by")


class Book(Base):
    __tablename__ = "books"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    isbn: Mapped[str | None] = mapped_column(String(20), unique=True, index=True, nullable=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    subtitle: Mapped[str | None] = mapped_column(String(500), nullable=True)
    author: Mapped[str | None] = mapped_column(String(500), nullable=True)
    publisher: Mapped[str | None] = mapped_column(String(255), nullable=True)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    cover_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    added_by_user_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    added_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    added_by: Mapped["User | None"] = relationship("User", back_populates="books_added")
    user_books: Mapped[list["UserBook"]] = relationship("UserBook", back_populates="book")
    loans: Mapped[list["Loan"]] = relationship("Loan", back_populates="book")


class UserBook(Base):
    __tablename__ = "user_books"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    book_id: Mapped[int] = mapped_column(Integer, ForeignKey("books.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="unread")  # unread/reading/read

    user: Mapped["User"] = relationship("User", back_populates="user_books")
    book: Mapped["Book"] = relationship("Book", back_populates="user_books")


class Loan(Base):
    __tablename__ = "loans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    book_id: Mapped[int] = mapped_column(Integer, ForeignKey("books.id"), nullable=False)
    loaned_to_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    loaned_by_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    loaned_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    returned_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    book: Mapped["Book"] = relationship("Book", back_populates="loans")
    loaned_to: Mapped["User"] = relationship("User", foreign_keys=[loaned_to_user_id], back_populates="loans_received")
    loaned_by: Mapped["User"] = relationship("User", foreign_keys=[loaned_by_user_id], back_populates="loans_given")
