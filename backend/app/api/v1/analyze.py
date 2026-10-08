"""
Analyze API endpoint — POST /api/v1/analyze/message
"""

from fastapi import APIRouter, HTTPException
from app.schemas.analyze import AnalysisRequest, AnalysisResponse, ErrorResponse
from app.services.orchestrator import analyze_message

router = APIRouter()


@router.post(
    "/analyze/message",
    response_model=AnalysisResponse,
    responses={
        400: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Analyze a suspicious SMS/WhatsApp message",
    description="Submit a message for AI-powered scam analysis. Returns risk score, highlighted evidence, explanations, and safety actions.",
)
async def analyze(request: AnalysisRequest):
    """Analyze a suspicious message for scam indicators."""
    try:
        msg_text = request.get_message_text()
        src = request.get_source()

        result = analyze_message(
            message=msg_text,
            source=src,
        )

        # Build highlight objects
        highlights_list = [
            {
                "start": h["start"],
                "end": h["end"],
                "start_idx": h["start"],
                "end_idx": h["end"],
                "text": h["text"],
                "matched_text": h["text"],
                "indicator_code": h["indicator_code"],
                "code": h["indicator_code"],
                "title": h["indicator_code"].replace("_", " ").title(),
                "severity": h["severity"],
                "reason": h["reason"],
                "description": h["reason"],
            }
            for h in result.highlights
        ]

        # Build link objects
        links_list = [
            {
                "url": l["url"],
                "original_url": l["url"],
                "domain": l["url"].replace("https://", "").replace("http://", "").split("/")[0],
                "start": l["start"],
                "end": l["end"],
                "risk_flags": l["risk_flags"],
                "is_shortened": l.get("is_shortened", "SHORTENED_LINK" in l.get("risk_flags", [])),
                "is_suspicious": l.get("is_suspicious", len(l.get("risk_flags", [])) > 0),
                "safety_verdict": l.get("safety_verdict", "Neutral / Unverified"),
                "threat_type": l.get("threat_type", "External Link"),
                "risk_score": l.get("risk_score", 0.0),
                "risk_explanation": l.get("risk_explanation", ""),
            }
            for l in result.links
        ]

        # Build structured indicators
        indicators_list = [
            {
                "code": h["indicator_code"],
                "title": h["indicator_code"].replace("_", " ").title(),
                "severity": h["severity"],
                "description": h["reason"],
                "matched_text": h["text"],
            }
            for h in result.highlights
        ]

        # Build safety action items
        actions_list = [
            {
                "step": idx + 1,
                "action": act.split(".")[0] if "." in act else act[:40],
                "description": act,
            }
            for idx, act in enumerate(result.recommended_actions)
        ]

        # ML prediction info
        ml_info = {
            "label": result.ml_label,
            "spam_probability": result.ml_probability,
            "ham_probability": round(1.0 - result.ml_probability, 4),
        }

        return AnalysisResponse(
            analysis_id=result.analysis_id,
            model_version=result.model_version,
            dataset_version=result.dataset_version,
            ruleset_version=result.ruleset_version,
            risk_score=result.risk_score,
            classification=result.classification.value,
            scam_category=getattr(result, "scam_category", "General Alert"),
            ml_label=result.ml_label,
            ml_probability=result.ml_probability,
            ml_prediction=ml_info,
            highlights=highlights_list,
            evidence_spans=highlights_list,
            links=links_list,
            extracted_urls=links_list,
            indicators=indicators_list,
            reasons=result.reasons,
            recommended_actions=result.recommended_actions,
            safety_actions=actions_list,
            disclaimer=result.disclaimer,
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")

