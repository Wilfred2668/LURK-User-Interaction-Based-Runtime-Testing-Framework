/**
 * Normalized output types for Layer 2.
 * These types provide a clean, predictable, self-contained structure
 * where every event, route, and page has explicit contextual bindings.
 */

import type {
  RawConsoleEventData,
  RawNetworkEventData,
  RawPerformanceEventData,
  RawRouteNavigationType,
  RawSessionStatus
} from './raw.js';

export type NormalizedEventCategory = 'console' | 'network' | 'performance';

export interface NormalizedEventContext {
  sessionId: string;
  websiteId: string;
  websiteOrigin: string;
  pageId: string;
  routeId: string | null;
  tabId: number | null;
}

export interface NormalizedConsoleEvent {
  eventId: string;
  category: 'console';
  timestamp: string;
  context: NormalizedEventContext;
  data: RawConsoleEventData;
}

export interface NormalizedNetworkEvent {
  eventId: string;
  category: 'network';
  timestamp: string;
  context: NormalizedEventContext;
  data: RawNetworkEventData;
}

export interface NormalizedPerformanceEvent {
  eventId: string;
  category: 'performance';
  timestamp: string;
  context: NormalizedEventContext;
  data: RawPerformanceEventData;
}

export type NormalizedEvent =
  | NormalizedConsoleEvent
  | NormalizedNetworkEvent
  | NormalizedPerformanceEvent;

export interface NormalizedRoute {
  routeId: string;
  pageId: string;
  websiteId: string;
  websiteOrigin: string;
  sessionId: string;
  tabId: number;
  url: string;
  path: string;
  hash: string;
  navigationType: RawRouteNavigationType;
  timestamp: string;
}

export interface NormalizedPage {
  pageId: string;
  websiteId: string;
  websiteOrigin: string;
  sessionId: string;
  tabId: number;
  url: string;
  title: string;
  createdAt: string;
  routes: NormalizedRoute[];
  events: NormalizedEvent[];
}

export interface NormalizedWebsite {
  websiteId: string;
  sessionId: string;
  origin: string;
  firstSeenAt: string;
  lastSeenAt: string;
  pages: NormalizedPage[];
}

export interface NormalizedSessionMetadata {
  sessionId: string;
  status: RawSessionStatus;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  rootUrl: string | null;
  activeTabId: number | null;
}

export interface NormalizedSessionData {
  session: NormalizedSessionMetadata;
  websites: NormalizedWebsite[];
  events: NormalizedEvent[];
}
