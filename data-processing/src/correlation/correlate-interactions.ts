import { RawInteractionEventData, RawRuntimeEvent } from '../types/raw.js';
import { InteractionTriggerContext } from '../types/findings.js';

export interface CorrelationWindowConfig {
  maxLookbackMs: number; // Maximum ms between interaction and event (default: 1500ms)
}

export const DEFAULT_CORRELATION_CONFIG: CorrelationWindowConfig = {
  maxLookbackMs: 1500
};

/**
 * Finds the closest preceding user interaction for a given event timestamp within the same page.
 * Immutability Guarantee: Input events are never modified.
 * Precision: Returns null if no interaction occurred within the correlation window.
 */
export function findPrecedingInteraction(
  targetTimestamp: string,
  events: readonly RawRuntimeEvent[],
  config: CorrelationWindowConfig = DEFAULT_CORRELATION_CONFIG
): InteractionTriggerContext | null {
  const targetTime = new Date(targetTimestamp).getTime();
  if (Number.isNaN(targetTime)) return null;

  let closestInteraction: { event: RawRuntimeEvent<RawInteractionEventData>; timeDeltaMs: number } | null = null;

  for (const e of events) {
    if (e.type !== 'interaction' || !e.data) continue;

    const interactionTime = new Date(e.timestamp).getTime();
    if (Number.isNaN(interactionTime)) continue;

    const timeDeltaMs = targetTime - interactionTime;

    // Interaction must have occurred BEFORE (or virtually at the same time) the event, within the window
    if (timeDeltaMs >= 0 && timeDeltaMs <= config.maxLookbackMs) {
      if (!closestInteraction || timeDeltaMs < closestInteraction.timeDeltaMs) {
        closestInteraction = {
          event: e as unknown as RawRuntimeEvent<RawInteractionEventData>,
          timeDeltaMs
        };
      }
    }
  }

  if (!closestInteraction) return null;

  const data = closestInteraction.event.data as unknown as RawInteractionEventData;
  return {
    interactionType: data.interactionType || 'click',
    elementTag: data.elementTag || 'ELEMENT',
    elementId: data.elementId || null,
    elementClasses: data.elementClasses || null,
    textPreview: data.textPreview || null,
    selector: data.selector || null,
    timeDeltaMs: closestInteraction.timeDeltaMs
  };
}
