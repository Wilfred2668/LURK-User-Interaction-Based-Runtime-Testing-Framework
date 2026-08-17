import type {
  AIAnalysisBatch,
  PageBatchIdentity,
  PageSummary,
  SampledEvidenceItem,
  WebsiteBatchIdentity
} from '../types/ai-context.js';
import type { InsightPage, InsightSessionData } from '../types/findings.js';
import type { AIContextConfig } from './ai-context-config.js';
import { DEFAULT_AI_CONTEXT_CONFIG } from './ai-context-config.js';
import { sampleEventIds } from './evidence-sampler.js';
import { constrainBatchSize } from './batch-size.js';

function computePageSummary(findings: InsightPage['findings']): PageSummary {
  const summary: PageSummary = {
    consoleErrors: 0,
    consoleWarnings: 0,
    networkFailures: 0,
    repeatedRequests: 0,
    slowRequests: 0,
    slowResources: 0,
    largeResources: 0,
    longTasks: 0,
    slowNavigations: 0
  };

  for (const finding of findings) {
    switch (finding.findingType) {
      case 'repeated_console_error':
        summary.consoleErrors++;
        break;
      case 'repeated_console_warning':
        summary.consoleWarnings++;
        break;
      case 'failed_network_request':
      case 'network_transport_failure':
        summary.networkFailures++;
        break;
      case 'repeated_network_request':
        summary.repeatedRequests++;
        break;
      case 'slow_network_request':
        summary.slowRequests++;
        break;
      case 'slow_resource':
        summary.slowResources++;
        break;
      case 'large_resource':
        summary.largeResources++;
        break;
      case 'long_task':
        summary.longTasks++;
        break;
      case 'slow_navigation':
        summary.slowNavigations++;
        break;
    }
  }

  return summary;
}

/**
 * Prepares a provider-independent AIAnalysisBatch for a specific page.
 *
 * Immutability Guarantee: Input sessionData is NEVER modified.
 * Determinism Guarantee: Same input produces identical batchId and structure.
 */
export function preparePageBatch(
  sessionData: InsightSessionData,
  websiteId: string,
  pageId: string,
  config: Partial<AIContextConfig> = {}
): AIAnalysisBatch {
  const effectiveConfig: AIContextConfig = {
    ...DEFAULT_AI_CONTEXT_CONFIG,
    ...config
  };

  const targetWebsite = sessionData.websites.find((w) => w.websiteId === websiteId);
  if (!targetWebsite) {
    throw new Error(`Website with ID "${websiteId}" was not found in session "${sessionData.session.sessionId}".`);
  }

  const targetPage = targetWebsite.pages.find((p) => p.pageId === pageId);
  if (!targetPage) {
    throw new Error(
      `Page with ID "${pageId}" was not found under website "${websiteId}" in session "${sessionData.session.sessionId}".`
    );
  }

  const batchId = `batch_${sessionData.session.sessionId}_${websiteId}_${pageId}`;
  const summary = computePageSummary(targetPage.findings);

  // Sample evidence items for the page's findings
  const evidenceItems: SampledEvidenceItem[] = targetPage.findings.map((finding) => {
    const sampledEventIds = sampleEventIds(finding.evidence.eventIds, effectiveConfig.maxEvidenceEvents);
    const matchingPattern = targetPage.patterns.find((p) => p.aggregationId === finding.evidence.aggregationId);

    return {
      findingId: finding.findingId,
      findingType: finding.findingType,
      category: finding.category,
      severity: finding.severity,
      title: finding.title,
      description: finding.description,
      confidence: finding.confidence,
      evidence: { ...finding.evidence },
      sampledEventIds,
      representativeData: matchingPattern?.representativeData
    };
  });

  // Calculate unique events associated with this page
  const allPageEventIds = new Set<string>();
  for (const pattern of targetPage.patterns) {
    for (const id of pattern.eventIds) {
      allPageEventIds.add(id);
    }
  }

  const websiteIdentity: WebsiteBatchIdentity = {
    websiteId: targetWebsite.websiteId,
    origin: targetWebsite.origin,
    firstSeenAt: targetWebsite.firstSeenAt,
    lastSeenAt: targetWebsite.lastSeenAt
  };

  const pageIdentity: PageBatchIdentity = {
    pageId: targetPage.pageId,
    websiteId: targetPage.websiteId,
    websiteOrigin: targetPage.websiteOrigin,
    sessionId: targetPage.sessionId,
    tabId: targetPage.tabId,
    url: targetPage.url,
    title: targetPage.title,
    createdAt: targetPage.createdAt
  };

  const rawBatch: AIAnalysisBatch = {
    batchId,
    schemaVersion: effectiveConfig.schemaVersion,
    sessionId: sessionData.session.sessionId,
    websiteId,
    websiteOrigin: targetWebsite.origin,
    pageId,
    session: { ...sessionData.session },
    website: websiteIdentity,
    page: pageIdentity,
    routes: targetPage.routes.map((r) => ({ ...r })),
    findings: targetPage.findings.map((f) => ({ ...f })),
    evidence: evidenceItems,
    summary,
    metadata: {
      schemaVersion: effectiveConfig.schemaVersion,
      generatedAt: effectiveConfig.generatedAt,
      eventCount: allPageEventIds.size,
      findingCount: targetPage.findings.length,
      patternCount: targetPage.patterns.length
    }
  };

  // Enforce byte size constraint
  return constrainBatchSize(rawBatch, effectiveConfig.maxBatchBytes);
}
