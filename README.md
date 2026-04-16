# Family Library

A self-hosted PWA for cataloging your family's physical book collection.

## Quick Start

```bash
docker compose up --build
```

Then open **server-ip:port** you set in your yml in your browser (or your local IP on your phone).

## Features

- **Barcode scanning** — point your phone camera at any book's barcode (alternatively can manually enter ISBN)
- **Auto metadata** — title, author, cover art fetched from Open Library / Google Books
- **Reading status** — per-user "unread / reading / read" tracking
- **Loan tracking** — record who borrowed what, mark returned
- **Multiple accounts** — first registered user becomes admin
- **PWA installable** — "Add to Home Screen" on iOS & Android
- **Tags** — Select tags for fiction, non-fiction, genres, age demographic
- **Search** — Lookup authors or title names

## Local Development

**Backend** (requires Python 3.12+):
```bash
cd backend
pip install -r requirements.txt
DATABASE_URL=sqlite:///./data/library.db uvicorn main:app --reload
```

**Frontend** (requires Node 20+):
```bash
cd frontend
npm install
npm run dev    # proxies /api and /auth to localhost:8000
```

## Production Notes

- Change `SECRET_KEY` in `docker-compose.yml` before deploying
- For camera access on phones, HTTPS is required — deploy behind Caddy or nginx with TLS
- SQLite data is persisted in `./data/library.db` (Docker volume bind-mount)
- Backup: just copy `./data/library.db`

## Architecture

Single Docker container: FastAPI (Python) serves the REST API and the compiled React PWA as static files. SQLite for storage.

```
Phone (PWA) ──► FastAPI ──► Open Library API
                  │
              SQLite DB (./data/)
```

## Screenshots

### Library Landing Page
<img width="958" height="1023" alt="image" src="https://github.com/user-attachments/assets/38ddc03e-40c8-40c5-b2a8-bfd5fc0d1ee7" />

### Scanning New Books
<img width="954" height="1023" alt="image" src="https://github.com/user-attachments/assets/1b043403-7b92-4e4c-a34b-cb322f03f620" />

### ISBN Lookup
- Pulls cover image if available
- Option to manually load cover if needed
- Change Tags, select age, select private (visible only to user)
<img width="951" height="1024" alt="image" src="https://github.com/user-attachments/assets/4b0b4d0f-069d-4bc8-86ad-66fc40c648e9" />

