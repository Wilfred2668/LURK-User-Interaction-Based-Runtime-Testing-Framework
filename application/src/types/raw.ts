/**
 * Raw input types representing the finalized session package produced by Layer 1.
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

export interface RawRuntimeEvent<T = Record<string, unknown>> {
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
