export type SessionStatus = 'active' | 'stopped';
export type RouteNavigationType = 'initial' | 'pushState' | 'replaceState' | 'popstate' | 'hashchange';

export interface WebsiteRecord {
  websiteId: string;
  sessionId: string;
  origin: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface PageRecord {
  pageId: string;
  sessionId: string;
  websiteId: string;
  websiteOrigin: string;
  tabId: number;
  url: string;
  title: string;
  createdAt: string;
}

export interface RouteRecord {
  routeId: string;
  sessionId: string;
  pageId: string;
  tabId: number;
  url: string;
  path: string;
  hash: string;
  timestamp: string;
  navigationType: RouteNavigationType;
}

export interface SessionState {
  sessionId: string;
  startedAt: string;
  status: SessionStatus;
  activeTabId: number | null;
  rootUrl: string | null;
  websites: WebsiteRecord[];
  pages: PageRecord[];
  routes: RouteRecord[];
}

export type MessageType =
  | 'START_SESSION'
  | 'STOP_SESSION'
  | 'GET_SESSION_STATE'
  | 'GET_CURRENT_PAGE'
  | 'ROUTE_EVENT'
  | 'CONSOLE_EVENT'
  | 'NETWORK_EVENT'
  | 'PERFORMANCE_EVENT';

export interface BaseMessage {
  type: MessageType;
}

export interface StartSessionMessage extends BaseMessage {
  type: 'START_SESSION';
}

export interface StopSessionMessage extends BaseMessage {
  type: 'STOP_SESSION';
}

export interface GetSessionStateMessage extends BaseMessage {
  type: 'GET_SESSION_STATE';
}

export interface GetCurrentPageMessage extends BaseMessage {
  type: 'GET_CURRENT_PAGE';
}

export interface RouteEventMessage extends BaseMessage {
  type: 'ROUTE_EVENT';
  url: string;
  path: string;
  hash: string;
  navigationType: RouteNavigationType;
  timestamp: string;
}

export interface ConsoleEventMessage extends BaseMessage {
  type: 'CONSOLE_EVENT';
  payload: {
    level: 'log' | 'info' | 'warn' | 'error' | 'debug';
    message: string;
    arguments: unknown[];
    sourceUrl: string | null;
    timestamp: string;
  };
}

export interface NetworkRuntimeData {
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

export interface NetworkEventMessage extends BaseMessage {
  type: 'NETWORK_EVENT';
  payload: NetworkRuntimeData;
}

export type PerformanceSubtype = 'navigation' | 'resource' | 'longtask';

export interface NavigationPerformanceData {
  performanceType: 'navigation';
  navigationType: string;
  startTime: number;
  durationMs: number;
  domContentLoadedMs: number;
  loadEventMs: number;
  dnsMs?: number;
  connectMs?: number;
  responseMs?: number;
  sourceUrl?: string | null;
  timestamp: string;
}

export interface ResourcePerformanceData {
  performanceType: 'resource';
  url: string;
  initiatorType: string;
  startTime: number;
  durationMs: number;
  transferSize?: number;
  encodedBodySize?: number;
  decodedBodySize?: number;
  dnsMs?: number;
  connectMs?: number;
  responseMs?: number;
  sourceUrl?: string | null;
  timestamp: string;
}

export interface LongTaskAttribution {
  name?: string;
  entryType?: string;
  startTime?: number;
  duration?: number;
  containerType?: string;
  containerSrc?: string;
  containerId?: string;
  containerName?: string;
}

export interface LongTaskPerformanceData {
  performanceType: 'longtask';
  name: string;
  startTime: number;
  durationMs: number;
  attribution?: LongTaskAttribution[];
  sourceUrl?: string | null;
  timestamp: string;
}

export type PerformanceRuntimeData =
  | NavigationPerformanceData
  | ResourcePerformanceData
  | LongTaskPerformanceData;

export interface PerformanceEventMessage extends BaseMessage {
  type: 'PERFORMANCE_EVENT';
  payload: PerformanceRuntimeData;
}

export type ExtensionMessage =
  | StartSessionMessage
  | StopSessionMessage
  | GetSessionStateMessage
  | GetCurrentPageMessage
  | RouteEventMessage
  | ConsoleEventMessage
  | NetworkEventMessage
  | PerformanceEventMessage;

export type RuntimeResponse =
  | { ok: true; type: 'SESSION_STARTED'; session: SessionState }
  | { ok: true; type: 'SESSION_STOPPED'; session: SessionState | null }
  | { ok: true; type: 'SESSION_STATE'; session: SessionState | null }
  | { ok: true; type: 'CURRENT_PAGE'; page: PageRecord | null; session: SessionState | null }
  | { ok: true; type: 'ROUTE_CAPTURED'; route: RouteRecord | null }
  | { ok: false; type: 'ERROR'; message: string };
