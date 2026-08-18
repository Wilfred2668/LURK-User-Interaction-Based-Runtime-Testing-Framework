"""Comprehensive test suite for Milestone 3C LLM Provider Integration and Prompt Building."""

import json
import os
import copy
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.request import AIAnalysisBatch
from app.models.response import AnalysisResponse
from app.prompts.builder import build_page_analysis_prompt
from app.providers.base import (
    LLMProvider,
    LLMAuthenticationError,
    LLMTimeoutError,
    LLMRateLimitError,
    LLMInvalidResponseError,
    LLMProviderError
)
from app.providers.groq_provider import GroqProvider
from app.providers.factory import get_llm_provider
from app.services.analysis_service import analyze_batch

client = TestClient(app)

FIXTURE_PATH = os.path.join(os.path.dirname(__file__), "fixtures", "sample_batch.json")


def load_sample_batch() -> dict:
    with open(FIXTURE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def create_mock_groq_completion(content_dict: dict) -> MagicMock:
    """Helper to create a mocked Groq ChatCompletion return object."""
    mock_choice = MagicMock()
    mock_choice.message.content = json.dumps(content_dict)
    mock_completion = MagicMock()
    mock_completion.choices = [mock_choice]
    return mock_completion


# TEST 1 — Provider abstraction can be instantiated
def test_provider_abstraction_can_be_instantiated():
    class DummyProvider(LLMProvider):
        def analyze_batch(self, batch: AIAnalysisBatch) -> AnalysisResponse:
            return AnalysisResponse(
                analysisVersion="3C.1",
                batchId=batch.batchId,
                sessionId=batch.sessionId,
                websiteId=batch.websiteId,
                pageId=batch.pageId,
                status="completed",
                summary="Dummy analysis"
            )

    provider = DummyProvider()
    assert isinstance(provider, LLMProvider)


# TEST 2 — Groq provider configuration is loaded correctly
def test_groq_provider_configuration_is_loaded():
    provider = GroqProvider(
        api_key="gsk_test_12345",
        model="openai/gpt-oss-20b",
        base_url="https://api.groq.com/openai/v1",
        timeout=45.0
    )
    assert provider.api_key == "gsk_test_12345"
    assert provider.model == "openai/gpt-oss-20b"
    assert provider.base_url == "https://api.groq.com"
    assert provider.timeout == 45.0


# TEST 3 — Missing API key is handled safely
def test_missing_api_key_raises_auth_error():
    provider = GroqProvider(api_key="")
    batch = AIAnalysisBatch.model_validate(load_sample_batch())

    with pytest.raises(LLMAuthenticationError) as exc_info:
        provider.analyze_batch(batch)

    assert "GROQ_API_KEY is not configured" in str(exc_info.value)


# TEST 4 — Correct AIAnalysisBatch reaches the provider
def test_correct_batch_reaches_provider():
    batch = AIAnalysisBatch.model_validate(load_sample_batch())
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = create_mock_groq_completion({
        "overallSummary": "Analyzed successfully",
        "findings": []
    })

    provider = GroqProvider(api_key="gsk_test", client=mock_client)
    res = provider.analyze_batch(batch)

    assert res.batchId == batch.batchId
    assert mock_client.chat.completions.create.called
    kwargs = mock_client.chat.completions.create.call_args[1]
    assert kwargs["model"] == "openai/gpt-oss-20b"


# TEST 5 — Prompt contains correct website/page information
def test_prompt_contains_correct_page_context():
    batch = AIAnalysisBatch.model_validate(load_sample_batch())
    sys_prompt, user_prompt = build_page_analysis_prompt(batch)

    assert batch.page.url in user_prompt
    assert batch.website.websiteId in user_prompt
    assert batch.page.pageId in user_prompt
    assert batch.website.origin in user_prompt
    assert "#faq" in user_prompt


# TEST 6 — Prompt excludes unrelated websites
def test_prompt_excludes_unrelated_websites():
    batch = AIAnalysisBatch.model_validate(load_sample_batch())
    _, user_prompt = build_page_analysis_prompt(batch)

    assert "github.com" not in user_prompt
    assert "google.com" not in user_prompt


# TEST 7 — Prompt excludes unrelated pages
def test_prompt_excludes_unrelated_pages():
    batch = AIAnalysisBatch.model_validate(load_sample_batch())
    _, user_prompt = build_page_analysis_prompt(batch)

    assert "page_001" not in user_prompt
    assert "page_003" not in user_prompt


# TEST 8 — Structured provider response is parsed correctly
def test_structured_provider_response_is_parsed():
    batch = AIAnalysisBatch.model_validate(load_sample_batch())
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = create_mock_groq_completion({
        "overallSummary": "Page has moderate network pressure.",
        "engineeringAssessment": "Frequent leaderboard polling observed.",
        "findings": [
            {
                "findingId": "fnd_repeated_network_request_agg_evt_net_01",
                "findingType": "repeated_network_request",
                "category": "network",
                "severity": "medium",
                "title": "Repeated network request detected",
                "observedFact": "10 repeated requests observed.",
                "possibleInterpretation": "Rapid polling or duplicate component renders.",
                "requiredAdditionalContext": "Component lifecycle code.",
                "analysis": "10 repeated requests observed due to potential rapid polling.",
                "confidence": 0.95,
                "evidence": {
                    "count": 10,
                    "eventIds": ["evt_net_01"]
                }
            }
        ]
    })

    provider = GroqProvider(api_key="gsk_test", client=mock_client)
    res = provider.analyze_batch(batch)

    assert res.analysisVersion == "3C.1"
    assert res.status == "completed"
    assert res.summary == "Page has moderate network pressure."
    assert res.engineeringAssessment == "Frequent leaderboard polling observed."
    assert len(res.findings) == 1
    assert res.findings[0].findingId == "fnd_repeated_network_request_agg_evt_net_01"


# TEST 9 — Identifiers are preserved in the response
def test_identifiers_preserved_in_llm_response():
    batch = AIAnalysisBatch.model_validate(load_sample_batch())
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = create_mock_groq_completion({
        "overallSummary": "Summary",
        "findings": []
    })

    provider = GroqProvider(api_key="gsk_test", client=mock_client)
    res = provider.analyze_batch(batch)

    assert res.batchId == batch.batchId
    assert res.sessionId == batch.sessionId
    assert res.websiteId == batch.websiteId
    assert res.pageId == batch.pageId


# TEST 10 — Event IDs remain traceable
def test_event_ids_remain_traceable():
    batch = AIAnalysisBatch.model_validate(load_sample_batch())
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = create_mock_groq_completion({
        "overallSummary": "Summary",
        "findings": [
            {
                "findingId": "fnd_repeated_network_request_agg_evt_net_01",
                "findingType": "repeated_network_request",
                "category": "network",
                "severity": "medium",
                "title": "Repeated network request",
                "observedFact": "10 requests",
                "possibleInterpretation": "Polling",
                "requiredAdditionalContext": "Code",
                "analysis": "Text",
                "evidence": {
                    "eventIds": ["evt_net_01", "evt_net_02", "evt_net_03"]
                }
            }
        ]
    })

    provider = GroqProvider(api_key="gsk_test", client=mock_client)
    res = provider.analyze_batch(batch)

    assert res.findings[0].evidence["eventIds"] == ["evt_net_01", "evt_net_02", "evt_net_03"]


# TEST 11 — Multiple findings are analyzed correctly
def test_multiple_findings_analyzed():
    batch = AIAnalysisBatch.model_validate(load_sample_batch())
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = create_mock_groq_completion({
        "overallSummary": "Multi-finding summary",
        "findings": [
            {
                "findingId": f.findingId,
                "findingType": f.findingType,
                "category": f.category,
                "severity": f.severity,
                "title": f.title,
                "observedFact": f.description,
                "possibleInterpretation": "Interpretation",
                "requiredAdditionalContext": "Context",
                "analysis": "Analysis text",
                "evidence": f.evidence.model_dump()
            }
            for f in batch.findings
        ]
    })

    provider = GroqProvider(api_key="gsk_test", client=mock_client)
    res = provider.analyze_batch(batch)

    assert len(res.findings) == 3


# TEST 12 — Empty findings handled correctly
def test_empty_findings_handled_in_llm_mode():
    payload = load_sample_batch()
    payload["findings"] = []
    payload["evidence"] = []
    batch = AIAnalysisBatch.model_validate(payload)

    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = create_mock_groq_completion({
        "overallSummary": "No issues detected on this page.",
        "findings": []
    })

    provider = GroqProvider(api_key="gsk_test", client=mock_client)
    res = provider.analyze_batch(batch)

    assert len(res.findings) == 0
    assert "No issues detected" in res.summary


# TEST 13 — Provider timeout is handled safely
def test_provider_timeout_handled():
    from groq import APITimeoutError

    batch = AIAnalysisBatch.model_validate(load_sample_batch())
    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = APITimeoutError(request=MagicMock())

    provider = GroqProvider(api_key="gsk_test", client=mock_client)

    with pytest.raises(LLMTimeoutError):
        provider.analyze_batch(batch)


# TEST 14 — Provider rate-limit error is handled safely
def test_provider_rate_limit_handled():
    from groq import RateLimitError

    batch = AIAnalysisBatch.model_validate(load_sample_batch())
    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = RateLimitError(
        message="Rate limit reached",
        response=MagicMock(status_code=429),
        body={}
    )

    provider = GroqProvider(api_key="gsk_test", client=mock_client)

    with pytest.raises(LLMRateLimitError):
        provider.analyze_batch(batch)


# TEST 15 — Provider API error is handled safely
def test_provider_api_error_handled():
    from groq import APIError

    batch = AIAnalysisBatch.model_validate(load_sample_batch())
    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = APIError(
        message="Internal Groq Error",
        request=MagicMock(),
        body={}
    )

    provider = GroqProvider(api_key="gsk_test", client=mock_client)

    with pytest.raises(LLMProviderError):
        provider.analyze_batch(batch)


# TEST 16 — Malformed LLM response is rejected safely
def test_malformed_llm_response_rejected():
    batch = AIAnalysisBatch.model_validate(load_sample_batch())
    mock_client = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = "Not valid JSON at all!"
    mock_client.chat.completions.create.return_value = MagicMock(choices=[mock_choice])

    provider = GroqProvider(api_key="gsk_test", client=mock_client)

    with pytest.raises(LLMInvalidResponseError) as exc_info:
        provider.analyze_batch(batch)

    assert "Failed to parse Groq response as JSON" in str(exc_info.value)


# TEST 17 — Deterministic 3B analysis still works
def test_deterministic_3b_mode_preserved():
    payload = load_sample_batch()
    batch = AIAnalysisBatch.model_validate(payload)

    # Calling analyze_batch without provider runs deterministic mode
    res = analyze_batch(batch, mode="deterministic")

    assert res.analysisVersion == "3B.1"
    assert res.status == "completed"
    assert len(res.findings) == 3


# TEST 18 — Input AIAnalysisBatch is not mutated
def test_input_batch_not_mutated():
    payload = load_sample_batch()
    payload_copy = copy.deepcopy(payload)
    batch = AIAnalysisBatch.model_validate(payload)

    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = create_mock_groq_completion({
        "overallSummary": "Summary",
        "findings": []
    })
    provider = GroqProvider(api_key="gsk_test", client=mock_client)
    _ = provider.analyze_batch(batch)

    assert batch.model_dump() == AIAnalysisBatch.model_validate(payload_copy).model_dump()


# TEST 19 — No API key or secret appears in logs/responses
def test_no_api_key_in_response():
    test_key = "gsk_super_secret_key_12345"
    batch = AIAnalysisBatch.model_validate(load_sample_batch())

    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = create_mock_groq_completion({
        "overallSummary": "Summary",
        "findings": []
    })
    provider = GroqProvider(api_key=test_key, client=mock_client)
    res = provider.analyze_batch(batch)

    res_json = json.dumps(res.model_dump())
    assert test_key not in res_json


# TEST 20 — Provider-specific fields do not leak into response
def test_provider_specific_fields_do_not_leak():
    batch = AIAnalysisBatch.model_validate(load_sample_batch())
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = create_mock_groq_completion({
        "overallSummary": "Summary",
        "findings": []
    })
    provider = GroqProvider(api_key="gsk_test", client=mock_client)
    res = provider.analyze_batch(batch)

    dump = res.model_dump()
    forbidden = ["apiKey", "model", "temperature", "topP", "systemPrompt", "provider", "prompt"]
    for f in forbidden:
        assert f not in dump


# TEST 21 — Repeated execution with same mock is deterministic
def test_mocked_execution_is_deterministic():
    batch = AIAnalysisBatch.model_validate(load_sample_batch())
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = create_mock_groq_completion({
        "overallSummary": "Deterministic summary",
        "engineeringAssessment": "Assessment",
        "findings": []
    })

    provider = GroqProvider(api_key="gsk_test", client=mock_client)
    run1 = provider.analyze_batch(batch).model_dump()
    run2 = provider.analyze_batch(batch).model_dump()

    assert run1 == run2


# TEST 22 — Multi-website isolation is preserved
def test_multi_website_isolation_preserved():
    batch = AIAnalysisBatch.model_validate(load_sample_batch())
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = create_mock_groq_completion({
        "overallSummary": "Isolated summary",
        "findings": []
    })
    provider = GroqProvider(api_key="gsk_test", client=mock_client)
    res = provider.analyze_batch(batch)

    assert res.websiteId == batch.website.websiteId
    assert "github.com" not in res.summary


# TEST 23 — Full pipeline works with mocked provider
def test_full_mocked_pipeline():
    payload = load_sample_batch()

    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = create_mock_groq_completion({
        "overallSummary": "Full pipeline analysis complete.",
        "engineeringAssessment": "3 findings verified.",
        "findings": [
            {
                "findingId": "fnd_repeated_network_request_agg_evt_net_01",
                "findingType": "repeated_network_request",
                "category": "network",
                "severity": "medium",
                "title": "Repeated network request",
                "observedFact": "Fact",
                "possibleInterpretation": "Interp",
                "requiredAdditionalContext": "Context",
                "analysis": "Analysis",
                "evidence": {"count": 10, "eventIds": ["evt_net_01"]}
            }
        ]
    })

    mock_provider = GroqProvider(api_key="gsk_mock", client=mock_client)
    with patch("app.services.analysis_service.get_llm_provider", return_value=mock_provider):
        response = client.post("/analyze?mode=llm", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["analysisVersion"] == "3C.1"
        assert data["status"] == "completed"
        assert data["summary"] == "Full pipeline analysis complete."


# TEST 24 — Realistic page containing multiple findings produces complete structured LLM analysis
def test_realistic_page_produces_complete_llm_analysis():
    payload = load_sample_batch()
    batch = AIAnalysisBatch.model_validate(payload)

    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = create_mock_groq_completion({
        "overallSummary": "The AI Interns page demonstrates 3 runtime patterns across 2 routes.",
        "engineeringAssessment": "Main thread responsiveness is impacted by an 85ms task while network polling repeats 10 times.",
        "findings": [
            {
                "findingId": "fnd_repeated_network_request_agg_evt_net_01",
                "findingType": "repeated_network_request",
                "category": "network",
                "severity": "medium",
                "title": "Repeated network request detected",
                "observedFact": "Observed 10 identical GET requests to /api/leaderboard within 3 seconds.",
                "possibleInterpretation": "Rapid interval polling or reactive component loops.",
                "requiredAdditionalContext": "Examine state update triggers in the leaderboard widget.",
                "analysis": "10 GET requests occurred rapidly.",
                "confidence": 0.95,
                "evidence": {
                    "count": 10,
                    "url": "https://www.example.com/api/leaderboard",
                    "eventIds": ["evt_net_01", "evt_net_02"]
                }
            },
            {
                "findingId": "fnd_failed_network_request_agg_evt_net_fail",
                "findingType": "failed_network_request",
                "category": "network",
                "severity": "low",
                "title": "HTTP 404 response observed",
                "observedFact": "Observed Client-side HTTP error (HTTP 404 Not Found) for /api/missing-info.",
                "possibleInterpretation": "Dead link or deprecated API endpoint.",
                "requiredAdditionalContext": "Verify backend API route registration.",
                "analysis": "HTTP 404 response detected.",
                "confidence": 1.0,
                "evidence": {
                    "count": 1,
                    "status": 404,
                    "eventIds": ["evt_net_fail"]
                }
            },
            {
                "findingId": "fnd_long_task_agg_evt_p02",
                "findingType": "long_task",
                "category": "performance",
                "severity": "medium",
                "title": "Main thread long task observed",
                "observedFact": "A long task lasting 85ms was observed blocking the execution thread.",
                "possibleInterpretation": "Expensive synchronous computation during FAQ hash navigation.",
                "requiredAdditionalContext": "Profile JavaScript call tree during hash change.",
                "analysis": "Main thread blocked for 85ms.",
                "confidence": 0.95,
                "evidence": {
                    "durationMs": 85,
                    "eventIds": ["evt_p02"]
                }
            }
        ]
    })

    provider = GroqProvider(api_key="gsk_test", client=mock_client)
    res = provider.analyze_batch(batch)

    assert res.analysisVersion == "3C.1"
    assert len(res.findings) == 3
    assert res.engineeringAssessment is not None
    assert "85ms" in res.engineeringAssessment
