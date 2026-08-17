import type { AggregatedSessionData } from '../types/aggregated.js';
import type {
  EngineeringFinding,
  FindingSeverity,
  InsightPage,
  InsightSessionData,
  InsightWebsite
} from '../types/findings.js';
import type { InsightConfig } from './insight-config.js';
import { DEFAULT_INSIGHT_CONFIG } from './insight-config.js';
import { detectInsightsFromPattern } from './detect-insights.js';

const SEVERITY_RANK: Record<FindingSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4
};

function sortFindings(findings: EngineeringFinding[]): void {
  findings.sort((a, b) => {
    const timeDiff = Date.parse(a.evidence.firstSeenAt) - Date.parse(b.evidence.firstSeenAt);
    if (timeDiff !== 0) return timeDiff;

    const rankDiff = (SEVERITY_RANK[a.severity] ?? 99) - (SEVERITY_RANK[b.severity] ?? 99);
    if (rankDiff !== 0) return rankDiff;

    return a.findingId.localeCompare(b.findingId);
  });
}

/**
 * Extracts rule-based engineering findings across an entire AggregatedSessionData structure.
 *
 * Immutability Guarantee: Input session is NEVER modified.
 * Determinism Guarantee: Findings are uniquely keyed and stably sorted.
 */
export function extractInsights(
  sessionData: AggregatedSessionData,
  config: Partial<InsightConfig> = {}
): InsightSessionData {
  const effectiveConfig: InsightConfig = {
    ...DEFAULT_INSIGHT_CONFIG,
    ...config
  };

  const allSessionFindings: EngineeringFinding[] = [];

  const insightWebsites: InsightWebsite[] = sessionData.websites.map((website) => {
    const insightPages: InsightPage[] = website.pages.map((page) => {
      const pageFindings: EngineeringFinding[] = [];

      for (const pattern of page.patterns) {
        const patternFindings = detectInsightsFromPattern(pattern, effectiveConfig);
        pageFindings.push(...patternFindings);
      }

      sortFindings(pageFindings);
      allSessionFindings.push(...pageFindings);

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
        patterns: [...page.patterns],
        findings: pageFindings
      };
    });

    return {
      websiteId: website.websiteId,
      sessionId: website.sessionId,
      origin: website.origin,
      firstSeenAt: website.firstSeenAt,
      lastSeenAt: website.lastSeenAt,
      pages: insightPages
    };
  });

  sortFindings(allSessionFindings);

  return {
    session: { ...sessionData.session },
    websites: insightWebsites,
    findings: allSessionFindings
  };
}
