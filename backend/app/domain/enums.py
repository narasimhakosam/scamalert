"""
Domain enumerations for classifications, severities, and indicator codes.
"""

from enum import Enum


class Classification(str, Enum):
    SAFE = "safe"
    SUSPICIOUS = "suspicious"
    HIGH_RISK = "high_risk"


class Severity(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class DetectionSource(str, Enum):
    RULE = "rule"
    MODEL = "model"
    REPUTATION = "reputation"


class IndicatorCode(str, Enum):
    PAYMENT_REQUEST = "PAYMENT_REQUEST"
    OTP_REQUEST = "OTP_REQUEST"
    PASSWORD_REQUEST = "PASSWORD_REQUEST"
    URGENCY = "URGENCY"
    GUARANTEED_REWARD = "GUARANTEED_REWARD"
    GUARANTEED_SELECTION = "GUARANTEED_SELECTION"
    ACCOUNT_VERIFICATION = "ACCOUNT_VERIFICATION"
    PERSONAL_DOCUMENT_REQUEST = "PERSONAL_DOCUMENT_REQUEST"
    SUSPICIOUS_LINK = "SUSPICIOUS_LINK"
    SHORTENED_LINK = "SHORTENED_LINK"
    IP_HOST = "IP_HOST"
    PUNYCODE_HOST = "PUNYCODE_HOST"
    KNOWN_PHISHING_URL = "KNOWN_PHISHING_URL"
    IMPERSONATED_BRAND = "IMPERSONATED_BRAND"


class MessageSource(str, Enum):
    SMS = "sms"
    WHATSAPP = "whatsapp"
    UNKNOWN = "unknown"
