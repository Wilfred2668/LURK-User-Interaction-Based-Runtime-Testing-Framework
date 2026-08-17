"""Pydantic request models representing the AIAnalysisBatch contract from Milestone 3A."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


class SessionMetadata(BaseModel):
    sessionId: str = Field(..., min_length=1)
    status: str = Field(..., min_length=1)
    startedAt: str = Field(..., min_length=1)
    endedAt: str = Field(..., min_length=1)
    durationMs: float = Field(..., ge=0)
    rootUrl: Optional[str] = None
    activeTabId: Optional[int] = None


class WebsiteIdentity(BaseModel):
    websiteId: str = Field(..., min_length=1)
    origin: str = Field(..., min_length=1)
    firstSeenAt: str = Field(..., min_length=1)
    lastSeenAt: str = Field(..., min_length=1)


class PageIdentity(BaseModel):
    pageId: str = Field(..., min_length=1)
    websiteId: str = Field(..., min_length=1)
    websiteOrigin: str = Field(..., min_length=1)
    sessionId: str = Field(..., min_length=1)
    tabId: int
    url: str = Field(..., min_length=1)
    title: str = ""
    createdAt: str = Field(..., min_length=1)


class RouteItem(BaseModel):
    routeId: str = Field(..., min_length=1)
    pageId: str = Field(..., min_length=1)
    websiteId: str = Field(..., min_length=1)
    websiteOrigin: str = Field(..., min_length=1)
    sessionId: str = Field(..., min_length=1)
    tabId: int
    url: str = Field(..., min_length=1)
    path: str = ""
    hash: str = ""
    navigationType: str = Field(..., min_length=1)
    timestamp: str = Field(..., min_length=1)


class FindingContext(BaseModel):
    sessionId: str = Field(..., min_length=1)
    websiteId: str = Field(..., min_length=1)
    websiteOrigin: str = Field(..., min_length=1)
    pageId: str = Field(..., min_length=1)
    routeId: Optional[str] = None
    tabId: Optional[int] = None


class FindingEvidence(BaseModel):
    aggregationId: str = Field(..., min_length=1)
    eventIds: List[str] = Field(default_factory=list)
    count: int = Field(..., ge=1)
    firstSeenAt: str = Field(..., min_length=1)
    lastSeenAt: str = Field(..., min_length=1)
    timeSpanMs: float = Field(default=0, ge=0)
    url: Optional[str] = None
    method: Optional[str] = None
    status: Optional[int] = None
    statusText: Optional[str] = None
    failureType: Optional[str] = None
    errorMessage: Optional[str] = None
    durationMs: Optional[float] = None
    level: Optional[str] = None
    message: Optional[str] = None
    initiatorType: Optional[str] = None
    decodedBodySize: Optional[int] = None
    encodedBodySize: Optional[int] = None
    transferSize: Optional[int] = None
    startTime: Optional[float] = None


class FindingItem(BaseModel):
    findingId: str = Field(..., min_length=1)
    findingType: str = Field(..., min_length=1)
    category: str = Field(..., min_length=1)
    severity: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)
    confidence: float = Field(..., ge=0.0, le=1.0)
    context: FindingContext
    evidence: FindingEvidence
    metadata: Optional[Dict[str, Any]] = None


class SampledEvidenceItem(BaseModel):
    findingId: str = Field(..., min_length=1)
    findingType: str = Field(..., min_length=1)
    category: str = Field(..., min_length=1)
    severity: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)
    confidence: float = Field(..., ge=0.0, le=1.0)
    evidence: FindingEvidence
    sampledEventIds: List[str] = Field(default_factory=list)
    representativeData: Optional[Any] = None


class PageSummaryModel(BaseModel):
    consoleErrors: int = Field(default=0, ge=0)
    consoleWarnings: int = Field(default=0, ge=0)
    networkFailures: int = Field(default=0, ge=0)
    repeatedRequests: int = Field(default=0, ge=0)
    slowRequests: int = Field(default=0, ge=0)
    slowResources: int = Field(default=0, ge=0)
    largeResources: int = Field(default=0, ge=0)
    longTasks: int = Field(default=0, ge=0)
    slowNavigations: int = Field(default=0, ge=0)


class BatchMetadataModel(BaseModel):
    schemaVersion: str = Field(..., min_length=1)
    generatedAt: Optional[str] = None
    eventCount: int = Field(default=0, ge=0)
    findingCount: int = Field(default=0, ge=0)
    patternCount: int = Field(default=0, ge=0)


class AIAnalysisBatch(BaseModel):
    schemaVersion: str = Field(..., min_length=1)
    batchId: str = Field(..., min_length=1)
    sessionId: str = Field(..., min_length=1)
    websiteId: str = Field(..., min_length=1)
    websiteOrigin: str = Field(..., min_length=1)
    pageId: str = Field(..., min_length=1)
    session: SessionMetadata
    website: WebsiteIdentity
    page: PageIdentity
    routes: List[RouteItem] = Field(default_factory=list)
    findings: List[FindingItem] = Field(default_factory=list)
    evidence: List[SampledEvidenceItem] = Field(default_factory=list)
    summary: PageSummaryModel
    metadata: BatchMetadataModel

    @field_validator("websiteOrigin")
    @classmethod
    def validate_website_origin(cls, v: str) -> str:
        if not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("websiteOrigin must start with http:// or https://")
        return v
