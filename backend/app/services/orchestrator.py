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

    # Build link items with full safety breakdown
    links = []
    for lf in link_findings:
        links.append({
            "url": lf.url,
            "start": lf.start,
            "end": lf.end,
            "risk_flags": lf.risk_flags,
            "is_shortened": lf.is_shortened,
            "is_suspicious": lf.risk_score >= 3.0,
            "safety_verdict": lf.safety_verdict,
            "threat_type": lf.threat_type or "External Link",
            "risk_score": lf.risk_score,
            "risk_explanation": lf.risk_explanation,
        })

    # Determine scam category for student awareness
    indicator_codes = {ind.code.value for ind in all_indicators}
    msg_lower = preprocessed.original.lower()

    if classification == Classification.SAFE:
        scam_category = "Legitimate / Standard Notification"
    elif "PAYMENT_REQUEST" in indicator_codes and any(k in msg_lower for k in ["intern", "job", "hiring", "select", "seat"]):
        scam_category = "Internship & Job Fee Fraud"
    elif "MESSAGING_REDIRECT" in indicator_codes or any(k in msg_lower for k in ["telegram", "t.me", "task", "like video", "daily earn"]):
        scam_category = "Telegram Task / Like-Video Ponzi"
    elif "OTP_REQUEST" in indicator_codes or "PASSWORD_REQUEST" in indicator_codes or any(k in msg_lower for k in ["sbi", "bank", "kyc", "card", "upi"]):
        scam_category = "Bank KYC / Credential Harvesting"
    elif "GUARANTEED_REWARD" in indicator_codes or any(k in msg_lower for k in ["lottery", "prize", "won", "crore", "lakh"]):
        scam_category = "Lottery & Gift Voucher Phishing"
    elif any(k in msg_lower for k in ["parcel", "delivery", "indiapost", "speedpost", "address"]):
        scam_category = "Courier / Delivery Address Phishing"
    elif "scholarship" in msg_lower:
        scam_category = "Fake Scholarship Disbursement"
    else:
        scam_category = "Suspicious Digital Solicitation"

    # Assemble result
    analysis_id = f"SG-{uuid.uuid4().hex[:5].upper()}"

    return AnalysisResult(
        analysis_id=analysis_id,
        model_version=MODEL_VERSION,
        dataset_version=DATASET_VERSION,
        ruleset_version=RULESET_VERSION,
        risk_score=risk_score,
        classification=classification,
        scam_category=scam_category,
        ml_label=prediction.label,
        ml_probability=prediction.spam_probability,
        highlights=highlights,
        links=links,
        reasons=reasons,
        recommended_actions=actions,
    )

