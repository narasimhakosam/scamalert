"""
Domain data models (plain dataclasses) for internal use between services.
"""

from dataclasses import dataclass, field
from typing import Optional

from .enums import Classification, DetectionSource, IndicatorCode, Severity


@dataclass
class Indicator:
    """A single detected scam indicator with its text span."""
    code: IndicatorCode
    severity: Severity
    source: DetectionSource
    start: int
    end: int
    text: str
    reason: str
    weight: float = 0.0


@dataclass
class LinkFinding:
    """Result of analyzing a single URL."""
    url: str
    start: int
    end: int
    risk_flags: list[str] = field(default_factory=list)
    is_shortened: bool = False
    is_ip_host: bool = False
    is_punycode: bool = False
    has_suspicious_tokens: bool = False
    risk_score: float = 0.0


@dataclass
class PreprocessedMessage:
    """Normalized message with extracted URL positions."""
    original: str
    normalized: str
    urls: list[dict] = field(default_factory=list)  # {url, start, end}


@dataclass
class MLPrediction:
    """Output from the NLP spam classifier."""
    label: str  # "spam" or "ham"
    spam_probability: float
    ham_probability: float


@dataclass
class AnalysisResult:
    """Complete analysis result assembled by the orchestrator."""
    analysis_id: str
    model_version: str
    dataset_version: str
    ruleset_version: str
    risk_score: int
    classification: Classification
    ml_label: str
    ml_probability: float
    highlights: list[dict] = field(default_factory=list)
    links: list[dict] = field(default_factory=list)
    reasons: list[str] = field(default_factory=list)
    recommended_actions: list[str] = field(default_factory=list)
    disclaimer: str = "Risk assessment only; it does not prove that a message is genuine."
