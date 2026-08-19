import {
  clearSessionState,
  readFinalizedSessionPackage,
  readSessionState,
  writeFinalizedSessionPackage,
  writeSessionState
} from '../storage/session-store';
import type {
  ConsoleEventMessage,
  ExtensionMessage,
  FinalizedPageData,
  FinalizedSessionMetadata,
  FinalizedSessionPackage,
  FinalizedWebsiteData,
  GetFinalizedSessionMessage,
  NetworkEventMessage,
  NetworkRuntimeData,
  PageRecord,
  PerformanceEventMessage,
  PerformanceRuntimeData,
  RouteRecord,
  RuntimeResponse,
  SessionState,
  WebsiteRecord
} from '../types/session';
import type { RuntimeEvent } from '../types/runtime-event';
import { RuntimeEventPipeline, createRuntimeEventTimestamp, generateEventId } from '../runtime/runtime-event-pipeline';
import { runtimeEventRepository } from '../runtime/runtime-event-repository';
import {
  extractWebsiteOrigin,
  generatePageId,
  generateRouteId,
  generateSessionId,
  generateWebsiteId,
  isSupportedUrl,
  normalizeDocumentUrl,
  safeTitle
} from '../utils/page';

const SESSION_LOG_PREFIX = '[SESSION]';
const WEBSITE_LOG_PREFIX = '[WEBSITE]';
const PAGE_LOG_PREFIX = '[PAGE]';
const NAV_LOG_PREFIX = '[NAVIGATION]';
const TAB_LOG_PREFIX = '[TAB]';
const ROUTE_LOG_PREFIX = '[ROUTE]';

const routeDedupCache = new Map<string, number>();

function installMainWorldConsoleObserver(): void {
  const marker = '__runtimeConsoleObserverInstalled';
  const maxDepth = 4;
  const maxItems = 20;
  const maxStringLength = 2000;

  if ((window as typeof window & { [marker]?: boolean })[marker]) {
    return;
  }

  (window as typeof window & { [marker]?: boolean })[marker] = true;

  const levels: Array<'log' | 'info' | 'warn' | 'error' | 'debug'> = ['log', 'info', 'warn', 'error', 'debug'];

  function truncateString(value: string): string {
    return value.length > maxStringLength ? `${value.slice(0, maxStringLength)}...` : value;
  }

  function safeStringifyValue(value: unknown): string {
    try {
      if (typeof value === 'string') return truncateString(value);
      if (typeof value === 'number' || typeof value === 'boolean' || value === null) return String(value);
      if (typeof value === 'undefined') return 'undefined';
      if (typeof value === 'function') return value.name ? `[Function: ${value.name}]` : '[Function]';
      if (typeof value === 'symbol') return value.toString();
      if (value instanceof Error) return value.message || value.name || 'Error';
      return Object.prototype.toString.call(value);
    } catch {
      return '[Unserializable]';
    }
  }

  function serializeConsoleValue(value: unknown, depth = 0, seen = new WeakSet<object>()): Record<string, unknown> {
    if (depth > maxDepth) {
      return { type: 'truncated', value: '[Depth limit reached]' };
    }

    if (value === null) return { type: 'null', value: null };
    if (typeof value === 'undefined') return { type: 'undefined', value: undefined };
    if (typeof value === 'string') return { type: 'string', value: truncateString(value) };
    if (typeof value === 'number') return { type: 'number', value: String(value) };
    if (typeof value === 'boolean') return { type: 'boolean', value: value };
    if (typeof value === 'bigint') return { type: 'bigint', value: value.toString() };
    if (typeof value === 'symbol') return { type: 'symbol', value: value.toString() };
    if (typeof value === 'function') return { type: 'function', value: value.name ? `[Function: ${value.name}]` : '[Function]' };
    if (value instanceof Error) {
      const result: Record<string, unknown> = { type: 'error' };
      if (value.name) result.name = value.name;
      if (value.message) result.message = truncateString(value.message);
      if (value.stack) result.stack = truncateString(value.stack);
      return result;
    }
    if (value instanceof Date) return { type: 'date', value: value.toISOString() };
    if (Array.isArray(value)) {
      const items = value.slice(0, maxItems).map((item) => serializeConsoleValue(item, depth + 1, seen));
      return { type: 'array', value: items, truncated: value.length > maxItems };
    }
    if (typeof value === 'object') {
      if (seen.has(value as object)) {
        return { type: 'circular', value: '[Circular]' };
      }
      seen.add(value as object);
      const entries = Object.entries(value as Record<string, unknown>).slice(0, maxItems);
      const result: Record<string, unknown> = {};
      for (const [key, nestedValue] of entries) {
        result[key] = serializeConsoleValue(nestedValue, depth + 1, seen);
      }
      return { type: 'object', value: result, truncated: Object.keys(value as Record<string, unknown>).length > maxItems };
    }
    return { type: 'unknown', value: safeStringifyValue(value) };
  }

  function formatSerializedValueForMessage(value: Record<string, unknown>, depth = 0, seen = new WeakSet<object>()): string {
    const type = value.type;

    if (type === 'string') return String(value.value);
    if (type === 'number' || type === 'boolean' || type === 'null' || type === 'undefined') return String(value.value);
    if (type === 'bigint' || type === 'symbol' || type === 'function' || type === 'date') return String(value.value);
    if (type === 'unknown') return String(value.value);
    if (type === 'circular') return '[Circular]';
    if (type === 'truncated') return '[Truncated]';
    if (type === 'error') {
      const name = typeof value.name === 'string' && value.name ? value.name : 'Error';
      const message = typeof value.message === 'string' && value.message ? value.message : '';
      return message ? `${name}: ${message}` : name;
    }
    if (type === 'array') {
      const entries = Array.isArray(value.value) ? value.value : [];
      const rendered = entries.map((entry) => {
        if (entry && typeof entry === 'object' && 'type' in entry) {
          return formatSerializedValueForMessage(entry as Record<string, unknown>, depth + 1, seen);
        }
        return String(entry);
      });
      const suffix = value.truncated ? ', ...' : '';
      return `[${rendered.join(', ')}${suffix}]`;
    }
    if (type === 'object') {
      const entries = value.value && typeof value.value === 'object' ? Object.entries(value.value as Record<string, unknown>) : [];
      if (entries.length === 0) {
        return '{}';
      }

      const rendered = entries.map(([key, nestedValue]) => {
        if (nestedValue && typeof nestedValue === 'object' && 'type' in nestedValue) {
          return `${key}: ${formatSerializedValueForMessage(nestedValue as Record<string, unknown>, depth + 1, seen)}`;
        }
        return `${key}: ${String(nestedValue)}`;
      });

      const suffix = value.truncated ? ', ...' : '';
      return `{${rendered.join(', ')}${suffix}}`;
    }

    return String(value.value ?? '');
  }

  function buildMessageFromArgs(args: unknown[]): string {
    return args
      .map((arg) => {
        const serialized = serializeConsoleValue(arg, 0, new WeakSet<object>());
        return formatSerializedValueForMessage(serialized as Record<string, unknown>, 0, new WeakSet<object>());
      })
      .join(' ');
  }

  for (const level of levels) {
    const original = console[level];
    console[level] = function (...args: unknown[]) {
      try {
        const payload = {
          __runtimeConsoleMessage: true,
          level,
          timestamp: new Date().toISOString(),
          message: buildMessageFromArgs(args).slice(0, maxStringLength),
          arguments: args.map((arg) => serializeConsoleValue(arg, 0, new WeakSet())),
          sourceUrl: window.location ? window.location.href : null
        };
        window.postMessage(payload, '*');
      } catch {
        try {
          window.postMessage({
            __runtimeConsoleMessage: true,
            level,
            timestamp: new Date().toISOString(),
            message: '[Console serialization failed]',
            arguments: [{ type: 'error', message: 'Console argument serialization failed.' }],
            sourceUrl: window.location ? window.location.href : null
          }, '*');
        } catch {
          // no-op
        }
      }

      return original.apply(this, args);
    };
  }
}

