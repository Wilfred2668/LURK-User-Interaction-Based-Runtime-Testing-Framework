import type { PerformanceRuntimeData } from '../types/session';

const MESSAGE_LISTENER_MARKER = '__runtimePerformanceObserverMessageListenerInstalled';

function handlePagePerformanceMessage(event: MessageEvent): void {
  if (event.source !== window) {
    return;
  }

  const data = event.data as ({ __runtimePerformanceMessage?: boolean } & PerformanceRuntimeData) | undefined;
  if (!data || data.__runtimePerformanceMessage !== true || !data.performanceType || !data.timestamp) {
    return;
  }

  try {
    if (!chrome.runtime || !chrome.runtime.sendMessage) {
      return;
    }

    chrome.runtime.sendMessage(
      {
        type: 'PERFORMANCE_EVENT',
        payload: data
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

function initializePerformanceObserver(): void {
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
  window.addEventListener('message', handlePagePerformanceMessage);
}

initializePerformanceObserver();
console.log('[PERFORMANCE] Observer bridge initialized');
