import re

URL_PATTERN = re.compile(
    r'(?:https?://|www\.)[^\s<>\[\](){}\'"`,;!]+',
    re.IGNORECASE
)

SHORT_LINK_PATTERN = re.compile(
    r'\b(?:bit\.ly|tinyurl\.com|goo\.gl|t\.co|is\.gd|buff\.ly|ow\.ly|'
    r'rb\.gy|cutt\.ly|shorturl\.at|tiny\.cc|t\.me|wa\.me|forms\.gle)'
    r'/[^\s<>\[\](){}\'"`,;!]+',
    re.IGNORECASE
)

BARE_DOMAIN_PATTERN = re.compile(
    r'\b[a-zA-Z0-9\-\.]+\.(?:com|in|org|net|xyz|top|online|site|co|info|app|tech|club|me|live|store|tk|ml|ga|cf|gq|io|dev|ac\.in|gov\.in)'
    r'(?:/[^\s<>\[\](){}\'"`,;!]*)?',
    re.IGNORECASE
)

UPI_VPA_PATTERN = re.compile(
    r'\b[a-zA-Z0-9\.\-_]+@(?:upi|ybl|okaxis|icici|paytm|axl|ibl|barodampay|sbi|apl|okhdfcbank)\b',
    re.IGNORECASE
)

sample_text = """
Check these links:
1. http://example.com/pay
2. www.google.com/search
3. bit.ly/intern-confirm
4. bare-domain.xyz/test
5. t.me/task_earn_daily
6. https://student.university.ac.in
7. Transfer UPI to internship@ybl or 9876543210@paytm
"""

def test_extract(text):
    candidates = []
    for pattern in [URL_PATTERN, SHORT_LINK_PATTERN, BARE_DOMAIN_PATTERN]:
        for match in pattern.finditer(text):
            url = match.group(0).rstrip(".,;:!?)")
            start = match.start()
            end = start + len(url)
            candidates.append({"url": url, "start": start, "end": end})

    candidates.sort(key=lambda u: (u["start"], -(u["end"] - u["start"])))
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

urls = test_extract(sample_text)
print("EXTRACTED URLS:")
for u in urls:
    print(f"  [{u['start']}-{u['end']}] -> {u['url']}")

vpas = [m.group(0) for m in UPI_VPA_PATTERN.finditer(sample_text)]
print("\nEXTRACTED UPI VPAs:", vpas)
