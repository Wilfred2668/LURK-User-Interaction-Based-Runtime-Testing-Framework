import type { NormalizedSessionData } from '../types/normalized.js';
import type {
  AggregatedPage,
  AggregatedPattern,
  AggregatedSessionData,
  AggregatedWebsite,
  AggregationConfig
} from '../types/aggregated.js';
import { aggregateEvents } from './aggregate-events.js';

/**
 * Aggregates all normalized events across an entire session,
 * producing a structured hierarchy of websites, pages, and aggregated patterns.
 *
 * Immutability Guarantee: Input session is NEVER modified.
 */
export function aggregateSession(
  sessionData: NormalizedSessionData,
  config: Partial<AggregationConfig> = {}
): AggregatedSessionData {
  const allSessionPatterns: AggregatedPattern[] = [];

  const aggregatedWebsites: AggregatedWebsite[] = sessionData.websites.map((website) => {
    const aggregatedPages: AggregatedPage[] = website.pages.map((page) => {
      const pagePatterns = aggregateEvents(page.events, config);
      allSessionPatterns.push(...pagePatterns);

      return {
        pageId: page.pageId,
        websiteId: page.websiteId,
        websiteOrigin: page.websiteOrigin,
        sessionId: page.sessionId,
        tabId: page.tabId,
        url: page.url,
        title: page.title,
        createdAt: page.createdAt,
        routes: [...page.routes],
        patterns: pagePatterns
      };
    });

    return {
      websiteId: website.websiteId,
      sessionId: website.sessionId,
      origin: website.origin,
      firstSeenAt: website.firstSeenAt,
      lastSeenAt: website.lastSeenAt,
      pages: aggregatedPages
    };
  });

  // Sort flat list of all session patterns chronologically
  allSessionPatterns.sort((a, b) => {
    const timeDiff = Date.parse(a.firstSeenAt) - Date.parse(b.firstSeenAt);
    if (timeDiff !== 0) return timeDiff;
    return a.aggregationId.localeCompare(b.aggregationId);
  });

  return {
    session: { ...sessionData.session },
    websites: aggregatedWebsites,
    patterns: allSessionPatterns
  };
}
