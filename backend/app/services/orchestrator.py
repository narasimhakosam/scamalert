"""
Analysis orchestrator — coordinates all services into a single analysis pipeline.
"""

import uuid
import logging

from app.config import MODEL_VERSION, DATASET_VERSION, RULESET_VERSION
from app.domain.enums import Classification
from app.domain.models import AnalysisResult
from app.services import (
    preprocessing,
    nlp_service,
    rule_engine,
    url_service,
    risk_engine,
    explanation_service,
    recommendation_service,
)

logger = logging.getLogger(__name__)


def analyze_message(message: str, source: str = "unknown") -> AnalysisResult:
    """
    Run the full analysis pipeline on a message:
    1. Preprocess text and extract URLs
    2. ML model predicts spam probability
    3. Rule engine detects scam indicators
    4. URL analyzer checks links
    5. Risk engine combines signals
    6. Generate explanations and actions
    """
    # Step 1: Preprocess
    preprocessed = preprocessing.preprocess(message)

    # Step 2: ML Classification
    prediction = nlp_service.predict(preprocessed.normalized)

    # Step 3: Rule-based indicator detection
    rule_indicators = rule_engine.detect_indicators(preprocessed.original)

    # Step 4: URL analysis
    link_findings, url_indicators = url_service.analyze_urls(preprocessed.urls)

    # Combine all indicators
    all_indicators = rule_indicators + url_indicators

    # Step 5: Risk scoring
    risk_score, classification = risk_engine.calculate_risk_score(
        prediction, all_indicators, link_findings
    )

    # Step 6: Explanations
    reasons = explanation_service.generate_reasons(
        all_indicators, link_findings, classification
    )

    # Step 7: Safety actions
    actions = recommendation_service.generate_recommendations(
        all_indicators, link_findings, classification
    )

    # Build highlights for the frontend
    highlights = []
    for i, ind in enumerate(all_indicators):
        highlights.append({
            "start": ind.start,
            "end": ind.end,
            "text": ind.text,
            "indicator_code": ind.code.value,
            "severity": ind.severity.value,
            "reason": ind.reason,
        })

    # Build link items
    links = []
    for lf in link_findings:
        links.append({
            "url": lf.url,
            "start": lf.start,
            "end": lf.end,
            "risk_flags": lf.risk_flags,
        })

    # Assemble result
    analysis_id = f"SG-{uuid.uuid4().hex[:5].upper()}"

    return AnalysisResult(
        analysis_id=analysis_id,
        model_version=MODEL_VERSION,
        dataset_version=DATASET_VERSION,
        ruleset_version=RULESET_VERSION,
        risk_score=risk_score,
        classification=classification,
        ml_label=prediction.label,
        ml_probability=prediction.spam_probability,
        highlights=highlights,
        links=links,
        reasons=reasons,
        recommended_actions=actions,
    )
