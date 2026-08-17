/**
 * Engineering Findings models for Milestone 2C.
 * Represents structured, evidence-backed engineering findings extracted deterministically from aggregated patterns.
 */

import type { NormalizedEventCategory, NormalizedEventContext, NormalizedSessionMetadata } from './normalized.js';
import type { AggregatedPage, AggregatedWebsite } from './aggregated.js';

export type FindingSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export type FindingCategory = NormalizedEventCategory;

export type FindingType =
  | 'repeated_network_request'
  | 'failed_network_request'
  | 'network_transport_failure'
  | 'slow_network_request'
  | 'repeated_console_error'
  | 'repeated_console_warning'
  | 'slow_resource'
  | 'large_resource'
  | 'repeated_resource'
  | 'long_task'
  | 'slow_navigation';

export interface FindingEvidence {
  aggregationId: string;
  eventIds: string[];
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
  timeSpanMs: number;
  url?: string;
  method?: string;
  status?: number | null;
  statusText?: string;
  failureType?: string | null;
  errorMessage?: string | null;
  durationMs?: number;
  level?: string;
  message?: string;
  initiatorType?: string;
  decodedBodySize?: number;
  encodedBodySize?: number;
  transferSize?: number;
  startTime?: number;
}

export interface EngineeringFinding {
  findingId: string;
  findingType: FindingType;
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  description: string;
  confidence: number;
  context: NormalizedEventContext;
  evidence: FindingEvidence;
  metadata?: Record<string, unknown>;
}

export interface InsightPage extends Omit<AggregatedPage, 'patterns'> {
  patterns: AggregatedPage['patterns'];
  findings: EngineeringFinding[];
}

export interface InsightWebsite extends Omit<AggregatedWebsite, 'pages'> {
  pages: InsightPage[];
}

export interface InsightSessionData {
  session: NormalizedSessionMetadata;
  websites: InsightWebsite[];
  findings: EngineeringFinding[];
}
