import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session as DBSession

from database import Base, engine
from models import Tag
from routers import auth, books, loans, users

PREDEFINED_TAGS = [
    # Fiction type
    ("Fiction", "type"),
    ("Non-Fiction", "type"),
    # Genre
    ("Adventure", "genre"),
    ("Art", "genre"),
    ("Biography", "genre"),
    ("Business", "genre"),
    ("Cooking", "genre"),
    ("Fantasy", "genre"),
    ("Graphic Novel", "genre"),
    ("Historical Fiction", "genre"),
    ("History", "genre"),
    ("Horror", "genre"),
    ("Literary Fiction", "genre"),
    ("Memoir", "genre"),
    ("Mystery", "genre"),
    ("Philosophy", "genre"),
    ("Poetry", "genre"),
    ("Psychology", "genre"),
    ("Religion", "genre"),
    ("Romance", "genre"),
    ("Science", "genre"),
    ("Science Fiction", "genre"),
    ("Self-Help", "genre"),
    ("Short Stories", "genre"),
    ("Technology", "genre"),
    ("Thriller", "genre"),
    ("Travel", "genre"),
    ("True Crime", "genre"),
    # Age demographic
    ("Children (0–8)", "age"),
    ("Middle Grade (8–12)", "age"),
    ("Young Adult (13–18)", "age"),
    ("Adult", "age"),
]

# Ensure data directories exist
Path("/app/data/covers").mkdir(parents=True, exist_ok=True)

# Create tables and seed tags on startup
Base.metadata.create_all(bind=engine)
with DBSession(engine) as _db:
    for _name, _category in PREDEFINED_TAGS:
        if not _db.query(Tag).filter(Tag.name == _name).first():
            _db.add(Tag(name=_name, category=_category))
    _db.commit()

app = FastAPI(title="Family Library", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routers
app.include_router(auth.router)
app.include_router(books.router)
app.include_router(loans.router)
app.include_router(users.router)

# Serve uploaded covers — must be mounted BEFORE the SPA catch-all
app.mount("/covers", StaticFiles(directory="/app/data/covers"), name="covers")

# Serve React PWA static files (built into ./static by Docker)
static_dir = Path(__file__).parent / "static"
if static_dir.exists():
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")
