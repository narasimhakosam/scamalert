"""
URL analysis service — extracts URL features and scores link risk.
"""

import re
from urllib.parse import urlparse

from app.domain.enums import DetectionSource, IndicatorCode, Severity
from app.domain.models import Indicator, LinkFinding
from app.config import INDICATOR_WEIGHTS

# Known URL shortener domains
SHORTENER_DOMAINS = {
    "bit.ly", "tinyurl.com", "goo.gl", "t.co", "is.gd", "buff.ly",
    "ow.ly", "rb.gy", "cutt.ly", "shorturl.at", "tiny.cc", "j.mp",
    "soo.gd", "s.coop", "cli.gs", "budurl.com", "short.io", "bl.ink",
    "lnkd.in", "db.tt", "t.me", "wa.me", "forms.gle", "linktr.ee",
}

SUSPICIOUS_TLDS = {
    "xyz", "top", "online", "site", "tk", "ml", "ga", "cf", "gq",
    "buzz", "work", "icu", "click", "club", "live", "store", "vip"
}

# Suspicious path/host tokens often found in phishing URLs
SUSPICIOUS_TOKENS = {
    "login", "signin", "verify", "secure", "account", "update",
    "confirm", "banking", "wallet", "password", "auth", "reset",
    "suspended", "locked", "urgent", "click", "free", "prize",
    "winner", "claim", "offer", "limited", "reward", "internship",
    "refund", "kyc", "aadhaar", "pan", "cashback",
}

# Brand-like domains that scammers impersonate
BRAND_PATTERNS = [
    r'(?:g00gle|gooogle|g0ogle|googie)',
    r'(?:faceb00k|facebo0k|facebok)',
    r'(?:amaz0n|amazom|amaazon)',
    r'(?:paypa[il1]|paypl)',
    r'(?:micros0ft|micr0soft)',
    r'(?:app[il1]e|aple)',
    r'(?:netf[il1]x|netfl1x)',
    r'(?:wh[a4]ts[a4]pp)',
    r'(?:ph0nepe|phonep[e3]|paytm-verify|paytm-claim)',
    r'(?:sb[il1]-verify|hdfc-verify|icici-secure)',
    r'(?:fl[il1]pkart|flipkart-refund)',
    r'(?:tcs-recruitment|wipro-placement)',
]

BRAND_REGEX = re.compile('|'.join(BRAND_PATTERNS), re.IGNORECASE)



