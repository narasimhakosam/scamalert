"""
Unit and integration test runner for ScamGuard AI.
Runs all tests and reports pass/fail status with execution timing.
"""

import sys
import time
from pathlib import Path

# Add backend to sys.path
backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from tests.test_engine import (
    test_preprocessor_basic,
    test_payment_request_indicator,
    test_otp_request_indicator,
    test_shortened_url_detection,
    test_risk_engine_scoring_high_risk,
    test_risk_engine_scoring_safe,
    test_recommendation_generation
)

TESTS = [
    ("Preprocessor basic normalization", test_preprocessor_basic),
    ("Payment request indicator detection", test_payment_request_indicator),
    ("OTP request indicator detection", test_otp_request_indicator),
    ("Shortened URL extraction & analysis", test_shortened_url_detection),
    ("Risk engine high-risk scoring", test_risk_engine_scoring_high_risk),
    ("Risk engine safe message scoring", test_risk_engine_scoring_safe),
    ("Defensive safety recommendation generation", test_recommendation_generation),
]

def run_all():
    print("=" * 65)
    print("  Student ScamGuard AI — Test Suite Runner")
    print("=" * 65)
    
    passed = 0
    failed = 0
    start_all = time.time()
    
    for name, func in TESTS:
        t0 = time.time()
        try:
            func()
            elapsed = (time.time() - t0) * 1000
            print(f"  [PASS] {name} ({elapsed:.1f}ms)")
            passed += 1
        except Exception as e:
            elapsed = (time.time() - t0) * 1000
            print(f"  [FAIL] {name}: {e} ({elapsed:.1f}ms)")
            failed += 1
            
    total_time = (time.time() - start_all) * 1000
    print("-" * 65)
    print(f"  Results: {passed} passed, {failed} failed in {total_time:.1f}ms")
    print("=" * 65)
    
    return failed == 0

if __name__ == "__main__":
    success = run_all()
    sys.exit(0 if success else 1)
