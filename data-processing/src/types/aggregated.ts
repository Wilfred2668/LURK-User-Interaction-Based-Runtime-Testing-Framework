/**
 * Aggregated output types for Layer 2.
 * Represents analytical groups and repeated patterns derived from normalized events.
 */

import type {
  NormalizedEventCategory,
  NormalizedEventContext,
  NormalizedPage,
  NormalizedSessionMetadata,
  NormalizedWebsite
} from './normalized.js';
import type {
  RawConsoleEventData,
  RawNetworkEventData,
  RawPerformanceEventData
} from './raw.js';

export type PatternType =
  | 'repeated_network'
  | 'network_event'
  | 'repeated_console'
  | 'console_event'
  | 'repeated_resource'
  | 'performance_event';

export interface NetworkGroupingKey {
  requestType: 'fetch' | 'xhr';
  method: string;
  url: string;
}

export interface ConsoleGroupingKey {
  level: string;
  message: string;
}

export interface PerformanceGroupingKey {
  performanceType: string;
  name: string;
  initiatorType?: string;
}

export type AggregationKey =
  | NetworkGroupingKey
  | ConsoleGroupingKey
  | PerformanceGroupingKey
  | Record<string, unknown>;

export interface AggregatedPattern<T = RawConsoleEventData | RawNetworkEventData | RawPerformanceEventData> {
  aggregationId: string;
  category: NormalizedEventCategory;
  patternType: PatternType;
  context: NormalizedEventContext;
  key: AggregationKey;
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
  timeSpanMs: number;
  representativeEventId: string;
  eventIds: string[];
  representativeData: T;
}

export interface AggregationConfig {
  /**
   * Time window in milliseconds to group identical events within the same context.
   * Default: 5000ms (5 seconds)
   */
  windowMs: number;
}

export const DEFAULT_AGGREGATION_CONFIG: AggregationConfig = {
  windowMs: 5000
};

export interface AggregatedPage extends Omit<NormalizedPage, 'events'> {
  patterns: AggregatedPattern[];
}

export interface AggregatedWebsite extends Omit<NormalizedWebsite, 'pages'> {
  pages: AggregatedPage[];
}

export interface AggregatedSessionData {
  session: NormalizedSessionMetadata;
  websites: AggregatedWebsite[];
  patterns: AggregatedPattern[];
}