function installMainWorldNetworkObserver(): void {
  const marker = '__runtimeNetworkObserverInstalled';

  if ((window as typeof window & { [marker]?: boolean })[marker]) {
    return;
  }

  (window as typeof window & { [marker]?: boolean })[marker] = true;

  const SENSITIVE_PARAM_NAMES = new Set([
    'token',
    'access_token',
    'refreshtoken',
    'refresh_token',
    'id_token',
    'password',
    'pwd',
    'secret',
    'api_key',
    'apikey',
    'auth',
    'authorization',
    'key',
    'app_key',
    'client_secret'
  ]);

  function sanitizeUrl(rawUrl: string): string {
    try {
      const base = window.location ? window.location.href : undefined;
      const parsed = new URL(rawUrl, base);
      parsed.username = '';
      parsed.password = '';

      for (const param of Array.from(parsed.searchParams.keys())) {
        if (SENSITIVE_PARAM_NAMES.has(param.toLowerCase())) {
          parsed.searchParams.set(param, '[REDACTED]');
        }
      }

      return parsed.toString();
    } catch {
      return rawUrl;
    }
  }

  // Intercept window.fetch
  const originalFetch = window.fetch;
  if (typeof originalFetch === 'function') {
    window.fetch = async function (...args: Parameters<typeof fetch>) {
      const startTime = performance.now();
      const timestamp = new Date().toISOString();
      const input = args[0];
      const init = args[1];

      let rawUrl = '';
      let method = 'GET';

      try {
        if (typeof input === 'string') {
          rawUrl = input;
        } else if (input instanceof URL) {
          rawUrl = input.toString();
        } else if (input && typeof input === 'object' && 'url' in input) {
          rawUrl = (input as Request).url;
          if ((input as Request).method) {
            method = (input as Request).method.toUpperCase();
          }
        }

        if (init && init.method) {
          method = init.method.toUpperCase();
        }
      } catch {
        // Fallback
      }

      const sanitizedUrl = sanitizeUrl(rawUrl);

      try {
        const response = await originalFetch.apply(this, args);
        const durationMs = Math.round(performance.now() - startTime);

        try {
          const payload = {
            __runtimeNetworkMessage: true,
            requestType: 'fetch',
            method: method || 'GET',
            url: sanitizedUrl || rawUrl,
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            durationMs,
            failureType: response.ok ? null : 'http',
            errorMessage: null,
            sourceUrl: window.location ? window.location.href : null,
            timestamp
          };
          window.postMessage(payload, '*');
        } catch {
          // no-op
        }

        return response;
      } catch (error) {
        const durationMs = Math.round(performance.now() - startTime);
        const errorMessage = error instanceof Error ? error.message : 'Fetch failed';

        try {
          const payload = {
            __runtimeNetworkMessage: true,
            requestType: 'fetch',
            method: method || 'GET',
            url: sanitizedUrl || rawUrl,
            status: null,
            statusText: '',
            ok: false,
            durationMs,
            failureType: 'network',
            errorMessage,
            sourceUrl: window.location ? window.location.href : null,
            timestamp
          };
          window.postMessage(payload, '*');
        } catch {
          // no-op
        }

        throw error;
      }
    };
  }

  // Intercept XMLHttpRequest
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (
    this: XMLHttpRequest & {
      __runtimeNetworkMeta?: {
        method: string;
        url: string;
        startTime: number;
        timestamp: string;
        reported: boolean;
      };
    },
    ...args: unknown[]
  ) {
    try {
      const method = typeof args[0] === 'string' ? args[0].toUpperCase() : 'GET';
      const rawUrl = typeof args[1] === 'string' ? args[1] : (args[1] ? String(args[1]) : '');
      this.__runtimeNetworkMeta = {
        method,
        url: sanitizeUrl(rawUrl),
        startTime: 0,
        timestamp: '',
        reported: false
      };
    } catch {
      // fallback
    }

    return originalOpen.apply(this, args as Parameters<typeof originalOpen>);
  };

  XMLHttpRequest.prototype.send = function (
    this: XMLHttpRequest & {
      __runtimeNetworkMeta?: {
        method: string;
        url: string;
        startTime: number;
        timestamp: string;
        reported: boolean;
      };
    },
    ...args: unknown[]
  ) {
    if (this.__runtimeNetworkMeta) {
      this.__runtimeNetworkMeta.startTime = performance.now();
      this.__runtimeNetworkMeta.timestamp = new Date().toISOString();

      const report = (failureType: 'http' | 'network' | null, errorMessage?: string) => {
        if (!this.__runtimeNetworkMeta || this.__runtimeNetworkMeta.reported) {
          return;
        }
        this.__runtimeNetworkMeta.reported = true;

        const durationMs = Math.round(performance.now() - this.__runtimeNetworkMeta.startTime);
        const status = this.status || null;
        const ok = status !== null && status >= 200 && status < 300;

        try {
          const payload = {
            __runtimeNetworkMessage: true,
            requestType: 'xhr',
            method: this.__runtimeNetworkMeta.method,
            url: this.__runtimeNetworkMeta.url,
            status,
            statusText: this.statusText || '',
            ok,
            durationMs,
            failureType: failureType ?? (ok ? null : (status ? 'http' : 'network')),
            errorMessage: errorMessage || null,
            sourceUrl: window.location ? window.location.href : null,
            timestamp: this.__runtimeNetworkMeta.timestamp
          };
          window.postMessage(payload, '*');
        } catch {
          // no-op
        }
      };

      this.addEventListener('load', () => {
        report(null);
      });

      this.addEventListener('error', () => {
        report('network', 'XHR network error');
      });

      this.addEventListener('abort', () => {
        report('network', 'XHR aborted');
      });

      this.addEventListener('timeout', () => {
        report('network', 'XHR timeout');
      });
    }

    return originalSend.apply(this, args as Parameters<typeof originalSend>);
  };
}

