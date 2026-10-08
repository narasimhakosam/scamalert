"""
Text preprocessing service — normalizes text and extracts URLs with positions.
"""

import re
import unicodedata
from app.domain.models import PreprocessedMessage

# Comprehensive URL pattern matching schemes, shorteners, messaging redirects,
# high-risk phishing TLDs, bare domains with paths, and IP addresses.
URL_SCHEME_PATTERN = re.compile(
    r'(?:https?://|ftp://|www\.)[^\s<>\[\](){}\'"`,;!]+',
    re.IGNORECASE
)

SHORT_AND_MESSAGING_REDIRECT_PATTERN = re.compile(
    r'\b(?:t\.me|telegram\.me|telegram\.dog|wa\.me|chat\.whatsapp\.com|forms\.gle|'
    r'bit\.ly|tinyurl\.com|goo\.gl|t\.co|is\.gd|buff\.ly|ow\.ly|rb\.gy|cutt\.ly|'
    r'shorturl\.at|tiny\.cc|rebrand\.ly|cutt\.us|bl\.ink|ngrok\.io|ngrok-free\.app|'
    r'pages\.dev|firebaseapp\.com|web\.app|000webhostapp\.com)/[^\s<>\[\](){}\'"`,;!]+',
    re.IGNORECASE
)

SUSPICIOUS_TLD_PATTERN = re.compile(
    r'\b[a-zA-Z0-9][-a-zA-Z0-9]*\.(?:xyz|top|site|online|tk|ml|ga|cf|gq|buzz|icu|vip|live|'
    r'club|work|click|rest|shop|loan|fit|link|monster|fun|bid|cam|trade|racing|download|kim|stream|gdn)'
    r'(?:/[^\s<>\[\](){}\'"`,;!]*)?',
    re.IGNORECASE
)

BARE_DOMAIN_PATH_PATTERN = re.compile(
    r'\b(?:[a-zA-Z0-9][-a-zA-Z0-9]*\.)+(?:com|org|net|in|co|io|edu|gov|ac\.in|edu\.in|gov\.in|co\.in|org\.in|nic\.in)/'
    r'[^\s<>\[\](){}\'"`,;!]+',
    re.IGNORECASE
)

IP_PATTERN = re.compile(
    r'\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)'
    r'(?::\d+)?(?:/[^\s<>\[\](){}\'"`,;!]*)?',
    re.IGNORECASE
)

ALL_URL_PATTERNS = [
    URL_SCHEME_PATTERN,
    SHORT_AND_MESSAGING_REDIRECT_PATTERN,
    SUSPICIOUS_TLD_PATTERN,
    BARE_DOMAIN_PATH_PATTERN,
    IP_PATTERN,
]


def normalize_text(text: str) -> str:
    """Normalize unicode, collapse whitespace, strip."""
    # Normalize unicode (NFKD then NFC) to standardize characters
    text = unicodedata.normalize("NFKC", text)
    # Replace multiple whitespace with single space
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def extract_urls(text: str) -> list[dict]:
    """
    Extract URLs from text with their start/end positions.
    Returns list of {url, start, end}.
    """
    candidates = []

    for pattern in ALL_URL_PATTERNS:
        for match in pattern.finditer(text):
            url = match.group(0).rstrip(".,;:!?)'\"")
            start = match.start()
            end = start + len(url)
            candidates.append({"url": url, "start": start, "end": end})


    # Sort by start ascending, then length descending (prefer longer matches)
    candidates.sort(key=lambda u: (u["start"], -(u["end"] - u["start"])))

    # Deduplicate overlapping spans
    urls = []
    for cand in candidates:
        # Check if overlaps with any already accepted URL
        overlaps = any(
            not (cand["end"] <= accepted["start"] or cand["start"] >= accepted["end"])
            for accepted in urls
        )
        if not overlaps:
            urls.append(cand)

    urls.sort(key=lambda u: u["start"])
    return urls



def preprocess(message: str) -> PreprocessedMessage:
    """Full preprocessing pipeline."""
    normalized = normalize_text(message)
    urls = extract_urls(message)  # Use original text for accurate positions
    return PreprocessedMessage(
        original=message,
        normalized=normalized,
        urls=urls
    )
