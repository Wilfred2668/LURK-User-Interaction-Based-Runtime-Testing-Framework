/**
 * AI Context and Batch models for Milestone 3A.
 * Provides provider-independent, page-wise structured batches for future AI analysis.
 */

import type { NormalizedRoute, NormalizedSessionMetadata } from './normalized.js';
import type { EngineeringFinding, FindingCategory, FindingEvidence, FindingSeverity, FindingType } from './findings.js';

export const AI_CONTEXT_SCHEMA_VERSION = '3A.1';

export interface PageSummary {
  consoleErrors: number;
  consoleWarnings: number;
  networkFailures: number;
  repeatedRequests: number;
  slowRequests: number;
  slowResources: number;
  largeResources: number;
  longTasks: number;
  slowNavigations: number;
}

export interface SampledEvidenceItem {
  findingId: string;
  findingType: FindingType;
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  description: string;
  confidence: number;
  evidence: FindingEvidence;
  sampledEventIds: string[];
  representativeData?: unknown;
}

export interface BatchMetadata {
  schemaVersion: string;
  generatedAt?: string;
  eventCount: number;
  findingCount: number;
  patternCount: number;
}

export interface PageBatchIdentity {
  pageId: string;
  websiteId: string;
  websiteOrigin: string;
  sessionId: string;
  tabId: number;
  url: string;
  title: string;
  createdAt: string;
}

export interface WebsiteBatchIdentity {
  websiteId: string;
  origin: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface AIAnalysisBatch {
  batchId: string;
  schemaVersion: string;
  sessionId: string;
  websiteId: string;
  websiteOrigin: string;
  pageId: string;
  session: NormalizedSessionMetadata;
  website: WebsiteBatchIdentity;
  page: PageBatchIdentity;
  routes: NormalizedRoute[];
  findings: EngineeringFinding[];
  evidence: SampledEvidenceItem[];
  summary: PageSummary;
  metadata: BatchMetadata;
}