function installMainWorldPerformanceObserver(): void {
  const marker = '__runtimePerformanceObserverInstalled';

  if ((window as typeof window & { [marker]?: boolean })[marker]) {
    return;
  }

  (window as typeof window & { [marker]?: boolean })[marker] = true;

  const SENSITIVE_PARAM_NAMES = new Set([
    'token',
    'access_token',
    'refreshtoken',
    'refresh_token',
    'id_token',
    'password',
    'pwd',
    'secret',
    'api_key',
    'apikey',
    'auth',
    'authorization',
    'key',
    'app_key',
    'client_secret'
  ]);

  function sanitizeUrl(rawUrl: string): string {
    if (!rawUrl) return '';
    try {
      const base = window.location ? window.location.href : undefined;
      const parsed = new URL(rawUrl, base);
      parsed.username = '';
      parsed.password = '';

      for (const param of Array.from(parsed.searchParams.keys())) {
        if (SENSITIVE_PARAM_NAMES.has(param.toLowerCase())) {
          parsed.searchParams.set(param, '[REDACTED]');
        }
      }

      return parsed.toString();
    } catch {
      return rawUrl;
    }
  }

  // 1. Navigation Timing
  function reportNavigationTiming(): void {
    const navReportedMarker = '__runtimeNavigationTimingReported';
    if ((window as typeof window & { [navReportedMarker]?: boolean })[navReportedMarker]) {
      return;
    }

    try {
      if (typeof performance === 'undefined') {
        return;
      }

      const navEntries = performance.getEntriesByType('navigation');
      if (navEntries.length > 0) {
        const entry = navEntries[0] as PerformanceNavigationTiming;

        if (entry.loadEventEnd === 0 && document.readyState !== 'complete') {
          window.addEventListener(
            'load',
            () => {
              setTimeout(reportNavigationTiming, 0);
            },
            { once: true }
          );
          return;
        }

        (window as typeof window & { [navReportedMarker]?: boolean })[navReportedMarker] = true;

        const durationMs = Math.round(entry.duration);
        const domContentLoadedMs = Math.round(Math.max(0, entry.domContentLoadedEventEnd - entry.startTime));
        const loadEventMs = Math.round(Math.max(0, entry.loadEventEnd - entry.startTime));
        const dnsMs = Math.round(Math.max(0, entry.domainLookupEnd - entry.domainLookupStart));
        const connectMs = Math.round(Math.max(0, entry.connectEnd - entry.connectStart));
        const responseMs = Math.round(Math.max(0, entry.responseEnd - entry.responseStart));

        const payload = {
          __runtimePerformanceMessage: true,
          performanceType: 'navigation',
          navigationType: entry.type || 'navigate',
          startTime: Math.round(entry.startTime),
          durationMs,
          domContentLoadedMs,
          loadEventMs,
          dnsMs,
          connectMs,
          responseMs,
          sourceUrl: window.location ? window.location.href : null,
          timestamp: new Date().toISOString()
        };

        window.postMessage(payload, '*');
      } else if (performance.timing) {
        const timing = performance.timing;
        if (timing.loadEventEnd === 0 && document.readyState !== 'complete') {
          window.addEventListener(
            'load',
            () => {
              setTimeout(reportNavigationTiming, 0);
            },
            { once: true }
          );
          return;
        }

        (window as typeof window & { [navReportedMarker]?: boolean })[navReportedMarker] = true;

        const navStart = timing.navigationStart || 0;
        const durationMs = Math.max(0, (timing.loadEventEnd || timing.responseEnd || Date.now()) - navStart);
        const domContentLoadedMs = Math.max(0, (timing.domContentLoadedEventEnd || timing.domInteractive) - navStart);
        const loadEventMs = Math.max(0, timing.loadEventEnd - navStart);
        const dnsMs = Math.max(0, timing.domainLookupEnd - timing.domainLookupStart);
        const connectMs = Math.max(0, timing.connectEnd - timing.connectStart);
        const responseMs = Math.max(0, timing.responseEnd - timing.responseStart);

        const payload = {
          __runtimePerformanceMessage: true,
          performanceType: 'navigation',
          navigationType: 'navigate',
          startTime: 0,
          durationMs,
          domContentLoadedMs,
          loadEventMs,
          dnsMs,
          connectMs,
          responseMs,
          sourceUrl: window.location ? window.location.href : null,
          timestamp: new Date().toISOString()
        };

        window.postMessage(payload, '*');
      }
    } catch {
      // no-op
    }
  }

  if (document.readyState === 'complete') {
    setTimeout(reportNavigationTiming, 0);
  } else {
    window.addEventListener(
      'load',
      () => {
        setTimeout(reportNavigationTiming, 0);
      },
      { once: true }
    );
    setTimeout(reportNavigationTiming, 50);
  }

  // 2. Resource Timing
  const seenResourceKeys = new Set<string>();

  function reportResourceEntry(entry: PerformanceResourceTiming): void {
    try {
      const key = `${entry.name}#${Math.round(entry.startTime)}#${Math.round(entry.responseEnd)}#${entry.initiatorType}`;
      if (seenResourceKeys.has(key)) {
        return;
      }
      seenResourceKeys.add(key);

      const sanitizedUrl = sanitizeUrl(entry.name);
      const durationMs = Math.round(entry.duration);
      const dnsMs = entry.domainLookupEnd > 0 && entry.domainLookupStart > 0
        ? Math.round(Math.max(0, entry.domainLookupEnd - entry.domainLookupStart))
        : undefined;
      const connectMs = entry.connectEnd > 0 && entry.connectStart > 0
        ? Math.round(Math.max(0, entry.connectEnd - entry.connectStart))
        : undefined;
      const responseMs = entry.responseEnd > 0 && entry.responseStart > 0
        ? Math.round(Math.max(0, entry.responseEnd - entry.responseStart))
        : undefined;

      const payload = {
        __runtimePerformanceMessage: true,
        performanceType: 'resource',
        url: sanitizedUrl || entry.name,
        initiatorType: entry.initiatorType || 'other',
        startTime: Math.round(entry.startTime),
        durationMs,
        transferSize: typeof entry.transferSize === 'number' ? entry.transferSize : undefined,
        encodedBodySize: typeof entry.encodedBodySize === 'number' ? entry.encodedBodySize : undefined,
        decodedBodySize: typeof entry.decodedBodySize === 'number' ? entry.decodedBodySize : undefined,
        dnsMs,
        connectMs,
        responseMs,
        sourceUrl: window.location ? window.location.href : null,
        timestamp: new Date().toISOString()
      };

      window.postMessage(payload, '*');
    } catch {
      // no-op
    }
  }

  try {
    if (typeof PerformanceObserver !== 'undefined') {
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'resource') {
            reportResourceEntry(entry as PerformanceResourceTiming);
          }
        }
      });

      resourceObserver.observe({ type: 'resource', buffered: true });
    } else if (typeof performance !== 'undefined' && performance.getEntriesByType) {
      const existing = performance.getEntriesByType('resource');
      for (const entry of existing) {
        reportResourceEntry(entry as PerformanceResourceTiming);
      }
    }
  } catch {
    try {
      if (typeof performance !== 'undefined' && performance.getEntriesByType) {
        const existing = performance.getEntriesByType('resource');
        for (const entry of existing) {
          reportResourceEntry(entry as PerformanceResourceTiming);
        }
      }
    } catch {
      // no-op
    }
  }

  // 3. Long Tasks
  try {
    if (
      typeof PerformanceObserver !== 'undefined' &&
      PerformanceObserver.supportedEntryTypes &&
      PerformanceObserver.supportedEntryTypes.includes('longtask')
    ) {
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const attribution: Array<{
            name?: string;
            entryType?: string;
            startTime?: number;
            duration?: number;
            containerType?: string;
            containerSrc?: string;
            containerId?: string;
            containerName?: string;
          }> = [];

          if ('attribution' in entry && Array.isArray((entry as any).attribution)) {
            for (const attr of (entry as any).attribution) {
              attribution.push({
                name: typeof attr.name === 'string' ? attr.name : undefined,
                entryType: typeof attr.entryType === 'string' ? attr.entryType : undefined,
                containerType: typeof attr.containerType === 'string' ? attr.containerType : undefined,
                containerSrc: typeof attr.containerSrc === 'string' ? sanitizeUrl(attr.containerSrc) : undefined,
                containerId: typeof attr.containerId === 'string' ? attr.containerId : undefined,
                containerName: typeof attr.containerName === 'string' ? attr.containerName : undefined
              });
            }
          }

          const payload = {
            __runtimePerformanceMessage: true,
            performanceType: 'longtask',
            name: entry.name || 'self',
            startTime: Math.round(entry.startTime),
            durationMs: Math.round(entry.duration),
            attribution: attribution.length > 0 ? attribution : undefined,
            sourceUrl: window.location ? window.location.href : null,
            timestamp: new Date().toISOString()
          };

          window.postMessage(payload, '*');
        }
      });

      longTaskObserver.observe({ entryTypes: ['longtask'] });
    }
  } catch {
    // no-op
  }
}

