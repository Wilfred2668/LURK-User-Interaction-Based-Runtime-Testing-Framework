"""Factory for instantiating LLM providers based on configuration."""

from typing import Optional
from app.config import GROQ_API_KEY, LLM_BASE_URL, LLM_MODEL, LLM_PROVIDER, LLM_TIMEOUT_SECONDS
from app.providers.base import LLMProvider
from app.providers.groq_provider import GroqProvider


def get_llm_provider(provider_type: Optional[str] = None) -> Optional[LLMProvider]:
    """Returns the configured LLMProvider instance, or None if in deterministic mode."""
    target = (provider_type or LLM_PROVIDER or "none").lower()

    if target == "groq":
        return GroqProvider(
            api_key=GROQ_API_KEY,
            model=LLM_MODEL,
            base_url=LLM_BASE_URL,
            timeout=LLM_TIMEOUT_SECONDS
        )

    return None
