"""Groq LLM Provider implementation."""

import json
import re
from typing import Any, Dict, List, Optional
from groq import Groq, APIError, APITimeoutError, AuthenticationError, RateLimitError

from app.models.request import AIAnalysisBatch
from app.models.response import AnalysisResponse, FindingAnalysisItem
from app.prompts.builder import build_page_analysis_prompt
from app.providers.base import (
    LLMProvider,
    LLMProviderError,
    LLMAuthenticationError,
    LLMTimeoutError,
    LLMRateLimitError,
    LLMInvalidResponseError
)


def _clean_json_markdown(text: str) -> str:
    """Strips ```json markdown fences if present."""
    text = text.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return text


class GroqProvider(LLMProvider):
    """Groq implementation of LLMProvider."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "openai/gpt-oss-20b",
        base_url: str = "https://api.groq.com/openai/v1",
        timeout: float = 30.0,
        client: Optional[Groq] = None
    ) -> None:
        # Strip /openai/v1 or /v1 suffix if present since groq SDK automatically appends it
        cleaned_base_url = (base_url or "https://api.groq.com").rstrip("/")
        if cleaned_base_url.endswith("/openai/v1"):
            cleaned_base_url = cleaned_base_url[:-10]
        elif cleaned_base_url.endswith("/v1"):
            cleaned_base_url = cleaned_base_url[:-3]

        self.api_key = api_key or ""
        self.model = model
        self.base_url = cleaned_base_url
        self.timeout = timeout

        if client is not None:
            self._client = client
        elif self.api_key:
            self._client = Groq(
                api_key=self.api_key,
                base_url=self.base_url,
                timeout=self.timeout
            )
        else:
            self._client = None

    def analyze_batch(self, batch: AIAnalysisBatch) -> AnalysisResponse:
        """Invokes Groq API to analyze the AIAnalysisBatch."""
        if not self.api_key and self._client is None:
            raise LLMAuthenticationError("GROQ_API_KEY is not configured or is empty.")

        client = self._client or Groq(
            api_key=self.api_key,
            base_url=self.base_url,
            timeout=self.timeout
        )

        system_prompt, user_prompt = build_page_analysis_prompt(batch)

        try:
            chat_completion = client.chat.completions.create(
                model=self.model,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.1
            )
        except AuthenticationError as e:
            raise LLMAuthenticationError(f"Groq authentication failed: {e.message if hasattr(e, 'message') else 'Invalid API Key'}")
        except RateLimitError as e:
            raise LLMRateLimitError(f"Groq rate limit exceeded: {e.message if hasattr(e, 'message') else 'Rate limited'}")
        except APITimeoutError as e:
            raise LLMTimeoutError(f"Groq request timed out after {self.timeout}s")
        except APIError as e:
            raise LLMProviderError(f"Groq API error ({getattr(e, 'status_code', 'unknown')}): {getattr(e, 'message', str(e))}")
        except Exception as e:
            raise LLMProviderError(f"Unexpected error communicating with Groq: {str(e)}")

        choices = getattr(chat_completion, "choices", [])
        if not choices or not choices[0].message or not choices[0].message.content:
            raise LLMInvalidResponseError("Groq returned an empty response.")

        raw_content = choices[0].message.content
        cleaned_json = _clean_json_markdown(raw_content)

        try:
            parsed_data: Dict[str, Any] = json.loads(cleaned_json)
        except json.JSONDecodeError as e:
            raise LLMInvalidResponseError(f"Failed to parse Groq response as JSON: {str(e)}")

        if not isinstance(parsed_data, dict):
            raise LLMInvalidResponseError("Groq response root is not a JSON object.")

        # Reconstruct structured findings with fallback to input evidence
        input_findings_map = {f.findingId: f for f in batch.findings}
        analyzed_findings: List[FindingAnalysisItem] = []

        llm_findings = parsed_data.get("findings", [])
        if not isinstance(llm_findings, list):
            llm_findings = []

        for item in llm_findings:
            if not isinstance(item, dict):
                continue

            finding_id = item.get("findingId", "")
            original_finding = input_findings_map.get(finding_id)

            finding_type = item.get("findingType") or (original_finding.findingType if original_finding else "unknown")
            category = item.get("category") or (original_finding.category if original_finding else "unknown")
            severity = item.get("severity") or (original_finding.severity if original_finding else "info")
            title = item.get("title") or (original_finding.title if original_finding else "Finding Analysis")
            observed_fact = item.get("observedFact") or (original_finding.description if original_finding else "")
            possible_interp = item.get("possibleInterpretation") or ""
            req_context = item.get("requiredAdditionalContext") or ""
            analysis_text = item.get("analysis") or f"{observed_fact} {possible_interp} {req_context}".strip()
            confidence = item.get("confidence") or (original_finding.confidence if original_finding else 0.9)
            likely_impact = item.get("likelyImpact")

            evidence_dict: Dict[str, Any] = item.get("evidence", {})
            if not evidence_dict and original_finding:
                evidence_dict = original_finding.evidence.model_dump()

            analyzed_findings.append(
                FindingAnalysisItem(
                    findingId=finding_id or f"fnd_llm_{len(analyzed_findings)}",
                    findingType=finding_type,
                    category=category,
                    severity=severity,
                    title=title,
                    observedFact=observed_fact,
                    possibleInterpretation=possible_interp,
                    requiredAdditionalContext=req_context,
                    analysis=analysis_text,
                    confidence=confidence,
                    likelyImpact=likely_impact,
                    evidence=evidence_dict
                )
            )

        overall_summary = parsed_data.get("overallSummary") or f"AI Analysis completed for page {batch.page.url}."
        engineering_assessment = parsed_data.get("engineeringAssessment")

        return AnalysisResponse(
            analysisVersion="3C.1",
            batchId=batch.batchId,
            sessionId=batch.sessionId,
            websiteId=batch.websiteId,
            pageId=batch.pageId,
            status="completed",
            summary=overall_summary,
            engineeringAssessment=engineering_assessment,
            findings=analyzed_findings
        )
