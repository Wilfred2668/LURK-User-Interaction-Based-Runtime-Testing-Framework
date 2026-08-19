import { useEffect, useState } from 'react';
import type { RuntimeResponse, SessionState, PageRecord } from '../types/session';
import { Globe, Copy, Check, Square, Play, Layers } from 'lucide-react';
import logoImg from '../assets/logo-no-bg.png';

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
  const [copiedSessionId, setCopiedSessionId] = useState(false);

  const loadState = async () => {
    try {
      setErrorMessage('');
      const result = await sendMessage('GET_SESSION_STATE');
      if (result.ok && result.type === 'SESSION_STATE') {
        if (result.session && result.session.status === 'active') {
          setSession(result.session);
        } else {
          setSession(null);
        }
      }

      const currentPageResult = await sendMessage('GET_CURRENT_PAGE');
      if (currentPageResult.ok && currentPageResult.type === 'CURRENT_PAGE') {
        setPage(currentPageResult.page);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load session state.');
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

      setErrorMessage(result.type === 'ERROR' ? result.message : 'Unable to start session.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to start session.');
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

      setErrorMessage(result.type === 'ERROR' ? result.message : 'Unable to stop session.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to stop session.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopySessionId = () => {
    if (!session?.sessionId) return;
    navigator.clipboard.writeText(session.sessionId);
    setCopiedSessionId(true);
    setTimeout(() => setCopiedSessionId(false), 2000);
  };

  const isRecording = session !== null && session.status === 'active';

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: '#09090B',
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden',
        boxSizing: 'border-box',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
      }}
    >
      {/* Background Subtle Checkered Pattern with Feathered Mask */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'%3E%3Crect x='0' y='0' width='10' height='10' fill='rgba(255,255,255,0.015)'/%3E%3Crect x='10' y='10' width='10' height='10' fill='rgba(255,255,255,0.015)'/%3E%3C/svg%3E")`,
          backgroundSize: '20px 20px',
          WebkitMaskImage: 'radial-gradient(ellipse at 85% 10%, black 5%, rgba(0, 0, 0, 0.15) 45%, transparent 75%)',
          maskImage: 'radial-gradient(ellipse at 85% 10%, black 5%, rgba(0, 0, 0, 0.15) 45%, transparent 75%)',
          pointerEvents: 'none',
          zIndex: 0
        }}
      />

      {/* Top Header: Logo + Minimalist Status Indicator */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: '14px',
          flexShrink: 0
        }}
      >
        <img
          src={logoImg}
          alt="LURK"
          style={{
            height: '36px',
            width: 'auto',
            maxWidth: '115px',
            objectFit: 'contain',
            display: 'block'
          }}
        />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '0.04em',
            color: isRecording ? '#34D399' : '#71717A'
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: isRecording ? '#10B981' : '#52525B',
              boxShadow: isRecording ? '0 0 6px rgba(16, 185, 129, 0.6)' : 'none',
              flexShrink: 0
            }}
          />
          <span>{isRecording ? 'RECORDING' : 'IDLE'}</span>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage ? (
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            background: 'rgba(239, 68, 68, 0.06)',
            border: '1px solid rgba(239, 68, 68, 0.18)',
            color: '#F87171',
            borderRadius: '6px',
            padding: '8px 12px',
            fontSize: '11.5px',
            lineHeight: 1.4,
            flexShrink: 0
          }}
        >
          {errorMessage}
        </div>
      ) : null}

      {/* Middle Body Area (Fills Available Height) */}
      {!session ? (
        /* ── IDLE STATE ── */
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: '16px',
            flex: 1,
            padding: '12px 0'
          }}
        >
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.025)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '6px',
              padding: '18px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
          >
            <div
              style={{
                fontSize: '10.5px',
                fontWeight: 500,
                color: '#A1A1AA',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontFamily: "'JetBrains Mono', monospace"
              }}
            >
              RUNTIME TELEMETRY
            </div>
            <p style={{ fontSize: '12px', color: '#71717A', lineHeight: 1.5, margin: 0, fontWeight: 400 }}>
              Captures user clicks, network requests, console errors, and long tasks on this tab.
            </p>
          </div>

          <button
            type="button"
            onClick={startSession}
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: '6px',
              background: 'rgba(245, 158, 11, 0.08)',
              color: '#FBBF24',
              border: '1px solid rgba(245, 158, 11, 0.22)',
              fontSize: '12.5px',
              fontWeight: 500,
              fontFamily: "'Inter', sans-serif",
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.6 : 1,
              transition: 'background 0.15s ease, border-color 0.15s ease'
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.background = 'rgba(245, 158, 11, 0.14)';
                e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.35)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(245, 158, 11, 0.08)';
              e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.22)';
            }}
          >
            <Play size={13} />
            <span>{isLoading ? 'Starting Session...' : 'Start Monitoring'}</span>
          </button>
        </div>
      ) : (
        /* ── ACTIVE RECORDING STATE ── */
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            flex: 1,
            padding: '12px 0',
            gap: '12px'
          }}
        >
          {/* Top Section: Target Card & Metrics Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Target Origin & Active URL Hero Card */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.025)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '6px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <Globe size={13} color="#38BDF8" style={{ flexShrink: 0 }} />
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#F4F4F5',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {page?.websiteOrigin ?? (session.websites?.[0]?.origin ?? 'Unknown Origin')}
                </span>
              </div>

              <div
                style={{
                  fontSize: '11px',
                  fontFamily: "'JetBrains Mono', monospace",
                  color: '#71717A',
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  padding: '6px 9px',
                  borderRadius: '4px',
                  border: '1px solid rgba(255, 255, 255, 0.04)',
                  wordBreak: 'break-all',
                  maxHeight: '44px',
                  overflow: 'hidden',
                  lineHeight: 1.4
                }}
              >
                {page?.url ?? session.rootUrl ?? '—'}
              </div>
            </div>

            {/* 2-Column Telemetry Stats Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '10px'
              }}
            >
              {/* Session ID Card */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.025)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span
                    style={{
                      fontSize: '9.5px',
                      color: '#71717A',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      fontFamily: "'JetBrains Mono', monospace"
                    }}
                  >
                    SESSION
                  </span>
                  <button
                    type="button"
                    onClick={handleCopySessionId}
                    title="Copy Session ID"
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: copiedSessionId ? '#34D399' : '#71717A',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    {copiedSessionId ? <Check size={11} /> : <Copy size={11} />}
                  </button>
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    fontFamily: "'JetBrains Mono', monospace",
                    color: '#D4D4D8',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {session.sessionId}
                </div>
              </div>

              {/* Pages Tracked */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.025)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Layers size={11} color="#71717A" />
                  <span
                    style={{
                      fontSize: '9.5px',
                      color: '#71717A',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      fontFamily: "'JetBrains Mono', monospace"
                    }}
                  >
                    PAGES
                  </span>
                </div>
                <div style={{ fontSize: '12px', fontWeight: 500, color: '#D4D4D8' }}>
                  {session.pages?.length || 1} Visited
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Action: Stop Button */}
          <button
            type="button"
            onClick={stopSession}
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '11px 16px',
              borderRadius: '6px',
              background: 'rgba(239, 68, 68, 0.08)',
              color: '#F87171',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              fontSize: '12.5px',
              fontWeight: 500,
              fontFamily: "'Inter', sans-serif",
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.6 : 1,
              transition: 'background 0.15s ease, border-color 0.15s ease'
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.35)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)';
            }}
          >
            <Square size={12} fill="#F87171" />
            <span>{isLoading ? 'Finalizing Session...' : 'Stop Monitoring'}</span>
          </button>
        </div>
      )}

      {/* Permanently Anchored Bottom Footer */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          textAlign: 'center',
          fontSize: '10px',
          color: '#52525B',
          letterSpacing: '0.04em',
          fontFamily: "'JetBrains Mono', monospace",
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          paddingTop: '10px',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          flexShrink: 0
        }}
      >
        <span>LURK TELEMETRY</span>
        <span>•</span>
        <span>v0.1.0</span>
      </div>
    </div>
  );
}
