/**
 * Raw input types representing the finalized session package produced by Layer 1.
 * These types match the runtime output from the Chrome extension.
 */

export type RawSessionStatus = 'active' | 'completed' | 'finalized' | 'stopped';
export type RawRouteNavigationType = 'initial' | 'pushState' | 'replaceState' | 'popstate' | 'hashchange';

export interface RawWebsiteRecord {
  websiteId: string;
  sessionId: string;
  origin: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface RawPageRecord {
  pageId: string;
  sessionId: string;
  websiteId: string;
  websiteOrigin: string;
  tabId: number;
  url: string;
  title: string;
  createdAt: string;
}

export interface RawRouteRecord {
  routeId: string;
  sessionId: string;
  pageId: string;
  tabId: number;
  url: string;
  path: string;
  hash: string;
  timestamp: string;
  navigationType: RawRouteNavigationType;
}

export type RawRuntimeEventType =
  | 'console'
  | 'network'
  | 'performance'
  | 'dom'
  | 'accessibility'
  | 'interaction';

export interface RawConsoleEventData {
  level: 'log' | 'info' | 'warn' | 'error' | 'debug';
  message: string;
  arguments: unknown[];
  sourceUrl: string | null;
  rawTimestamp: string;
}

export interface RawNetworkEventData {
  requestType: 'fetch' | 'xhr';
  method: string;
  url: string;
  status: number | null;
  statusText?: string;
  ok: boolean;
  durationMs: number;
  failureType?: 'http' | 'network' | null;
  errorMessage?: string | null;
  sourceUrl?: string | null;
  timestamp: string;
}

export interface RawLongTaskAttribution {
  name?: string;
  entryType?: string;
  startTime?: number;
  duration?: number;
  containerType?: string;
  containerSrc?: string;
  containerId?: string;
  containerName?: string;
}

export interface RawNavigationPerformanceData {
  performanceType: 'navigation';
  navigationType: string;
  startTime: number;
  durationMs: number;
  domContentLoadedMs: number;
  loadEventMs: number;
  dnsMs: number;
  connectMs: number;
  responseMs: number;
  sourceUrl?: string | null;
  timestamp: string;
}

export interface RawResourcePerformanceData {
  performanceType: 'resource';
  name: string;
  initiatorType: string;
  durationMs: number;
  startTime: number;
  responseEnd: number;
  transferSize: number;
  encodedBodySize: number;
  decodedBodySize: number;
  dnsMs: number;
  connectMs: number;
  responseMs: number;
  sourceUrl?: string | null;
  timestamp: string;
}

export interface RawLongTaskPerformanceData {
  performanceType: 'longtask';
  name: string;
  startTime: number;
  durationMs: number;
  attribution?: RawLongTaskAttribution[];
  sourceUrl?: string | null;
  timestamp: string;
}

export type RawPerformanceEventData =
  | RawNavigationPerformanceData
  | RawResourcePerformanceData
  | RawLongTaskPerformanceData;

export type RawEventData =
  | RawConsoleEventData
  | RawNetworkEventData
  | RawPerformanceEventData
  | Record<string, unknown>;

export interface RawRuntimeEvent<T = RawEventData> {
  eventId: string;
  sessionId: string;
  pageId: string | null;
  routeId?: string | null;
  tabId: number | null;
  timestamp: string;
  type: RawRuntimeEventType;
  data: T;
}

export interface RawFinalizedPageData extends RawPageRecord {
  routes: RawRouteRecord[];
  events: RawRuntimeEvent[];
}

export interface RawFinalizedWebsiteData extends RawWebsiteRecord {
  pages: RawFinalizedPageData[];
}

export interface RawFinalizedSessionMetadata {
  sessionId: string;
  status: RawSessionStatus;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  rootUrl: string | null;
  activeTabId: number | null;
}

export interface RawFinalizedSessionPackage {
  session: RawFinalizedSessionMetadata;
  websites: RawFinalizedWebsiteData[];
}
