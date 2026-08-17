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
    evidence: Dict[str, Any] = Field(default_factory=dict)


class AnalysisResponse(BaseModel):
    analysisVersion: str = "3B.1"
    batchId: str = Field(..., min_length=1)
    sessionId: str = Field(..., min_length=1)
    websiteId: str = Field(..., min_length=1)
    pageId: str = Field(..., min_length=1)
    status: str = "completed"
    summary: str = Field(..., min_length=1)
    findings: List[FindingAnalysisItem] = Field(default_factory=list)
