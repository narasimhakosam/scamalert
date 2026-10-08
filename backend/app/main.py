"""
FastAPI main application — Student ScamGuard AI Backend
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS
from app.api.v1.analyze import router as analyze_router
from app.api.v1.health import router as health_router
from app.services import nlp_service

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load ML model on startup."""
    logger.info("Starting Student ScamGuard AI Backend...")
    model_loaded = nlp_service.load_model()
    if model_loaded:
        logger.info("ML model loaded successfully")
    else:
        logger.warning("ML model not loaded — predictions will use fallback")
    yield
    logger.info("Shutting down...")


app = FastAPI(
    title="Student ScamGuard AI",
    description="AI-powered scam message checker for students. Analyzes SMS/WhatsApp messages for fraud indicators.",
    version="1.0.0",
    lifespan=lifespan,
)

from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routes
app.include_router(analyze_router, prefix="/api/v1", tags=["Analysis"])
app.include_router(health_router, prefix="/api/v1", tags=["System"])

# Mount frontend static files if available
FRONTEND_DIR = Path(__file__).resolve().parent.parent.parent / "frontend"
if FRONTEND_DIR.exists() and (FRONTEND_DIR / "index.html").exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

    @app.get("/", tags=["Frontend"])
    async def serve_frontend():
        return FileResponse(FRONTEND_DIR / "index.html")

    @app.get("/{full_path:path}", tags=["Frontend"])
    async def serve_frontend_assets(full_path: str):
        file_path = FRONTEND_DIR / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(FRONTEND_DIR / "index.html")
else:
    @app.get("/", tags=["Root"])
    async def root():
        return {
            "name": "Student ScamGuard AI",
            "description": "Scam Message Checker API",
            "version": "1.0.0",
            "docs": "/docs",
        }

