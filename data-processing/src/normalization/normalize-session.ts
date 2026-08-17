import type { RawFinalizedSessionPackage } from '../types/raw.js';
import type {
  NormalizedEvent,
  NormalizedPage,
  NormalizedRoute,
  NormalizedSessionData,
  NormalizedSessionMetadata,
  NormalizedWebsite
} from '../types/normalized.js';
import { assertValidSessionPackage } from '../validation/validate-session.js';
import { normalizeEvent } from './normalize-event.js';

export interface NormalizeSessionOptions {
  /**
   * Whether to run full structural validation on the raw package.
   * Default: true
   */
  validate?: boolean;
}

/**
 * Transforms a raw FinalizedSessionPackage from Layer 1 into a clean,
 * consistent, normalized session structure for Layer 2.
 *
 * Immutability Guarantee: The raw input package is NEVER modified.
 * Completeness Guarantee: Every event is preserved 1:1 without aggregation.
 */
export function normalizeSession(
  rawPackage: RawFinalizedSessionPackage,
  options: NormalizeSessionOptions = {}
): NormalizedSessionData {
  const { validate = true } = options;

  if (validate) {
    assertValidSessionPackage(rawPackage);
  }

  const allNormalizedEvents: NormalizedEvent[] = [];

  const normalizedWebsites: NormalizedWebsite[] = rawPackage.websites.map((rawWebsite) => {
    const normalizedPages: NormalizedPage[] = rawWebsite.pages.map((rawPage) => {
      const normalizedRoutes: NormalizedRoute[] = rawPage.routes.map((rawRoute) => ({
        routeId: rawRoute.routeId,
        pageId: rawRoute.pageId,
        websiteId: rawWebsite.websiteId,
        websiteOrigin: rawWebsite.origin,
        sessionId: rawRoute.sessionId,
        tabId: rawRoute.tabId,
        url: rawRoute.url,
        path: rawRoute.path,
        hash: rawRoute.hash,
        navigationType: rawRoute.navigationType,
        timestamp: rawRoute.timestamp
      }));

      const normalizedPageEvents: NormalizedEvent[] = rawPage.events.map((rawEvent) => {
        const normalized = normalizeEvent(rawEvent, {
          sessionId: rawPackage.session.sessionId,
          websiteId: rawWebsite.websiteId,
          websiteOrigin: rawWebsite.origin,
          pageId: rawPage.pageId,
          routeId: rawEvent.routeId ?? null,
          tabId: rawEvent.tabId ?? rawPage.tabId
        });

        allNormalizedEvents.push(normalized);
        return normalized;
      });

      return {
        pageId: rawPage.pageId,
        websiteId: rawWebsite.websiteId,
        websiteOrigin: rawWebsite.origin,
        sessionId: rawPage.sessionId,
        tabId: rawPage.tabId,
        url: rawPage.url,
        title: rawPage.title,
        createdAt: rawPage.createdAt,
        routes: normalizedRoutes,
        events: normalizedPageEvents
      };
    });

    return {
      websiteId: rawWebsite.websiteId,
      sessionId: rawWebsite.sessionId,
      origin: rawWebsite.origin,
      firstSeenAt: rawWebsite.firstSeenAt,
      lastSeenAt: rawWebsite.lastSeenAt,
      pages: normalizedPages
    };
  });

  // Sort flat events stably by timestamp, with eventId as deterministic tie-breaker
  allNormalizedEvents.sort((a, b) => {
    const timeDiff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    if (timeDiff !== 0) {
      return timeDiff;
    }
    return a.eventId.localeCompare(b.eventId);
  });

  const sessionMetadata: NormalizedSessionMetadata = {
    sessionId: rawPackage.session.sessionId,
    status: rawPackage.session.status,
    startedAt: rawPackage.session.startedAt,
    endedAt: rawPackage.session.endedAt,
    durationMs: rawPackage.session.durationMs,
    rootUrl: rawPackage.session.rootUrl,
    activeTabId: rawPackage.session.activeTabId
  };

  return {
    session: sessionMetadata,
    websites: normalizedWebsites,
    events: allNormalizedEvents
  };
}
