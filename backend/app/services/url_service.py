"""
URL analysis service — extracts comprehensive URL features, detects spam/phishing links,
and assigns explainable safety verdicts and risk scores.
"""

import re
from urllib.parse import urlparse
from typing import Optional

from app.domain.enums import DetectionSource, IndicatorCode, Severity
from app.domain.models import Indicator, LinkFinding
from app.config import INDICATOR_WEIGHTS

# Known URL shortener domains that hide the true destination
SHORTENER_DOMAINS = {
    "bit.ly", "tinyurl.com", "goo.gl", "t.co", "is.gd", "buff.ly",
    "ow.ly", "rb.gy", "cutt.ly", "shorturl.at", "tiny.cc", "j.mp",
    "soo.gd", "s.coop", "cli.gs", "budurl.com", "short.io", "bl.ink",
    "lnkd.in", "db.tt", "rebrand.ly", "cutt.us", "v.gd", "bc.vc",
}

# Messaging redirect links used to funnel victims off-platform to avoid fraud filters
MESSAGING_REDIRECT_DOMAINS = {
    "t.me", "telegram.me", "telegram.dog", "wa.me", "chat.whatsapp.com",
    "api.whatsapp.com", "whatsapp.com",
}

# Cloud tunneling / free hosting providers frequently abused for fake student portals
FREE_HOSTING_TUNNEL_DOMAINS = {
    "ngrok.io", "ngrok-free.app", "pages.dev", "workers.dev",
    "firebaseapp.com", "web.app", "000webhostapp.com", "weebly.com",
    "surge.sh", "glitch.me", "repl.co", "blogspot.com", "site123.me",
}

# High-risk top-level domains statistically prevalent in disposable phishing campaigns
HIGH_RISK_TLDS = {
    "xyz", "top", "site", "online", "tk", "ml", "ga", "cf", "gq",
    "buzz", "icu", "vip", "live", "club", "work", "click", "rest",
    "shop", "loan", "fit", "link", "monster", "fun", "bid", "cam",
    "trade", "racing", "download", "kim", "stream", "gdn",
}

# Legitimate institutional domain suffixes (universities, colleges, official gov)
LEGITIMATE_ACADEMIC_GOV_SUFFIXES = (
    ".ac.in", ".edu.in", ".gov.in", ".nic.in", ".edu", ".gov"
)

# Verified official domains
VERIFIED_OFFICIAL_DOMAINS = {
    "google.com", "google.co.in", "amazon.in", "amazon.com",
    "microsoft.com", "apple.com", "netflix.com",
    "sbi.co.in", "onlinesbi.sbi", "hdfcbank.com", "icicibank.com",
    "rbi.org.in", "incometax.gov.in", "uidai.gov.in", "indiapost.gov.in",
    "irctc.co.in", "jio.com", "airtel.in", "flipkart.com", "swiggy.com",
    "zomato.com", "tcs.com", "infosys.com", "wipro.com",
}

# Sensitive credential and payment harvesting keywords in path or host
SUSPICIOUS_TOKENS = {
    "login", "signin", "verify", "secure", "account", "update",
    "confirm", "banking", "wallet", "password", "auth", "reset",
    "suspended", "locked", "urgent", "click", "free", "prize",
    "winner", "claim", "offer", "limited", "kyc", "refund", "bonus",
    "reward", "internship", "mandate", "collect", "admit", "card",
}

# Brand names scammers impersonate via look-alike domains
BRAND_PATTERNS = [
    r'(?:g00gle|gooogle|g0ogle|googie)',
    r'(?:faceb00k|facebo0k|facebok)',
    r'(?:amaz0n|amazom|amaazon)',
    r'(?:paypa[il1]|paypl)',
    r'(?:micros0ft|micr0soft)',
    r'(?:app[il1]e|aple)',
    r'(?:netf[il1]x|netfl1x)',
    r'(?:wh[a4]ts[a4]pp)',
    r'(?:sbi-?[a-z0-9]*)',
    r'(?:hdfc-?[a-z0-9]*)',
    r'(?:icici-?[a-z0-9]*)',
    r'(?:paytm-?[a-z0-9]*)',
    r'(?:phonepe-?[a-z0-9]*)',
    r'(?:indiapost-?[a-z0-9]*)',
]
BRAND_REGEX = re.compile('|'.join(BRAND_PATTERNS), re.IGNORECASE)


