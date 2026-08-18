"""Main FastAPI application for AI Service."""

from typing import Dict, Optional
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from app.config import APP_NAME, APP_VERSION
from app.models.request import AIAnalysisBatch
from app.models.response import AnalysisResponse
from app.providers.base import (
    LLMAuthenticationError,
    LLMInvalidResponseError,
    LLMProviderError,
    LLMRateLimitError,
    LLMTimeoutError
)
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
def analyze_page_batch(
    batch: AIAnalysisBatch,
    mode: Optional[str] = Query(None, description="Analysis mode: 'deterministic' or 'llm'")
) -> AnalysisResponse:
    """Accepts a validated AIAnalysisBatch and returns a structured AnalysisResponse."""
    try:
        return analyze_batch(batch, mode=mode)
    except LLMAuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"LLM Authentication Failed: {str(e)}"
        )
    except LLMRateLimitError as e:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"LLM Rate Limit Exceeded: {str(e)}"
        )
    except LLMTimeoutError as e:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"LLM Provider Timeout: {str(e)}"
        )
    except LLMInvalidResponseError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"LLM Invalid Response: {str(e)}"
        )
    except LLMProviderError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"LLM Provider Error: {str(e)}"
        )
