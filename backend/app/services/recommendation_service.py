"""
Safety action recommender — maps detected indicators to simple, actionable recommendations.
"""

from app.domain.enums import Classification, IndicatorCode
from app.domain.models import Indicator, LinkFinding


# Mapping of indicator codes to specific actions
INDICATOR_ACTIONS: dict[str, str] = {
    "PAYMENT_REQUEST": "Don't pay the requested fee. Legitimate employers and institutions never charge candidates for placements or confirmation.",
    "OTP_REQUEST": "Don't share OTPs or verification codes. Never authorize bank mandates, approve UPI collect requests, or give SMS PINs.",
    "PASSWORD_REQUEST": "Don't share your passwords or login credentials. Change your password immediately if you already shared it.",
    "URGENCY": "Don't rush. Take time to verify the sender through official channels before responding.",
    "GUARANTEED_REWARD": "Don't claim the prize. Real rewards don't require upfront payments or personal information.",
    "GUARANTEED_SELECTION": "Don't trust guaranteed selection claims. Verify through your institution's official placement office.",
    "ACCOUNT_VERIFICATION": "Don't verify your account through this link. Use your bank or platform's official app directly.",
    "PERSONAL_DOCUMENT_REQUEST": "Don't upload ID documents (Aadhaar, PAN, marksheets) through external links received on chat.",
    "SUSPICIOUS_LINK": "Don't open the suspicious link. It may lead to a phishing page or malware.",
    "SHORTENED_LINK": "Don't open the shortened link. Shortened links may download malware or redirect to spoofed login portals.",
    "IP_HOST": "Don't visit the IP-based link. Legitimate services use domain names, not IP addresses.",
    "PUNYCODE_HOST": "Don't trust the look-alike link. The domain uses encoding that can disguise its true identity.",
    "IMPERSONATED_BRAND": "Don't trust the look-alike domain. Visit the brand's official website by typing it directly.",
}

# General safety actions always included for non-safe messages
GENERAL_ACTIONS = [
    "Verify the sender through official channels. Consult your campus career placement office or look up the organization's verified domain directly.",
]


def generate_recommendations(
    indicators: list[Indicator],
    link_findings: list[LinkFinding],
    classification: Classification,
) -> list[str]:
    """
    Generate safety action recommendations based on detected indicators.
    Returns an ordered list of actionable advice.
    """
    if classification == Classification.SAFE:
        return [
            "Standard verification. Confirm the status directly on the official portal if unsure.",
            "Remember: legitimate organizations will never request your passwords, OTPs, or immediate payment transfers over SMS.",
            "Keep your personal student credentials, library PINs, and ID numbers private at all times.",
        ]

    actions: list[str] = []
    seen_codes = set()

    # Priority order for actions
    priority = [
        "PAYMENT_REQUEST", "OTP_REQUEST", "PASSWORD_REQUEST",
        "PERSONAL_DOCUMENT_REQUEST", "SHORTENED_LINK", "SUSPICIOUS_LINK",
        "IP_HOST", "PUNYCODE_HOST", "IMPERSONATED_BRAND",
        "ACCOUNT_VERIFICATION", "GUARANTEED_REWARD", "GUARANTEED_SELECTION",
        "URGENCY",
    ]

    # Add indicator-specific actions
    indicator_codes = {ind.code.value for ind in indicators}
    for code in priority:
        if code in indicator_codes and code not in seen_codes:
            seen_codes.add(code)
            if code in INDICATOR_ACTIONS:
                actions.append(INDICATOR_ACTIONS[code])

    # Add general verification action
    actions.extend(GENERAL_ACTIONS)

    return actions
