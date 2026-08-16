export type RuntimeEventType =
  | 'console'
  | 'network'
  | 'performance'
  | 'dom'
  | 'accessibility'
  | 'interaction';

export interface RuntimeEvent<T = unknown> {
  eventId: string;
  sessionId: string;
  pageId: string | null;
  routeId?: string | null;
  tabId: number | null;
  timestamp: string;
  type: RuntimeEventType;
  data: T;
}

export function isRuntimeEventType(value: unknown): value is RuntimeEventType {
  return typeof value === 'string' && [
    'console',
    'network',
    'performance',
    'dom',
    'accessibility',
    'interaction'
  ].includes(value);
}
