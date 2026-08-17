import { useEffect, useState } from 'react';
import type { RuntimeResponse, SessionState, PageRecord } from '../types/session';

function sendMessage(type: 'START_SESSION' | 'STOP_SESSION' | 'GET_SESSION_STATE' | 'GET_CURRENT_PAGE') {
  return new Promise<RuntimeResponse>((resolve, reject) => {
    chrome.runtime.sendMessage({ type }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(response as RuntimeResponse);
    });
  });
}

export default function App() {
  const [session, setSession] = useState<SessionState | null>(null);
  const [page, setPage] = useState<PageRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const loadState = async () => {
    try {
      setErrorMessage('');
      const result = await sendMessage('GET_SESSION_STATE');
      if (result.ok && result.type === 'SESSION_STATE') {
        setSession(result.session);
      }

      const currentPageResult = await sendMessage('GET_CURRENT_PAGE');
      if (currentPageResult.ok && currentPageResult.type === 'CURRENT_PAGE') {
        setPage(currentPageResult.page);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load the session state.');
    }
  };

  useEffect(() => {
    void loadState();
  }, []);

  const startSession = async () => {
    setIsLoading(true);
    try {
      const result = await sendMessage('START_SESSION');
      if (result.ok && result.type === 'SESSION_STARTED') {
        setSession(result.session);
        setPage(result.session.pages[result.session.pages.length - 1] ?? null);
        setErrorMessage('');
        return;
      }

      setErrorMessage(result.type === 'ERROR' ? result.message : 'Unable to start the monitoring session.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to start the monitoring session.');
    } finally {
      setIsLoading(false);
    }
  };

  const stopSession = async () => {
    setIsLoading(true);
    try {
      const result = await sendMessage('STOP_SESSION');
      if (result.ok && result.type === 'SESSION_STOPPED') {
        setSession(null);
        setPage(null);
        setErrorMessage('');
        return;
      }

      setErrorMessage(result.type === 'ERROR' ? result.message : 'Unable to stop the monitoring session.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to stop the monitoring session.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ width: 320, padding: 16, background: '#fff', borderRadius: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.08)' }}>
      <h2 style={{ marginTop: 0, marginBottom: 16 }}>Runtime Monitoring</h2>

      {errorMessage ? (
        <div style={{ background: '#ffe8e8', color: '#a61b1b', borderRadius: 8, padding: 8, marginBottom: 12, fontSize: 12 }}>
          {errorMessage}
        </div>
      ) : null}

      {!session ? (
        <button
          type="button"
          onClick={startSession}
          disabled={isLoading}
          style={{ width: '100%', padding: '10px 12px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#fff', cursor: 'pointer' }}
        >
          {isLoading ? 'Starting...' : 'Start Monitoring'}
        </button>
      ) : (
        <>
          <div style={{ marginBottom: 12, fontWeight: 700, color: '#0f766e' }}>Monitoring: ACTIVE</div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Session ID</div>
            <div style={{ fontSize: 13, wordBreak: 'break-all' }}>{session.sessionId}</div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Current Page</div>
            <div style={{ fontSize: 13, wordBreak: 'break-all' }}>{page?.pageId ?? 'N/A'}</div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Active Tab</div>
            <div style={{ fontSize: 12 }}>{session.activeTabId ?? 'N/A'}</div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Website Origin</div>
            <div style={{ fontSize: 12, wordBreak: 'break-all' }}>{page?.websiteOrigin ?? (session.websites?.[0]?.origin ?? 'N/A')}</div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>URL</div>
            <div style={{ fontSize: 12, wordBreak: 'break-all' }}>{page?.url ?? session.rootUrl ?? 'N/A'}</div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Title</div>
            <div style={{ fontSize: 12, wordBreak: 'break-all' }}>{page?.title || 'N/A'}</div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Started</div>
            <div style={{ fontSize: 12 }}>{new Date(session.startedAt).toLocaleString()}</div>
          </div>

          <button
            type="button"
            onClick={stopSession}
            disabled={isLoading}
            style={{ width: '100%', padding: '10px 12px', border: 'none', borderRadius: 8, background: '#dc2626', color: '#fff', cursor: 'pointer' }}
          >
            {isLoading ? 'Stopping...' : 'Stop Monitoring'}
          </button>
        </>
      )}
    </div>
  );
}
