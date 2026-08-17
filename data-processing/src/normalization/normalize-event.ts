import type {
  RawConsoleEventData,
  RawNetworkEventData,
  RawPerformanceEventData,
  RawRuntimeEvent
} from '../types/raw.js';
import type {
  NormalizedConsoleEvent,
  NormalizedEvent,
  NormalizedEventContext,
  NormalizedNetworkEvent,
  NormalizedPerformanceEvent
} from '../types/normalized.js';

/**
 * Normalizes a raw RuntimeEvent by embedding authoritative context and typing.
 * Preserves the inner data object without mutation or loss of information.
 */
export function normalizeEvent(
  rawEvent: RawRuntimeEvent,
  context: NormalizedEventContext
): NormalizedEvent {
  const base = {
    eventId: rawEvent.eventId,
    timestamp: rawEvent.timestamp,
    context: {
      sessionId: context.sessionId,
      websiteId: context.websiteId,
      websiteOrigin: context.websiteOrigin,
      pageId: rawEvent.pageId ?? context.pageId,
      routeId: rawEvent.routeId ?? context.routeId,
      tabId: rawEvent.tabId ?? context.tabId
    }
  };

  switch (rawEvent.type) {
    case 'console': {
      const consoleEvent: NormalizedConsoleEvent = {
        ...base,
        category: 'console',
        data: rawEvent.data as RawConsoleEventData
      };
      return consoleEvent;
    }
    case 'network': {
      const networkEvent: NormalizedNetworkEvent = {
        ...base,
        category: 'network',
        data: rawEvent.data as RawNetworkEventData
      };
      return networkEvent;
    }
    case 'performance': {
      const perfEvent: NormalizedPerformanceEvent = {
        ...base,
        category: 'performance',
        data: rawEvent.data as RawPerformanceEventData
      };
      return perfEvent;
    }
    default: {
      throw new Error(`Cannot normalize unsupported event type: "${String((rawEvent as { type?: unknown }).type)}"`);
    }
  }
}