async function ensureConsoleObserverForTab(tabId: number): Promise<void> {
  const session = await readSessionState();
  if (!session || session.status !== 'active') {
    return;
  }

  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab || !tab.url || !isSupportedUrl(tab.url)) {
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: installMainWorldConsoleObserver
    });
  } catch (error) {
    console.error('[CONSOLE] Failed to install main-world observer for tab:', tabId, error);
  }
}

async function ensureNetworkObserverForTab(tabId: number): Promise<void> {
  const session = await readSessionState();
  if (!session || session.status !== 'active') {
    return;
  }

  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab || !tab.url || !isSupportedUrl(tab.url)) {
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: installMainWorldNetworkObserver
    });
  } catch (error) {
    console.error('[NETWORK] Failed to install main-world network observer for tab:', tabId, error);
  }
}

async function ensurePerformanceObserverForTab(tabId: number): Promise<void> {
  const session = await readSessionState();
  if (!session || session.status !== 'active') {
    return;
  }

  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab || !tab.url || !isSupportedUrl(tab.url)) {
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: installMainWorldPerformanceObserver
    });
  } catch (error) {
    console.error('[PERFORMANCE] Failed to install main-world performance observer for tab:', tabId, error);
  }
}

async function ensureObserversForTab(tabId: number): Promise<void> {
  await ensureConsoleObserverForTab(tabId);
  await ensureNetworkObserverForTab(tabId);
  await ensurePerformanceObserverForTab(tabId);
}

async function restoreObserversForActiveSession(): Promise<void> {
  const session = await readSessionState();
  if (!session || session.status !== 'active') {
    return;
  }

  const tabs = await chrome.tabs.query({}).catch(() => [] as chrome.tabs.Tab[]);
  for (const tab of tabs) {
    if (tab.id !== undefined && tab.url && isSupportedUrl(tab.url)) {
      await ensureObserversForTab(tab.id);
    }
  }
}

function formatMessage(message: unknown): string {
  if (typeof message === 'string') {
    return message;
  }

  return 'Malformed message';
}

async function getActiveTab() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0] ?? null;
  } catch (error) {
    console.error('[SESSION] Unable to query active tab:', error);
    return null;
  }
}

function getLatestPageForTab(session: SessionState, tabId: number): PageRecord | null {
  const pagesForTab = session.pages.filter((page) => page.tabId === tabId);
  if (pagesForTab.length === 0) {
    return null;
  }

  return pagesForTab[pagesForTab.length - 1];
}

function getCurrentTrackedPage(session: SessionState): PageRecord | null {
  if (session.activeTabId !== null) {
    const activePage = getLatestPageForTab(session, session.activeTabId);
    if (activePage) {
      return activePage;
    }
  }

  return session.pages.length > 0 ? session.pages[session.pages.length - 1] : null;
}

function ensureWebsiteRecord(
  session: SessionState,
  origin: string
): { website: WebsiteRecord; websites: WebsiteRecord[] } {
  const now = new Date().toISOString();
  const existing = session.websites?.find((w) => w.origin === origin);

  if (existing) {
    const updatedWebsites = session.websites.map((w) =>
      w.origin === origin ? { ...w, lastSeenAt: now } : w
    );
    return {
      website: { ...existing, lastSeenAt: now },
      websites: updatedWebsites
    };
  }

  const newWebsite: WebsiteRecord = {
    websiteId: generateWebsiteId(),
    sessionId: session.sessionId,
    origin,
    firstSeenAt: now,
    lastSeenAt: now
  };

  const updatedWebsites = [...(session.websites || []), newWebsite];
  console.log(`${WEBSITE_LOG_PREFIX} Registered new website ${newWebsite.websiteId} -> ${origin} in session ${session.sessionId}`);
  return {
    website: newWebsite,
    websites: updatedWebsites
  };
}

function createPageRecord(
  sessionId: string,
  tab: chrome.tabs.Tab,
  website: WebsiteRecord,
  urlOverride?: string
): PageRecord {
  const rawUrl = urlOverride ?? tab.url ?? 'about:blank';
  const url = normalizeDocumentUrl(rawUrl);
  const title = tab.title ? safeTitle(tab.title) : '';
  const pageId = generatePageId();

  console.log(`${PAGE_LOG_PREFIX} Created ${pageId} for tab ${tab.id ?? 'unknown'} -> ${url} (website: ${website.origin})`);

  return {
    pageId,
    sessionId,
    websiteId: website.websiteId,
    websiteOrigin: website.origin,
    tabId: tab.id ?? 0,
    url,
    title,
    createdAt: new Date().toISOString()
  };
}

function createRouteRecord(
  sessionId: string,
  pageId: string,
  tabId: number,
  url: string,
  navigationType: 'initial' | 'pushState' | 'replaceState' | 'popstate' | 'hashchange'
): RouteRecord {
  const parsed = new URL(url);
  const path = `${parsed.pathname}${parsed.search}`;
  const hash = parsed.hash;

  return {
    routeId: generateRouteId(),
    sessionId,
    pageId,
    tabId,
    url,
    path,
    hash,
    timestamp: new Date().toISOString(),
    navigationType
  };
}

