"""Main FastAPI application for AI Service."""

from typing import Dict
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from app.config import APP_NAME, APP_VERSION
from app.models.request import AIAnalysisBatch
from app.models.response import AnalysisResponse
from app.services.analysis_service import analyze_batch

app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description="Provider-independent AI Service Foundation for Runtime Monitoring"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", status_code=status.HTTP_200_OK, response_model=Dict[str, str])
def health_check() -> Dict[str, str]:
    """Health check endpoint returning service status."""
    return {"status": "ok"}


@app.post("/analyze", status_code=status.HTTP_200_OK, response_model=AnalysisResponse)
def analyze_page_batch(batch: AIAnalysisBatch) -> AnalysisResponse:
    """Accepts a validated AIAnalysisBatch and returns a structured AnalysisResponse."""
    return analyze_batch(batch)
