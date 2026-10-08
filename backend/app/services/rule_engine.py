"""
Rule engine — detects scam indicators with exact text spans using phrase-context patterns.
Produces Indicator objects with start/end positions for frontend highlighting.
"""

import re
from typing import Optional

from app.domain.enums import DetectionSource, IndicatorCode, Severity
from app.domain.models import Indicator
from app.config import INDICATOR_WEIGHTS

# ── Pattern definitions ──────────────────────────────────────────
# Each rule: (indicator_code, severity, compiled_regex, reason_template)
# Patterns use phrase-context to avoid simplistic single-word matches.

RULES: list[tuple[IndicatorCode, Severity, re.Pattern, str]] = [
    # Payment requests
    (
        IndicatorCode.PAYMENT_REQUEST,
        Severity.HIGH,
        re.compile(
            r'(?:pay|payment|transfer|send|deposit|fee|charge|amount)\s*(?:of\s+)?'
            r'(?:₹|rs\.?|inr|usd|\$|£|€)?\s*\d+'
            r'|(?:₹|rs\.?|inr)\s*\d+\s*(?:registration|processing|admission|confirmation|fee|charge)'
            r'|(?:registration|processing|admission|confirmation)\s+fee'
            r'|(?:pay|transfer|send)\s+(?:₹|rs\.?|inr|usd|\$)?\s*\d+'
            r'|upfront\s+(?:payment|fee|charge)'
            r'|(?:upi|bank\s*transfer|neft|imps|gpay|paytm|phonepe)',
            re.IGNORECASE
        ),
        "The message asks for an upfront payment. Unexpected payment requests are a common scam signal."
    ),
    # OTP / PIN requests
    (
        IndicatorCode.OTP_REQUEST,
        Severity.HIGH,
        re.compile(
            r'(?:share|send|enter|provide|give|tell|forward)\s+(?:your\s+)?(?:otp|pin|verification\s+code|security\s+code|one.?time\s+password)'
            r'|(?:otp|pin|verification\s+code)\s+(?:is|was|has been|sent|received)'
            r'|(?:otp|pin)\s*(?::|#|number)',
            re.IGNORECASE
        ),
        "The message requests an OTP or PIN. Legitimate organizations never ask for your OTP."
    ),
    # Password / credential requests
    (
        IndicatorCode.PASSWORD_REQUEST,
        Severity.HIGH,
        re.compile(
            r'(?:share|send|enter|provide|give|tell|confirm|verify|update)\s+(?:your\s+)?(?:password|login\s+credentials|username\s+and\s+password|recovery\s+code|secret\s+key)'
            r'|(?:password|credentials?)\s+(?:expired?|reset|update|verify|confirm)',
            re.IGNORECASE
        ),
        "The message asks for your password or credentials. Never share passwords via SMS or WhatsApp."
    ),
    # Urgency
    (
        IndicatorCode.URGENCY,
        Severity.MEDIUM,
        re.compile(
            r'(?:within|in)\s+\d+\s*(?:minute|hour|hr|min|second|day)s?'
            r'|(?:immediately|urgent(?:ly)?|right\s+now|asap|hurry|last\s+chance|expires?\s+(?:today|soon|now))'
            r'|(?:act\s+(?:now|fast|quickly|immediately))'
            r'|(?:before\s+\d+\s*(?:pm|am|:\d{2}))'
            r'|(?:limited\s+time|time.?sensitive|deadline\s+(?:today|tomorrow))',
            re.IGNORECASE
        ),
        "The message uses urgency to push immediate action. Pressure tactics are common in scams."
    ),
    # Guaranteed reward
    (
        IndicatorCode.GUARANTEED_REWARD,
        Severity.HIGH,
        re.compile(
            r'(?:you\s+(?:have\s+)?won|congratulations|winner|prize|reward|cashback|bonus|lottery|jackpot)'
            r'.*?(?:claim|collect|receive|credited|guaranteed|selected|lucky)',
            re.IGNORECASE | re.DOTALL
        ),
        "The message promises a guaranteed reward or prize. Real prizes don't require upfront payments."
    ),
    # Guaranteed selection
    (
        IndicatorCode.GUARANTEED_SELECTION,
        Severity.HIGH,
        re.compile(
            r'(?:you\s+(?:have\s+been|are)\s+(?:selected|shortlisted|chosen|confirmed))'
            r'|(?:guaranteed\s+(?:selection|placement|admission|job|internship|offer))'
            r'|(?:100%\s+(?:placement|selection|guaranteed))',
            re.IGNORECASE
        ),
        "The message claims you have been selected or guarantees selection. Legitimate offers require a formal process."
    ),
    # Account verification
    (
        IndicatorCode.ACCOUNT_VERIFICATION,
        Severity.MEDIUM,
        re.compile(
            r'(?:verify|confirm|validate|update|re-?activate)\s+(?:your\s+)?(?:account|identity|profile|kyc|bank\s+details?|card\s+details?)'
            r'|(?:account|card|kyc)\s+(?:verification|suspended|blocked|locked|restricted|deactivated|will\s+be\s+(?:blocked|suspended|closed))',
            re.IGNORECASE
        ),
        "The message asks for account verification. Banks and platforms never ask for sensitive details via SMS."
    ),
    # Personal document request
    (
        IndicatorCode.PERSONAL_DOCUMENT_REQUEST,
        Severity.MEDIUM,
        re.compile(
            r'(?:share|send|upload|provide|submit|forward)\s+(?:your\s+)?(?:aadhaar|aadhar|pan\s*card|passport|voter\s*id|driving\s*licen[cs]e|mark\s*sheet|certificate|id\s*proof|address\s*proof)'
            r'|(?:aadhaar|aadhar|pan|passport)\s+(?:copy|number|card|details?)',
            re.IGNORECASE
        ),
        "The message requests sensitive identity documents. Do not share government IDs through unofficial channels."
    ),
    # Direct UPI VPA payment handle
    (
        IndicatorCode.PAYMENT_REQUEST,
        Severity.HIGH,
        re.compile(
            r'\b[a-zA-Z0-9\.\-_]+@(?:upi|ybl|okaxis|icici|paytm|axl|ibl|barodampay|sbi|apl|okhdfcbank)\b',
            re.IGNORECASE
        ),
        "The message includes a direct UPI Virtual Payment Address (VPA). Never send money or approve collect requests to unverified UPI handles."
    ),
]



def detect_indicators(text: str) -> list[Indicator]:
    """
    Run all rule patterns against the text.
    Returns a list of Indicator objects with exact spans.
    Deduplicates by indicator code — keeps the highest-severity match.
    """
    found: dict[IndicatorCode, Indicator] = {}

    for code, severity, pattern, reason in RULES:
        for match in pattern.finditer(text):
            matched_text = match.group(0).strip()
            start = match.start()
            end = match.start() + len(matched_text)
            weight = INDICATOR_WEIGHTS.get(code.value, 5)

            indicator = Indicator(
                code=code,
                severity=severity,
                source=DetectionSource.RULE,
                start=start,
                end=end,
                text=matched_text,
                reason=reason,
                weight=weight,
            )

            # Keep only the best (highest weight/first) match per indicator code
            if code not in found:
                found[code] = indicator

    return list(found.values())
