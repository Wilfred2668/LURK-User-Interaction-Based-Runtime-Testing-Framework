import { describe, expect, it } from 'vitest';
import { normalizeSession } from '../src/normalization/normalize-session.js';
import { validateSessionPackage } from '../src/validation/validate-session.js';
import { SessionValidationError } from '../src/validation/validation-error.js';
import type { RawFinalizedSessionPackage } from '../src/types/raw.js';
import {
  createEmptyEventsSession,
  createMultiWebsiteSession,
  createRepeatedEventsSession,
  createValidSingleWebsiteSession
} from './fixtures/session-fixtures.js';

describe('Layer 2 Normalization Test Suite', () => {
  // TEST 1 — Basic session normalization
  it('TEST 1: should normalize a valid finalized session package into a clean structure', () => {
    const raw = createValidSingleWebsiteSession();
    const result = normalizeSession(raw);

    expect(result).toBeDefined();
    expect(result.session).toBeDefined();
    expect(result.websites).toHaveLength(1);
    expect(result.events.length).toBeGreaterThan(0);
  });

  // TEST 2 — Session metadata preservation
  it('TEST 2: should preserve exact session metadata', () => {
    const raw = createValidSingleWebsiteSession();
    const result = normalizeSession(raw);

    expect(result.session.sessionId).toBe(raw.session.sessionId);
    expect(result.session.status).toBe(raw.session.status);
    expect(result.session.startedAt).toBe(raw.session.startedAt);
    expect(result.session.endedAt).toBe(raw.session.endedAt);
    expect(result.session.durationMs).toBe(raw.session.durationMs);
    expect(result.session.rootUrl).toBe(raw.session.rootUrl);
    expect(result.session.activeTabId).toBe(raw.session.activeTabId);
  });

  // TEST 3 — Website normalization
  it('TEST 3: should normalize multiple websites into distinct website objects', () => {
    const raw = createMultiWebsiteSession();
    const result = normalizeSession(raw);

    expect(result.websites).toHaveLength(2);
    expect(result.websites[0]?.origin).toBe('https://www.hidevs.xyz');
    expect(result.websites[1]?.origin).toBe('https://github.com');
  });

  // TEST 4 — Website identity preservation
  it('TEST 4: should preserve website identity attributes', () => {
    const raw = createMultiWebsiteSession();
    const result = normalizeSession(raw);

    const w0 = result.websites[0]!;
    const rawW0 = raw.websites[0]!;
    expect(w0.websiteId).toBe(rawW0.websiteId);
    expect(w0.sessionId).toBe(rawW0.sessionId);
    expect(w0.origin).toBe(rawW0.origin);
    expect(w0.firstSeenAt).toBe(rawW0.firstSeenAt);
    expect(w0.lastSeenAt).toBe(rawW0.lastSeenAt);
  });

  // TEST 5 — Page normalization
  it('TEST 5: should preserve page hierarchy under the correct website', () => {
    const raw = createValidSingleWebsiteSession();
    const result = normalizeSession(raw);

    const website = result.websites[0]!;
    expect(website.pages).toHaveLength(2);
    expect(website.pages[0]?.pageId).toBe('page_001');
    expect(website.pages[1]?.pageId).toBe('page_002');
    expect(website.pages[0]?.websiteId).toBe(website.websiteId);
    expect(website.pages[0]?.websiteOrigin).toBe(website.origin);
  });

  // TEST 6 — Route normalization
  it('TEST 6: should preserve routes under the correct page with correct context', () => {
    const raw = createValidSingleWebsiteSession();
    const result = normalizeSession(raw);

    const page2 = result.websites[0]!.pages[1]!;
    expect(page2.routes).toHaveLength(2);
    expect(page2.routes[0]?.routeId).toBe('route_002');
    expect(page2.routes[1]?.routeId).toBe('route_003');
    expect(page2.routes[1]?.hash).toBe('#faq');
    expect(page2.routes[1]?.navigationType).toBe('hashchange');
    expect(page2.routes[1]?.websiteOrigin).toBe('https://www.hidevs.xyz');
  });

  // TEST 7 — Console normalization
  it('TEST 7: should normalize console events with category and full payload preserved', () => {
    const raw = createValidSingleWebsiteSession();
    const result = normalizeSession(raw);

    const consoleEvent = result.events.find((e) => e.category === 'console');
    expect(consoleEvent).toBeDefined();
    expect(consoleEvent?.category).toBe('console');
    expect(consoleEvent?.data.level).toBe('info');
    expect(consoleEvent?.data.message).toBe('App loaded');
    expect(consoleEvent?.context.websiteOrigin).toBe('https://www.hidevs.xyz');
    expect(consoleEvent?.context.pageId).toBe('page_001');
  });

  // TEST 8 — Network normalization
  it('TEST 8: should normalize network events with category and full payload preserved', () => {
    const raw = createValidSingleWebsiteSession();
    const result = normalizeSession(raw);

    const networkEvent = result.events.find((e) => e.category === 'network');
    expect(networkEvent).toBeDefined();
    expect(networkEvent?.category).toBe('network');
    expect(networkEvent?.data.requestType).toBe('fetch');
    expect(networkEvent?.data.method).toBe('GET');
    expect(networkEvent?.data.status).toBe(200);
    expect(networkEvent?.data.durationMs).toBe(45);
    expect(networkEvent?.context.websiteOrigin).toBe('https://www.hidevs.xyz');
  });

  // TEST 9 — Performance normalization
  it('TEST 9: should normalize performance events (navigation & longtask) with category preserved', () => {
    const raw = createValidSingleWebsiteSession();
    const result = normalizeSession(raw);

    const perfEvents = result.events.filter((e) => e.category === 'performance');
    expect(perfEvents).toHaveLength(2);

    const navPerf = perfEvents.find((e) => e.data.performanceType === 'navigation');
    expect(navPerf).toBeDefined();
    expect(navPerf?.data.performanceType).toBe('navigation');

    const longTaskPerf = perfEvents.find((e) => e.data.performanceType === 'longtask');
    expect(longTaskPerf).toBeDefined();
    expect(longTaskPerf?.data.performanceType).toBe('longtask');
    expect(longTaskPerf?.data.durationMs).toBe(85);
  });

  // TEST 10 — Multi-website isolation
  it('TEST 10: should strictly isolate events between different websites in the same session', () => {
    const raw = createMultiWebsiteSession();
    const result = normalizeSession(raw);

    const hidevsWebsite = result.websites.find((w) => w.origin === 'https://www.hidevs.xyz')!;
    const githubWebsite = result.websites.find((w) => w.origin === 'https://github.com')!;

    const hidevsEvents = hidevsWebsite.pages.flatMap((p) => p.events);
    const githubEvents = githubWebsite.pages.flatMap((p) => p.events);

    expect(hidevsEvents).toHaveLength(1);
    expect(hidevsEvents[0]?.context.websiteOrigin).toBe('https://www.hidevs.xyz');

    expect(githubEvents).toHaveLength(1);
    expect(githubEvents[0]?.context.websiteOrigin).toBe('https://github.com');
  });

  // TEST 11 — Multi-tab preservation
  it('TEST 11: should preserve tabId associations across pages and events', () => {
    const raw = createMultiWebsiteSession();
    const result = normalizeSession(raw);

    const page1 = result.websites[0]!.pages[0]!;
    const page2 = result.websites[1]!.pages[0]!;

    expect(page1.tabId).toBe(201);
    expect(page1.events[0]?.context.tabId).toBe(201);

    expect(page2.tabId).toBe(202);
    expect(page2.events[0]?.context.tabId).toBe(202);
  });

  // TEST 12 — Repeated console events are NOT aggregated
  it('TEST 12: should keep 10 identical console events as 10 distinct normalized events', () => {
    const raw = createRepeatedEventsSession(10);
    const result = normalizeSession(raw);

    const consoleEvents = result.events.filter((e) => e.category === 'console');
    expect(consoleEvents).toHaveLength(10);
    expect(new Set(consoleEvents.map((e) => e.eventId)).size).toBe(10);
  });

  // TEST 13 — Repeated network events are NOT aggregated
  it('TEST 13: should keep 10 identical network events as 10 distinct normalized events', () => {
    const raw = createRepeatedEventsSession(10);
    const result = normalizeSession(raw);

    const networkEvents = result.events.filter((e) => e.category === 'network');
    expect(networkEvents).toHaveLength(10);
    expect(new Set(networkEvents.map((e) => e.eventId)).size).toBe(10);
  });

  // TEST 14 — Empty event list
  it('TEST 14: should normalize a session with zero events without error', () => {
    const raw = createEmptyEventsSession();
    const result = normalizeSession(raw);

    expect(result.events).toHaveLength(0);
    expect(result.websites[0]?.pages[0]?.events).toHaveLength(0);
    expect(result.websites[0]?.pages[0]?.routes).toHaveLength(1);
  });

  // TEST 15 — Invalid session
  it('TEST 15: should fail validation when session metadata is invalid or missing', () => {
    const invalid = {
      session: {
        sessionId: '', // empty
        status: 'active', // not finalized
        startedAt: 'invalid-date',
        endedAt: 'invalid-date',
        durationMs: -50
      },
      websites: []
    };

    const validation = validateSessionPackage(invalid);
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);

    expect(() => normalizeSession(invalid as unknown as RawFinalizedSessionPackage)).toThrow(
      SessionValidationError
    );
  });

  // TEST 16 — Invalid website
  it('TEST 16: should fail validation when website origin is invalid', () => {
    const raw = createValidSingleWebsiteSession();
    const invalidWebsite = {
      ...raw,
      websites: [
        {
          ...raw.websites[0]!,
          origin: 'not-a-valid-url-origin'
        }
      ]
    };

    const validation = validateSessionPackage(invalidWebsite);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes('origin'))).toBe(true);
  });

  // TEST 17 — Invalid event
  it('TEST 17: should fail validation when event has missing required identity', () => {
    const raw = createValidSingleWebsiteSession();
    const invalidEvent = {
      ...raw,
      websites: [
        {
          ...raw.websites[0]!,
          pages: [
            {
              ...raw.websites[0]!.pages[0]!,
              events: [
                {
                  eventId: '', // missing
                  timestamp: '2026-08-17T08:00:00.000Z',
                  type: 'console' as const,
                  data: {}
                } as unknown as RawFinalizedSessionPackage['websites'][0]['pages'][0]['events'][0]
              ]
            }
          ]
        }
      ]
    };

    const validation = validateSessionPackage(invalidEvent);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes('eventId'))).toBe(true);
  });

  // TEST 18 — Unsupported event type
  it('TEST 18: should fail validation when event type is unsupported', () => {
    const raw = createValidSingleWebsiteSession();
    const invalidType = {
      ...raw,
      websites: [
        {
          ...raw.websites[0]!,
          pages: [
            {
              ...raw.websites[0]!.pages[0]!,
              events: [
                {
                  eventId: 'evt_unk_01',
                  sessionId: 'sess_20260817_test001',
                  pageId: 'page_001',
                  timestamp: '2026-08-17T08:00:00.000Z',
                  type: 'unknown_unsupported_type' as unknown as 'console',
                  data: {}
                }
              ]
            }
          ]
        }
      ]
    };

    const validation = validateSessionPackage(invalidType);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes('unsupported event type'))).toBe(true);
  });

  // TEST 19 — Determinism
  it('TEST 19: should produce identical output when normalized multiple times', () => {
    const raw = createValidSingleWebsiteSession();
    const result1 = normalizeSession(raw);
    const result2 = normalizeSession(raw);

    expect(result1).toEqual(result2);
  });

  // TEST 20 — Raw input immutability
  it('TEST 20: should not modify the raw input package object', () => {
    const raw = createValidSingleWebsiteSession();
    const rawCopy = JSON.parse(JSON.stringify(raw));

    normalizeSession(raw);

    expect(raw).toEqual(rawCopy);
  });

  // TEST 21 — Event count preservation
  it('TEST 21: should preserve exact event counts before and after normalization', () => {
    const raw = createRepeatedEventsSession(15);
    const rawEventCount = raw.websites.flatMap((w) => w.pages.flatMap((p) => p.events)).length;

    const result = normalizeSession(raw);
    const normalizedPageEventCount = result.websites.flatMap((w) => w.pages.flatMap((p) => p.events)).length;
    const flatEventCount = result.events.length;

    expect(rawEventCount).toBe(45);
    expect(normalizedPageEventCount).toBe(45);
    expect(flatEventCount).toBe(45);
  });
});
