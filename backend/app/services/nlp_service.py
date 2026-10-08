"""
NLP spam classifier service — loads the trained model and predicts spam probability.
"""

import logging
from pathlib import Path

import joblib
import numpy as np

from app.config import MODEL_PATH, VECTORIZER_PATH, MODEL_METADATA_PATH, MODEL_VERSION
from app.domain.models import MLPrediction

logger = logging.getLogger(__name__)

# Global model instances — loaded once at startup
_model = None
_vectorizer = None
_metadata = None


def load_model() -> bool:
    """Load the trained model and vectorizer from disk. Returns True on success."""
    global _model, _vectorizer, _metadata
    try:
        if not MODEL_PATH.exists() or not VECTORIZER_PATH.exists():
            logger.warning("Model artifacts not found at %s — ML predictions will be unavailable", MODEL_PATH)
            return False

        _model = joblib.load(MODEL_PATH)
        _vectorizer = joblib.load(VECTORIZER_PATH)

        if MODEL_METADATA_PATH.exists():
            import json
            with open(MODEL_METADATA_PATH, "r") as f:
                _metadata = json.load(f)

        logger.info("ML model loaded successfully: %s", MODEL_VERSION)
        return True
    except Exception as e:
        logger.error("Failed to load ML model: %s", str(e))
        return False


def is_model_loaded() -> bool:
    """Check if the model is available."""
    return _model is not None and _vectorizer is not None


def get_model_metadata() -> dict | None:
    """Return model training metadata."""
    return _metadata


def predict(text: str) -> MLPrediction:
    """
    Predict spam/ham classification for the given text.
    Returns MLPrediction with label and probabilities.
    """
    if not is_model_loaded():
        # Fallback: return neutral prediction if model not loaded
        logger.warning("Model not loaded, returning neutral prediction")
        return MLPrediction(label="unknown", spam_probability=0.5, ham_probability=0.5)

    # Vectorize the text
    text_vectorized = _vectorizer.transform([text])

    # Get predicted probabilities
    probabilities = _model.predict_proba(text_vectorized)[0]
    classes = list(_model.classes_)

    spam_idx = classes.index("spam") if "spam" in classes else 1
    ham_idx = classes.index("ham") if "ham" in classes else 0

    spam_prob = float(probabilities[spam_idx])
    ham_prob = float(probabilities[ham_idx])
    label = "spam" if spam_prob > ham_prob else "ham"

    return MLPrediction(
        label=label,
        spam_probability=round(spam_prob, 4),
        ham_probability=round(ham_prob, 4)
    )
