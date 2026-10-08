"""
Health and model-info endpoints.
"""

from fastapi import APIRouter
from app.schemas.analyze import HealthResponse, ModelInfoResponse
from app.services.nlp_service import is_model_loaded, get_model_metadata
from app.config import MODEL_VERSION, DATASET_VERSION, RULESET_VERSION

router = APIRouter()


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health check",
)
async def health():
    """Check if the API and ML model are operational."""
    return HealthResponse(
        status="ok",
        model_loaded=is_model_loaded(),
        model_version=MODEL_VERSION if is_model_loaded() else None,
    )


@router.get(
    "/model-info",
    response_model=ModelInfoResponse,
    summary="Model information",
)
async def model_info():
    """Return model version, dataset version, and evaluation metadata."""
    metadata = get_model_metadata()
    return ModelInfoResponse(
        model_version=MODEL_VERSION,
        dataset_version=DATASET_VERSION,
        ruleset_version=RULESET_VERSION,
        evaluation_metrics=metadata.get("evaluation_metrics") if metadata else None,
        training_date=metadata.get("training_date") if metadata else None,
    )
