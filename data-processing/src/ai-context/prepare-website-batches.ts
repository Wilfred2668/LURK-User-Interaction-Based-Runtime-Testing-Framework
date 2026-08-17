import type { AIAnalysisBatch } from '../types/ai-context.js';
import type { InsightSessionData } from '../types/findings.js';
import type { AIContextConfig } from './ai-context-config.js';
import { preparePageBatch } from './prepare-page-batch.js';

/**
 * Prepares AI analysis batches for all pages belonging to a specified website within the session.
 *
 * Isolation Guarantee: Only pages belonging to websiteId are returned. Unrelated websites are excluded.
 * Determinism Guarantee: Batches are stably sorted by page creation time and pageId.
 */
export function prepareWebsiteBatches(
  sessionData: InsightSessionData,
  websiteId: string,
  config: Partial<AIContextConfig> = {}
): AIAnalysisBatch[] {
  const targetWebsite = sessionData.websites.find((w) => w.websiteId === websiteId);
  if (!targetWebsite) {
    throw new Error(`Website with ID "${websiteId}" was not found in session "${sessionData.session.sessionId}".`);
  }

  // Sort pages deterministically
  const sortedPages = [...targetWebsite.pages].sort((a, b) => {
    const timeDiff = Date.parse(a.createdAt) - Date.parse(b.createdAt);
    if (timeDiff !== 0) return timeDiff;
    return a.pageId.localeCompare(b.pageId);
  });

  return sortedPages.map((page) => preparePageBatch(sessionData, websiteId, page.pageId, config));
}
