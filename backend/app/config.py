"""
Application configuration — all weights, thresholds, and limits are configurable.
"""

import os
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
ML_DIR = BASE_DIR / "ml"
ARTIFACTS_DIR = ML_DIR / "artifacts"
DATA_DIR = ML_DIR / "data"

# ── API ────────────────────────────────────────────────────────
MAX_MESSAGE_LENGTH = int(os.getenv("MAX_MESSAGE_LENGTH", "5000"))
RATE_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", "30"))
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")

# ── Model ──────────────────────────────────────────────────────
MODEL_VERSION = os.getenv("MODEL_VERSION", "spamclf-v1")
DATASET_VERSION = os.getenv("DATASET_VERSION", "sms-spam-collection-v1")
RULESET_VERSION = os.getenv("RULESET_VERSION", "rules-v1")
MODEL_PATH = ARTIFACTS_DIR / "spam_classifier.joblib"
VECTORIZER_PATH = ARTIFACTS_DIR / "tfidf_vectorizer.joblib"
MODEL_METADATA_PATH = ARTIFACTS_DIR / "model_metadata.json"

# ── Risk scoring weights ───────────────────────────────────────
# ML probability is scaled to a base score in [0, ML_BASE_MAX].
ML_BASE_MAX = float(os.getenv("ML_BASE_MAX", "55"))

# Per-indicator weights (added once per unique code).
INDICATOR_WEIGHTS: dict[str, float] = {
    "PAYMENT_REQUEST": 18,
    "OTP_REQUEST": 16,
    "PASSWORD_REQUEST": 16,
    "URGENCY": 10,
    "GUARANTEED_REWARD": 12,
    "GUARANTEED_SELECTION": 12,
    "ACCOUNT_VERIFICATION": 10,
    "PERSONAL_DOCUMENT_REQUEST": 12,
    "SUSPICIOUS_LINK": 8,
    "SHORTENED_LINK": 6,
    "IP_HOST": 8,
    "PUNYCODE_HOST": 6,
    "IMPERSONATED_BRAND": 14,
    "SUSPICIOUS_TLD": 10,
    "MESSAGING_REDIRECT": 10,
    "FREE_HOSTING_PHISHING": 10,
    "UNVERIFIED_FORM_LINK": 6,
}


# URL risk flat contribution.
URL_RISK_BASE = float(os.getenv("URL_RISK_BASE", "5"))

# ── Classification thresholds ──────────────────────────────────
SAFE_MAX = int(os.getenv("SAFE_MAX", "29"))
SUSPICIOUS_MAX = int(os.getenv("SUSPICIOUS_MAX", "59"))
# 60-100 → High Risk
