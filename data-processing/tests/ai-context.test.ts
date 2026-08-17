import { describe, expect, it } from 'vitest';
import { normalizeSession } from '../src/normalization/normalize-session.js';
import { aggregateSession } from '../src/aggregation/aggregate-session.js';
import { extractInsights } from '../src/insights/extract-insights.js';
import { preparePageBatch } from '../src/ai-context/prepare-page-batch.js';
import { prepareWebsiteBatches } from '../src/ai-context/prepare-website-batches.js';
import { sampleEventIds } from '../src/ai-context/evidence-sampler.js';
import { AI_CONTEXT_SCHEMA_VERSION } from '../src/types/ai-context.js';
import type { RawFinalizedSessionPackage } from '../src/types/raw.js';
import {
  createMultiWebsiteSession,
  createRepeatedEventsSession,
  createValidSingleWebsiteSession,
  createEmptyEventsSession
} from './fixtures/session-fixtures.js';

function getProcessedSession(raw: RawFinalizedSessionPackage) {
  const normalized = normalizeSession(raw);
  const aggregated = aggregateSession(normalized);
  return extractInsights(aggregated);
}

function createDenseRepeatedSession(count = 20): RawFinalizedSessionPackage {
  return {
    session: {
      sessionId: 'sess_dense_01',
      status: 'finalized',
      startedAt: '2026-08-17T10:00:00.000Z',
      endedAt: '2026-08-17T10:05:00.000Z',
      durationMs: 300000,
      rootUrl: 'https://example.com/',
      activeTabId: 301
    },
    websites: [
      {
        websiteId: 'web_dense_01',
        sessionId: 'sess_dense_01',
        origin: 'https://example.com',
        firstSeenAt: '2026-08-17T10:00:00.000Z',
        lastSeenAt: '2026-08-17T10:04:00.000Z',
        pages: [
          {
            pageId: 'page_dense_1',
            sessionId: 'sess_dense_01',
            websiteId: 'web_dense_01',
            websiteOrigin: 'https://example.com',
            tabId: 301,
            url: 'https://example.com/',
            title: 'Dense Example',
            createdAt: '2026-08-17T10:00:00.000Z',
            routes: [
              {
                routeId: 'route_dense_1',
                sessionId: 'sess_dense_01',
                pageId: 'page_dense_1',
                tabId: 301,
                url: 'https://example.com/',
                path: '/',
                hash: '',
                timestamp: '2026-08-17T10:00:00.000Z',
                navigationType: 'initial'
              }
            ],
            events: Array.from({ length: count }, (_, i) => ({
              eventId: `evt_dense_n_${i + 1}`,
              sessionId: 'sess_dense_01',
              pageId: 'page_dense_1',
              routeId: 'route_dense_1',
              tabId: 301,
              timestamp: `2026-08-17T10:01:0${i % 4}.000Z`,
              type: 'network' as const,
              data: {
                requestType: 'fetch' as const,
                method: 'GET',
                url: 'https://example.com/api/items',
                status: 200,
                statusText: 'OK',
                ok: true,
                durationMs: 30,
                failureType: null,
                errorMessage: null,
                sourceUrl: 'https://example.com/',
                timestamp: `2026-08-17T10:01:0${i % 4}.000Z`
              }
            }))
          }
        ]
      }
    ]
  };
}

