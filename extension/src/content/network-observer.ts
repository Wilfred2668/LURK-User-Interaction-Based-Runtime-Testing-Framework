import type { NetworkRuntimeData } from '../types/session';

const MESSAGE_LISTENER_MARKER = '__runtimeNetworkObserverMessageListenerInstalled';

function handlePageNetworkMessage(event: MessageEvent): void {
  if (event.source !== window) {
    return;
  }

  const data = event.data as ({ __runtimeNetworkMessage?: boolean } & NetworkRuntimeData) | undefined;
  if (!data || data.__runtimeNetworkMessage !== true || !data.requestType || !data.url || !data.timestamp) {
    return;
  }

  try {
    if (!chrome.runtime || !chrome.runtime.sendMessage) {
      return;
    }

    const payload: NetworkRuntimeData = {
      requestType: data.requestType,
      method: typeof data.method === 'string' ? data.method : 'GET',
      url: typeof data.url === 'string' ? data.url : '',
      status: typeof data.status === 'number' ? data.status : null,
      statusText: typeof data.statusText === 'string' ? data.statusText : '',
      ok: Boolean(data.ok),
      durationMs: typeof data.durationMs === 'number' ? data.durationMs : 0,
      failureType: data.failureType ?? null,
      errorMessage: typeof data.errorMessage === 'string' ? data.errorMessage : null,
      sourceUrl: typeof data.sourceUrl === 'string' ? data.sourceUrl : null,
      timestamp: data.timestamp
    };

    chrome.runtime.sendMessage(
      {
        type: 'NETWORK_EVENT',
        payload
      },
      () => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          return;
        }
      }
    );
  } catch (error) {
    // Ignore invalidated extension contexts and transient service-worker teardown states.
  }
}

function initializeNetworkObserver(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const windowWithFlags = window as typeof window & {
    [MESSAGE_LISTENER_MARKER]?: boolean;
  };

  if (windowWithFlags[MESSAGE_LISTENER_MARKER]) {
    return;
  }

  windowWithFlags[MESSAGE_LISTENER_MARKER] = true;
  window.addEventListener('message', handlePageNetworkMessage);
}

initializeNetworkObserver();
console.log('[NETWORK] Observer bridge initialized');
