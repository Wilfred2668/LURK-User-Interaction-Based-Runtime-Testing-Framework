"""Deterministic Analysis Service for Milestone 3B.

Transforms an AIAnalysisBatch into a structured AnalysisResponse.
This service does NOT call external LLM APIs and produces objective,
evidence-grounded placeholder analyses separating observed facts from interpretations.
"""

from typing import Any, Dict, List, Optional
from app.models.request import AIAnalysisBatch, FindingItem
from app.models.response import AnalysisResponse, FindingAnalysisItem


def _format_ms(val: Optional[float]) -> str:
    if val is None:
        return "N/A"
    if val.is_integer():
        return f"{int(val)}ms"
    return f"{val}ms"


def generate_finding_analysis(finding: FindingItem) -> FindingAnalysisItem:
    ev = finding.evidence
    ft = finding.findingType

    observed_fact = finding.description
    possible_interpretation = ""
    required_context = ""

    if ft == "repeated_network_request":
        observed_fact = (
            f"Observed {ev.count} identical {ev.method or 'HTTP'} requests to "
            f"{ev.url or 'the endpoint'} within approximately {round(ev.timeSpanMs / 1000)}s on this page."
        )
        possible_interpretation = (
            "Frequent polling intervals, un-debounced user interactions, or reactive component re-renders "
            "may be triggering repeated network requests."
        )
        required_context = (
            "Verification of component lifecycle hooks, caching strategies, and event trigger handlers "
            "in the application source code is required."
        )
    elif ft == "failed_network_request":
        status_code = ev.status if ev.status is not None else "HTTP"
        observed_fact = (
            f"Observed HTTP {status_code} ({ev.statusText or 'Error'}) response for "
            f"{ev.method or ''} {ev.url or 'request'}."
        )
        possible_interpretation = (
            "The requested resource was unavailable, unauthorized, or encountered an unhandled server-side condition."
        )
        required_context = (
            "Server logs, request payload validation, and endpoint routing configuration are needed to confirm the root cause."
        )
    elif ft == "network_transport_failure":
        observed_fact = (
            f"Observed network transport failure ({ev.errorMessage or ev.failureType or 'connection failure'}) "
            f"for {ev.method or ''} {ev.url or 'request'}."
        )
        possible_interpretation = (
            "Client network disconnect, CORS blocking, DNS resolution failure, or connection reset interrupted the transport."
        )
        required_context = (
            "Browser network security policies and host reachability logs must be inspected."
        )
    elif ft == "slow_network_request":
        observed_fact = (
            f"Request duration of {_format_ms(ev.durationMs)} for {ev.method or ''} {ev.url or 'request'} "
            f"exceeded the configured latency threshold."
        )
        possible_interpretation = (
            "High backend processing time, large payload transfer, or network latency delayed the response."
        )
        required_context = (
            "Backend trace metrics and network waterfall breakdown are required."
        )
    elif ft == "repeated_console_error":
        observed_fact = (
            f"Console error \"{ev.message or 'Error'}\" occurred {ev.count} times on this page."
        )
        possible_interpretation = (
            "Repeated runtime exceptions or rejected asynchronous operations were caught and logged."
        )
        required_context = (
            "Stack trace inspection and exception handling code in application scripts are needed."
        )
    elif ft == "repeated_console_warning":
        observed_fact = (
            f"Console warning \"{ev.message or 'Warning'}\" occurred {ev.count} times on this page."
        )
        possible_interpretation = (
            "Deprecation notices or non-fatal configuration warnings were repeatedly emitted."
        )
        required_context = (
            "Framework configuration and dependency deprecation guides should be consulted."
        )
    elif ft == "long_task":
        observed_fact = (
            f"A main-thread long task lasting {_format_ms(ev.durationMs)} was observed blocking the execution loop."
        )
        possible_interpretation = (
            "Heavy JavaScript execution, synchronous DOM manipulation, or complex parsing blocked the UI thread."
        )
        required_context = (
            "CPU profiling and source script identification are required to locate the synchronous bottleneck."
        )
    elif ft == "slow_resource":
        observed_fact = (
            f"Resource \"{ev.url or 'asset'}\" load duration of {_format_ms(ev.durationMs)} exceeded the threshold."
        )
        possible_interpretation = (
            "Uncompressed asset sizes or slow CDN/origin response times delayed resource delivery."
        )
        required_context = (
            "Asset caching headers and compression settings must be verified."
        )
    elif ft == "large_resource":
        size_kb = round((ev.decodedBodySize or ev.transferSize or 0) / 1024)
        observed_fact = (
            f"Resource \"{ev.url or 'asset'}\" size ({size_kb} KB) exceeded the configured threshold."
        )
        possible_interpretation = (
            "Large media payloads or unminified bundles increased bandwidth consumption."
        )
        required_context = (
            "Asset optimization, code splitting, and bundle analyzer reports are needed."
        )
    elif ft == "repeated_resource":
        observed_fact = (
            f"Resource \"{ev.url or 'asset'}\" was loaded {ev.count} times within the aggregation window."
        )
        possible_interpretation = (
            "Missing cache-control headers or duplicate asset requests in the DOM triggered repeated loads."
        )
        required_context = (
            "HTTP cache headers and component render logic must be verified."
        )
    else:
        observed_fact = finding.description
        possible_interpretation = "Pattern matched detection rule."
        required_context = "Further source code inspection required."

    analysis_text = f"{observed_fact} {possible_interpretation} {required_context}"

    evidence_dict: Dict[str, Any] = {
        "count": ev.count,
        "eventIds": list(ev.eventIds),
        "firstSeenAt": ev.firstSeenAt,
        "lastSeenAt": ev.lastSeenAt,
        "timeSpanMs": ev.timeSpanMs
    }
    if ev.url:
        evidence_dict["url"] = ev.url
    if ev.method:
        evidence_dict["method"] = ev.method
    if ev.status is not None:
        evidence_dict["status"] = ev.status
    if ev.durationMs is not None:
        evidence_dict["durationMs"] = ev.durationMs

    return FindingAnalysisItem(
        findingId=finding.findingId,
        findingType=finding.findingType,
        category=finding.category,
        severity=finding.severity,
        title=finding.title,
        observedFact=observed_fact,
        possibleInterpretation=possible_interpretation,
        requiredAdditionalContext=required_context,
        analysis=analysis_text,
        evidence=evidence_dict
    )


def analyze_batch(batch: AIAnalysisBatch) -> AnalysisResponse:
    """Performs deterministic, rule-grounded analysis on a validated AIAnalysisBatch."""
    finding_analyses: List[FindingAnalysisItem] = [
        generate_finding_analysis(f) for f in batch.findings
    ]

    total_findings = len(finding_analyses)
    if total_findings == 0:
        summary = f"No runtime engineering findings were detected for page {batch.page.url}."
    else:
        severity_counts: Dict[str, int] = {}
        for f in finding_analyses:
            severity_counts[f.severity] = severity_counts.get(f.severity, 0) + 1

        severity_summary = ", ".join(f"{count} {sev}" for sev, count in severity_counts.items())
        summary = (
            f"Analyzed {total_findings} runtime engineering finding(s) ({severity_summary}) "
            f"on page {batch.page.url} across {len(batch.routes)} route(s)."
        )

    return AnalysisResponse(
        analysisVersion="3B.1",
        batchId=batch.batchId,
        sessionId=batch.sessionId,
        websiteId=batch.websiteId,
        pageId=batch.pageId,
        status="completed",
        summary=summary,
        findings=finding_analyses
    )
