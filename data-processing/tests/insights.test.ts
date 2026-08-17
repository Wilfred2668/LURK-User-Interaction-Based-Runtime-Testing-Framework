import { describe, expect, it } from 'vitest';
import { normalizeSession } from '../src/normalization/normalize-session.js';
import { aggregateEvents } from '../src/aggregation/aggregate-events.js';
import { aggregateSession } from '../src/aggregation/aggregate-session.js';
import { detectInsightsFromPattern } from '../src/insights/detect-insights.js';
import { extractInsights } from '../src/insights/extract-insights.js';
import type { NormalizedEvent, NormalizedEventContext } from '../src/types/normalized.js';
import type { RawFinalizedSessionPackage } from '../src/types/raw.js';
import {
  createMultiWebsiteSession,
  createRepeatedEventsSession,
  createValidSingleWebsiteSession
} from './fixtures/session-fixtures.js';

function createMockContext(overrides: Partial<NormalizedEventContext> = {}): NormalizedEventContext {
  return {
    sessionId: 'sess_test_1',
    websiteId: 'web_test_1',
    websiteOrigin: 'https://www.hidevs.xyz',
    pageId: 'page_test_1',
    routeId: 'route_test_1',
    tabId: 100,
    ...overrides
  };
}

function createMockNetworkEvent(
  id: string,
  timestamp: string,
  method = 'GET',
  url = 'https://www.hidevs.xyz/api/leaderboard',
  requestType: 'fetch' | 'xhr' = 'fetch',
  status: number | null = 200,
  durationMs = 40,
  failureType: 'http' | 'network' | null = null,
  errorMessage: string | null = null,
  contextOverrides: Partial<NormalizedEventContext> = {}
): NormalizedEvent {
  return {
    eventId: id,
    category: 'network',
    timestamp,
    context: createMockContext(contextOverrides),
    data: {
      requestType,
      method,
      url,
      status,
      statusText: status === 200 ? 'OK' : status === 404 ? 'Not Found' : status === 500 ? 'Internal Server Error' : status === 401 ? 'Unauthorized' : 'Error',
      ok: status !== null && status >= 200 && status < 400,
      durationMs,
      failureType,
      errorMessage,
      timestamp
    }
  };
}

function createMockConsoleEvent(
  id: string,
  timestamp: string,
  level: 'log' | 'info' | 'warn' | 'error' = 'error',
  message = 'Failed to load leaderboard',
  contextOverrides: Partial<NormalizedEventContext> = {}
): NormalizedEvent {
  return {
    eventId: id,
    category: 'console',
    timestamp,
    context: createMockContext(contextOverrides),
    data: {
      level,
      message,
      arguments: [message],
      sourceUrl: 'https://www.hidevs.xyz/main.js',
      rawTimestamp: timestamp
    }
  };
}

function createMockResourceEvent(
  id: string,
  timestamp: string,
  name = 'https://www.hidevs.xyz/assets/logo.png',
  initiatorType = 'img',
  durationMs = 25,
  decodedBodySize = 5000,
  contextOverrides: Partial<NormalizedEventContext> = {}
): NormalizedEvent {
  return {
    eventId: id,
    category: 'performance',
    timestamp,
    context: createMockContext(contextOverrides),
    data: {
      performanceType: 'resource',
      name,
      initiatorType,
      durationMs,
      startTime: 100,
      responseEnd: 100 + durationMs,
      transferSize: decodedBodySize,
      encodedBodySize: decodedBodySize,
      decodedBodySize,
      dnsMs: 5,
      connectMs: 10,
      responseMs: 10,
      timestamp
    }
  };
}

function createMockLongTaskEvent(
  id: string,
  timestamp: string,
  durationMs = 150,
  startTime = 500,
  contextOverrides: Partial<NormalizedEventContext> = {}
): NormalizedEvent {
  return {
    eventId: id,
    category: 'performance',
    timestamp,
    context: createMockContext(contextOverrides),
    data: {
      performanceType: 'longtask',
      name: 'self',
      startTime,
      durationMs,
      sourceUrl: 'https://www.hidevs.xyz/app.js',
      timestamp
    }
  };
}

