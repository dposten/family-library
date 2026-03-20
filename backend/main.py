import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import Base, engine
from routers import auth, books, loans, users

# Create tables on startup
Base.metadata.create_all(bind=engine)

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

# Serve React PWA static files (built into ./static by Docker)
static_dir = Path(__file__).parent / "static"
if static_dir.exists():
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")
