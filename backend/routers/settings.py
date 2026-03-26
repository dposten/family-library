from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from auth import require_admin
from models import User

COVERS_DIR = Path("/app/data/covers")
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
LOGIN_BG_BASE = "login_bg"

router = APIRouter(prefix="/api/settings", tags=["settings"])


def _find_login_bg() -> Path | None:
    for ext in ALLOWED_EXTENSIONS:
        p = COVERS_DIR / f"{LOGIN_BG_BASE}.{ext}"
        if p.exists():
            return p
    return None


@router.get("/login-image")
async def get_login_image():
    p = _find_login_bg()
    if p is None:
        raise HTTPException(status_code=404, detail="No login background set")
    return {"url": f"/covers/{p.name}"}


@router.post("/login-image")
async def set_login_image(
    file: UploadFile = File(...),
    current_user: User = Depends(require_admin),
):
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="File must be jpg, png, or webp")

    # Remove any existing login background
    for old_ext in ALLOWED_EXTENSIONS:
        old_p = COVERS_DIR / f"{LOGIN_BG_BASE}.{old_ext}"
        if old_p.exists():
            old_p.unlink()

    dest = COVERS_DIR / f"{LOGIN_BG_BASE}.{ext}"
    dest.write_bytes(await file.read())

    return {"url": f"/covers/{dest.name}"}
