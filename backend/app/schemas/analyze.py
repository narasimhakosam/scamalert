"""
Pydantic request/response schemas for the Analyze API.
"""

from typing import Optional
from pydantic import BaseModel, Field, field_validator
from app.config import MAX_MESSAGE_LENGTH


class AnalysisRequest(BaseModel):
    """Incoming message analysis request with flexible aliases."""
    message: Optional[str] = None
    text: Optional[str] = None
    source: str = Field(default="unknown")
    source_channel: Optional[str] = None

    def get_message_text(self) -> str:
        msg = self.message or self.text or ""
        if not msg.strip():
            raise ValueError("Message cannot be empty or whitespace only")
        return msg.strip()

    def get_source(self) -> str:
        src = self.source_channel or self.source or "unknown"
        src = src.lower().strip()
        if src not in {"sms", "whatsapp", "unknown"}:
            src = "unknown"
        return src


class HighlightItem(BaseModel):
    """A single highlighted suspicious span."""
    start: int
    end: int
    start_idx: Optional[int] = None
    end_idx: Optional[int] = None
    text: str
    matched_text: Optional[str] = None
    indicator_code: str
    code: Optional[str] = None
    title: Optional[str] = None
    severity: str
    reason: str
    description: Optional[str] = None


class LinkItem(BaseModel):
    """A detected link with risk information."""
    url: str
    original_url: Optional[str] = None
    domain: Optional[str] = None
    start: int
    end: int
    risk_flags: list[str] = []
    is_shortened: bool = False
    is_suspicious: bool = False


class IndicatorItem(BaseModel):
    """Structured indicator item."""
    code: str
    title: str
    severity: str
    description: str
    matched_text: Optional[str] = None


class ActionItem(BaseModel):
    """Defensive safety action step."""
    step: int
    action: str
    description: str


class MLPredictionInfo(BaseModel):
    """ML model classification probabilities."""
    label: str
    spam_probability: float
    ham_probability: float


class AnalysisResponse(BaseModel):
    """Complete analysis result returned to the frontend."""
    analysis_id: str
    model_version: str
    dataset_version: str
    ruleset_version: str
    risk_score: int = Field(..., ge=0, le=100)
    classification: str
    ml_label: str
    ml_probability: float
    ml_prediction: Optional[MLPredictionInfo] = None
    highlights: list[HighlightItem] = []
    evidence_spans: list[HighlightItem] = []
    links: list[LinkItem] = []
    extracted_urls: list[LinkItem] = []
    indicators: list[IndicatorItem] = []
    reasons: list[str] = []
    recommended_actions: list[str] = []
    safety_actions: list[ActionItem] = []
    disclaimer: str = "Risk assessment only; it does not prove that a message is genuine."



class ModelInfoResponse(BaseModel):
    """Model version and evaluation metadata."""
    model_version: str
    dataset_version: str
    ruleset_version: str
    evaluation_metrics: Optional[dict] = None
    training_date: Optional[str] = None


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = "ok"
    model_loaded: bool = False
    model_version: Optional[str] = None


class ErrorResponse(BaseModel):
    """Standard error response."""
    detail: str
