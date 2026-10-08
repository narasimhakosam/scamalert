"""
Comprehensive unit tests for ScamGuard AI domain and services.
"""

from app.domain.enums import Classification, IndicatorCode, Severity
from app.domain.models import Indicator, LinkFinding, MLPrediction
from app.services.preprocessing import preprocess, normalize_text, extract_urls
from app.services.rule_engine import detect_indicators
from app.services.url_service import analyze_urls
from app.services.risk_engine import calculate_risk_score
from app.services.recommendation_service import generate_recommendations


def test_preprocessor_basic():
    text = "  Hello   world!  Visit   https://example.com/test  "
    prep = preprocess(text)
    assert "Hello world!" in prep.normalized
    assert len(prep.urls) == 1
    assert prep.urls[0]["url"] == "https://example.com/test"


def test_payment_request_indicator():
    text = "Pay Rs 499 registration fee within 10 minutes to confirm your seat."
    indicators = detect_indicators(text)
    codes = [ind.code for ind in indicators]
    assert IndicatorCode.PAYMENT_REQUEST in codes
    assert IndicatorCode.URGENCY in codes


def test_otp_request_indicator():
    text = "Your OTP is 492019. Please share this OTP with the executive to verify your bank account."
    indicators = detect_indicators(text)
    codes = [ind.code for ind in indicators]
    assert IndicatorCode.OTP_REQUEST in codes


def test_shortened_url_detection():
    text = "Check your lottery results now: http://bit.ly/student-lottery"
    urls = extract_urls(text)
    findings, ind = analyze_urls(urls)
    assert len(findings) == 1
    assert "SHORTENED_LINK" in findings[0].risk_flags


def test_risk_engine_scoring_high_risk():
    text = "Congratulations! You won Rs 50,000. Pay Rs 499 fee to claim within 10 mins: http://bit.ly/claim"
    urls = extract_urls(text)
    findings, url_indicators = analyze_urls(urls)
    rule_indicators = detect_indicators(text)
    all_indicators = rule_indicators + url_indicators

    pred = MLPrediction(label="spam", spam_probability=0.92, ham_probability=0.08)
    score, classification = calculate_risk_score(
        prediction=pred,
        indicators=all_indicators,
        link_findings=findings
    )
    assert score >= 60
    assert classification == Classification.HIGH_RISK


def test_risk_engine_scoring_safe():
    text = "Your college library book is due on Friday. Please return it to the counter."
    urls = extract_urls(text)
    findings, url_indicators = analyze_urls(urls)
    rule_indicators = detect_indicators(text)

    pred = MLPrediction(label="ham", spam_probability=0.02, ham_probability=0.98)
    score, classification = calculate_risk_score(
        prediction=pred,
        indicators=rule_indicators,
        link_findings=findings
    )
    assert score <= 29
    assert classification == Classification.SAFE


def test_recommendation_generation():
    text = "Pay Rs 499 fee immediately"
    indicators = detect_indicators(text)
    actions = generate_recommendations(
        indicators=indicators,
        link_findings=[],
        classification=Classification.HIGH_RISK
    )
    assert len(actions) >= 1
    assert any("pay" in act.lower() for act in actions)
