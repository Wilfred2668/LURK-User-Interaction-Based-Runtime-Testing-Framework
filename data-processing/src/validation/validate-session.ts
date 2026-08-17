import type { RawFinalizedSessionPackage } from '../types/raw.js';
import { SessionValidationError } from './validation-error.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const SUPPORTED_EVENT_TYPES = new Set(['console', 'network', 'performance']);
const SUPPORTED_NAVIGATION_TYPES = new Set(['initial', 'pushState', 'replaceState', 'popstate', 'hashchange']);

function isValidDateString(val: unknown): boolean {
  if (typeof val !== 'string' || !val.trim()) return false;
  const time = Date.parse(val);
  return !Number.isNaN(time);
}

function isValidOrigin(origin: unknown): boolean {
  if (typeof origin !== 'string' || !origin.trim()) return false;
  try {
    const url = new URL(origin);
    return Boolean(url.protocol && url.host);
  } catch {
    return false;
  }
}

/**
 * Validates a raw finalized session package structure and contents.
 * Returns a ValidationResult with all validation issues encountered.
 */
export function validateSessionPackage(input: unknown): ValidationResult {
  const errors: string[] = [];

  if (!input || typeof input !== 'object') {
    return { valid: false, errors: ['Session package must be a non-null object.'] };
  }

  const pkg = input as Partial<RawFinalizedSessionPackage>;

  // 1. Validate Session Metadata
  if (!pkg.session || typeof pkg.session !== 'object') {
    errors.push('Session metadata ("session") is missing or invalid.');
  } else {
    const s = pkg.session;
    if (typeof s.sessionId !== 'string' || !s.sessionId.trim()) {
      errors.push('Session sessionId must be a non-empty string.');
    }

    if (s.status !== 'finalized' && s.status !== 'completed') {
      errors.push(`Session status must be "finalized" or "completed", got "${String(s.status)}".`);
    }

    if (!isValidDateString(s.startedAt)) {
      errors.push('Session startedAt must be a valid ISO date string.');
    }

    if (!isValidDateString(s.endedAt)) {
      errors.push('Session endedAt must be a valid ISO date string.');
    }

    if (typeof s.durationMs !== 'number' || s.durationMs < 0 || Number.isNaN(s.durationMs)) {
      errors.push('Session durationMs must be a non-negative number.');
    }
  }

  // 2. Validate Websites
  if (!Array.isArray(pkg.websites)) {
    errors.push('Session websites must be an array.');
  } else {
    for (let wIdx = 0; wIdx < pkg.websites.length; wIdx++) {
      const website = pkg.websites[wIdx];
      const wPrefix = `Website [${wIdx}]`;

      if (!website || typeof website !== 'object') {
        errors.push(`${wPrefix} must be an object.`);
        continue;
      }

      if (typeof website.websiteId !== 'string' || !website.websiteId.trim()) {
        errors.push(`${wPrefix} missing valid websiteId.`);
      }

      if (!isValidOrigin(website.origin)) {
        errors.push(`${wPrefix} origin "${String(website.origin)}" is not a valid URL origin.`);
      }

      if (!isValidDateString(website.firstSeenAt)) {
        errors.push(`${wPrefix} firstSeenAt must be a valid ISO date string.`);
      }

      if (!isValidDateString(website.lastSeenAt)) {
        errors.push(`${wPrefix} lastSeenAt must be a valid ISO date string.`);
      }

      // 3. Validate Pages under Website
      if (!Array.isArray(website.pages)) {
        errors.push(`${wPrefix} pages must be an array.`);
      } else {
        for (let pIdx = 0; pIdx < website.pages.length; pIdx++) {
          const page = website.pages[pIdx];
          const pPrefix = `${wPrefix} -> Page [${pIdx}]`;

          if (!page || typeof page !== 'object') {
            errors.push(`${pPrefix} must be an object.`);
            continue;
          }

          if (typeof page.pageId !== 'string' || !page.pageId.trim()) {
            errors.push(`${pPrefix} missing valid pageId.`);
          }

          if (typeof page.url !== 'string' || !page.url.trim()) {
            errors.push(`${pPrefix} missing valid url.`);
          }

          if (typeof page.tabId !== 'number' || Number.isNaN(page.tabId)) {
            errors.push(`${pPrefix} tabId must be a number.`);
          }

          if (!isValidDateString(page.createdAt)) {
            errors.push(`${pPrefix} createdAt must be a valid ISO date string.`);
          }

          // 4. Validate Routes under Page
          if (!Array.isArray(page.routes)) {
            errors.push(`${pPrefix} routes must be an array.`);
          } else {
            for (let rIdx = 0; rIdx < page.routes.length; rIdx++) {
              const route = page.routes[rIdx];
              const rPrefix = `${pPrefix} -> Route [${rIdx}]`;

              if (!route || typeof route !== 'object') {
                errors.push(`${rPrefix} must be an object.`);
                continue;
              }

              if (typeof route.routeId !== 'string' || !route.routeId.trim()) {
                errors.push(`${rPrefix} missing valid routeId.`);
              }

              if (typeof route.url !== 'string' || !route.url.trim()) {
                errors.push(`${rPrefix} missing valid url.`);
              }

              if (!SUPPORTED_NAVIGATION_TYPES.has(route.navigationType)) {
                errors.push(`${rPrefix} unsupported navigationType "${String(route.navigationType)}".`);
              }

              if (!isValidDateString(route.timestamp)) {
                errors.push(`${rPrefix} timestamp must be a valid ISO date string.`);
              }
            }
          }

          // 5. Validate Events under Page
          if (!Array.isArray(page.events)) {
            errors.push(`${pPrefix} events must be an array.`);
          } else {
            for (let eIdx = 0; eIdx < page.events.length; eIdx++) {
              const event = page.events[eIdx];
              const ePrefix = `${pPrefix} -> Event [${eIdx}]`;

              if (!event || typeof event !== 'object') {
                errors.push(`${ePrefix} must be an object.`);
                continue;
              }

              if (typeof event.eventId !== 'string' || !event.eventId.trim()) {
                errors.push(`${ePrefix} missing valid eventId.`);
              }

              if (!isValidDateString(event.timestamp)) {
                errors.push(`${ePrefix} timestamp must be a valid ISO date string.`);
              }

              if (!SUPPORTED_EVENT_TYPES.has(event.type)) {
                errors.push(`${ePrefix} unsupported event type "${String(event.type)}". Supported types: console, network, performance.`);
              }

              if (!event.data || typeof event.data !== 'object') {
                errors.push(`${ePrefix} data must be a non-null object.`);
              }
            }
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Asserts that a raw session package is valid. Throws SessionValidationError if invalid.
 */
export function assertValidSessionPackage(input: unknown): asserts input is RawFinalizedSessionPackage {
  const result = validateSessionPackage(input);
  if (!result.valid) {
    throw new SessionValidationError(
      `Session validation failed with ${result.errors.length} error(s):\n - ${result.errors.join('\n - ')}`,
      result.errors
    );
  }
}
