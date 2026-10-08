"""
Risk scoring engine — combines ML probability, rule indicators, and URL risk into a 0-100 score.
"""

from app.config import (
    ML_BASE_MAX, URL_RISK_BASE, INDICATOR_WEIGHTS,
    SAFE_MAX, SUSPICIOUS_MAX
)
from app.domain.enums import Classification
from app.domain.models import Indicator, LinkFinding, MLPrediction


def calculate_risk_score(
    prediction: MLPrediction,
    indicators: list[Indicator],
    link_findings: list[LinkFinding],
) -> tuple[int, Classification]:
    """
    Combine all signals into a 0-100 risk score and classification.

    1. Convert ML spam probability to a configurable base score.
    2. Add unique rule-indicator contributions.
    3. Add link-risk contribution.
    4. Clamp to [0, 100].
    5. Map the final score to classification.
    """
    # Step 1: ML base score
    ml_base = prediction.spam_probability * ML_BASE_MAX

    # Step 2: Unique indicator contributions (deduplicated by code)
    seen_codes = set()
    indicator_total = 0.0
    for ind in indicators:
        if ind.code.value not in seen_codes:
            seen_codes.add(ind.code.value)
            weight = INDICATOR_WEIGHTS.get(ind.code.value, ind.weight)
            indicator_total += weight

    # Step 3: URL risk contribution
    url_total = 0.0
    if link_findings:
        # Sum up individual link risk scores, capped at reasonable max
        for lf in link_findings:
            url_total += lf.risk_score
        url_total = min(url_total, 25.0)  # Cap URL contribution

    # Step 4: Raw score and clamping
    raw_score = ml_base + indicator_total + url_total
    clamped_score = max(0, min(100, round(raw_score)))

    # Step 5: Classification
    if clamped_score <= SAFE_MAX:
        classification = Classification.SAFE
    elif clamped_score <= SUSPICIOUS_MAX:
        classification = Classification.SUSPICIOUS
    else:
        classification = Classification.HIGH_RISK

    return clamped_score, classification
