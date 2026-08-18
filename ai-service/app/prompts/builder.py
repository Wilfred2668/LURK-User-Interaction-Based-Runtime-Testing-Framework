"""Prompt construction module for AI Analysis."""

import json
from typing import Tuple
from app.models.request import AIAnalysisBatch

SYSTEM_PROMPT = """You are an expert Runtime Monitoring Analysis Engine.
Your task is to analyze the provided page-level runtime monitoring batch containing engineering findings and observable evidence.

CRITICAL INSTRUCTIONS:
1. Base your analysis STRICTLY on the supplied evidence. Do NOT invent facts or assume behaviors not captured in the telemetry.
2. Clearly distinguish:
   - observedFact: The factual, observable measurement.
   - possibleInterpretation: Technical interpretations or possibilities (e.g. polling intervals, missing debouncing, unhandled promise rejections).
   - requiredAdditionalContext: Specific application source code, configuration, or backend telemetry needed to confirm the cause.
3. Preserve all findingId, findingType, category, severity, and evidence attributes (including eventIds).
4. Do NOT make definitive root cause assertions. Express appropriate engineering nuance.
5. Do NOT include any recommendation fields or solution fixes unless requested.
6. Provide an objective 'overallSummary' and 'engineeringAssessment' of the page runtime health.
7. Return ONLY a valid JSON object conforming to the following structure:

{
  "overallSummary": "Brief overview of findings on this page",
  "engineeringAssessment": "Assessment of runtime behavior and pattern significance",
  "findings": [
    {
      "findingId": "string (must match input)",
      "findingType": "string (must match input)",
      "category": "string",
      "severity": "string",
      "title": "string",
      "observedFact": "string",
      "possibleInterpretation": "string",
      "requiredAdditionalContext": "string",
      "analysis": "Consolidated technical narrative",
      "confidence": 0.95,
      "likelyImpact": "string (optional)",
      "evidence": { ... }
    }
  ]
}
"""


def build_page_analysis_prompt(batch: AIAnalysisBatch) -> Tuple[str, str]:
    """Constructs system and user prompts from an AIAnalysisBatch.

    Strictly isolates context to the specified page and website.
    """
    findings_data = []
    for f in batch.findings:
        findings_data.append({
            "findingId": f.findingId,
            "findingType": f.findingType,
            "category": f.category,
            "severity": f.severity,
            "title": f.title,
            "description": f.description,
            "confidence": f.confidence,
            "evidence": f.evidence.model_dump()
        })

    routes_data = [{"routeId": r.routeId, "path": r.path, "hash": r.hash, "navigationType": r.navigationType} for r in batch.routes]

    user_payload = {
        "batchId": batch.batchId,
        "sessionId": batch.sessionId,
        "website": {
            "websiteId": batch.website.websiteId,
            "origin": batch.website.origin
        },
        "page": {
            "pageId": batch.page.pageId,
            "url": batch.page.url,
            "title": batch.page.title,
            "tabId": batch.page.tabId
        },
        "routes": routes_data,
        "summary": batch.summary.model_dump(),
        "findings": findings_data
    }

    user_prompt = (
        f"Please analyze the following runtime monitoring page batch:\n\n"
        f"```json\n{json.dumps(user_payload, indent=2)}\n```\n\n"
        f"Return the structured JSON analysis."
    )

    return SYSTEM_PROMPT, user_prompt
