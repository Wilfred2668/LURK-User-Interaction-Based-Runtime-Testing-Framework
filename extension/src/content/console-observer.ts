type ConsoleLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

type SerializedConsoleValue =
  | { type: 'string'; value: string }
  | { type: 'number'; value: string }
  | { type: 'boolean'; value: boolean }
  | { type: 'null'; value: null }
  | { type: 'undefined'; value: undefined }
  | { type: 'function'; value: string }
  | { type: 'symbol'; value: string }
  | { type: 'bigint'; value: string }
  | { type: 'date'; value: string }
  | { type: 'error'; name?: string; message?: string; stack?: string }
  | { type: 'array'; value: SerializedConsoleValue[]; truncated?: boolean }
  | { type: 'object'; value: Record<string, SerializedConsoleValue>; truncated?: boolean }
  | { type: 'circular'; value: string }
  | { type: 'truncated'; value: string }
  | { type: 'unknown'; value: string };

const INJECTED_MARKER = '__runtimeConsoleObserverInstalled';
const MESSAGE_LISTENER_MARKER = '__runtimeConsoleObserverMessageListenerInstalled';
const MAX_STRING_LENGTH = 2000;
const MAX_DEPTH = 4;
const MAX_ITEMS = 20;

function truncateString(value: string): string {
  return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}...` : value;
}

function safeStringifyValue(value: unknown): string {
  try {
    if (typeof value === 'string') {
      return truncateString(value);
    }

    if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
      return String(value);
    }

    if (typeof value === 'undefined') {
      return 'undefined';
    }

    if (typeof value === 'function') {
      return value.name ? `[Function: ${value.name}]` : '[Function]';
    }

    if (typeof value === 'symbol') {
      return value.toString();
    }

    if (value instanceof Error) {
      return value.message || value.name || 'Error';
    }

    return Object.prototype.toString.call(value);
  } catch {
    return '[Unserializable]';
  }
}

function serializeConsoleValue(value: unknown, depth = 0, seen = new WeakSet<object>()): SerializedConsoleValue {
  if (depth > MAX_DEPTH) {
    return { type: 'truncated', value: '[Depth limit reached]' };
  }

  if (value === null) {
    return { type: 'null', value: null };
  }

  if (typeof value === 'undefined') {
    return { type: 'undefined', value: undefined };
  }

  if (typeof value === 'string') {
    return { type: 'string', value: truncateString(value) };
  }

  if (typeof value === 'number') {
    return { type: 'number', value: String(value) };
  }

  if (typeof value === 'boolean') {
    return { type: 'boolean', value: value };
  }

  if (typeof value === 'bigint') {
    return { type: 'bigint', value: value.toString() };
  }

  if (typeof value === 'symbol') {
    return { type: 'symbol', value: value.toString() };
  }

  if (typeof value === 'function') {
    return { type: 'function', value: value.name ? `[Function: ${value.name}]` : '[Function]' };
  }

  if (value instanceof Error) {
    const result: { type: 'error'; name?: string; message?: string; stack?: string } = { type: 'error' };
    if (value.name) {
      result.name = value.name;
    }
    if (value.message) {
      result.message = truncateString(value.message);
    }
    if (value.stack) {
      result.stack = truncateString(value.stack);
    }
    return result;
  }

  if (value instanceof Date) {
    return { type: 'date', value: value.toISOString() };
  }

  if (Array.isArray(value)) {
    const sliced = value.slice(0, MAX_ITEMS).map((item) => serializeConsoleValue(item, depth + 1, seen));
    return {
      type: 'array',
      value: sliced,
      truncated: value.length > MAX_ITEMS
    };
  }

  if (typeof value === 'object') {
    if (seen.has(value as object)) {
      return { type: 'circular', value: '[Circular]' };
    }

    seen.add(value as object);

    const entries = Object.entries(value as Record<string, unknown>).slice(0, MAX_ITEMS);
    const result: Record<string, SerializedConsoleValue> = {};
    for (const [key, item] of entries) {
      result[key] = serializeConsoleValue(item, depth + 1, seen);
    }

    return {
      type: 'object',
      value: result,
      truncated: Object.keys(value as Record<string, unknown>).length > MAX_ITEMS
    };
  }

  return { type: 'unknown', value: safeStringifyValue(value) };
}

function formatSerializedValueForMessage(value: SerializedConsoleValue, seen = new WeakSet<object>()): string {
  switch (value.type) {
    case 'string':
      return String(value.value);
    case 'number':
    case 'boolean':
    case 'null':
    case 'undefined':
    case 'bigint':
    case 'symbol':
    case 'function':
    case 'date':
    case 'unknown':
      return String(value.value ?? '');
    case 'circular':
      return '[Circular]';
    case 'truncated':
      return '[Truncated]';
    case 'error': {
      const name = value.name && value.name.trim() ? value.name : 'Error';
      const message = value.message && value.message.trim() ? value.message : '';
      return message ? `${name}: ${message}` : name;
    }
    case 'array': {
      const rendered = value.value.map((item) => formatSerializedValueForMessage(item, seen));
      return `[${rendered.join(', ')}${value.truncated ? ', ...' : ''}]`;
    }
    case 'object': {
      const entries = Object.entries(value.value);
      if (entries.length === 0) {
        return '{}';
      }

      const rendered = entries.map(([key, nestedValue]) => `${key}: ${formatSerializedValueForMessage(nestedValue, seen)}`);
      return `{${rendered.join(', ')}${value.truncated ? ', ...' : ''}}`;
    }
    default:
      return String(value);
  }
}

function buildMessageFromArgs(args: unknown[]): string {
  return args
    .map((arg) => formatSerializedValueForMessage(serializeConsoleValue(arg, 0, new WeakSet<object>())))
    .join(' ');
}

function handlePageConsoleMessage(event: MessageEvent): void {
  if (event.source !== window) {
    return;
  }

  const data = event.data as { __runtimeConsoleMessage?: boolean; level?: ConsoleLevel; message?: string; arguments?: unknown[]; sourceUrl?: string | null; timestamp?: string } | undefined;
  if (!data || data.__runtimeConsoleMessage !== true || !data.level || !data.timestamp) {
    return;
  }

  try {
    if (!chrome.runtime || !chrome.runtime.sendMessage) {
      return;
    }

    chrome.runtime.sendMessage(
      {
        type: 'CONSOLE_EVENT',
        payload: {
          level: data.level,
          message: typeof data.message === 'string' ? data.message : '',
          arguments: Array.isArray(data.arguments) ? data.arguments : [],
          sourceUrl: typeof data.sourceUrl === 'string' ? data.sourceUrl : null,
          timestamp: data.timestamp
        }
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

function initializeConsoleObserver(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const windowWithFlags = window as typeof window & {
    [INJECTED_MARKER]?: boolean;
    [MESSAGE_LISTENER_MARKER]?: boolean;
  };

  if (windowWithFlags[INJECTED_MARKER]) {
    return;
  }

  windowWithFlags[INJECTED_MARKER] = true;

  if (windowWithFlags[MESSAGE_LISTENER_MARKER]) {
    return;
  }

  windowWithFlags[MESSAGE_LISTENER_MARKER] = true;
  window.addEventListener('message', handlePageConsoleMessage);
}

initializeConsoleObserver();
console.log('[CONSOLE] Observer installed');
