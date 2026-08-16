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
}).catch((error) => {
  console.error('[EVENT_DB] Runtime event database initialization failed:', error);
});

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
