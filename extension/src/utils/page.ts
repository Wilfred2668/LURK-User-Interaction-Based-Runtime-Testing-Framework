export function normalizeDocumentUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return url;
  }
}

export function isSupportedUrl(url: string | undefined): boolean {
  if (!url) return false;

  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('edge://')) {
    return false;
  }

  return true;
}

export function generateSessionId(): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.random().toString(36).slice(2, 8);
  return `sess_${stamp}_${suffix}`;
}

export function generatePageId(): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.random().toString(36).slice(2, 8);
  return `page_${stamp}_${suffix}`;
}

export function generateRouteId(): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.random().toString(36).slice(2, 8);
  return `route_${stamp}_${suffix}`;
}

export function safeTitle(title?: string): string {
  return title && title.trim() ? title.trim() : 'Untitled page';
}

export function extractWebsiteOrigin(rawUrl: string | undefined): string | null {
  if (!rawUrl || !isSupportedUrl(rawUrl)) {
    return null;
  }

  try {
    const parsed = new URL(rawUrl);
    if (!parsed.protocol || !parsed.host) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

export function generateWebsiteId(): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.random().toString(36).slice(2, 8);
  return `web_${stamp}_${suffix}`;
}