function getPageForRouteTarget(session: SessionState, tabId: number, url: string): PageRecord | null {
  const latestPage = getLatestPageForTab(session, tabId);
  if (latestPage) {
    return latestPage;
  }

  const normalizedUrl = normalizeDocumentUrl(url);
  return session.pages.find((page) => normalizeDocumentUrl(page.url) === normalizedUrl) ?? null;
}

function shouldSkipDuplicateRoute(tabId: number, pageId: string, url: string, navigationType: string): boolean {
  const key = `${tabId}:${pageId}:${url}`;
  const previous = routeDedupCache.get(key);
  const now = Date.now();

  if (previous && now - previous < 1200) {
    return true;
  }

  routeDedupCache.set(key, now);
  return false;
}

async function startSession(): Promise<RuntimeResponse> {
  const activeTab = await getActiveTab();

  if (!activeTab) {
    return { ok: false, type: 'ERROR', message: 'No active tab is available to start a monitoring session.' };
  }

  if (typeof activeTab.url !== 'string' || !isSupportedUrl(activeTab.url)) {
    return { ok: false, type: 'ERROR', message: 'The active tab is unsupported for monitoring. Use a normal web page.' };
  }

  const origin = extractWebsiteOrigin(activeTab.url);
  if (!origin) {
    return { ok: false, type: 'ERROR', message: 'Unable to determine the canonical website origin for the active tab.' };
  }

  const sessionId = generateSessionId();
  const startedAt = new Date().toISOString();
  const rootUrl = activeTab.url;

  const initialWebsite: WebsiteRecord = {
    websiteId: generateWebsiteId(),
    sessionId,
    origin,
    firstSeenAt: startedAt,
    lastSeenAt: startedAt
  };

  const initialPage = createPageRecord(sessionId, activeTab, initialWebsite, activeTab.url);
  const initialRoute = createRouteRecord(sessionId, initialPage.pageId, initialPage.tabId, activeTab.url, 'initial');

  const session: SessionState = {
    sessionId,
    startedAt,
    status: 'active',
    activeTabId: activeTab.id ?? null,
    rootUrl,
    websites: [initialWebsite],
    pages: [initialPage],
    routes: [initialRoute]
  };

  await writeSessionState(session);
  await ensureObserversForTab(activeTab.id ?? 0);

  console.log(`${SESSION_LOG_PREFIX} Started ${sessionId} on website ${initialWebsite.origin}`);

  return { ok: true, type: 'SESSION_STARTED', session };
}

async function buildFinalizedSessionPackage(
  session: SessionState,
  endedAt: string,
  durationMs: number
): Promise<FinalizedSessionPackage> {
  const events = await runtimeEventRepository.getBySessionId(session.sessionId);

  const eventsByPageId = new Map<string, RuntimeEvent[]>();
  const unassignedEvents: RuntimeEvent[] = [];

  for (const event of events) {
    if (event.pageId) {
      const pageEvents = eventsByPageId.get(event.pageId) || [];
      pageEvents.push(event);
      eventsByPageId.set(event.pageId, pageEvents);
    } else {
      unassignedEvents.push(event);
    }
  }

  const routesByPageId = new Map<string, RouteRecord[]>();
  for (const route of session.routes) {
    const pageRoutes = routesByPageId.get(route.pageId) || [];
    pageRoutes.push(route);
    routesByPageId.set(route.pageId, pageRoutes);
  }

  const pagesByWebsiteId = new Map<string, FinalizedPageData[]>();
  for (const page of session.pages) {
    const pageData: FinalizedPageData = {
      ...page,
      routes: routesByPageId.get(page.pageId) || [],
      events: eventsByPageId.get(page.pageId) || []
    };

    const targetKey = page.websiteId || page.websiteOrigin;
    const websitePages = pagesByWebsiteId.get(targetKey) || [];
    websitePages.push(pageData);
    pagesByWebsiteId.set(targetKey, websitePages);
  }

  if (unassignedEvents.length > 0 && session.pages.length > 0) {
    const firstPage = session.pages[0];
    const targetKey = firstPage.websiteId || firstPage.websiteOrigin;
    const websitePages = pagesByWebsiteId.get(targetKey);
    if (websitePages && websitePages.length > 0) {
      websitePages[0].events.push(...unassignedEvents);
    }
  }

  const websites: FinalizedWebsiteData[] = (session.websites || []).map((website) => {
    const targetKey = website.websiteId || website.origin;
    return {
      ...website,
      pages: pagesByWebsiteId.get(targetKey) || pagesByWebsiteId.get(website.origin) || []
    };
  });

  const sessionMetadata: FinalizedSessionMetadata = {
    sessionId: session.sessionId,
    status: 'finalized',
    startedAt: session.startedAt,
    endedAt,
    durationMs,
    rootUrl: session.rootUrl,
    activeTabId: session.activeTabId
  };

  return {
    session: sessionMetadata,
    websites
  };
}

const APPLICATION_INGEST_URL = 'http://localhost:3001/api/sessions/ingest';

async function syncSessionToBackend(sessionPackage: FinalizedSessionPackage): Promise<boolean> {
  try {
    const res = await fetch(APPLICATION_INGEST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(sessionPackage)
    });

    if (res.ok) {
      console.log(`${SESSION_LOG_PREFIX} Successfully persisted ${sessionPackage.session.sessionId} to Supabase via Application API.`);
      return true;
    } else {
      const errBody = await res.text();
      console.warn(`${SESSION_LOG_PREFIX} Failed to ingest session ${sessionPackage.session.sessionId} (HTTP ${res.status}): ${errBody}`);
      return false;
    }
  } catch (error) {
    console.warn(`${SESSION_LOG_PREFIX} Unable to reach Application API at ${APPLICATION_INGEST_URL}:`, error);
    return false;
  }
}

async function stopSession(): Promise<RuntimeResponse> {
  const currentSession = await readSessionState();

  if (!currentSession) {
    return { ok: false, type: 'ERROR', message: 'No active monitoring session to stop.' };
  }

  // Idempotency: if already finalized, return the existing package without re-finalizing
  if (currentSession.status === 'finalized' && currentSession.endedAt) {
    const existingPackage = await readFinalizedSessionPackage();
    if (existingPackage) {
      void syncSessionToBackend(existingPackage);
      return { ok: true, type: 'SESSION_STOPPED', session: currentSession, package: existingPackage };
    }
    const pkg = await buildFinalizedSessionPackage(
      currentSession,
      currentSession.endedAt,
      currentSession.durationMs || 0
    );
    await writeFinalizedSessionPackage(pkg);
    void syncSessionToBackend(pkg);
    return { ok: true, type: 'SESSION_STOPPED', session: currentSession, package: pkg };
  }

  const endedAt = new Date().toISOString();
  const durationMs = Math.max(0, new Date(endedAt).getTime() - new Date(currentSession.startedAt).getTime());

  const stoppedSession: SessionState = {
    ...currentSession,
    status: 'finalized',
    endedAt,
    durationMs
  };

  await writeSessionState(stoppedSession);

  const sessionPackage = await buildFinalizedSessionPackage(stoppedSession, endedAt, durationMs);
  await writeFinalizedSessionPackage(sessionPackage);

  console.log(`${SESSION_LOG_PREFIX} Finalized ${stoppedSession.sessionId} (duration: ${durationMs}ms, websites: ${sessionPackage.websites.length})`);

  // Automatically push finalized session to Supabase via Application API
  void syncSessionToBackend(sessionPackage);

  return { ok: true, type: 'SESSION_STOPPED', session: stoppedSession, package: sessionPackage };
}

