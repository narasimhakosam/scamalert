"""
Text preprocessing service — normalizes text and extracts URLs & UPI VPAs with positions.
"""

import re
import unicodedata
from app.domain.models import PreprocessedMessage

# Regex 1: Scheme or www URLs (http://, https://, www.)
URL_PATTERN = re.compile(
    r'(?:https?://|www\.)'            # scheme or www
    r'[^\s<>\[\](){}\'"`,;!]+',       # url body until whitespace or special chars
    re.IGNORECASE
)

# Regex 2: Common URL Shorteners and messaging links
SHORT_LINK_PATTERN = re.compile(
    r'\b(?:bit\.ly|tinyurl\.com|goo\.gl|t\.co|is\.gd|buff\.ly|ow\.ly|'
    r'rb\.gy|cutt\.ly|shorturl\.at|tiny\.cc|t\.me|wa\.me|forms\.gle)'
    r'/[^\s<>\[\](){}\'"`,;!]+',
    re.IGNORECASE
)

# Regex 3: Bare domain names with common TLDs (e.g. bare-domain.xyz/test)
BARE_DOMAIN_PATTERN = re.compile(
    r'\b[a-zA-Z0-9\-\.]+\.(?:com|in|org|net|xyz|top|online|site|co|info|app|tech|club|me|live|store|tk|ml|ga|cf|gq|io|dev|ac\.in|gov\.in)'
    r'(?:/[^\s<>\[\](){}\'"`,;!]*)?',
    re.IGNORECASE
)

# Regex 4: UPI Virtual Payment Addresses (VPAs) commonly used in student scams
UPI_VPA_PATTERN = re.compile(
    r'\b[a-zA-Z0-9\.\-_]+@(?:upi|ybl|okaxis|icici|paytm|axl|ibl|barodampay|sbi|apl|okhdfcbank)\b',
    re.IGNORECASE
)


def normalize_text(text: str) -> str:
    """Normalize unicode, collapse whitespace, strip."""
    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def extract_urls(text: str) -> list[dict]:
    """
    Extract URLs and bare domains from text with their start/end positions.
    Returns list of {url, start, end}.
    """
    candidates = []

    for pattern in [URL_PATTERN, SHORT_LINK_PATTERN, BARE_DOMAIN_PATTERN]:
        for match in pattern.finditer(text):
            url = match.group(0)
            # Strip trailing punctuation that isn't part of the URL
            url = url.rstrip(".,;:!?)")
            start = match.start()
            end = start + len(url)
            # Filter out email addresses or false positives
            if "@" in url and not url.startswith("http"):
                continue
            candidates.append({"url": url, "start": start, "end": end})

    # Sort by start ascending, then length descending (prefer longer matches)
    candidates.sort(key=lambda u: (u["start"], -(u["end"] - u["start"])))

    # Deduplicate overlapping spans
    urls = []
    for cand in candidates:
        overlaps = any(
            not (cand["end"] <= accepted["start"] or cand["start"] >= accepted["end"])
            for accepted in urls
        )
        if not overlaps:
            urls.append(cand)

    urls.sort(key=lambda u: u["start"])
    return urls


def extract_upi_vpas(text: str) -> list[dict]:
    """Extract UPI VPA handles (e.g. internship@ybl, paytm@upi)."""
    vpas = []
    for match in UPI_VPA_PATTERN.finditer(text):
        vpa = match.group(0)
        vpas.append({"vpa": vpa, "start": match.start(), "end": match.end()})
    return vpas


def preprocess(message: str) -> PreprocessedMessage:
    """Full preprocessing pipeline."""
    normalized = normalize_text(message)
    urls = extract_urls(message)
    return PreprocessedMessage(
        original=message,
        normalized=normalized,
        urls=urls
    )
