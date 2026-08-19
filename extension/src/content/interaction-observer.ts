/**
 * Interaction Observer for Milestone 4F.
 * Safely captures user click and form interaction metadata without recording sensitive input values.
 */

interface InteractionPayload {
  interactionType: 'click' | 'submit' | 'keydown';
  elementTag: string;
  elementId?: string | null;
  elementClasses?: string | null;
  elementRole?: string | null;
  accessibleLabel?: string | null;
  textPreview?: string | null;
  selector?: string | null;
  timestamp: string;
}

function sanitizeText(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  // Truncate to maximum 50 characters
  return trimmed.length > 50 ? `${trimmed.slice(0, 47)}...` : trimmed;
}

function isSensitiveElement(el: Element): boolean {
  if (el instanceof HTMLInputElement) {
    const type = (el.type || '').toLowerCase();
    if (type === 'password' || type === 'hidden') return true;
    const name = (el.name || '').toLowerCase();
    const id = (el.id || '').toLowerCase();
    if (name.includes('pass') || name.includes('card') || name.includes('cvv') || name.includes('secret') || name.includes('token')) return true;
    if (id.includes('pass') || id.includes('card') || id.includes('cvv') || id.includes('secret') || id.includes('token')) return true;
  }
  return false;
}

function getCssSelector(el: Element): string {
  if (el.id) {
    return `${el.tagName.toLowerCase()}#${el.id}`;
  }

  const parts: string[] = [];
  let current: Element | null = el;
  let depth = 0;

  while (current && depth < 3) {
    let part = current.tagName.toLowerCase();
    if (current.id) {
      part += `#${current.id}`;
      parts.unshift(part);
      break;
    } else if (current.className && typeof current.className === 'string') {
      const cls = current.className.trim().split(/\s+/).slice(0, 2).join('.');
      if (cls) part += `.${cls}`;
    }
    parts.unshift(part);
    current = current.parentElement;
    depth++;
  }

  return parts.join(' > ');
}

function dispatchInteraction(payload: InteractionPayload): void {
  try {
    chrome.runtime.sendMessage({
      type: 'INTERACTION_EVENT',
      payload
    }).catch(() => {
      // Background worker might be sleeping
    });
  } catch {
    // Context invalidated
  }
}

// Global click listener with delegation
document.addEventListener(
  'click',
  (event) => {
    try {
      const target = event.target as Element | null;
      if (!target || !(target instanceof Element)) return;

      if (isSensitiveElement(target)) return;

      // Prioritize interactive ancestors (e.g. button > span)
      const interactiveEl = target.closest('button, a, input, select, textarea, [role="button"], [role="link"]') || target;

      const elementTag = interactiveEl.tagName.toUpperCase();
      const elementId = interactiveEl.id || null;
      const elementClasses = typeof interactiveEl.className === 'string' && interactiveEl.className ? interactiveEl.className.trim() : null;
      const elementRole = interactiveEl.getAttribute('role') || null;
      const accessibleLabel = interactiveEl.getAttribute('aria-label') || interactiveEl.getAttribute('title') || null;

      // Extract safe text preview
      let textPreview: string | null = null;
      if (interactiveEl instanceof HTMLInputElement) {
        if (['button', 'submit', 'reset'].includes(interactiveEl.type)) {
          textPreview = sanitizeText(interactiveEl.value);
        }
      } else {
        textPreview = sanitizeText(interactiveEl.textContent);
      }

      const selector = getCssSelector(interactiveEl);

      dispatchInteraction({
        interactionType: 'click',
        elementTag,
        elementId,
        elementClasses,
        elementRole,
        accessibleLabel,
        textPreview,
        selector,
        timestamp: new Date().toISOString()
      });
    } catch {
      // Ignore capture errors
    }
  },
  { capture: true, passive: true }
);