async function handleGetFinalizedSession(): Promise<RuntimeResponse> {
  const pkg = await readFinalizedSessionPackage();
  return { ok: true, type: 'FINALIZED_SESSION', package: pkg };
}

async function handleGetSessionState(): Promise<RuntimeResponse> {
  const session = await readSessionState();
  return { ok: true, type: 'SESSION_STATE', session };
}

async function handleGetCurrentPage(): Promise<RuntimeResponse> {
  const session = await readSessionState();
  if (!session || session.pages.length === 0) {
    return { ok: true, type: 'CURRENT_PAGE', page: null, session };
  }

  const page = getCurrentTrackedPage(session);
  return { ok: true, type: 'CURRENT_PAGE', page, session };
}

async function createPageForNavigation(tabId: number, url?: string): Promise<void> {
  const session = await readSessionState();
  if (!session || session.status !== 'active') {
    return;
  }

  if (!url || !isSupportedUrl(url)) {
    console.log(`${NAV_LOG_PREFIX} Ignored unsupported navigation for tab ${tabId}: ${url ?? 'unknown'}`);
    return;
  }

  const normalizedUrl = normalizeDocumentUrl(url);
  const latestPageForTab = getLatestPageForTab(session, tabId);
  if (latestPageForTab && latestPageForTab.url === normalizedUrl) {
    console.log(`${NAV_LOG_PREFIX} Skipping duplicate navigation for tab ${tabId} -> ${normalizedUrl}`);
    return;
  }

  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab) {
    return;
  }

  const origin = extractWebsiteOrigin(url) || extractWebsiteOrigin(normalizedUrl);
  if (!origin) {
    console.log(`${NAV_LOG_PREFIX} Ignored navigation with invalid origin for tab ${tabId}: ${url}`);
    return;
  }

  const { website, websites } = ensureWebsiteRecord(session, origin);
  const newPage = createPageRecord(session.sessionId, tab, website, normalizedUrl);
  const initialRoute = createRouteRecord(session.sessionId, newPage.pageId, newPage.tabId, url, 'initial');
  const nextSession: SessionState = {
    ...session,
    activeTabId: tab.id ?? session.activeTabId,
    rootUrl: session.rootUrl ?? normalizedUrl ?? null,
    websites,
    pages: [...session.pages, newPage],
    routes: [...session.routes, initialRoute]
  };

  await writeSessionState(nextSession);
  console.log(`${NAV_LOG_PREFIX} New page created for tab ${tabId}: ${newPage.pageId} -> ${normalizedUrl} (website: ${website.origin})`);
}

async function captureRouteEvent(
  tabId: number,
  url: string,
  navigationType: 'initial' | 'pushState' | 'replaceState' | 'popstate' | 'hashchange'
): Promise<void> {
  const session = await readSessionState();
  if (!session || session.status !== 'active') {
    return;
  }

  if (!isSupportedUrl(url)) {
    console.log(`${ROUTE_LOG_PREFIX} Ignored unsupported route url for tab ${tabId}: ${url}`);
    return;
  }

  const latestPage = getLatestPageForTab(session, tabId);
  if (!latestPage) {
    return;
  }

  const latestPageUrl = normalizeDocumentUrl(latestPage.url);
  const targetUrl = normalizeDocumentUrl(url);

  if (latestPageUrl !== targetUrl) {
    console.log(`${ROUTE_LOG_PREFIX} Ignoring route ${navigationType} for tab ${tabId}: stale URL ${url} does not match current page ${latestPage.url}`);
    return;
  }

  if (shouldSkipDuplicateRoute(tabId, latestPage.pageId, url, navigationType)) {
    console.log(`${ROUTE_LOG_PREFIX} Skipping duplicate ${navigationType} event for tab ${tabId}: ${url}`);
    return;
  }

  const route = createRouteRecord(session.sessionId, latestPage.pageId, tabId, url, navigationType);
  const nextSession: SessionState = {
    ...session,
    activeTabId: tabId,
    routes: [...session.routes, route]
  };

  await writeSessionState(nextSession);
  console.log(`${ROUTE_LOG_PREFIX} ${navigationType} created route ${route.routeId} for page ${latestPage.pageId}`);
}

async function updateActiveTab(tabId: number | null): Promise<void> {
  const session = await readSessionState();
  if (!session || session.status !== 'active') {
    return;
  }

  const nextSession: SessionState = {
    ...session,
    activeTabId: tabId
  };

  await writeSessionState(nextSession);
  console.log(`${TAB_LOG_PREFIX} Activated tab ${tabId ?? 'none'} in session ${session.sessionId}`);
}

let runtimeMessageListenerRegistered = false;

if (!runtimeMessageListenerRegistered) {
  chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    void (async () => {
      try {
        const typedMessage = message as ExtensionMessage;
        if (!typedMessage || typeof typedMessage.type !== 'string') {
          sendResponse({ ok: false, type: 'ERROR', message: 'Malformed message payload.' });
          return;
        }

        switch (typedMessage.type) {
          case 'START_SESSION': {
            const result = await startSession();
            sendResponse(result);
            return;
          }
          case 'STOP_SESSION': {
            const result = await stopSession();
            sendResponse(result);
            return;
          }
          case 'GET_SESSION_STATE': {
            const result = await handleGetSessionState();
            sendResponse(result);
            return;
          }
          case 'GET_CURRENT_PAGE': {
            const result = await handleGetCurrentPage();
            sendResponse(result);
            return;
          }
          case 'GET_FINALIZED_SESSION': {
            const result = await handleGetFinalizedSession();
            sendResponse(result);
            return;
          }
          case 'ROUTE_EVENT': {
            const payload = typedMessage as { url: string; navigationType: 'initial' | 'pushState' | 'replaceState' | 'popstate' | 'hashchange'; timestamp: string; path: string };
            const tabId = sender.tab?.id ?? (await readSessionState())?.activeTabId ?? null;
            if (tabId === null) {
              sendResponse({ ok: false, type: 'ERROR', message: 'No active tab available for route capture.' });
              return;
            }

            await captureRouteEvent(tabId, payload.url, payload.navigationType);
            sendResponse({ ok: true, type: 'ROUTE_CAPTURED', route: null });
            return;
          }
          case 'CONSOLE_EVENT': {
            const payload = typedMessage as ConsoleEventMessage;
            const tabId = sender.tab?.id ?? null;
            await handleConsoleEvent(payload.payload, tabId);
            sendResponse({ ok: true, type: 'ROUTE_CAPTURED', route: null });
            return;
          }
          case 'NETWORK_EVENT': {
            const payload = typedMessage as NetworkEventMessage;
            const tabId = sender.tab?.id ?? null;
            await handleNetworkEvent(payload.payload, tabId);
            sendResponse({ ok: true, type: 'ROUTE_CAPTURED', route: null });
            return;
          }
          case 'PERFORMANCE_EVENT': {
            const payload = typedMessage as PerformanceEventMessage;
            const tabId = sender.tab?.id ?? null;
            await handlePerformanceEvent(payload.payload, tabId);
            sendResponse({ ok: true, type: 'ROUTE_CAPTURED', route: null });
            return;
          }
          case 'INTERACTION_EVENT': {
            const payload = typedMessage as any;
            const tabId = sender.tab?.id ?? null;
            await handleInteractionEvent(payload.payload, tabId);
            sendResponse({ ok: true, type: 'ROUTE_CAPTURED', route: null });
            return;
          }
          default: {
            sendResponse({ ok: false, type: 'ERROR', message: `Unsupported message type: ${String((typedMessage as { type?: unknown }).type)}` });
          }
        }
      } catch (error) {
        console.error('[SESSION] Unhandled message error:', error);
        sendResponse({ ok: false, type: 'ERROR', message: formatMessage(error) });
      }
    })();

    return true;
  });

  runtimeMessageListenerRegistered = true;
}