def analyze_url(url: str, start: int, end: int) -> tuple[LinkFinding, list[Indicator]]:
    """
    Analyze a single URL for risk signals.
    Returns a LinkFinding and any generated Indicators.
    """
    indicators: list[Indicator] = []
    finding = LinkFinding(url=url, start=start, end=end)

    try:
        parsed = urlparse(url if url.startswith(("http://", "https://")) else f"http://{url}")
    except Exception:
        finding.risk_flags.append("MALFORMED_URL")
        finding.risk_score = 5
        return finding, indicators

    hostname = (parsed.hostname or "").lower()
    path = (parsed.path or "").lower()
    full_url_lower = url.lower()

    # 1. Shortened link detection
    domain_parts = hostname.split(".")
    base_domain = ".".join(domain_parts[-2:]) if len(domain_parts) >= 2 else hostname
    if base_domain in SHORTENER_DOMAINS:
        finding.is_shortened = True
        finding.risk_flags.append("SHORTENED_LINK")
        finding.risk_score += 3
        indicators.append(Indicator(
            code=IndicatorCode.SHORTENED_LINK,
            severity=Severity.MEDIUM,
            source=DetectionSource.RULE,
            start=start, end=end, text=url,
            reason="This is a shortened URL that hides its true destination. Scammers use these to mask phishing links.",
            weight=INDICATOR_WEIGHTS.get("SHORTENED_LINK", 6),
        ))

    # 2. IP-literal hostname
    ip_pattern = re.compile(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$')
    if ip_pattern.match(hostname):
        finding.is_ip_host = True
        finding.risk_flags.append("IP_HOST")
        finding.risk_score += 4
        indicators.append(Indicator(
            code=IndicatorCode.IP_HOST,
            severity=Severity.HIGH,
            source=DetectionSource.RULE,
            start=start, end=end, text=url,
            reason="The link uses an IP address instead of a domain name. This is unusual for legitimate services.",
            weight=INDICATOR_WEIGHTS.get("IP_HOST", 8),
        ))

    # 3. Punycode detection
    if hostname.startswith("xn--") or any(part.startswith("xn--") for part in domain_parts):
        finding.is_punycode = True
        finding.risk_flags.append("PUNYCODE_HOST")
        finding.risk_score += 3
        indicators.append(Indicator(
            code=IndicatorCode.PUNYCODE_HOST,
            severity=Severity.MEDIUM,
            source=DetectionSource.RULE,
            start=start, end=end, text=url,
            reason="The link uses internationalized encoding that can disguise the actual domain.",
            weight=INDICATOR_WEIGHTS.get("PUNYCODE_HOST", 6),
        ))

    # Suspicious high-risk TLD detection
    tld = domain_parts[-1] if domain_parts else ""
    if tld in SUSPICIOUS_TLDS:
        finding.risk_flags.append("SUSPICIOUS_TLD")
        finding.risk_score += 3
        indicators.append(Indicator(
            code=IndicatorCode.SUSPICIOUS_LINK,
            severity=Severity.MEDIUM,
            source=DetectionSource.RULE,
            start=start, end=end, text=url,
            reason=f"The link uses a high-risk generic TLD (.{tld}) commonly associated with phishing.",
            weight=INDICATOR_WEIGHTS.get("SUSPICIOUS_LINK", 8),
        ))


    # 4. Excessive subdomains (more than 3 parts before TLD)
    if len(domain_parts) > 4:
        finding.risk_flags.append("EXCESSIVE_SUBDOMAINS")
        finding.risk_score += 2

    # 5. Suspicious tokens in URL
    url_tokens = set(re.findall(r'[a-z]+', full_url_lower))
    suspicious_found = url_tokens & SUSPICIOUS_TOKENS
    if len(suspicious_found) >= 2:  # Require multiple suspicious tokens
        finding.has_suspicious_tokens = True
        finding.risk_flags.append("SUSPICIOUS_TOKENS")
        finding.risk_score += 2
        indicators.append(Indicator(
            code=IndicatorCode.SUSPICIOUS_LINK,
            severity=Severity.MEDIUM,
            source=DetectionSource.RULE,
            start=start, end=end, text=url,
            reason=f"The link contains suspicious keywords: {', '.join(sorted(suspicious_found)[:3])}.",
            weight=INDICATOR_WEIGHTS.get("SUSPICIOUS_LINK", 8),
        ))

    # 6. Brand impersonation
    if BRAND_REGEX.search(hostname):
        finding.risk_flags.append("IMPERSONATED_BRAND")
        finding.risk_score += 5
        indicators.append(Indicator(
            code=IndicatorCode.IMPERSONATED_BRAND,
            severity=Severity.HIGH,
            source=DetectionSource.RULE,
            start=start, end=end, text=url,
            reason="The link appears to impersonate a well-known brand using a look-alike domain.",
            weight=INDICATOR_WEIGHTS.get("IMPERSONATED_BRAND", 12),
        ))

    # 7. No HTTPS
    if not url.lower().startswith("https://"):
        finding.risk_flags.append("NO_HTTPS")
        finding.risk_score += 1

    # 8. Very long URL (> 100 chars)
    if len(url) > 100:
        finding.risk_flags.append("EXCESSIVE_LENGTH")
        finding.risk_score += 1

    return finding, indicators


def analyze_urls(urls: list[dict]) -> tuple[list[LinkFinding], list[Indicator]]:
    """Analyze all extracted URLs. Returns findings and indicators."""
    findings: list[LinkFinding] = []
    all_indicators: list[Indicator] = []

    for url_info in urls:
        finding, indicators = analyze_url(
            url_info["url"], url_info["start"], url_info["end"]
        )
        findings.append(finding)
        all_indicators.extend(indicators)

    return findings, all_indicators
