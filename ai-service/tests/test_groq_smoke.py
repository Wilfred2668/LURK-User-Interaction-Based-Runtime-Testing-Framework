"""Optional real Groq smoke test.

This test is SKIPPED by default.
It only executes when explicitly enabled via:
    RUN_LLM_SMOKE_TEST=true GROQ_API_KEY=... pytest tests/test_groq_smoke.py
"""

import json
import os
import pytest
from app.models.request import AIAnalysisBatch
from app.providers.groq_provider import GroqProvider

FIXTURE_PATH = os.path.join(os.path.dirname(__file__), "fixtures", "sample_batch.json")


def test_real_groq_smoke():
    """Smoke test against the live Groq API (opt-in only)."""
    should_run = os.getenv("RUN_LLM_SMOKE_TEST", "").lower() in ("true", "1", "yes")
    api_key = os.getenv("GROQ_API_KEY", "")

    if not should_run:
        pytest.skip("Groq smoke test skipped. Set RUN_LLM_SMOKE_TEST=true to run.")

    if not api_key:
        pytest.skip("GROQ_API_KEY is not set in environment.")

    with open(FIXTURE_PATH, "r", encoding="utf-8") as f:
        payload = json.load(f)

    batch = AIAnalysisBatch.model_validate(payload)
    provider = GroqProvider(api_key=api_key)

    response = provider.analyze_batch(batch)

    assert response.status == "completed"
    assert response.batchId == batch.batchId
    assert len(response.summary) > 0
    assert len(response.findings) == len(batch.findings)