chrome.tabs.onCreated.addListener(async (tab) => {
  try {
    if (!tab.id || !tab.url || !isSupportedUrl(tab.url)) {
      return;
    }

    const session = await readSessionState();
    if (!session || session.status !== 'active') {
      return;
    }

    await createPageForNavigation(tab.id, tab.url);
    await ensureObserversForTab(tab.id);
  } catch (error) {
    console.error('[TAB] Creation handler failed:', error);
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  try {
    if (changeInfo.status !== 'complete') {
      return;
    }

    if (!tab.url) {
      return;
    }

    if (tab.url === 'chrome://newtab/' || tab.url === 'chrome://new-tab-page/' || tab.url.startsWith('chrome://')) {
      return;
    }

    await createPageForNavigation(tabId, tab.url);
    await ensureObserversForTab(tabId);
  } catch (error) {
    console.error('[PAGE] Navigation handler failed:', error);
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const session = await readSessionState();
    if (!session || session.status !== 'active') {
      return;
    }

    const hardwareTab = await chrome.tabs.get(tabId).catch(() => null);
    if (hardwareTab?.url && !isSupportedUrl(hardwareTab.url)) {
      await updateActiveTab(tabId);
      return;
    }

    await updateActiveTab(tabId);
    await ensureObserversForTab(tabId);
    console.log(`${TAB_LOG_PREFIX} Active tab switched to ${tabId}; current tracked page: ${getLatestPageForTab(session, tabId)?.pageId ?? 'none'}`);
  } catch (error) {
    console.error('[TAB] Activation handler failed:', error);
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  try {
    const session = await readSessionState();
    if (!session || session.status !== 'active') {
      return;
    }

    const nextSession: SessionState = {
      ...session,
      activeTabId: session.activeTabId === tabId ? null : session.activeTabId
    };

    await writeSessionState(nextSession);
    console.log(`${TAB_LOG_PREFIX} Removed tab ${tabId}; active tab is now ${nextSession.activeTabId ?? 'none'}`);
  } catch (error) {
    console.error('[TAB] Remove handler failed:', error);
  }
});

const runtimeEventPipeline = new RuntimeEventPipeline(runtimeEventRepository);

void runtimeEventRepository.initialize().then(() => {
  console.log('[EVENT_DB] Runtime event database initialized on service worker startup');
  void restoreObserversForActiveSession();
}).catch((error) => {
  console.error('[EVENT_DB] Runtime event database initialization failed:', error);
});

async function handleConsoleEvent(
  payload: { level: 'log' | 'info' | 'warn' | 'error' | 'debug'; message: string; arguments: unknown[]; sourceUrl: string | null; timestamp: string },
  senderTabId?: number | null
): Promise<void> {
  const session = await readSessionState();
  if (!session || session.status !== 'active') {
    console.log('[CONSOLE] Monitoring inactive; event ignored');
    return;
  }

  const targetTabId = senderTabId ?? session.activeTabId;
  const activeTab = targetTabId !== null ? await chrome.tabs.get(targetTabId).catch(() => null) : null;
  const page = activeTab ? getLatestPageForTab(session, activeTab.id ?? 0) : getCurrentTrackedPage(session);
  const route = page ? session.routes.filter((item) => item.pageId === page.pageId).at(-1) ?? null : null;

  const runtimeEvent = {
    eventId: generateEventId(),
    sessionId: session.sessionId,
    pageId: page?.pageId ?? null,
    routeId: route?.routeId ?? null,
    tabId: activeTab?.id ?? targetTabId ?? null,
    timestamp: payload.timestamp || createRuntimeEventTimestamp(),
    type: 'console' as const,
    data: {
      level: payload.level,
      message: payload.message || 'Console event',
      arguments: Array.isArray(payload.arguments) ? payload.arguments : [],
      sourceUrl: payload.sourceUrl,
      rawTimestamp: payload.timestamp
    }
  };

  const saved = await runtimeEventPipeline.record(runtimeEvent);
  if (!saved.ok) {
    console.error('[CONSOLE] Failed to store runtime event:', saved.error);
    return;
  }

  console.log('[CONSOLE] Event stored', saved.event.eventId);
}

async function handleNetworkEvent(
  payload: NetworkRuntimeData,
  senderTabId?: number | null
): Promise<void> {
  const session = await readSessionState();
  if (!session || session.status !== 'active') {
    console.log('[NETWORK] Monitoring inactive; event ignored');
    return;
  }

  const targetTabId = senderTabId ?? session.activeTabId;
  const activeTab = targetTabId !== null ? await chrome.tabs.get(targetTabId).catch(() => null) : null;
  const page = activeTab ? getLatestPageForTab(session, activeTab.id ?? 0) : getCurrentTrackedPage(session);
  const route = page ? session.routes.filter((item) => item.pageId === page.pageId).at(-1) ?? null : null;

  const runtimeEvent = {
    eventId: generateEventId(),
    sessionId: session.sessionId,
    pageId: page?.pageId ?? null,
    routeId: route?.routeId ?? null,
    tabId: activeTab?.id ?? targetTabId ?? null,
    timestamp: payload.timestamp || createRuntimeEventTimestamp(),
    type: 'network' as const,
    data: {
      requestType: payload.requestType,
      method: payload.method,
      url: payload.url,
      status: payload.status,
      statusText: payload.statusText,
      ok: payload.ok,
      durationMs: payload.durationMs,
      failureType: payload.failureType ?? null,
      errorMessage: payload.errorMessage ?? null,
      sourceUrl: payload.sourceUrl ?? null,
      timestamp: payload.timestamp
    }
  };

  const saved = await runtimeEventPipeline.record(runtimeEvent);
  if (!saved.ok) {
    console.error('[NETWORK] Failed to store runtime event:', saved.error);
    return;
  }

  console.log('[NETWORK] Event stored', saved.event.eventId, payload.method, payload.url);
}

async function handlePerformanceEvent(
  payload: PerformanceRuntimeData,
  senderTabId?: number | null
): Promise<void> {
  const session = await readSessionState();
  if (!session || session.status !== 'active') {
    console.log('[PERFORMANCE] Monitoring inactive; event ignored');
    return;
  }

  const targetTabId = senderTabId ?? session.activeTabId;
  const activeTab = targetTabId !== null ? await chrome.tabs.get(targetTabId).catch(() => null) : null;
  const page = activeTab ? getLatestPageForTab(session, activeTab.id ?? 0) : getCurrentTrackedPage(session);
  const route = page ? session.routes.filter((item) => item.pageId === page.pageId).at(-1) ?? null : null;

  const runtimeEvent = {
    eventId: generateEventId(),
    sessionId: session.sessionId,
    pageId: page?.pageId ?? null,
    routeId: route?.routeId ?? null,
    tabId: activeTab?.id ?? targetTabId ?? null,
    timestamp: payload.timestamp || createRuntimeEventTimestamp(),
    type: 'performance' as const,
    data: payload
  };

  const saved = await runtimeEventPipeline.record(runtimeEvent);
  if (!saved.ok) {
    console.error('[PERFORMANCE] Failed to store runtime event:', saved.error);
    return;
  }

  console.log('[PERFORMANCE] Event stored', saved.event.eventId, payload.performanceType);
}

async function handleInteractionEvent(
  payload: {
    interactionType: 'click' | 'submit' | 'keydown';
    elementTag: string;
    elementId?: string | null;
    elementClasses?: string | null;
    elementRole?: string | null;
    accessibleLabel?: string | null;
    textPreview?: string | null;
    selector?: string | null;
    timestamp: string;
  },
  senderTabId?: number | null
): Promise<void> {
  const session = await readSessionState();
  if (!session || session.status !== 'active') {
    return;
  }

  const targetTabId = senderTabId ?? session.activeTabId;
  const activeTab = targetTabId !== null ? await chrome.tabs.get(targetTabId).catch(() => null) : null;
  const page = activeTab ? getLatestPageForTab(session, activeTab.id ?? 0) : getCurrentTrackedPage(session);
  const route = page ? session.routes.filter((item) => item.pageId === page.pageId).at(-1) ?? null : null;

  const runtimeEvent = {
    eventId: generateEventId(),
    sessionId: session.sessionId,
    pageId: page?.pageId ?? null,
    routeId: route?.routeId ?? null,
    tabId: activeTab?.id ?? targetTabId ?? null,
    timestamp: payload.timestamp || createRuntimeEventTimestamp(),
    type: 'interaction' as const,
    data: {
      interactionType: payload.interactionType,
      elementTag: payload.elementTag,
      elementId: payload.elementId ?? null,
      elementClasses: payload.elementClasses ?? null,
      elementRole: payload.elementRole ?? null,
      accessibleLabel: payload.accessibleLabel ?? null,
      textPreview: payload.textPreview ?? null,
      selector: payload.selector ?? null,
      timestamp: payload.timestamp
    }
  };

  const saved = await runtimeEventPipeline.record(runtimeEvent);
  if (!saved.ok) {
    console.error('[INTERACTION] Failed to store runtime event:', saved.error);
    return;
  }

  console.log('[INTERACTION] Event stored', saved.event.eventId, payload.elementTag, payload.textPreview);
}

console.log('[SESSION] Service worker initialized');

(globalThis as typeof globalThis & {
  __runtimeSessionDebug?: () => Promise<void>;
  __runtimeEventDebug?: () => Promise<{
    created?: unknown;
    all?: unknown[];
    bySession?: unknown[];
    byPage?: unknown[];
    byType?: unknown[];
    cleared?: boolean;
    error?: string;
  }>;
}).__runtimeSessionDebug = async () => {
  const session = await readSessionState();
  console.log('[SESSION] Active session debug:', session);
};

(globalThis as typeof globalThis & {
  __runtimeEventDebug?: () => Promise<{
    created?: unknown;
    all?: unknown[];
    bySession?: unknown[];
    byPage?: unknown[];
    byType?: unknown[];
    cleared?: boolean;
    error?: string;
  }>;
}).__runtimeEventDebug = async () => {
  const session = await readSessionState();
  if (!session) {
    return { error: 'No active monitoring session exists. Start a session before creating runtime test events.' };
  }

  const currentPage = getCurrentTrackedPage(session);
  if (!currentPage) {
    return { error: 'No current page is available for the active monitoring session.' };
  }

  const route = session.routes[session.routes.length - 1] ?? null;
  const testEvent = {
    eventId: generateEventId(),
    sessionId: session.sessionId,
    pageId: currentPage.pageId,
    routeId: route?.routeId ?? null,
    tabId: currentPage.tabId,
    timestamp: createRuntimeEventTimestamp(),
    type: 'network' as const,
    data: {
      requestType: 'fetch' as const,
      method: 'GET',
      url: 'https://jsonplaceholder.typicode.com/todos/1',
      status: 200,
      statusText: 'OK',
      ok: true,
      durationMs: 45,
      failureType: null,
      errorMessage: null,
      sourceUrl: currentPage.url,
      timestamp: createRuntimeEventTimestamp()
    }
  };

  const created = await runtimeEventPipeline.record(testEvent);
  if (!created.ok) {
    return { error: created.error };
  }

  const all = await runtimeEventRepository.getBySessionId(session.sessionId);
  const byPage = await runtimeEventRepository.getByPageId(currentPage.pageId);
  const byType = await runtimeEventRepository.getByType('network');

  return {
    created: created.event,
    all,
    bySession: all,
    byPage,
    byType
  };
};

(globalThis as typeof globalThis & {
  __runtimeEventClearDebug?: () => Promise<{ cleared: boolean; error?: string }>;
}).__runtimeEventClearDebug = async () => {
  try {
    const session = await readSessionState();
    if (!session) {
      await runtimeEventRepository.clear();
      return { cleared: true };
    }

    await runtimeEventRepository.deleteBySessionId(session.sessionId);
    return { cleared: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown clear error.';
    console.error('[EVENT_DB] Clear debug failed:', message);
    return { cleared: false, error: message };
  }
};

(globalThis as typeof globalThis & {
  __runtimeSessionExport?: () => Promise<FinalizedSessionPackage | null>;
}).__runtimeSessionExport = async () => {
  const currentSession = await readSessionState();
  if (currentSession) {
    const endedAt = currentSession.endedAt || new Date().toISOString();
    const durationMs = currentSession.durationMs || Math.max(0, new Date(endedAt).getTime() - new Date(currentSession.startedAt).getTime());
    const pkg = await buildFinalizedSessionPackage(currentSession, endedAt, durationMs);
    console.log('[SESSION] Exported session package:', pkg);
    return pkg;
  }

  const cached = await readFinalizedSessionPackage();
  if (cached) {
    console.log('[SESSION] Exported cached finalized session package:', cached);
    return cached;
  }

  console.log('[SESSION] No session available to export.');
  return null;
};