describe('Layer 2C — Engineering Insight Extraction Test Suite', () => {
  // TEST 1 — Repeated network finding
  it('TEST 1: should generate repeated_network_request finding for 10 identical GET requests within 5s', () => {
    const events = Array.from({ length: 10 }, (_, i) =>
      createMockNetworkEvent(`evt_net_${i}`, `2026-08-17T08:00:0${i % 4}.000Z`)
    );

    const patterns = aggregateEvents(events, { windowMs: 5000 });
    const findings = patterns.flatMap((p) => detectInsightsFromPattern(p));

    const repFinding = findings.find((f) => f.findingType === 'repeated_network_request');
    expect(repFinding).toBeDefined();
    expect(repFinding?.category).toBe('network');
    expect(repFinding?.evidence.count).toBe(10);
    expect(repFinding?.confidence).toBeGreaterThan(0.9);
    expect(repFinding?.title).toBe('Repeated network request detected');
  });

  // TEST 2 — Below repeated network threshold
  it('TEST 2: should not generate repeated-network finding for 2 requests (below minCount=5)', () => {
    const events = [
      createMockNetworkEvent('evt_1', '2026-08-17T08:00:00.000Z'),
      createMockNetworkEvent('evt_2', '2026-08-17T08:00:01.000Z')
    ];

    const patterns = aggregateEvents(events, { windowMs: 5000 });
    const findings = patterns.flatMap((p) => detectInsightsFromPattern(p));

    expect(findings.some((f) => f.findingType === 'repeated_network_request')).toBe(false);
  });

  // TEST 3 — Repeated console error
  it('TEST 3: should generate repeated_console_error finding for 5 identical console errors', () => {
    const events = Array.from({ length: 5 }, (_, i) =>
      createMockConsoleEvent(`evt_err_${i}`, `2026-08-17T08:00:0${i}.000Z`, 'error', 'Failed to fetch items')
    );

    const patterns = aggregateEvents(events, { windowMs: 5000 });
    const findings = patterns.flatMap((p) => detectInsightsFromPattern(p));

    const errFinding = findings.find((f) => f.findingType === 'repeated_console_error');
    expect(errFinding).toBeDefined();
    expect(errFinding?.evidence.count).toBe(5);
    expect(errFinding?.evidence.message).toBe('Failed to fetch items');
  });

  // TEST 4 — Repeated warning
  it('TEST 4: should generate repeated_console_warning (not error) for repeated console warnings', () => {
    const events = Array.from({ length: 5 }, (_, i) =>
      createMockConsoleEvent(`evt_warn_${i}`, `2026-08-17T08:00:0${i}.000Z`, 'warn', 'Deprecated API used')
    );

    const patterns = aggregateEvents(events, { windowMs: 5000 });
    const findings = patterns.flatMap((p) => detectInsightsFromPattern(p));

    const warnFinding = findings.find((f) => f.findingType === 'repeated_console_warning');
    const errFinding = findings.find((f) => f.findingType === 'repeated_console_error');

    expect(warnFinding).toBeDefined();
    expect(errFinding).toBeUndefined();
    expect(warnFinding?.evidence.message).toBe('Deprecated API used');
  });

  // TEST 5 — HTTP 404
  it('TEST 5: should generate failed_network_request finding for HTTP 404 response', () => {
    const events = [createMockNetworkEvent('evt_404', '2026-08-17T08:00:00.000Z', 'GET', 'https://www.hidevs.xyz/api/missing', 'fetch', 404)];

    const patterns = aggregateEvents(events);
    const findings = patterns.flatMap((p) => detectInsightsFromPattern(p));

    const failFinding = findings.find((f) => f.findingType === 'failed_network_request');
    expect(failFinding).toBeDefined();
    expect(failFinding?.evidence.status).toBe(404);
    expect(failFinding?.severity).toBe('low');
  });

  // TEST 6 — HTTP 500
  it('TEST 6: should generate failed_network_request finding with high severity for HTTP 500', () => {
    const events = [createMockNetworkEvent('evt_500', '2026-08-17T08:00:00.000Z', 'POST', 'https://www.hidevs.xyz/api/submit', 'fetch', 500)];

    const patterns = aggregateEvents(events);
    const findings = patterns.flatMap((p) => detectInsightsFromPattern(p));

    const failFinding = findings.find((f) => f.findingType === 'failed_network_request');
    expect(failFinding).toBeDefined();
    expect(failFinding?.evidence.status).toBe(500);
    expect(failFinding?.severity).toBe('high');
  });

  // TEST 7 — HTTP 401
  it('TEST 7: should generate failed_network_request for HTTP 401 without claiming broken auth', () => {
    const events = [createMockNetworkEvent('evt_401', '2026-08-17T08:00:00.000Z', 'GET', 'https://www.hidevs.xyz/api/admin', 'fetch', 401)];

    const patterns = aggregateEvents(events);
    const findings = patterns.flatMap((p) => detectInsightsFromPattern(p));

    const failFinding = findings.find((f) => f.findingType === 'failed_network_request');
    expect(failFinding).toBeDefined();
    expect(failFinding?.description).not.toContain('broken');
    expect(failFinding?.description).toContain('HTTP 401');
  });

  // TEST 8 — Network transport failure
  it('TEST 8: should generate network_transport_failure for connection/transport failures', () => {
    const events = [
      createMockNetworkEvent('evt_net_fail', '2026-08-17T08:00:00.000Z', 'GET', 'https://www.hidevs.xyz/api/data', 'fetch', null, 0, 'network', 'Failed to fetch')
    ];

    const patterns = aggregateEvents(events);
    const findings = patterns.flatMap((p) => detectInsightsFromPattern(p));

    const transportFinding = findings.find((f) => f.findingType === 'network_transport_failure');
    expect(transportFinding).toBeDefined();
    expect(transportFinding?.severity).toBe('high');
    expect(transportFinding?.evidence.failureType).toBe('network');
  });

  // TEST 9 — Slow network
  it('TEST 9: should generate slow_network_request when duration >= 1000ms', () => {
    const events = [
      createMockNetworkEvent('evt_slow', '2026-08-17T08:00:00.000Z', 'GET', 'https://www.hidevs.xyz/api/heavy', 'fetch', 200, 1500)
    ];

    const patterns = aggregateEvents(events);
    const findings = patterns.flatMap((p) => detectInsightsFromPattern(p));

    const slowFinding = findings.find((f) => f.findingType === 'slow_network_request');
    expect(slowFinding).toBeDefined();
    expect(slowFinding?.severity).toBe('medium');
    expect(slowFinding?.evidence.durationMs).toBe(1500);
  });

  // TEST 10 — Very slow network
  it('TEST 10: should assign high severity when request duration >= 3000ms', () => {
    const events = [
      createMockNetworkEvent('evt_vslow', '2026-08-17T08:00:00.000Z', 'GET', 'https://www.hidevs.xyz/api/huge', 'fetch', 200, 3500)
    ];

    const patterns = aggregateEvents(events);
    const findings = patterns.flatMap((p) => detectInsightsFromPattern(p));

    const slowFinding = findings.find((f) => f.findingType === 'slow_network_request');
    expect(slowFinding).toBeDefined();
    expect(slowFinding?.severity).toBe('high');
  });

  // TEST 11 — Fast network
  it('TEST 11: should not generate slow_network_request for fast requests (100ms < 1000ms)', () => {
    const events = [
      createMockNetworkEvent('evt_fast', '2026-08-17T08:00:00.000Z', 'GET', 'https://www.hidevs.xyz/api/fast', 'fetch', 200, 100)
    ];

    const patterns = aggregateEvents(events);
    const findings = patterns.flatMap((p) => detectInsightsFromPattern(p));

    expect(findings.some((f) => f.findingType === 'slow_network_request')).toBe(false);
  });

  // TEST 12 — Slow resource
  it('TEST 12: should generate slow_resource for performance resources with duration >= 500ms', () => {
    const events = [
      createMockResourceEvent('evt_res_slow', '2026-08-17T08:00:00.000Z', 'https://www.hidevs.xyz/bundle.js', 'script', 1000)
    ];

    const patterns = aggregateEvents(events);
    const findings = patterns.flatMap((p) => detectInsightsFromPattern(p));

    const slowResFinding = findings.find((f) => f.findingType === 'slow_resource');
    expect(slowResFinding).toBeDefined();
    expect(slowResFinding?.evidence.durationMs).toBe(1000);
  });

  // TEST 13 — Large resource
  it('TEST 13: should generate large_resource for resources with size >= 1MB (e.g. 2MB)', () => {
    const events = [
      createMockResourceEvent('evt_res_large', '2026-08-17T08:00:00.000Z', 'https://www.hidevs.xyz/video.mp4', 'media', 100, 2_000_000)
    ];

    const patterns = aggregateEvents(events);
    const findings = patterns.flatMap((p) => detectInsightsFromPattern(p));

    const largeFinding = findings.find((f) => f.findingType === 'large_resource');
    expect(largeFinding).toBeDefined();
    expect(largeFinding?.evidence.decodedBodySize).toBe(2_000_000);
  });

  // TEST 14 — Repeated resource
  it('TEST 14: should generate repeated_resource when resource is loaded >= 5 times in the window', () => {
    const events = Array.from({ length: 5 }, (_, i) =>
      createMockResourceEvent(`evt_res_${i}`, `2026-08-17T08:00:0${i}.000Z`, 'https://www.hidevs.xyz/icon.svg', 'img')
    );

    const patterns = aggregateEvents(events, { windowMs: 5000 });
    const findings = patterns.flatMap((p) => detectInsightsFromPattern(p));

    const repResFinding = findings.find((f) => f.findingType === 'repeated_resource');
    expect(repResFinding).toBeDefined();
    expect(repResFinding?.evidence.count).toBe(5);
  });

  // TEST 15 — Long task
  it('TEST 15: should generate long_task for main-thread long task lasting >= 50ms', () => {
    const events = [createMockLongTaskEvent('evt_lt', '2026-08-17T08:00:00.000Z', 250)];

    const patterns = aggregateEvents(events);
    const findings = patterns.flatMap((p) => detectInsightsFromPattern(p));

    const ltFinding = findings.find((f) => f.findingType === 'long_task');
    expect(ltFinding).toBeDefined();
    expect(ltFinding?.severity).toBe('high');
    expect(ltFinding?.evidence.durationMs).toBe(250);
  });

  // TEST 16 — Missing data
  it('TEST 16: should not generate invalid findings when optional timing/size fields are missing', () => {
    const mockPerfEvent: NormalizedEvent = {
      eventId: 'evt_no_data',
      category: 'performance',
      timestamp: '2026-08-17T08:00:00.000Z',
      context: createMockContext(),
      data: {
        performanceType: 'resource',
        name: 'https://www.hidevs.xyz/asset.png',
        initiatorType: 'img',
        durationMs: 0,
        startTime: 0,
        responseEnd: 0,
        transferSize: 0,
        encodedBodySize: 0,
        decodedBodySize: 0,
        dnsMs: 0,
        connectMs: 0,
        responseMs: 0,
        timestamp: '2026-08-17T08:00:00.000Z'
      }
    };

    const patterns = aggregateEvents([mockPerfEvent]);
    const findings = patterns.flatMap((p) => detectInsightsFromPattern(p));

    expect(findings.some((f) => f.findingType === 'slow_resource')).toBe(false);
    expect(findings.some((f) => f.findingType === 'large_resource')).toBe(false);
  });

  // TEST 17 — Finding traceability
  it('TEST 17: should contain valid aggregationId and eventIds tracing back to normalized events', () => {
    const events = Array.from({ length: 6 }, (_, i) =>
      createMockNetworkEvent(`evt_trace_${i}`, `2026-08-17T08:00:0${i}.000Z`)
    );

    const patterns = aggregateEvents(events);
    const findings = patterns.flatMap((p) => detectInsightsFromPattern(p));

    expect(findings).toHaveLength(1);
    const f = findings[0]!;
    expect(f.evidence.aggregationId).toBe(patterns[0]?.aggregationId);
    expect(f.evidence.eventIds).toEqual(events.map((e) => e.eventId));
  });

  // TEST 18 — Context preservation
  it('TEST 18: should preserve complete hierarchical context in the finding', () => {
    const events = Array.from({ length: 6 }, (_, i) =>
      createMockNetworkEvent(`evt_c_${i}`, `2026-08-17T08:00:0${i}.000Z`, 'GET', 'https://www.hidevs.xyz/api', 'fetch', 200, 40, null, null, {
        sessionId: 'sess_custom_1',
        websiteId: 'web_custom_1',
        websiteOrigin: 'https://www.hidevs.xyz',
        pageId: 'page_custom_1',
        routeId: 'route_custom_1',
        tabId: 999
      })
    );

    const patterns = aggregateEvents(events);
    const findings = patterns.flatMap((p) => detectInsightsFromPattern(p));

    const f = findings[0]!;
    expect(f.context.sessionId).toBe('sess_custom_1');
    expect(f.context.websiteId).toBe('web_custom_1');
    expect(f.context.websiteOrigin).toBe('https://www.hidevs.xyz');
    expect(f.context.pageId).toBe('page_custom_1');
    expect(f.context.routeId).toBe('route_custom_1');
    expect(f.context.tabId).toBe(999);
  });

  // TEST 19 — Website isolation
  it('TEST 19: should isolate findings between different websites', () => {
    const raw = createMultiWebsiteSession();
    const normalized = normalizeSession(raw);
    const aggregated = aggregateSession(normalized);
    const insights = extractInsights(aggregated);

    expect(insights.websites).toHaveLength(2);
    const hidevs = insights.websites.find((w) => w.origin === 'https://www.hidevs.xyz')!;
    const github = insights.websites.find((w) => w.origin === 'https://github.com')!;

    expect(hidevs.pages[0]?.findings.every((f) => f.context.websiteOrigin === 'https://www.hidevs.xyz')).toBe(true);
    expect(github.pages[0]?.findings.every((f) => f.context.websiteOrigin === 'https://github.com')).toBe(true);
  });

  // TEST 20 — Page isolation
  it('TEST 20: should isolate findings between different pages of the same website', () => {
    const page1Events = Array.from({ length: 6 }, (_, i) =>
      createMockNetworkEvent(`evt_p1_${i}`, `2026-08-17T08:00:0${i}.000Z`, 'GET', 'https://www.hidevs.xyz/api/feed', 'fetch', 200, 40, null, null, { pageId: 'page_1' })
    );
    const page2Events = Array.from({ length: 6 }, (_, i) =>
      createMockNetworkEvent(`evt_p2_${i}`, `2026-08-17T08:00:0${i}.000Z`, 'GET', 'https://www.hidevs.xyz/api/feed', 'fetch', 200, 40, null, null, { pageId: 'page_2' })
    );

    const patterns = aggregateEvents([...page1Events, ...page2Events]);
    const findings = patterns.flatMap((p) => detectInsightsFromPattern(p));

    expect(findings).toHaveLength(2);
    expect(findings[0]?.context.pageId).not.toBe(findings[1]?.context.pageId);
  });

  // TEST 21 — No duplicate finding
  it('TEST 21: should generate exactly one finding per matching rule for an aggregated pattern', () => {
    const events = Array.from({ length: 10 }, (_, i) =>
      createMockNetworkEvent(`evt_d_${i}`, `2026-08-17T08:00:0${i % 4}.000Z`, 'GET', 'https://www.hidevs.xyz/api/items')
    );

    const patterns = aggregateEvents(events);
    const findings = patterns.flatMap((p) => detectInsightsFromPattern(p));

    const repFindings = findings.filter((f) => f.findingType === 'repeated_network_request');
    expect(repFindings).toHaveLength(1);
  });

  // TEST 22 — Multiple findings from one pattern
  it('TEST 22: should allow multiple distinct findings from one pattern (e.g. repeated AND slow)', () => {
    const events = Array.from({ length: 10 }, (_, i) =>
      createMockNetworkEvent(`evt_rs_${i}`, `2026-08-17T08:00:0${i % 4}.000Z`, 'GET', 'https://www.hidevs.xyz/api/heavy', 'fetch', 200, 1500)
    );

    const patterns = aggregateEvents(events);
    const findings = patterns.flatMap((p) => detectInsightsFromPattern(p));

    const repFinding = findings.find((f) => f.findingType === 'repeated_network_request');
    const slowFinding = findings.find((f) => f.findingType === 'slow_network_request');

    expect(repFinding).toBeDefined();
    expect(slowFinding).toBeDefined();
    expect(findings).toHaveLength(2);
  });

  // TEST 23 — No root-cause language
  it('TEST 23: should avoid speculative root-cause language in descriptions', () => {
    const events = [
      ...Array.from({ length: 10 }, (_, i) => createMockNetworkEvent(`e1_${i}`, `2026-08-17T08:00:0${i % 4}.000Z`)),
      createMockNetworkEvent('e2', '2026-08-17T08:00:01.000Z', 'GET', 'https://www.hidevs.xyz/api/404', 'fetch', 404),
      createMockNetworkEvent('e3', '2026-08-17T08:00:02.000Z', 'GET', 'https://www.hidevs.xyz/api/500', 'fetch', 500),
      createMockLongTaskEvent('e4', '2026-08-17T08:00:03.000Z', 300)
    ];

    const patterns = aggregateEvents(events);
    const findings = patterns.flatMap((p) => detectInsightsFromPattern(p));

    const forbiddenPhrases = ['caused by', 'definitely broken', 'bug', 'must use', 'should use websockets', 'incorrect implementation'];

    for (const f of findings) {
      const descLower = f.description.toLowerCase();
      for (const phrase of forbiddenPhrases) {
        expect(descLower).not.toContain(phrase);
      }
    }
  });

  // TEST 24 — No recommendations
  it('TEST 24: should not output solution recommendations in findings', () => {
    const raw = createRepeatedEventsSession(10);
    const normalized = normalizeSession(raw);
    const aggregated = aggregateSession(normalized);
    const insights = extractInsights(aggregated);

    for (const f of insights.findings) {
      expect((f as unknown as { recommendation?: unknown }).recommendation).toBeUndefined();
      expect((f as unknown as { solution?: unknown }).solution).toBeUndefined();
    }
  });

  // TEST 25 — Deterministic output
  it('TEST 25: should produce identical findings and IDs when executed multiple times', () => {
    const raw = createRepeatedEventsSession(15);
    const normalized = normalizeSession(raw);
    const aggregated = aggregateSession(normalized);

    const run1 = extractInsights(aggregated);
    const run2 = extractInsights(aggregated);

    expect(run1).toEqual(run2);
  });

  // TEST 26 — Input immutability
  it('TEST 26: should not mutate the aggregated input structure during extraction', () => {
    const raw = createValidSingleWebsiteSession();
    const normalized = normalizeSession(raw);
    const aggregated = aggregateSession(normalized);
    const aggregatedCopy = JSON.parse(JSON.stringify(aggregated));

    extractInsights(aggregated);

    expect(aggregated).toEqual(aggregatedCopy);
  });

  // TEST 27 — Full pipeline
  it('TEST 27: should successfully execute raw -> normalize -> aggregate -> extractInsights', () => {
    const raw = createValidSingleWebsiteSession();
    const normalized = normalizeSession(raw);
    const aggregated = aggregateSession(normalized);
    const insights = extractInsights(aggregated);

    expect(insights.session.sessionId).toBe(raw.session.sessionId);
    expect(insights.websites).toHaveLength(1);
    expect(insights.findings.length).toBeGreaterThan(0);

    const longTaskFinding = insights.findings.find((f) => f.findingType === 'long_task');
    expect(longTaskFinding).toBeDefined();
    expect(longTaskFinding?.evidence.durationMs).toBe(85);
  });

  // TEST 28 — Noisy session
  it('TEST 28: should generate findings only for meaningful patterns without excessive noise on normal activity', () => {
    const normalEvents: NormalizedEvent[] = [
      // 1 normal console log (should not create finding)
      createMockConsoleEvent('norm_c1', '2026-08-17T08:00:00.000Z', 'log', 'User navigated'),
      // 2 repeated warnings (below threshold 3 -> no finding)
      createMockConsoleEvent('norm_w1', '2026-08-17T08:00:01.000Z', 'warn', 'Small warning'),
      createMockConsoleEvent('norm_w2', '2026-08-17T08:00:02.000Z', 'warn', 'Small warning'),
      // 5 repeated errors (threshold 3 -> 1 finding)
      ...Array.from({ length: 5 }, (_, i) => createMockConsoleEvent(`err_${i}`, `2026-08-17T08:00:0${i}.000Z`, 'error', 'API 500')),
      // 1 normal fast 200 request (no finding)
      createMockNetworkEvent('norm_n1', '2026-08-17T08:00:01.000Z', 'GET', 'https://www.hidevs.xyz/api/ok', 'fetch', 200, 50),
      // 10 repeated GET requests (threshold 5 -> 1 finding)
      ...Array.from({ length: 10 }, (_, i) => createMockNetworkEvent(`rep_get_${i}`, `2026-08-17T08:00:0${i % 4}.000Z`, 'GET', 'https://www.hidevs.xyz/api/feed')),
      // 1 × 404 (1 finding)
      createMockNetworkEvent('n_404', '2026-08-17T08:00:02.000Z', 'GET', 'https://www.hidevs.xyz/api/missing', 'fetch', 404, 50),
      // 1 × 500 (1 finding)
      createMockNetworkEvent('n_500', '2026-08-17T08:00:03.000Z', 'POST', 'https://www.hidevs.xyz/api/save', 'fetch', 500, 100),
      // 1 slow request 1500ms (1 finding)
      createMockNetworkEvent('n_slow', '2026-08-17T08:00:04.000Z', 'GET', 'https://www.hidevs.xyz/api/slow', 'fetch', 200, 1500),
      // 2 normal small resources (no finding)
      createMockResourceEvent('res_1', '2026-08-17T08:00:01.000Z', 'https://www.hidevs.xyz/a.css', 'css', 30, 2000),
      createMockResourceEvent('res_2', '2026-08-17T08:00:02.000Z', 'https://www.hidevs.xyz/b.js', 'script', 40, 5000),
      // 1 large resource (2MB -> 1 finding)
      createMockResourceEvent('res_large', '2026-08-17T08:00:03.000Z', 'https://www.hidevs.xyz/img.png', 'img', 100, 2_000_000),
      // 1 long task (150ms -> 1 finding)
      createMockLongTaskEvent('lt_1', '2026-08-17T08:00:04.000Z', 150)
    ];

    const patterns = aggregateEvents(normalEvents);
    const findings = patterns.flatMap((p) => detectInsightsFromPattern(p));

    // Expected findings:
    // 1. repeated_console_error (count = 5)
    // 2. repeated_network_request (count = 10)
    // 3. failed_network_request (404)
    // 4. failed_network_request (500)
    // 5. slow_network_request (1500ms)
    // 6. large_resource (2MB)
    // 7. long_task (150ms)
    // Total findings = 7
    expect(findings).toHaveLength(7);

    const findingTypes = findings.map((f) => f.findingType);
    expect(findingTypes).toContain('repeated_console_error');
    expect(findingTypes).toContain('repeated_network_request');
    expect(findingTypes).toContain('failed_network_request');
    expect(findingTypes).toContain('slow_network_request');
    expect(findingTypes).toContain('large_resource');
    expect(findingTypes).toContain('long_task');
  });
});
