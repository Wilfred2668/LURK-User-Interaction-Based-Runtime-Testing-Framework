"""Pydantic response models for AI Service analysis responses."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class FindingAnalysisItem(BaseModel):
    findingId: str = Field(..., min_length=1)
    findingType: str = Field(..., min_length=1)
    category: str = Field(..., min_length=1)
    severity: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    observedFact: str = Field(..., min_length=1)
    possibleInterpretation: str = Field(..., min_length=1)
    requiredAdditionalContext: str = Field(..., min_length=1)
    analysis: str = Field(..., min_length=1)
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    likelyImpact: Optional[str] = None
    evidence: Dict[str, Any] = Field(default_factory=dict)


class AnalysisResponse(BaseModel):
    analysisVersion: str = Field(default="3C.1")
    batchId: str = Field(..., min_length=1)
    sessionId: str = Field(..., min_length=1)
    websiteId: str = Field(..., min_length=1)
    pageId: str = Field(..., min_length=1)
    status: str = Field(default="completed")
    summary: str = Field(..., min_length=1)
    engineeringAssessment: Optional[str] = None
    findings: List[FindingAnalysisItem] = Field(default_factory=list)
