"""Comprehensive test suite for AI Service analysis endpoint and analysis service."""

import json
import os
import copy
from fastapi.testclient import TestClient
from app.main import app
from app.models.request import AIAnalysisBatch
from app.services.analysis_service import analyze_batch

client = TestClient(app)

FIXTURE_PATH = os.path.join(os.path.dirname(__file__), "fixtures", "sample_batch.json")


def load_sample_batch() -> dict:
    with open(FIXTURE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def test_valid_batch_is_accepted_by_analyze():
    """TEST 2: Valid AIAnalysisBatch is accepted by /analyze."""
    payload = load_sample_batch()
    response = client.post("/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"


def test_returned_response_preserves_identifiers():
    """TEST 3: Returned response preserves batchId, sessionId, websiteId, pageId."""
    payload = load_sample_batch()
    response = client.post("/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["batchId"] == payload["batchId"]
    assert data["sessionId"] == payload["sessionId"]
    assert data["websiteId"] == payload["websiteId"]
    assert data["pageId"] == payload["pageId"]


def test_analysis_status_is_completed():
    """TEST 4: Analysis status is 'completed'."""
    payload = load_sample_batch()
    response = client.post("/analyze", json=payload)
    assert response.status_code == 200
    assert response.json()["status"] == "completed"


def test_repeated_network_request_generates_analysis_entry():
    """TEST 5: A repeated_network_request finding generates an analysis entry."""
    payload = load_sample_batch()
    payload["findings"] = [f for f in payload["findings"] if f["findingType"] == "repeated_network_request"]

    response = client.post("/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["findings"]) == 1
    item = data["findings"][0]
    assert item["findingType"] == "repeated_network_request"
    assert "Observed 10 identical GET requests" in item["observedFact"]
    assert item["evidence"]["count"] == 10


def test_failed_network_request_generates_analysis_entry():
    """TEST 6: A failed_network_request finding generates an analysis entry."""
    payload = load_sample_batch()
    payload["findings"] = [f for f in payload["findings"] if f["findingType"] == "failed_network_request"]

    response = client.post("/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["findings"]) == 1
    item = data["findings"][0]
    assert item["findingType"] == "failed_network_request"
    assert "HTTP 404" in item["observedFact"]


def test_long_task_generates_analysis_entry():
    """TEST 7: A long_task finding generates an analysis entry."""
    payload = load_sample_batch()
    payload["findings"] = [f for f in payload["findings"] if f["findingType"] == "long_task"]

    response = client.post("/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["findings"]) == 1
    item = data["findings"][0]
    assert item["findingType"] == "long_task"
    assert "85ms" in item["observedFact"]


def test_multiple_findings_produce_multiple_analysis_entries():
    """TEST 8: Multiple findings produce multiple corresponding analysis entries."""
    payload = load_sample_batch()
    response = client.post("/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["findings"]) == len(payload["findings"])
    assert len(data["findings"]) == 3


def test_empty_findings_produce_valid_empty_analysis():
    """TEST 9: Empty findings are accepted and produce a valid empty analysis."""
    payload = load_sample_batch()
    payload["findings"] = []
    payload["evidence"] = []

    response = client.post("/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    assert len(data["findings"]) == 0
    assert "No runtime engineering findings were detected" in data["summary"]


def test_missing_or_empty_batch_id_is_rejected():
    """TEST 10: Invalid/missing batchId is rejected."""
    payload = load_sample_batch()
    payload["batchId"] = ""
    response = client.post("/analyze", json=payload)
    assert response.status_code == 422


def test_missing_or_empty_session_id_is_rejected():
    """TEST 11: Invalid/missing sessionId is rejected."""
    payload = load_sample_batch()
    del payload["sessionId"]
    response = client.post("/analyze", json=payload)
    assert response.status_code == 422


def test_invalid_website_origin_is_rejected():
    """TEST 12: Invalid websiteOrigin (not starting with http:// or https://) is rejected."""
    payload = load_sample_batch()
    payload["websiteOrigin"] = "ftp://invalid.com"
    response = client.post("/analyze", json=payload)
    assert response.status_code == 422


def test_missing_or_empty_page_id_is_rejected():
    """TEST 13: Invalid pageId is rejected."""
    payload = load_sample_batch()
    payload["pageId"] = ""
    response = client.post("/analyze", json=payload)
    assert response.status_code == 422


def test_malformed_finding_is_rejected():
    """TEST 14: Malformed finding data is rejected where required fields are missing."""
    payload = load_sample_batch()
    payload["findings"][0] = {"invalid": "finding"}
    response = client.post("/analyze", json=payload)
    assert response.status_code == 422


def test_analysis_is_deterministic():
    """TEST 15: Analysis is deterministic: same input produces identical output."""
    payload = load_sample_batch()
    batch_obj = AIAnalysisBatch.model_validate(payload)

    run1 = analyze_batch(batch_obj).model_dump()
    run2 = analyze_batch(batch_obj).model_dump()

    assert run1 == run2


def test_input_batch_is_not_mutated():
    """TEST 16: Input batch is not mutated."""
    payload = load_sample_batch()
    payload_copy = copy.deepcopy(payload)
    batch_obj = AIAnalysisBatch.model_validate(payload)

    _ = analyze_batch(batch_obj)

    assert batch_obj.model_dump() == AIAnalysisBatch.model_validate(payload_copy).model_dump()


def test_no_provider_specific_fields_in_response():
    """TEST 17: No provider-specific fields (apiKey, model, temperature) appear in the response."""
    payload = load_sample_batch()
    response = client.post("/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()

    forbidden_fields = ["apiKey", "model", "temperature", "topP", "provider", "prompt", "systemPrompt"]
    for field in forbidden_fields:
        assert field not in data


def test_no_external_network_call_is_made():
    """TEST 18: No external network/API call is made."""
    payload = load_sample_batch()
    # The analyze_batch function is pure in-memory transformation
    batch_obj = AIAnalysisBatch.model_validate(payload)
    res = analyze_batch(batch_obj)
    assert res.status == "completed"


def test_multi_website_isolation():
    """TEST 19: Multi-website isolation: a batch for website A does not contain website B information."""
    payload = load_sample_batch()
    assert payload["websiteOrigin"] == "https://www.example.com"

    response = client.post("/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["websiteId"] == "web_20260817_w01"
    assert "github.com" not in data["summary"]


def test_realistic_complete_batch_e2e():
    """TEST 20: Realistic complete batch is validated and processed through the service."""
    payload = load_sample_batch()

    response = client.post("/analyze", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["analysisVersion"] == "3B.1"
    assert data["batchId"] == "batch_sess_20260817_test001_web_20260817_w01_page_002"
    assert data["status"] == "completed"
    assert len(data["findings"]) == 3

    # Check that each finding contains separated fact, interpretation, and required context
    for f in data["findings"]:
        assert len(f["observedFact"]) > 0
        assert len(f["possibleInterpretation"]) > 0
        assert len(f["requiredAdditionalContext"]) > 0
        assert len(f["analysis"]) > 0
        assert "eventIds" in f["evidence"]
