import type { SessionState } from '../types/session';

export const SESSION_STORAGE_KEY = 'runtime-monitoring-session';

export async function readSessionState(): Promise<SessionState | null> {
  try {
    const result = await chrome.storage.local.get(SESSION_STORAGE_KEY);
    return (result[SESSION_STORAGE_KEY] as SessionState | undefined) ?? null;
  } catch (error) {
    console.error('[SESSION] Failed to read active session state from chrome.storage.local:', error);
    return null;
  }
}

export async function writeSessionState(session: SessionState | null): Promise<void> {
  try {
    if (session) {
      await chrome.storage.local.set({ [SESSION_STORAGE_KEY]: session });
      return;
    }

    await chrome.storage.local.remove(SESSION_STORAGE_KEY);
  } catch (error) {
    console.error('[SESSION] Failed to write active session state to chrome.storage.local:', error);
    throw error;
  }
}

export async function clearSessionState(): Promise<void> {
  await writeSessionState(null);
}
