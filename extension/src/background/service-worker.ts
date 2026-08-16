import { clearSessionState, readSessionState, writeSessionState } from '../storage/session-store';
import type { ExtensionMessage, PageRecord, RouteRecord, RuntimeResponse, SessionState } from '../types/session';
import { RuntimeEventPipeline, createRuntimeEventTimestamp, generateEventId } from '../runtime/runtime-event-pipeline';
import { runtimeEventRepository } from '../runtime/runtime-event-repository';
import { generatePageId, generateRouteId, generateSessionId, isSupportedUrl, normalizeDocumentUrl, safeTitle } from '../utils/page';

const SESSION_LOG_PREFIX = '[SESSION]';
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

async function restoreConsoleObserversForActiveSession(): Promise<void> {
  const session = await readSessionState();
  if (!session || session.status !== 'active') {
    return;
  }

  const tabs = await chrome.tabs.query({}).catch(() => [] as chrome.tabs.Tab[]);
  for (const tab of tabs) {
    if (tab.id !== undefined && tab.url && isSupportedUrl(tab.url)) {
      await ensureConsoleObserverForTab(tab.id);
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

function createPageRecord(sessionId: string, tab: chrome.tabs.Tab, urlOverride?: string): PageRecord {
  const rawUrl = urlOverride ?? tab.url ?? 'about:blank';
  const url = normalizeDocumentUrl(rawUrl);
  const title = tab.title ? safeTitle(tab.title) : '';
  const pageId = generatePageId();

  console.log(`${PAGE_LOG_PREFIX} Created ${pageId} for tab ${tab.id ?? 'unknown'} -> ${url}`);

  return {
    pageId,
    sessionId,
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

  const sessionId = generateSessionId();
  const startedAt = new Date().toISOString();
  const rootUrl = activeTab.url;
  const initialPage = createPageRecord(sessionId, activeTab, activeTab.url);
  const initialRoute = createRouteRecord(sessionId, initialPage.pageId, initialPage.tabId, activeTab.url, 'initial');

  const session: SessionState = {
    sessionId,
    startedAt,
    status: 'active',
    activeTabId: activeTab.id ?? null,
    rootUrl,
    pages: [initialPage],
    routes: [initialRoute]
  };

  await writeSessionState(session);
  await ensureConsoleObserverForTab(activeTab.id ?? 0);

  console.log(`${SESSION_LOG_PREFIX} Started ${sessionId}`);

  return { ok: true, type: 'SESSION_STARTED', session };
}

async function stopSession(): Promise<RuntimeResponse> {
  const currentSession = await readSessionState();

  if (!currentSession) {
    return { ok: false, type: 'ERROR', message: 'No active monitoring session to stop.' };
  }

  const stoppedSession: SessionState = {
    ...currentSession,
    status: 'stopped'
  };

  await clearSessionState();
  console.log(`${SESSION_LOG_PREFIX} Stopped ${stoppedSession.sessionId}`);

  return { ok: true, type: 'SESSION_STOPPED', session: stoppedSession };
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

  const newPage = createPageRecord(session.sessionId, tab, normalizedUrl);
  const initialRoute = createRouteRecord(session.sessionId, newPage.pageId, newPage.tabId, url, 'initial');
  const nextSession: SessionState = {
    ...session,
    activeTabId: tab.id ?? session.activeTabId,
    rootUrl: session.rootUrl ?? normalizedUrl ?? null,
    pages: [...session.pages, newPage],
    routes: [...session.routes, initialRoute]
  };

  await writeSessionState(nextSession);
  console.log(`${NAV_LOG_PREFIX} New page created for tab ${tabId}: ${newPage.pageId} -> ${normalizedUrl}`);
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
            const payload = typedMessage as {
              type: 'CONSOLE_EVENT';
              payload: {
                level: 'log' | 'info' | 'warn' | 'error' | 'debug';
                message: string;
                arguments: unknown[];
                sourceUrl: string | null;
                timestamp: string;
              };
            };
            await handleConsoleEvent(payload.payload);
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
    await ensureConsoleObserverForTab(tab.id);
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
    await ensureConsoleObserverForTab(tabId);
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
    await ensureConsoleObserverForTab(tabId);
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
  void restoreConsoleObserversForActiveSession();
}).catch((error) => {
  console.error('[EVENT_DB] Runtime event database initialization failed:', error);
});

async function handleConsoleEvent(payload: { level: 'log' | 'info' | 'warn' | 'error' | 'debug'; message: string; arguments: unknown[]; sourceUrl: string | null; timestamp: string }): Promise<void> {
  const session = await readSessionState();
  if (!session || session.status !== 'active') {
    console.log('[CONSOLE] Monitoring inactive; event ignored');
    return;
  }

  const activeTab = session.activeTabId !== null ? await chrome.tabs.get(session.activeTabId).catch(() => null) : null;
  const page = activeTab ? getLatestPageForTab(session, activeTab.id ?? 0) : getCurrentTrackedPage(session);
  const route = page ? session.routes.filter((item) => item.pageId === page.pageId).at(-1) ?? null : null;

  const runtimeEvent = {
    eventId: generateEventId(),
    sessionId: session.sessionId,
    pageId: page?.pageId ?? null,
    routeId: route?.routeId ?? null,
    tabId: activeTab?.id ?? session.activeTabId ?? null,
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
    type: 'console' as const,
    data: {
      test: true,
      message: 'Milestone 1D test event'
    }
  };

  const created = await runtimeEventPipeline.record(testEvent);
  if (!created.ok) {
    return { error: created.error };
  }

  const all = await runtimeEventRepository.getBySessionId(session.sessionId);
  const byPage = await runtimeEventRepository.getByPageId(currentPage.pageId);
  const byType = await runtimeEventRepository.getByType('console');

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
