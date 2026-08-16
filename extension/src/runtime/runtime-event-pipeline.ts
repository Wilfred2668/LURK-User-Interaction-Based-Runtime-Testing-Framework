import type { RuntimeEvent, RuntimeEventType } from '../types/runtime-event';
import { isRuntimeEventType } from '../types/runtime-event';
import { RuntimeEventRepository } from './runtime-event-repository';

export function generateEventId(): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const unique = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  return `evt_${stamp}_${unique}`;
}

export function createRuntimeEventTimestamp(): string {
  return new Date().toISOString();
}

export class RuntimeEventPipeline {
  constructor(private readonly repository: RuntimeEventRepository) {}

  async record<T>(event: Partial<RuntimeEvent<T>>): Promise<{ ok: true; event: RuntimeEvent<T> } | { ok: false; error: string }> {
    try {
      const normalized = this.normalizeEvent(event);
      const validationError = this.validateRuntimeEvent(normalized);
      if (validationError) {
        return { ok: false, error: validationError };
      }

      const stored = await this.repository.add(normalized);
      console.log('[EVENT_PIPELINE] Event stored:', stored.eventId);

      return { ok: true, event: stored };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown runtime event storage error.';
      console.error('[EVENT_PIPELINE] Error storing runtime event:', message);
      return { ok: false, error: message };
    }
  }

  private normalizeEvent<T>(event: Partial<RuntimeEvent<T>>): RuntimeEvent<T> {
    const timestamp = event.timestamp ?? createRuntimeEventTimestamp();
    const type = event.type ?? 'console';

    return {
      eventId: event.eventId ?? generateEventId(),
      sessionId: event.sessionId ?? '',
      pageId: event.pageId ?? null,
      routeId: event.routeId ?? null,
      tabId: event.tabId ?? null,
      timestamp,
      type,
      data: (event.data as T) ?? ({} as T)
    };
  }

  private validateRuntimeEvent<T>(event: RuntimeEvent<T>): string | null {
    if (!event.eventId || typeof event.eventId !== 'string' || !event.eventId.trim()) {
      return 'Runtime event requires a valid eventId.';
    }

    if (!event.sessionId || typeof event.sessionId !== 'string' || !event.sessionId.trim()) {
      return 'Runtime event requires a valid sessionId.';
    }

    if (!event.pageId || typeof event.pageId !== 'string' || !event.pageId.trim()) {
      return 'Runtime event requires a valid pageId.';
    }

    if (event.tabId === null || typeof event.tabId !== 'number' || Number.isNaN(event.tabId)) {
      return 'Runtime event requires a valid tabId.';
    }

    if (!event.timestamp || Number.isNaN(Date.parse(event.timestamp))) {
      return 'Runtime event requires a valid ISO 8601 timestamp.';
    }

    if (!isRuntimeEventType(event.type)) {
      return 'Runtime event requires a valid event type.';
    }

    if (event.routeId !== null && event.routeId !== undefined && (typeof event.routeId !== 'string' || !event.routeId.trim())) {
      return 'Runtime event routeId must be null or a non-empty string.';
    }

    return null;
  }
}

export type RuntimeEventValidationResult<T> =
  | { ok: true; event: RuntimeEvent<T> }
  | { ok: false; error: string };

export const VALID_RUNTIME_EVENT_TYPES: RuntimeEventType[] = [
  'console',
  'network',
  'performance',
  'dom',
  'accessibility',
  'interaction'
];
