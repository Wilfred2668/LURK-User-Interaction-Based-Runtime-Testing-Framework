"""Provider abstraction and base classes for LLM integrations."""

from abc import ABC, abstractmethod
from app.models.request import AIAnalysisBatch
from app.models.response import AnalysisResponse


class LLMProviderError(Exception):
    """Base exception for all LLM provider errors."""
    pass


class LLMAuthenticationError(LLMProviderError):
    """Raised when provider credentials are missing or invalid."""
    pass


class LLMTimeoutError(LLMProviderError):
    """Raised when an LLM call exceeds the configured timeout."""
    pass


class LLMRateLimitError(LLMProviderError):
    """Raised when rate limits are exceeded."""
    pass


class LLMInvalidResponseError(LLMProviderError):
    """Raised when the LLM returns invalid or malformed output."""
    pass


class LLMProvider(ABC):
    """Abstract base class for all LLM providers."""

    @abstractmethod
    def analyze_batch(self, batch: AIAnalysisBatch) -> AnalysisResponse:
        """Analyzes an AIAnalysisBatch and returns a validated AnalysisResponse."""
        pass
