import type {
  NormalizedConsoleEvent,
  NormalizedEvent,
  NormalizedNetworkEvent,
  NormalizedPerformanceEvent
} from '../types/normalized.js';
import type {
  AggregatedPattern,
  AggregationConfig,
  AggregationKey,
  ConsoleGroupingKey,
  NetworkGroupingKey,
  PerformanceGroupingKey,
  PatternType
} from '../types/aggregated.js';
import { DEFAULT_AGGREGATION_CONFIG } from '../types/aggregated.js';

interface EventBucketItem {
  key: AggregationKey;
  keyString: string;
  event: NormalizedEvent;
}

function getEventKey(event: NormalizedEvent): { key: AggregationKey; keyString: string } {
  switch (event.category) {
    case 'console': {
      const consoleEvent = event as NormalizedConsoleEvent;
      const key: ConsoleGroupingKey = {
        level: consoleEvent.data.level,
        message: consoleEvent.data.message
      };
      return {
        key,
        keyString: `console::${key.level}::${key.message}`
      };
    }
    case 'network': {
      const netEvent = event as NormalizedNetworkEvent;
      const key: NetworkGroupingKey = {
        requestType: netEvent.data.requestType,
        method: netEvent.data.method,
        url: netEvent.data.url
      };
      return {
        key,
        keyString: `network::${key.requestType}::${key.method}::${key.url}`
      };
    }
    case 'performance': {
      const perfEvent = event as NormalizedPerformanceEvent;
      if (perfEvent.data.performanceType === 'resource') {
        const key: PerformanceGroupingKey = {
          performanceType: 'resource',
          name: perfEvent.data.name,
          initiatorType: perfEvent.data.initiatorType
        };
        return {
          key,
          keyString: `performance::resource::${key.name}::${key.initiatorType ?? ''}`
        };
      }

      // Non-resource performance events (navigation, longtask) remain distinct
      const perfType = perfEvent.data.performanceType;
      const name = perfType === 'longtask' ? perfEvent.data.name : perfEvent.data.navigationType;
      const key: PerformanceGroupingKey = {
        performanceType: perfType,
        name
      };
      return {
        key,
        keyString: `performance::${perfType}::unique::${event.eventId}`
      };
    }
  }
}

function determinePatternType(category: NormalizedEvent['category'], count: number): PatternType {
  switch (category) {
    case 'network':
      return count > 1 ? 'repeated_network' : 'network_event';
    case 'console':
      return count > 1 ? 'repeated_console' : 'console_event';
    case 'performance':
      return count > 1 ? 'repeated_resource' : 'performance_event';
  }
}

/**
 * Aggregates a list of NormalizedEvents into AggregatedPatterns based on
 * context isolation and a configurable time window.
 *
 * Immutability Guarantee: Input events are NEVER mutated.
 * Traceability Guarantee: Every input event appears in exactly one output pattern.
 */
export function aggregateEvents(
  events: readonly NormalizedEvent[],
  config: Partial<AggregationConfig> = {}
): AggregatedPattern[] {
  if (!events || events.length === 0) {
    return [];
  }

  const effectiveConfig: AggregationConfig = {
    ...DEFAULT_AGGREGATION_CONFIG,
    ...config
  };

  // Group events by strict context + semantic key
  const buckets = new Map<string, EventBucketItem[]>();

  for (const event of events) {
    const context = event.context;
    const contextKey = `${context.sessionId}::${context.websiteId}::${context.pageId}::${context.routeId ?? 'null'}`;
    const { key, keyString } = getEventKey(event);
    const bucketKey = `${contextKey}:::${keyString}`;

    let bucket = buckets.get(bucketKey);
    if (!bucket) {
      bucket = [];
      buckets.set(bucketKey, bucket);
    }

    bucket.push({ key, keyString, event });
  }

  const patterns: AggregatedPattern[] = [];

  // For each bucket, sort chronologically and apply sequential time windowing
  for (const bucketItems of buckets.values()) {
    // Sort bucket items chronologically with eventId tie-breaker
    const sortedItems = [...bucketItems].sort((a, b) => {
      const timeDiff = Date.parse(a.event.timestamp) - Date.parse(b.event.timestamp);
      if (timeDiff !== 0) return timeDiff;
      return a.event.eventId.localeCompare(b.event.eventId);
    });

    let currentGroup: EventBucketItem[] = [];
    let groupStartMs = 0;

    const flushGroup = () => {
      if (currentGroup.length === 0) return;

      const firstItem = currentGroup[0]!;
      const lastItem = currentGroup[currentGroup.length - 1]!;
      const count = currentGroup.length;
      const firstSeenAt = firstItem.event.timestamp;
      const lastSeenAt = lastItem.event.timestamp;
      const timeSpanMs = Math.max(0, Date.parse(lastSeenAt) - Date.parse(firstSeenAt));
      const representativeEvent = firstItem.event;
      const eventIds = currentGroup.map((item) => item.event.eventId);
      const category = representativeEvent.category;
      const patternType = determinePatternType(category, count);

      const pattern: AggregatedPattern = {
        aggregationId: `agg_${representativeEvent.eventId}`,
        category,
        patternType,
        context: {
          sessionId: representativeEvent.context.sessionId,
          websiteId: representativeEvent.context.websiteId,
          websiteOrigin: representativeEvent.context.websiteOrigin,
          pageId: representativeEvent.context.pageId,
          routeId: representativeEvent.context.routeId,
          tabId: representativeEvent.context.tabId
        },
        key: firstItem.key,
        count,
        firstSeenAt,
        lastSeenAt,
        timeSpanMs,
        representativeEventId: representativeEvent.eventId,
        eventIds,
        representativeData: representativeEvent.data
      };

      patterns.push(pattern);
      currentGroup = [];
    };

    for (const item of sortedItems) {
      const itemTimestampMs = Date.parse(item.event.timestamp);

      if (currentGroup.length === 0) {
        currentGroup.push(item);
        groupStartMs = itemTimestampMs;
        continue;
      }

      if (itemTimestampMs - groupStartMs <= effectiveConfig.windowMs) {
        currentGroup.push(item);
      } else {
        flushGroup();
        currentGroup.push(item);
        groupStartMs = itemTimestampMs;
      }
    }

    flushGroup();
  }

  // Stably sort all aggregated patterns by firstSeenAt + aggregationId
  patterns.sort((a, b) => {
    const timeDiff = Date.parse(a.firstSeenAt) - Date.parse(b.firstSeenAt);
    if (timeDiff !== 0) return timeDiff;
    return a.aggregationId.localeCompare(b.aggregationId);
  });

  return patterns;
}