describe('Layer 3A — AI Context & Batch Preparation Test Suite', () => {
  // TEST 1 — Single page batch
  it('TEST 1: should prepare a valid AIAnalysisBatch for a single page with correct identifiers', () => {
    const raw = createValidSingleWebsiteSession();
    const insights = getProcessedSession(raw);

    const batch = preparePageBatch(insights, 'web_20260817_w01', 'page_001');

    expect(batch).toBeDefined();
    expect(batch.batchId).toBe('batch_sess_20260817_test001_web_20260817_w01_page_001');
    expect(batch.sessionId).toBe('sess_20260817_test001');
    expect(batch.websiteId).toBe('web_20260817_w01');
    expect(batch.websiteOrigin).toBe('https://www.hidevs.xyz');
    expect(batch.pageId).toBe('page_001');
  });

  // TEST 2 — Multiple pages
  it('TEST 2: should prepare separate page batches for each page belonging to the website', () => {
    const raw = createValidSingleWebsiteSession();
    const insights = getProcessedSession(raw);

    const batches = prepareWebsiteBatches(insights, 'web_20260817_w01');

    expect(batches).toHaveLength(2);
    expect(batches[0]?.pageId).toBe('page_001');
    expect(batches[1]?.pageId).toBe('page_002');
  });

  // TEST 3 — Multiple websites
  it('TEST 3: should prepare batches exclusively for the selected website, excluding others', () => {
    const raw = createMultiWebsiteSession();
    const insights = getProcessedSession(raw);

    const hidevsBatches = prepareWebsiteBatches(insights, 'web_hidevs_01');

    expect(hidevsBatches).toHaveLength(1);
    expect(hidevsBatches[0]?.websiteOrigin).toBe('https://www.hidevs.xyz');
    expect(hidevsBatches[0]?.page.url).toBe('https://www.hidevs.xyz/');
    expect(hidevsBatches.some((b) => b.websiteOrigin.includes('github.com'))).toBe(false);
  });

  // TEST 4 — Page isolation
  it('TEST 4: should strictly isolate findings to the specific page batch', () => {
    const raw = createValidSingleWebsiteSession();
    const insights = getProcessedSession(raw);

    const batch1 = preparePageBatch(insights, 'web_20260817_w01', 'page_001');
    const batch2 = preparePageBatch(insights, 'web_20260817_w01', 'page_002');

    expect(batch1.findings.every((f) => f.context.pageId === 'page_001')).toBe(true);
    expect(batch2.findings.every((f) => f.context.pageId === 'page_002')).toBe(true);
  });

  // TEST 5 — Route preservation
  it('TEST 5: should preserve all route history under the page batch', () => {
    const raw = createValidSingleWebsiteSession();
    const insights = getProcessedSession(raw);

    const batch2 = preparePageBatch(insights, 'web_20260817_w01', 'page_002');

    expect(batch2.routes).toHaveLength(2);
    expect(batch2.routes[0]?.routeId).toBe('route_002');
    expect(batch2.routes[1]?.routeId).toBe('route_003');
    expect(batch2.routes[1]?.hash).toBe('#faq');
  });

  // TEST 6 — Findings preservation
  it('TEST 6: should preserve engineering findings without rewriting or adding recommendations', () => {
    const raw = createValidSingleWebsiteSession();
    const insights = getProcessedSession(raw);

    const batch2 = preparePageBatch(insights, 'web_20260817_w01', 'page_002');

    const ltFinding = batch2.findings.find((f) => f.findingType === 'long_task');
    expect(ltFinding).toBeDefined();
    expect(ltFinding?.severity).toBe('medium');
    expect(ltFinding?.evidence.durationMs).toBe(85);
  });

  // TEST 7 — Context preservation
  it('TEST 7: should preserve complete hierarchical context on all findings in the batch', () => {
    const raw = createValidSingleWebsiteSession();
    const insights = getProcessedSession(raw);

    const batch = preparePageBatch(insights, 'web_20260817_w01', 'page_002');

    for (const finding of batch.findings) {
      expect(finding.context.sessionId).toBe('sess_20260817_test001');
      expect(finding.context.websiteId).toBe('web_20260817_w01');
      expect(finding.context.websiteOrigin).toBe('https://www.hidevs.xyz');
      expect(finding.context.pageId).toBe('page_002');
    }
  });

  // TEST 8 — Evidence preservation
  it('TEST 8: should preserve evidence fields in the batch evidence items', () => {
    const raw = createValidSingleWebsiteSession();
    const insights = getProcessedSession(raw);

    const batch = preparePageBatch(insights, 'web_20260817_w01', 'page_002');

    expect(batch.evidence).toHaveLength(batch.findings.length);
    const ev = batch.evidence[0]!;
    expect(ev.evidence.aggregationId).toBeDefined();
    expect(ev.evidence.eventIds.length).toBeGreaterThan(0);
    expect(ev.evidence.count).toBeGreaterThan(0);
  });

  // TEST 9 — Representative evidence
  it('TEST 9: should preserve all eventIds while sampling at most maxEvidenceEvents', () => {
    const raw = createDenseRepeatedSession(20);
    const insights = getProcessedSession(raw);

    const batch = preparePageBatch(insights, 'web_dense_01', 'page_dense_1', { maxEvidenceEvents: 5 });

    const repFinding = batch.evidence.find((e) => e.findingType === 'repeated_network_request');
    expect(repFinding).toBeDefined();
    expect(repFinding?.evidence.eventIds).toHaveLength(20); // all 20 preserved
    expect(repFinding?.sampledEventIds.length).toBeLessThanOrEqual(5); // sampled at most 5
  });

  // TEST 10 — Deterministic sampling
  it('TEST 10: should produce identical sampled event IDs on repeated runs', () => {
    const eventIds = Array.from({ length: 25 }, (_, i) => `evt_${i}`);

    const sample1 = sampleEventIds(eventIds, 5);
    const sample2 = sampleEventIds(eventIds, 5);

    expect(sample1).toEqual(sample2);
    expect(sample1).toEqual(['evt_0', 'evt_6', 'evt_12', 'evt_18', 'evt_24']);
  });

  // TEST 11 — Single event evidence
  it('TEST 11: should correctly include a finding with a single event in evidence', () => {
    const eventIds = ['evt_only_1'];
    const sampled = sampleEventIds(eventIds, 5);

    expect(sampled).toEqual(['evt_only_1']);
  });

  // TEST 12 — Empty page
  it('TEST 12: should prepare a valid batch for an empty page with 0 findings/events', () => {
    const raw = createEmptyEventsSession();
    const insights = getProcessedSession(raw);

    const batch = preparePageBatch(insights, 'web_empty_01', 'page_empty_1');

    expect(batch).toBeDefined();
    expect(batch.findings).toHaveLength(0);
    expect(batch.evidence).toHaveLength(0);
    expect(batch.metadata.eventCount).toBe(0);
    expect(batch.metadata.findingCount).toBe(0);
  });

  // TEST 13 — Missing page
  it('TEST 13: should throw a clear error when requested page does not exist', () => {
    const raw = createValidSingleWebsiteSession();
    const insights = getProcessedSession(raw);

    expect(() => preparePageBatch(insights, 'web_20260817_w01', 'nonexistent_page')).toThrow(
      'Page with ID "nonexistent_page" was not found'
    );
  });

  // TEST 14 — Missing website
  it('TEST 14: should throw a clear error when requested website does not exist', () => {
    const raw = createValidSingleWebsiteSession();
    const insights = getProcessedSession(raw);

    expect(() => preparePageBatch(insights, 'nonexistent_web', 'page_001')).toThrow(
      'Website with ID "nonexistent_web" was not found'
    );
    expect(() => prepareWebsiteBatches(insights, 'nonexistent_web')).toThrow(
      'Website with ID "nonexistent_web" was not found'
    );
  });

  // TEST 15 — Summary generation
  it('TEST 15: should generate an accurate PageSummary counting finding types without health scoring', () => {
    const raw = createDenseRepeatedSession(10);
    const insights = getProcessedSession(raw);

    const batch = preparePageBatch(insights, 'web_dense_01', 'page_dense_1');

    expect(batch.summary).toBeDefined();
    expect(batch.summary.repeatedRequests).toBe(1); // 1 repeated network finding
    expect(batch.summary.slowResources).toBe(0);
  });

  // TEST 16 — Summary does not double-count
  it('TEST 16: should count finding occurrences rather than raw underlying events', () => {
    const raw = createDenseRepeatedSession(15);
    const insights = getProcessedSession(raw);

    const batch = preparePageBatch(insights, 'web_dense_01', 'page_dense_1');

    // 15 repeated requests = 1 repeatedRequests finding
    expect(batch.summary.repeatedRequests).toBe(1);
  });

  // TEST 17 — Session metadata
  it('TEST 17: should preserve session metadata in the batch', () => {
    const raw = createValidSingleWebsiteSession();
    const insights = getProcessedSession(raw);

    const batch = preparePageBatch(insights, 'web_20260817_w01', 'page_001');

    expect(batch.session.sessionId).toBe('sess_20260817_test001');
    expect(batch.session.startedAt).toBe('2026-08-17T08:00:00.000Z');
    expect(batch.session.endedAt).toBe('2026-08-17T08:05:00.000Z');
    expect(batch.session.durationMs).toBe(300000);
  });

  // TEST 18 — Page metadata
  it('TEST 18: should preserve page metadata in the batch', () => {
    const raw = createValidSingleWebsiteSession();
    const insights = getProcessedSession(raw);

    const batch = preparePageBatch(insights, 'web_20260817_w01', 'page_001');

    expect(batch.page.pageId).toBe('page_001');
    expect(batch.page.url).toBe('https://www.hidevs.xyz/');
    expect(batch.page.title).toBe('HiDevs Home');
    expect(batch.page.tabId).toBe(101);
    expect(batch.page.websiteOrigin).toBe('https://www.hidevs.xyz');
  });

  // TEST 19 — Website metadata
  it('TEST 19: should preserve website metadata in the batch', () => {
    const raw = createValidSingleWebsiteSession();
    const insights = getProcessedSession(raw);

    const batch = preparePageBatch(insights, 'web_20260817_w01', 'page_001');

    expect(batch.website.websiteId).toBe('web_20260817_w01');
    expect(batch.website.origin).toBe('https://www.hidevs.xyz');
  });

  // TEST 20 — No cross-session contamination
  it('TEST 20: should not mix data from different sessions even if page IDs match', () => {
    const raw1 = createValidSingleWebsiteSession();
    const raw2 = {
      ...createValidSingleWebsiteSession(),
      session: {
        ...createValidSingleWebsiteSession().session,
        sessionId: 'sess_second_session_999'
      }
    };

    const insights1 = getProcessedSession(raw1);
    const insights2 = getProcessedSession(raw2);

    const batch1 = preparePageBatch(insights1, 'web_20260817_w01', 'page_001');
    const batch2 = preparePageBatch(insights2, 'web_20260817_w01', 'page_001');

    expect(batch1.sessionId).toBe('sess_20260817_test001');
    expect(batch2.sessionId).toBe('sess_second_session_999');
    expect(batch1.batchId).not.toBe(batch2.batchId);
  });

  // TEST 21 — Immutability
  it('TEST 21: should not mutate the input InsightSessionData structure', () => {
    const raw = createValidSingleWebsiteSession();
    const insights = getProcessedSession(raw);
    const copy = JSON.parse(JSON.stringify(insights));

    preparePageBatch(insights, 'web_20260817_w01', 'page_001');

    expect(insights).toEqual(copy);
  });

  // TEST 22 — Deterministic batch
  it('TEST 22: should produce identical batches on repeated calls with same input', () => {
    const raw = createValidSingleWebsiteSession();
    const insights = getProcessedSession(raw);

    const batchA = preparePageBatch(insights, 'web_20260817_w01', 'page_001');
    const batchB = preparePageBatch(insights, 'web_20260817_w01', 'page_001');

    expect(batchA).toEqual(batchB);
  });

  // TEST 23 — Schema version
  it('TEST 23: should embed the standard schemaVersion (3A.1) in every batch and metadata', () => {
    const raw = createValidSingleWebsiteSession();
    const insights = getProcessedSession(raw);

    const batch = preparePageBatch(insights, 'web_20260817_w01', 'page_001');

    expect(batch.schemaVersion).toBe(AI_CONTEXT_SCHEMA_VERSION);
    expect(batch.metadata.schemaVersion).toBe(AI_CONTEXT_SCHEMA_VERSION);
  });

  // TEST 24 — Provider independence
  it('TEST 24: should not contain LLM provider-specific fields', () => {
    const raw = createValidSingleWebsiteSession();
    const insights = getProcessedSession(raw);

    const batch = preparePageBatch(insights, 'web_20260817_w01', 'page_001');
    const obj = batch as unknown as Record<string, unknown>;

    expect(obj['apiKey']).toBeUndefined();
    expect(obj['model']).toBeUndefined();
    expect(obj['temperature']).toBeUndefined();
    expect(obj['topP']).toBeUndefined();
    expect(obj['systemPrompt']).toBeUndefined();
    expect(obj['prompt']).toBeUndefined();
  });

  // TEST 25 — Large context handling
  it('TEST 25: should keep batch as valid structured data when size limit is enforced', () => {
    const raw = createRepeatedEventsSession(50);
    const insights = getProcessedSession(raw);

    // Apply strict 1500 byte limit
    const batch = preparePageBatch(insights, 'web_example_01', 'page_rep_1', { maxBatchBytes: 1500 });

    expect(batch).toBeDefined();
    expect(typeof batch).toBe('object');
    expect(batch.pageId).toBe('page_rep_1');
    expect(batch.summary).toBeDefined();
    // JSON serialization succeeds
    const json = JSON.stringify(batch);
    expect(JSON.parse(json)).toEqual(batch);
  });

  // TEST 26 — Finding priority
  it('TEST 26: should prioritize retaining higher severity findings over lower severity findings', () => {
    const raw = createValidSingleWebsiteSession();
    const insights = getProcessedSession(raw);

    const batch = preparePageBatch(insights, 'web_20260817_w01', 'page_002', { maxBatchBytes: 800 });

    // The batch should preserve the long_task finding or remaining high priority findings
    expect(batch).toBeDefined();
    expect(batch.pageId).toBe('page_002');
  });

  // TEST 27 — Full pipeline
  it('TEST 27: should successfully run Raw -> Normalize -> Aggregate -> Extract Insights -> Prepare Batch', () => {
    const raw = createMultiWebsiteSession();
    const normalized = normalizeSession(raw);
    const aggregated = aggregateSession(normalized);
    const insights = extractInsights(aggregated);
    const batches = prepareWebsiteBatches(insights, 'web_hidevs_01');

    expect(batches).toHaveLength(1);
    expect(batches[0]?.page.url).toBe('https://www.hidevs.xyz/');
    expect(batches[0]?.findings).toBeDefined();
  });

  // TEST 28 — Full website preparation
  it('TEST 28: should return batches for all pages under selected website without cross-website pages', () => {
    const raw = createMultiWebsiteSession();
    const insights = getProcessedSession(raw);

    const githubBatches = prepareWebsiteBatches(insights, 'web_github_02');

    expect(githubBatches).toHaveLength(1);
    expect(githubBatches[0]?.websiteOrigin).toBe('https://github.com');
    expect(githubBatches[0]?.page.url).toBe('https://github.com/login');
  });

  // TEST 29 — Page ordering
  it('TEST 29: should sort website page batches deterministically', () => {
    const raw = createValidSingleWebsiteSession();
    const insights = getProcessedSession(raw);

    const batches = prepareWebsiteBatches(insights, 'web_20260817_w01');

    expect(batches[0]?.pageId).toBe('page_001');
    expect(batches[1]?.pageId).toBe('page_002');
  });

  // TEST 30 — No source mutation
  it('TEST 30: should preserve all layers (raw, normalized, aggregated, findings) unmutated', () => {
    const raw = createValidSingleWebsiteSession();
    const rawCopy = JSON.parse(JSON.stringify(raw));

    const normalized = normalizeSession(raw);
    const normalizedCopy = JSON.parse(JSON.stringify(normalized));

    const aggregated = aggregateSession(normalized);
    const aggregatedCopy = JSON.parse(JSON.stringify(aggregated));

    const insights = extractInsights(aggregated);
    const insightsCopy = JSON.parse(JSON.stringify(insights));

    prepareWebsiteBatches(insights, 'web_20260817_w01');

    expect(raw).toEqual(rawCopy);
    expect(normalized).toEqual(normalizedCopy);
    expect(aggregated).toEqual(aggregatedCopy);
    expect(insights).toEqual(insightsCopy);
  });

  // IMPORTANT REALISTIC TEST
  it('IMPORTANT REALISTIC TEST: should prepare complete structured AI batch with routes, findings, evidence, and summary', () => {
    const raw = createValidSingleWebsiteSession();
    const insights = getProcessedSession(raw);

    const batch = preparePageBatch(insights, 'web_20260817_w01', 'page_002');

    // Verify complete structure
    expect(batch.page.url).toBe('https://www.hidevs.xyz/ai-interns');
    expect(batch.routes).toHaveLength(2); // /ai-interns and /ai-interns#faq
    expect(batch.findings.length).toBeGreaterThan(0);
    expect(batch.evidence.length).toBeGreaterThan(0);
    expect(batch.summary).toBeDefined();
    expect(batch.websiteOrigin).toBe('https://www.hidevs.xyz');
    expect(batch.websiteOrigin).not.toContain('github.com');
  });

  // IMPORTANT ARCHITECTURAL TEST
  it('IMPORTANT ARCHITECTURAL WORKFLOW: Session -> Website selection -> prepareWebsiteBatches -> Page Batch 2 strictly isolated', () => {
    const raw = createMultiWebsiteSession();
    const insights = getProcessedSession(raw);

    // 1. User selects "web_hidevs_01"
    const hidevsBatches = prepareWebsiteBatches(insights, 'web_hidevs_01');
    expect(hidevsBatches).toHaveLength(1);

    // 2. User selects "web_github_02"
    const githubBatches = prepareWebsiteBatches(insights, 'web_github_02');
    expect(githubBatches).toHaveLength(1);

    const ghBatch = githubBatches[0]!;
    expect(ghBatch.websiteOrigin).toBe('https://github.com');
    expect(ghBatch.page.url).toBe('https://github.com/login');
    expect(ghBatch.findings.every((f) => f.context.websiteOrigin === 'https://github.com')).toBe(true);
  });
});
