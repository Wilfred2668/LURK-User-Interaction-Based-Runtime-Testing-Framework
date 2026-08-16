type RouteNavigationEventType = 'pushState' | 'replaceState' | 'popstate' | 'hashchange';

const recentBrowserNavigationCache = new Map<string, number>();

function getRoutePartsFromUrl(url: string): { path: string; hash: string } {
  try {
    const parsed = new URL(url, window.location.origin);
    return {
      path: `${parsed.pathname}${parsed.search}`,
      hash: parsed.hash
    };
  } catch {
    return { path: url, hash: '' };
  }
}

function isDuplicateBrowserNavigation(url: string): boolean {
  const now = Date.now();
  const normalizedUrl = new URL(url, window.location.origin).href;
  const previous = recentBrowserNavigationCache.get(normalizedUrl);

  if (previous && now - previous < 1200) {
    return true;
  }

  recentBrowserNavigationCache.set(normalizedUrl, now);
  return false;
}

function sendRouteEvent(url: string, navigationType: RouteNavigationEventType) {
  try {
    if (isDuplicateBrowserNavigation(url)) {
      return;
    }

    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      return;
    }

    const { path, hash } = getRoutePartsFromUrl(url);
    const payload = {
      type: 'ROUTE_EVENT',
      url,
      path,
      hash,
      navigationType,
      timestamp: new Date().toISOString()
    };

    chrome.runtime.sendMessage(payload);
  } catch (error) {
    console.error('[ROUTE] Failed to send route event:', error);
  }
}

const originalPushState = history.pushState.bind(history);
const originalReplaceState = history.replaceState.bind(history);

history.pushState = function (...args) {
  const result = originalPushState.apply(this, args as Parameters<typeof history.pushState>);
  sendRouteEvent(window.location.href, 'pushState');
  return result;
};

history.replaceState = function (...args) {
  const result = originalReplaceState.apply(this, args as Parameters<typeof history.replaceState>);
  sendRouteEvent(window.location.href, 'replaceState');
  return result;
};

window.addEventListener('popstate', () => {
  sendRouteEvent(window.location.href, 'popstate');
});

window.addEventListener('hashchange', () => {
  sendRouteEvent(window.location.href, 'hashchange');
});

console.log('[ROUTE] Navigation observer initialized');
