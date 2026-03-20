# ── Stage 1: Build React PWA ───────────────────────────────────────────────
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# ── Stage 2: FastAPI server ────────────────────────────────────────────────
FROM python:3.12-slim
WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
COPY --from=frontend /app/frontend/dist ./static

# Ensure data directory exists for first-run
RUN mkdir -p /app/data

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
