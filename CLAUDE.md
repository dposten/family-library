# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Family Library** is a self-hosted PWA for cataloging a family book collection. It's a single FastAPI container that serves both the REST API and the pre-built React SPA, backed by SQLite.

## Development Commands

### Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt
DATABASE_URL=sqlite:///./data/library.db uvicorn main:app --reload
```
API runs at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

### Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
Dev server runs at `http://localhost:5173` with `/api` and `/auth` proxied to `localhost:8000`.

### Docker (full stack)
```bash
# Development build
docker compose up --build

# Production (pulls pre-built image from GHCR)
docker compose -f docker-compose.deploy.yml up
```

### Frontend production build
```bash
cd frontend
npm run build   # outputs to frontend/dist/
```

## Architecture

### Deployment Model
A single Docker container (multi-stage build) serves everything on port 8000: FastAPI handles API routes (`/api/*`, `/auth/*`) and also serves the pre-built React SPA as static files. SQLite DB and cover images are persisted via a volume mount at `./data/`.

### Backend Structure (`backend/`)
- `main.py` — FastAPI app init, CORS, static file mounting, router registration
- `database.py` — SQLAlchemy engine and session setup
- `models.py` — ORM models: `User`, `Book`, `UserBook` (per-user read status), `Loan`, `Tag`, `Note`
- `schemas.py` — Pydantic request/response schemas
- `auth.py` — JWT creation/verification and bcrypt password utilities; `require_admin` dependency for admin-only endpoints
- `routers/` — one file per domain: `auth.py`, `books.py`, `loans.py`, `settings.py`, `stats.py`, `users.py`

### Frontend Structure (`frontend/src/`)
- `App.jsx` — React Router setup, auth context (JWT in localStorage), and `NavBar` sidebar component
- `api.js` — Centralized fetch helpers that attach the Bearer token; multipart uploads (covers, login image) use raw `fetch` directly
- `pages/` — Full-page route components (`Home`, `BookDetail`, `ScanPage`, `LoansPage`, `StatsPage`, `LoginPage`)
- `components/` — Reusable UI pieces (`BookCard`, `SearchBar`, `LoanBadge`, `BarcodeScanner`)

### Key Design Decisions
- **Auth**: Stateless JWT; first registered user becomes admin. Token stored in localStorage. The `/login` route renders `LoginPage` even when authenticated (to support account switching without losing the current session until a new login succeeds).
- **Navigation**: Persistent left sidebar (`NavBar` in `App.jsx`); `w-14` icons-only on mobile, `md:w-48` with labels on desktop. Content area uses `ml-14 md:ml-48` for clearance. Account button opens a dropdown with "Switch Account" (navigate to `/login`, token kept) and "Logout" (clears token + user, sets state to null).
- **ISBN lookup**: `GET /api/books/lookup?isbn=...` fetches metadata from Open Library then falls back to Google Books (async via httpx).
- **Book covers**: Can be auto-fetched from Open Library or uploaded via `POST /api/books/{id}/cover`; stored in `data/covers/`.
- **Login background**: Admin-only. `POST /api/settings/login-image` saves the image as `data/covers/login_bg.{ext}`; `GET /api/settings/login-image` returns its `/covers/` URL. `LoginPage` applies it as a CSS background-image and shows the upload control only when `localStorage.user.is_admin === true`.
- **Book grid**: `repeat(auto-fill, minmax(170px, 1fr))` — no breakpoints. Outer container is `max-w-6xl` to allow 4–6 columns on wide desktops.
- **Tags**: ~30 predefined tags with categories (type/genre/age); many-to-many with books.
- **PWA**: Service worker configured in `vite.config.js`; Open Library cover images cached for 30 days.

### CI/CD
Push to `master` triggers `.github/workflows/docker-publish.yml`, which builds and pushes `ghcr.io/dposten/family-library:latest` to GHCR.

## Environment Variables
See `.env.example`:
```
SECRET_KEY=          # At least 32 random chars; required for JWT signing
DATABASE_URL=        # sqlite:///./data/library.db
ALLOW_REGISTRATION=  # true/false; disabling locks out new signups
```

## Notes
- No automated tests or linters are configured.
- HTTPS is required in production for barcode camera access (use Caddy or nginx as a reverse proxy).
