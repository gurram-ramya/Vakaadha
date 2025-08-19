import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

class BaseConfig:
    DEBUG = False
    TESTING = False
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret")

    # SQLite now (file next to repo)
    DATABASE_PATH = os.getenv("DATABASE_PATH", str(BASE_DIR / "vakaadha.db"))

    # Media (local)
    MEDIA_ROOT = os.getenv("MEDIA_ROOT", str(BASE_DIR / "media"))
    MEDIA_URL = os.getenv("MEDIA_URL", "/media/")
    ALLOWED_IMAGE_MIME = {"image/jpeg", "image/png", "image/webp", "image/avif"}
    MAX_IMAGE_MB = int(os.getenv("MAX_IMAGE_MB", "10"))

    # CORS
    CORS_ORIGINS = [
        "http://127.0.0.1:5173", "http://localhost:5173",  # Vite
        "http://127.0.0.1:3000", "http://localhost:3000",  # React dev
        "http://127.0.0.1:5500", "http://localhost:5500",  # live-server
    ]

class DevConfig(BaseConfig):
    DEBUG = True

class ProdConfig(BaseConfig):
    DEBUG = False
