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
  | 'unhandled_runtime_error'
  | 'slow_resource'
  | 'large_resource'
  | 'repeated_resource'
  | 'long_task'
  | 'main_thread_performance_degradation'
  | 'slow_navigation';

export interface RepresentativeTaskItem {
  eventId: string;
  durationMs: number;
  startTime?: number;
  sourceUrl?: string | null;
}

export interface InteractionTriggerContext {
  interactionType: string;
  elementTag: string;
  elementId?: string | null;
  elementClasses?: string | null;
  textPreview?: string | null;
  selector?: string | null;
  timeDeltaMs: number;
}

export interface FindingEvidence {
  aggregationId: string;
  eventIds: string[];
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
  timeSpanMs: number;
  url?: string;
  origin?: string;
  path?: string;
  method?: string;
  status?: number | null;
  statusText?: string;
  ok?: boolean;
  failureType?: string | null;
  errorMessage?: string | null;
  durationMs?: number;
  level?: string;
  message?: string;
  sourceUrl?: string | null;
  lineNumber?: number | null;
  columnNumber?: number | null;
  stack?: string | null;
  initiatorType?: string;
  decodedBodySize?: number;
  encodedBodySize?: number;
  transferSize?: number;
  startTime?: number;
  // Performance distribution metrics
  minDurationMs?: number;
  maxDurationMs?: number;
  averageDurationMs?: number;
  totalBlockedTimeMs?: number;
  tasksOver100ms?: number;
  tasksOver500ms?: number;
  tasksOver1000ms?: number;
  representativeTasks?: RepresentativeTaskItem[];
  // Interaction correlation
  interactionTrigger?: InteractionTriggerContext | null;
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
