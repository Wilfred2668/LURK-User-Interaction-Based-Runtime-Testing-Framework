"""Prompt construction module for AI Analysis with Milestone 4F Diagnostic Context."""

import json
from typing import Tuple
from app.models.request import AIAnalysisBatch

SYSTEM_PROMPT = """You are an expert Developer-Focused Runtime Monitoring and AI Diagnostics Engine.
Your task is to analyze the provided page-level runtime monitoring batch containing engineering findings and observable evidence.

CRITICAL DIAGNOSTIC INSTRUCTIONS:
1. Base your analysis STRICTLY on the supplied observable evidence. Do NOT invent facts, DOM elements, API endpoints, or behaviors not captured in telemetry.
2. Differentiate error types accurately:
   - "Cannot read properties of undefined / null" indicates null pointer or missing object property access.
   - "TypeError: Failed to fetch" / "NetworkError" indicates a client network transport, CORS, server unavailability, or request cancellation error. Do NOT interpret fetch failures as null-pointer exceptions or broken authentication without evidence.
   - HTTP 401 / 403 indicates unauthorized/forbidden access. Do NOT claim the entire authentication system is broken from a single failure.
   - HTTP 404 indicates missing endpoint or resource path.
   - HTTP 500+ indicates server-side unhandled exception or gateway error.
3. Express appropriate engineering nuance:
   - Never present speculation as confirmed root cause.
   - Use language such as "The available evidence suggests...", "Observed shortly after...", "A plausible explanation is...", or "Insufficient evidence to confirm root cause."
4. If an interaction trigger is present in the evidence (e.g. user clicked a button 200ms before), incorporate this temporal correlation into your interpretation.
5. For main-thread performance degradation findings, evaluate the task distribution (worst duration, tasks >1s, total blocked time) rather than treating tasks as isolated noise.
6. Clearly distinguish the 5 fields for each finding:
   - observedFact: Factual, measurable observation directly from telemetry.
   - possibleInterpretation: Nuanced, technically plausible explanations.
   - requiredAdditionalContext: Specific source code, network trace, or backend logs needed to verify the cause.
   - analysis: Clear, developer-friendly diagnostic narrative.
   - likelyImpact: Observable end-user or system impact.
7. Return ONLY a valid JSON object matching:

{
  "overallSummary": "Concise summary of page runtime health and significant patterns",
  "engineeringAssessment": "Technical assessment of stability, performance contention, and reliability",
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
      "analysis": "string",
      "confidence": 0.95,
      "likelyImpact": "string",
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