def analyze_url(url: str, start: int, end: int) -> tuple[LinkFinding, list[Indicator]]:
    """
    Analyze a single URL for scam and phishing risk signals.
    Returns a LinkFinding and any generated Indicators.
    """
    indicators: list[Indicator] = []
    finding = LinkFinding(url=url, start=start, end=end)

    normalized_url = url if url.startswith(("http://", "https://", "ftp://")) else f"http://{url}"

    try:
        parsed = urlparse(normalized_url)
    except Exception:
        finding.risk_flags.append("MALFORMED_URL")
        finding.risk_score = 6.0
        finding.safety_verdict = "Suspicious Link"
        finding.threat_type = "Malformed Link Structure"
        finding.risk_explanation = "The URL is malformed and does not follow standard domain conventions."
        return finding, indicators

    hostname = (parsed.hostname or "").lower()
    path = (parsed.path or "").lower()
    full_url_lower = url.lower()
    domain_parts = hostname.split(".")
    tld = domain_parts[-1] if domain_parts else ""
    base_domain = ".".join(domain_parts[-2:]) if len(domain_parts) >= 2 else hostname

    # 0. Check if it's a verified legitimate educational or government portal
    is_verified_academic = hostname.endswith(LEGITIMATE_ACADEMIC_GOV_SUFFIXES)
    is_verified_brand = base_domain in VERIFIED_OFFICIAL_DOMAINS or hostname in VERIFIED_OFFICIAL_DOMAINS

    if is_verified_academic or is_verified_brand:
        finding.safety_verdict = "Verified Legitimate"
        finding.threat_type = "Verified Institutional Domain" if is_verified_academic else "Verified Official Domain"
        finding.risk_explanation = f"Domain '{hostname}' is an official registered institutional/corporate portal."
        finding.risk_score = 0.0
        return finding, indicators

    threats = []
    link_risk = 0.0

    # 1. Messaging Redirect (Telegram / WhatsApp channel lures)
    if any(m in hostname for m in MESSAGING_REDIRECT_DOMAINS) or "forms.gle" in hostname:
        if "forms.gle" in hostname or "docs.google.com" in hostname:
            finding.risk_flags.append("UNVERIFIED_FORM")
            link_risk += 4.0
            threats.append("Anonymous Form Application")
            indicators.append(Indicator(
                code=IndicatorCode.UNVERIFIED_FORM_LINK,
                severity=Severity.MEDIUM,
                source=DetectionSource.RULE,
                start=start, end=end, text=url,
                reason="Directs to an anonymous Google Form. Authentic recruiters use formal corporate application systems.",
                weight=INDICATOR_WEIGHTS.get("UNVERIFIED_FORM_LINK", 6),
            ))
        else:
            finding.risk_flags.append("MESSAGING_REDIRECT")
            link_risk += 7.0
            threats.append("Off-Platform Chat Lure")
            indicators.append(Indicator(
                code=IndicatorCode.MESSAGING_REDIRECT,
                severity=Severity.HIGH,
                source=DetectionSource.RULE,
                start=start, end=end, text=url,
                reason="Lures you to a Telegram/WhatsApp channel. Task, like-video, and Ponzi scams frequently use this to evade detection.",
                weight=INDICATOR_WEIGHTS.get("MESSAGING_REDIRECT", 10),
            ))

    # 2. Shortened link detection
    if base_domain in SHORTENER_DOMAINS or hostname in SHORTENER_DOMAINS:
        finding.is_shortened = True
        finding.risk_flags.append("SHORTENED_LINK")
        link_risk += 6.0
        threats.append("Shortened Masking Link")
        indicators.append(Indicator(
            code=IndicatorCode.SHORTENED_LINK,
            severity=Severity.MEDIUM,
            source=DetectionSource.RULE,
            start=start, end=end, text=url,
            reason="Shortened URL hiding its real destination. Attackers use short links to obscure phishing websites on SMS.",
            weight=INDICATOR_WEIGHTS.get("SHORTENED_LINK", 6),
        ))

    # 3. High-Risk Phishing TLDs
    if tld in HIGH_RISK_TLDS:
        finding.risk_flags.append("SUSPICIOUS_TLD")
        link_risk += 8.0
        threats.append(f"High-Risk TLD (.{tld})")
        indicators.append(Indicator(
            code=IndicatorCode.SUSPICIOUS_TLD,
            severity=Severity.HIGH,
            source=DetectionSource.RULE,
            start=start, end=end, text=url,
            reason=f"The domain uses the '.{tld}' extension, which has a very high rate of abuse in malicious SMS campaigns.",
            weight=INDICATOR_WEIGHTS.get("SUSPICIOUS_TLD", 10),
        ))

    # 4. Free Cloud Tunnel / Disposable Hosting
    if any(h in hostname for h in FREE_HOSTING_TUNNEL_DOMAINS):
        finding.risk_flags.append("FREE_HOSTING_TUNNEL")
        link_risk += 7.0
        threats.append("Disposable Cloud Host")
        indicators.append(Indicator(
            code=IndicatorCode.FREE_HOSTING_PHISHING,
            severity=Severity.HIGH,
            source=DetectionSource.RULE,
            start=start, end=end, text=url,
            reason="Points to disposable free hosting or tunnel infrastructure commonly used to launch ephemeral phishing pages.",
            weight=INDICATOR_WEIGHTS.get("FREE_HOSTING_PHISHING", 10),
        ))

    # 5. IP-literal hostname
    ip_pattern = re.compile(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$')
    if ip_pattern.match(hostname):
        finding.is_ip_host = True
        finding.risk_flags.append("IP_HOST")
        link_risk += 8.0
        threats.append("Raw IP Address Host")
        indicators.append(Indicator(
            code=IndicatorCode.IP_HOST,
            severity=Severity.HIGH,
            source=DetectionSource.RULE,
            start=start, end=end, text=url,
            reason="The link uses an IP address instead of a domain name. Legitimate corporate or student services use proper domains.",
            weight=INDICATOR_WEIGHTS.get("IP_HOST", 8),
        ))

    # 6. Punycode detection
    if hostname.startswith("xn--") or any(part.startswith("xn--") for part in domain_parts):
        finding.is_punycode = True
        finding.risk_flags.append("PUNYCODE_HOST")
        link_risk += 6.0
        threats.append("Punycode Character Disguise")
        indicators.append(Indicator(
            code=IndicatorCode.PUNYCODE_HOST,
            severity=Severity.MEDIUM,
            source=DetectionSource.RULE,
            start=start, end=end, text=url,
            reason="Uses internationalized encoding (punycode) which can disguise look-alike characters (homograph attack).",
            weight=INDICATOR_WEIGHTS.get("PUNYCODE_HOST", 6),
        ))

    # 7. Brand impersonation / Typosquatting
    is_impersonation = False
    for pat in BRAND_PATTERNS:
        if re.search(pat, hostname, re.IGNORECASE) and base_domain not in VERIFIED_OFFICIAL_DOMAINS:
            is_impersonation = True
            break

    if is_impersonation:
        finding.risk_flags.append("IMPERSONATED_BRAND")
        link_risk += 12.0
        threats.append("Brand Spoofing / Impersonation")
        indicators.append(Indicator(
            code=IndicatorCode.IMPERSONATED_BRAND,
            severity=Severity.HIGH,
            source=DetectionSource.RULE,
            start=start, end=end, text=url,
            reason="The link mimics a trusted brand or bank name on an unverified domain to trick students into trusting it.",
            weight=INDICATOR_WEIGHTS.get("IMPERSONATED_BRAND", 14),
        ))

    # 8. Suspicious tokens in URL path/params
    url_tokens = set(re.findall(r'[a-z]+', full_url_lower))
    suspicious_found = url_tokens & SUSPICIOUS_TOKENS
    if len(suspicious_found) >= 2:
        finding.has_suspicious_tokens = True
        finding.risk_flags.append("SUSPICIOUS_TOKENS")
        link_risk += 4.0
        threats.append(f"Phishing Keywords ({', '.join(sorted(suspicious_found)[:2])})")
        indicators.append(Indicator(
            code=IndicatorCode.SUSPICIOUS_LINK,
            severity=Severity.MEDIUM,
            source=DetectionSource.RULE,
            start=start, end=end, text=url,
            reason=f"The link contains high-risk keywords: {', '.join(sorted(suspicious_found)[:3])}.",
            weight=INDICATOR_WEIGHTS.get("SUSPICIOUS_LINK", 8),
        ))

    # 9. Insecure HTTP
    if not url.lower().startswith("https://"):
        finding.risk_flags.append("NO_HTTPS")
        link_risk += 1.5

    # 10. Excessive Subdomains or Hyphens
    if len(domain_parts) > 4 or hostname.count("-") >= 2:
        finding.risk_flags.append("SUSPICIOUS_DOMAIN_STRUCTURE")
        link_risk += 3.0
        threats.append("Excessive Hyphens/Subdomains")

    # Set composite link score & safety verdict
    finding.risk_score = round(link_risk, 1)

    if link_risk >= 8.0:
        finding.safety_verdict = "High Risk"
        finding.threat_type = threats[0] if threats else "Phishing Link"
        finding.risk_explanation = f"Flagged as High Risk: {'; '.join(threats)}."
    elif link_risk >= 3.0:
        finding.safety_verdict = "Suspicious"
        finding.threat_type = threats[0] if threats else "Unverified Link"
        finding.risk_explanation = f"Flagged as Suspicious: {'; '.join(threats)}."
    else:
        finding.safety_verdict = "Neutral / Unverified"
        finding.threat_type = "Standard External Link"
        finding.risk_explanation = "No major blacklist or phishing indicators found. Still exercise caution."

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
