"""Diagnostic Quality and Nuance Tests for Milestone 4F."""

import pytest
from app.prompts.builder import build_page_analysis_prompt
from app.models.request import (
    AIAnalysisBatch,
    SessionMetadata,
    WebsiteIdentity,
    PageIdentity,
    PageSummaryModel,
    FindingItem,
    FindingContext,
    FindingEvidence,
    InteractionTriggerContext,
    RepresentativeTaskItem
)


def test_prompt_builder_includes_interaction_and_distribution():
    """Verifies that prompt builder correctly formats interaction trigger and performance distributions."""
    batch = AIAnalysisBatch(
        schemaVersion="1.0.0",
        batchId="batch_4f_test_1",
        sessionId="sess_123",
        websiteId="web_1",
        websiteOrigin="https://app.acme.io",
        pageId="page_1",
        session=SessionMetadata(
            sessionId="sess_123",
            status="finalized",
            startedAt="2026-08-18T10:00:00.000Z",
            endedAt="2026-08-18T10:00:10.000Z",
            durationMs=10000
        ),
        website=WebsiteIdentity(
            websiteId="web_1",
            origin="https://app.acme.io",
            firstSeenAt="2026-08-18T10:00:00.000Z",
            lastSeenAt="2026-08-18T10:00:10.000Z"
        ),
        page=PageIdentity(
            pageId="page_1",
            websiteId="web_1",
            websiteOrigin="https://app.acme.io",
            sessionId="sess_123",
            tabId=1,
            url="https://app.acme.io/dashboard",
            title="Acme Dashboard",
            createdAt="2026-08-18T10:00:00.000Z"
        ),
        routes=[],
        summary=PageSummaryModel(consoleErrors=0, consoleWarnings=0, networkFailures=0),
        findings=[
            FindingItem(
                findingId="fnd_perf_1",
                findingType="main_thread_performance_degradation",
                category="performance",
                severity="high",
                title="Main-Thread Performance Degradation (75 long tasks)",
                description="Observed 75 tasks totaling 5800ms.",
                confidence=0.95,
                context=FindingContext(
                    sessionId="sess_123",
                    websiteId="web_1",
                    websiteOrigin="https://app.acme.io",
                    pageId="page_1"
                ),
                evidence=FindingEvidence(
                    aggregationId="agg_1",
                    eventIds=["evt_1", "evt_2"],
                    count=75,
                    firstSeenAt="2026-08-18T10:00:00.000Z",
                    lastSeenAt="2026-08-18T10:00:10.000Z",
                    timeSpanMs=10000,
                    maxDurationMs=2151,
                    minDurationMs=56,
                    averageDurationMs=77,
                    totalBlockedTimeMs=5800,
                    tasksOver1000ms=5,
                    representativeTasks=[
                        RepresentativeTaskItem(eventId="evt_1", durationMs=2151)
                    ],
                    interactionTrigger=InteractionTriggerContext(
                        interactionType="click",
                        elementTag="BUTTON",
                        elementId="generate-report-btn",
                        textPreview="Generate Report",
                        timeDeltaMs=200
                    )
                )
            )
        ]
    )

    sys_prompt, user_prompt = build_page_analysis_prompt(batch)

    # Check system prompt rules
    assert "TypeError: Failed to fetch" in sys_prompt
    assert "Never present speculation as confirmed root cause" in sys_prompt
    assert "main-thread performance degradation" in sys_prompt

    # Check user prompt payload
    assert "Generate Report" in user_prompt
    assert "generate-report-btn" in user_prompt
    assert "2151" in user_prompt
    assert "5800" in user_prompt
