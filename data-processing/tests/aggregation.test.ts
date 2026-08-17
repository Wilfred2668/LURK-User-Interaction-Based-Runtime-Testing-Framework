import { describe, expect, it } from 'vitest';
import { normalizeSession } from '../src/normalization/normalize-session.js';
import { aggregateEvents } from '../src/aggregation/aggregate-events.js';
import { aggregateSession } from '../src/aggregation/aggregate-session.js';
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
      status: 200,
      statusText: 'OK',
      ok: true,
      durationMs: 40,
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
      durationMs: 25,
      startTime: 100,
      responseEnd: 125,
      transferSize: 5000,
      encodedBodySize: 4500,
      decodedBodySize: 4500,
      dnsMs: 5,
      connectMs: 10,
      responseMs: 10,
      timestamp
    }
  };
}

describe('Layer 2 Aggregation & Repeated-Pattern Detection Suite', () => {
  // TEST 1 — Basic repeated network requests
  it('TEST 1: should aggregate 10 identical GET requests within 5s into one group with count 10', () => {
    const events = Array.from({ length: 10 }, (_, i) =>
      createMockNetworkEvent(`evt_${i}`, `2026-08-17T08:00:0${i % 5}.000Z`)
    );

    const patterns = aggregateEvents(events, { windowMs: 5000 });
    expect(patterns).toHaveLength(1);
    expect(patterns[0]?.count).toBe(10);
    expect(patterns[0]?.patternType).toBe('repeated_network');
    expect(patterns[0]?.category).toBe('network');
    expect(patterns[0]?.eventIds).toHaveLength(10);
  });

  // TEST 2 — Repeated request outside time window
  it('TEST 2: should separate repeated requests exceeding the time window into distinct groups', () => {
    const events = [
      createMockNetworkEvent('evt_0', '2026-08-17T08:00:00.000Z'),
      createMockNetworkEvent('evt_1', '2026-08-17T08:00:01.000Z'),
      createMockNetworkEvent('evt_2', '2026-08-17T08:00:02.000Z'),
      createMockNetworkEvent('evt_8', '2026-08-17T08:00:08.000Z') // +8s > 5s window
    ];

    const patterns = aggregateEvents(events, { windowMs: 5000 });
    expect(patterns).toHaveLength(2);
    expect(patterns[0]?.count).toBe(3);
    expect(patterns[0]?.eventIds).toEqual(['evt_0', 'evt_1', 'evt_2']);
    expect(patterns[1]?.count).toBe(1);
    expect(patterns[1]?.eventIds).toEqual(['evt_8']);
  });

  // TEST 3 — Different HTTP methods
  it('TEST 3: should not combine GET and POST requests even if same URL and window', () => {
    const events = [
      createMockNetworkEvent('evt_get_1', '2026-08-17T08:00:00.000Z', 'GET'),
      createMockNetworkEvent('evt_post_1', '2026-08-17T08:00:01.000Z', 'POST'),
      createMockNetworkEvent('evt_get_2', '2026-08-17T08:00:02.000Z', 'GET')
    ];

    const patterns = aggregateEvents(events, { windowMs: 5000 });
    expect(patterns).toHaveLength(2);

    const getGroup = patterns.find((p) => (p.key as { method: string }).method === 'GET');
    const postGroup = patterns.find((p) => (p.key as { method: string }).method === 'POST');

    expect(getGroup?.count).toBe(2);
    expect(postGroup?.count).toBe(1);
  });

  // TEST 4 — Different URLs
  it('TEST 4: should not combine requests to different URLs', () => {
    const events = [
      createMockNetworkEvent('evt_u1', '2026-08-17T08:00:00.000Z', 'GET', 'https://www.hidevs.xyz/api/users'),
      createMockNetworkEvent('evt_l1', '2026-08-17T08:00:01.000Z', 'GET', 'https://www.hidevs.xyz/api/leaderboard')
    ];

    const patterns = aggregateEvents(events, { windowMs: 5000 });
    expect(patterns).toHaveLength(2);
  });

  // TEST 5 — Different pages
  it('TEST 5: should strictly isolate identical requests occurring on different pages', () => {
    const events = [
      createMockNetworkEvent('evt_pA_1', '2026-08-17T08:00:00.000Z', 'GET', 'https://www.hidevs.xyz/api/data', 'fetch', { pageId: 'page_A' }),
      createMockNetworkEvent('evt_pA_2', '2026-08-17T08:00:01.000Z', 'GET', 'https://www.hidevs.xyz/api/data', 'fetch', { pageId: 'page_A' }),
      createMockNetworkEvent('evt_pB_1', '2026-08-17T08:00:02.000Z', 'GET', 'https://www.hidevs.xyz/api/data', 'fetch', { pageId: 'page_B' })
    ];

    const patterns = aggregateEvents(events, { windowMs: 5000 });
    expect(patterns).toHaveLength(2);

    const pageAGroup = patterns.find((p) => p.context.pageId === 'page_A');
    const pageBGroup = patterns.find((p) => p.context.pageId === 'page_B');

    expect(pageAGroup?.count).toBe(2);
    expect(pageBGroup?.count).toBe(1);
  });

  // TEST 6 — Different routes
  it('TEST 6: should isolate identical requests occurring on different routes of the same page', () => {
    const events = [
      createMockNetworkEvent('evt_r1', '2026-08-17T08:00:00.000Z', 'GET', 'https://www.hidevs.xyz/api/scores', 'fetch', { routeId: 'route_dashboard' }),
      createMockNetworkEvent('evt_r2', '2026-08-17T08:00:01.000Z', 'GET', 'https://www.hidevs.xyz/api/scores', 'fetch', { routeId: 'route_scores_hash' })
    ];

    const patterns = aggregateEvents(events, { windowMs: 5000 });
    expect(patterns).toHaveLength(2);
  });

  // TEST 7 — Different websites
  it('TEST 7: should strictly isolate requests across different websites', () => {
    const events = [
      createMockNetworkEvent('evt_w1', '2026-08-17T08:00:00.000Z', 'GET', 'https://www.hidevs.xyz/api/ping', 'fetch', { websiteId: 'web_hidevs', websiteOrigin: 'https://www.hidevs.xyz' }),
      createMockNetworkEvent('evt_w2', '2026-08-17T08:00:01.000Z', 'GET', 'https://github.com/api/ping', 'fetch', { websiteId: 'web_github', websiteOrigin: 'https://github.com' })
    ];

    const patterns = aggregateEvents(events, { windowMs: 5000 });
    expect(patterns).toHaveLength(2);
    expect(patterns[0]?.context.websiteOrigin).toBe('https://www.hidevs.xyz');
    expect(patterns[1]?.context.websiteOrigin).toBe('https://github.com');
  });

  // TEST 8 — Console repeated errors
  it('TEST 8: should aggregate 10 identical console errors into repeated_console group with count 10', () => {
    const events = Array.from({ length: 10 }, (_, i) =>
      createMockConsoleEvent(`evt_c_${i}`, `2026-08-17T08:00:0${i % 4}.000Z`, 'error', 'API failed')
    );

    const patterns = aggregateEvents(events, { windowMs: 5000 });
    expect(patterns).toHaveLength(1);
    expect(patterns[0]?.category).toBe('console');
    expect(patterns[0]?.patternType).toBe('repeated_console');
    expect(patterns[0]?.count).toBe(10);
    expect(patterns[0]?.eventIds).toHaveLength(10);
  });

  // TEST 9 — Different console levels
  it('TEST 9: should separate console events with different log levels', () => {
    const events = [
      createMockConsoleEvent('evt_warn', '2026-08-17T08:00:00.000Z', 'warn', 'API failed'),
      createMockConsoleEvent('evt_error', '2026-08-17T08:00:01.000Z', 'error', 'API failed')
    ];

    const patterns = aggregateEvents(events, { windowMs: 5000 });
    expect(patterns).toHaveLength(2);
  });

  // TEST 10 — Different console messages
  it('TEST 10: should separate console events with different messages', () => {
    const events = [
      createMockConsoleEvent('evt_c1', '2026-08-17T08:00:00.000Z', 'error', 'Message A'),
      createMockConsoleEvent('evt_c2', '2026-08-17T08:00:01.000Z', 'error', 'Message B')
    ];

    const patterns = aggregateEvents(events, { windowMs: 5000 });
    expect(patterns).toHaveLength(2);
  });

  // TEST 11 — Performance resources
  it('TEST 11: should group identical repeated resource timing events within the window', () => {
    const events = [
      createMockResourceEvent('evt_res_1', '2026-08-17T08:00:00.000Z', 'https://www.hidevs.xyz/icon.png', 'img'),
      createMockResourceEvent('evt_res_2', '2026-08-17T08:00:01.000Z', 'https://www.hidevs.xyz/icon.png', 'img'),
      createMockResourceEvent('evt_res_3', '2026-08-17T08:00:02.000Z', 'https://www.hidevs.xyz/icon.png', 'img')
    ];

    const patterns = aggregateEvents(events, { windowMs: 5000 });
    expect(patterns).toHaveLength(1);
    expect(patterns[0]?.category).toBe('performance');
    expect(patterns[0]?.patternType).toBe('repeated_resource');
    expect(patterns[0]?.count).toBe(3);
  });

  // TEST 12 — Unique performance events
  it('TEST 12: should not group distinct resource performance events', () => {
    const events = [
      createMockResourceEvent('evt_res_1', '2026-08-17T08:00:00.000Z', 'https://www.hidevs.xyz/logo.png'),
      createMockResourceEvent('evt_res_2', '2026-08-17T08:00:01.000Z', 'https://www.hidevs.xyz/banner.jpg')
    ];

    const patterns = aggregateEvents(events, { windowMs: 5000 });
    expect(patterns).toHaveLength(2);
    expect(patterns[0]?.count).toBe(1);
    expect(patterns[1]?.count).toBe(1);
    expect(patterns[0]?.patternType).toBe('performance_event');
  });

  // TEST 13 — Single event preservation
  it('TEST 13: should preserve single events with count = 1 and appropriate single patternType', () => {
    const events = [createMockNetworkEvent('evt_single', '2026-08-17T08:00:00.000Z')];

    const patterns = aggregateEvents(events, { windowMs: 5000 });
    expect(patterns).toHaveLength(1);
    expect(patterns[0]?.count).toBe(1);
    expect(patterns[0]?.patternType).toBe('network_event');
    expect(patterns[0]?.representativeEventId).toBe('evt_single');
  });

  // TEST 14 — Event count preservation
  it('TEST 14: should preserve exact event counts (sum of group counts === input event count)', () => {
    const raw = createRepeatedEventsSession(30); // 30 console, 30 network, 30 perf = 90 events
    const normalized = normalizeSession(raw);

    const patterns = aggregateEvents(normalized.events, { windowMs: 5000 });
    const totalCountInPatterns = patterns.reduce((sum, p) => sum + p.count, 0);

    expect(totalCountInPatterns).toBe(normalized.events.length);
    expect(totalCountInPatterns).toBe(90);
  });

  // TEST 15 — Event ID traceability
  it('TEST 15: should contain every input eventId exactly once across all aggregated groups', () => {
    const raw = createRepeatedEventsSession(10);
    const normalized = normalizeSession(raw);

    const patterns = aggregateEvents(normalized.events, { windowMs: 5000 });
    const collectedEventIds = patterns.flatMap((p) => p.eventIds);

    expect(collectedEventIds).toHaveLength(normalized.events.length);
    expect(new Set(collectedEventIds).size).toBe(normalized.events.length);
  });

  // TEST 16 — No cross-session aggregation
  it('TEST 16: should not aggregate events across different sessions', () => {
    const events = [
      createMockNetworkEvent('evt_s1', '2026-08-17T08:00:00.000Z', 'GET', 'https://example.com/api', 'fetch', { sessionId: 'sess_1' }),
      createMockNetworkEvent('evt_s2', '2026-08-17T08:00:01.000Z', 'GET', 'https://example.com/api', 'fetch', { sessionId: 'sess_2' })
    ];

    const patterns = aggregateEvents(events, { windowMs: 5000 });
    expect(patterns).toHaveLength(2);
    expect(patterns[0]?.context.sessionId).toBe('sess_1');
    expect(patterns[1]?.context.sessionId).toBe('sess_2');
  });

  // TEST 17 — No raw mutation
  it('TEST 17: should not mutate the original raw session package', () => {
    const raw = createValidSingleWebsiteSession();
    const rawCopy = JSON.parse(JSON.stringify(raw));

    const normalized = normalizeSession(raw);
    aggregateSession(normalized);

    expect(raw).toEqual(rawCopy);
  });

  // TEST 18 — No normalization mutation
  it('TEST 18: should not mutate the normalized session data during aggregation', () => {
    const raw = createValidSingleWebsiteSession();
    const normalized = normalizeSession(raw);
    const normalizedCopy = JSON.parse(JSON.stringify(normalized));

    aggregateSession(normalized);

    expect(normalized).toEqual(normalizedCopy);
  });

  // TEST 19 — Deterministic output
  it('TEST 19: should produce identical aggregated patterns when executed repeatedly', () => {
    const raw = createRepeatedEventsSession(15);
    const normalized = normalizeSession(raw);

    const run1 = aggregateSession(normalized, { windowMs: 5000 });
    const run2 = aggregateSession(normalized, { windowMs: 5000 });

    expect(run1).toEqual(run2);
  });

  // TEST 20 — Unsorted input
  it('TEST 20: should produce deterministic chronological aggregation even if input is shuffled', () => {
    const events = [
      createMockNetworkEvent('evt_3', '2026-08-17T08:00:03.000Z'),
      createMockNetworkEvent('evt_1', '2026-08-17T08:00:01.000Z'),
      createMockNetworkEvent('evt_8', '2026-08-17T08:00:08.000Z'),
      createMockNetworkEvent('evt_0', '2026-08-17T08:00:00.000Z'),
      createMockNetworkEvent('evt_2', '2026-08-17T08:00:02.000Z')
    ];

    const patterns = aggregateEvents(events, { windowMs: 5000 });
    expect(patterns).toHaveLength(2);
    expect(patterns[0]?.count).toBe(4); // 0s, 1s, 2s, 3s
    expect(patterns[0]?.firstSeenAt).toBe('2026-08-17T08:00:00.000Z');
    expect(patterns[0]?.lastSeenAt).toBe('2026-08-17T08:00:03.000Z');
    expect(patterns[1]?.count).toBe(1); // 8s
  });

  // TEST 21 — Identical timestamps
  it('TEST 21: should cleanly group multiple events with identical timestamps', () => {
    const events = [
      createMockNetworkEvent('evt_same_1', '2026-08-17T08:00:00.000Z'),
      createMockNetworkEvent('evt_same_2', '2026-08-17T08:00:00.000Z'),
      createMockNetworkEvent('evt_same_3', '2026-08-17T08:00:00.000Z')
    ];

    const patterns = aggregateEvents(events, { windowMs: 5000 });
    expect(patterns).toHaveLength(1);
    expect(patterns[0]?.count).toBe(3);
    expect(patterns[0]?.timeSpanMs).toBe(0);
  });

  // TEST 22 — Empty input
  it('TEST 22: should handle empty event input gracefully without throwing errors', () => {
    const patterns = aggregateEvents([]);
    expect(patterns).toEqual([]);
  });

  // TEST 23 — Configuration
  it('TEST 23: should respect custom aggregation window sizes (e.g. 1000ms vs 5000ms)', () => {
    const events = [
      createMockNetworkEvent('evt_0', '2026-08-17T08:00:00.000Z'),
      createMockNetworkEvent('evt_2', '2026-08-17T08:00:02.000Z'),
      createMockNetworkEvent('evt_3', '2026-08-17T08:00:03.000Z')
    ];

    // With 5000ms window -> all 3 fit in 1 group (0s to 3s <= 5s)
    const patterns5s = aggregateEvents(events, { windowMs: 5000 });
    expect(patterns5s).toHaveLength(1);
    expect(patterns5s[0]?.count).toBe(3);

    // With 1000ms window -> 0s is one group, 2s & 3s is another group
    const patterns1s = aggregateEvents(events, { windowMs: 1000 });
    expect(patterns1s).toHaveLength(2);
    expect(patterns1s[0]?.count).toBe(1);
    expect(patterns1s[1]?.count).toBe(2);
  });

  // TEST 24 — Full pipeline
  it('TEST 24: should execute raw -> normalize -> aggregate across full session hierarchy', () => {
    const raw = createMultiWebsiteSession();
    const normalized = normalizeSession(raw);
    const aggregated = aggregateSession(normalized, { windowMs: 5000 });

    expect(aggregated.session.sessionId).toBe(raw.session.sessionId);
    expect(aggregated.websites).toHaveLength(2);

    const totalPatterns = aggregated.websites.flatMap((w) => w.pages.flatMap((p) => p.patterns));
    expect(totalPatterns).toHaveLength(aggregated.patterns.length);
  });

  // IMPORTANT REQUIRED COMPLEX SCENARIO TEST
  it('IMPORTANT SCENARIO: should properly group complex multi-category page events without mixing unrelated categories', () => {
    // 10 × GET /api/leaderboard
    const getLeaderboardEvents = Array.from({ length: 10 }, (_, i) =>
      createMockNetworkEvent(`evt_lb_get_${i}`, `2026-08-17T08:00:0${i % 4}.000Z`, 'GET', 'https://www.hidevs.xyz/api/leaderboard')
    );

    // 10 × GET /api/users
    const getUsersEvents = Array.from({ length: 10 }, (_, i) =>
      createMockNetworkEvent(`evt_usr_get_${i}`, `2026-08-17T08:00:0${i % 4}.000Z`, 'GET', 'https://www.hidevs.xyz/api/users')
    );

    // 5 × POST /api/leaderboard
    const postLeaderboardEvents = Array.from({ length: 5 }, (_, i) =>
      createMockNetworkEvent(`evt_lb_post_${i}`, `2026-08-17T08:00:0${i % 4}.000Z`, 'POST', 'https://www.hidevs.xyz/api/leaderboard')
    );

    // 3 × console.error("Leaderboard failed")
    const consoleEvents = Array.from({ length: 3 }, (_, i) =>
      createMockConsoleEvent(`evt_lb_err_${i}`, `2026-08-17T08:00:0${i % 3}.000Z`, 'error', 'Leaderboard failed')
    );

    // 4 × unique performance resources
    const perfEvents = [
      createMockResourceEvent('evt_res_1', '2026-08-17T08:00:01.000Z', 'https://www.hidevs.xyz/app.js', 'script'),
      createMockResourceEvent('evt_res_2', '2026-08-17T08:00:02.000Z', 'https://www.hidevs.xyz/style.css', 'css'),
      createMockResourceEvent('evt_res_3', '2026-08-17T08:00:03.000Z', 'https://www.hidevs.xyz/logo.svg', 'img'),
      createMockResourceEvent('evt_res_4', '2026-08-17T08:00:04.000Z', 'https://www.hidevs.xyz/font.woff2', 'font')
    ];

    const allEvents: NormalizedEvent[] = [
      ...getLeaderboardEvents,
      ...getUsersEvents,
      ...postLeaderboardEvents,
      ...consoleEvents,
      ...perfEvents
    ];

    expect(allEvents).toHaveLength(32);

    const patterns = aggregateEvents(allEvents, { windowMs: 5000 });

    // Expecting:
    // 1. repeated_network for GET /api/leaderboard (count = 10)
    // 2. repeated_network for GET /api/users (count = 10)
    // 3. repeated_network for POST /api/leaderboard (count = 5)
    // 4. repeated_console for "Leaderboard failed" (count = 3)
    // 5-8. 4 individual performance_event resource groups (count = 1 each)
    // Total groups = 8
    expect(patterns).toHaveLength(8);

    const getLbPattern = patterns.find((p) => (p.key as { method?: string; url?: string }).url === 'https://www.hidevs.xyz/api/leaderboard' && (p.key as { method?: string }).method === 'GET');
    const getUserPattern = patterns.find((p) => (p.key as { method?: string; url?: string }).url === 'https://www.hidevs.xyz/api/users' && (p.key as { method?: string }).method === 'GET');
    const postLbPattern = patterns.find((p) => (p.key as { method?: string; url?: string }).url === 'https://www.hidevs.xyz/api/leaderboard' && (p.key as { method?: string }).method === 'POST');
    const consolePattern = patterns.find((p) => p.category === 'console');
    const perfPatterns = patterns.filter((p) => p.category === 'performance');

    expect(getLbPattern?.count).toBe(10);
    expect(getLbPattern?.patternType).toBe('repeated_network');

    expect(getUserPattern?.count).toBe(10);
    expect(getUserPattern?.patternType).toBe('repeated_network');

    expect(postLbPattern?.count).toBe(5);
    expect(postLbPattern?.patternType).toBe('repeated_network');

    expect(consolePattern?.count).toBe(3);
    expect(consolePattern?.patternType).toBe('repeated_console');

    expect(perfPatterns).toHaveLength(4);
    for (const p of perfPatterns) {
      expect(p.count).toBe(1);
      expect(p.patternType).toBe('performance_event');
    }

    const totalAggregatedCount = patterns.reduce((sum, p) => sum + p.count, 0);
    expect(totalAggregatedCount).toBe(32);
  });
});
