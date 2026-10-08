"""
Explanation service — generates evidence-linked reasons from structured analysis data.
Every reason follows: Signal → Why it matters → Suggested action.
Never fabricates reasons unsupported by detected evidence.
"""

from app.domain.enums import Classification, IndicatorCode
from app.domain.models import Indicator, LinkFinding


# Templates for human-readable reasons per indicator code
REASON_TEMPLATES: dict[str, str] = {
    "PAYMENT_REQUEST": "An upfront payment is requested. Unexpected payment demands are a prime scam signal.",
    "OTP_REQUEST": "The message asks for your OTP or verification code. Legitimate services never request your OTP.",
    "PASSWORD_REQUEST": "Your password or credentials are being requested. Never share these via SMS or WhatsApp.",
    "URGENCY": "The message creates artificial urgency to pressure you into acting without thinking.",
    "GUARANTEED_REWARD": "A prize or reward is promised without any prior participation. This is a common bait tactic.",
    "GUARANTEED_SELECTION": "A selection or placement is guaranteed without proper process. Legitimate selections require formal procedures.",
    "ACCOUNT_VERIFICATION": "Account verification is requested via an informal channel. Banks and services use their official apps.",
    "PERSONAL_DOCUMENT_REQUEST": "Sensitive identity documents are being requested through an unofficial channel.",
    "SUSPICIOUS_LINK": "The message contains a link with suspicious characteristics.",
    "SHORTENED_LINK": "A shortened URL is used, which hides the true destination. Scammers frequently use link shorteners.",
    "IP_HOST": "A link uses a raw IP address instead of a domain name, which is unusual for legitimate services.",
    "PUNYCODE_HOST": "A link uses internationalized encoding that can disguise the actual domain.",
    "KNOWN_PHISHING_URL": "The link matches a known phishing URL pattern.",
    "IMPERSONATED_BRAND": "A link appears to use a look-alike domain to impersonate a well-known brand.",
}


def generate_reasons(
    indicators: list[Indicator],
    link_findings: list[LinkFinding],
    classification: Classification,
) -> list[str]:
    """
    Generate evidence-based reasons from detected indicators and link findings.
    Only includes reasons backed by actual evidence.
    """
    reasons: list[str] = []
    seen_codes = set()

    # Reasons from rule indicators (sorted by severity)
    severity_order = {"high": 0, "medium": 1, "low": 2}
    sorted_indicators = sorted(indicators, key=lambda i: severity_order.get(i.severity.value, 3))

    for ind in sorted_indicators:
        if ind.code.value not in seen_codes:
            seen_codes.add(ind.code.value)
            reason = REASON_TEMPLATES.get(ind.code.value, ind.reason)
            reasons.append(reason)

    # Reasons from link findings without an associated indicator
    for lf in link_findings:
        if lf.risk_flags and not any(f in seen_codes for f in lf.risk_flags):
            if lf.is_shortened and "SHORTENED_LINK" not in seen_codes:
                reasons.append(f"The link '{lf.url}' is a shortened URL that hides its true destination.")
            if not lf.url.lower().startswith("https://") and "NO_HTTPS" not in seen_codes:
                reasons.append(f"The link '{lf.url}' does not use HTTPS encryption.")

    # Add classification-level summary if high risk
    if classification == Classification.HIGH_RISK and len(reasons) >= 2:
        reasons.insert(0, "This message contains multiple warning signs commonly associated with scams targeting students.")

    return reasons
