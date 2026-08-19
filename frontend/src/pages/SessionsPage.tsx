import React, { useEffect, useState } from 'react';
import { apiClient } from '../services/api-client.js';
import { SessionListItemDto } from '../types/api.js';
import { Button } from '../components/ui/Button.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { ArrowRight, Clock, RefreshCw } from 'lucide-react';

interface SessionsPageProps {
  onNavigate: (path: string) => void;
}

export const SessionsPage: React.FC<SessionsPageProps> = ({ onNavigate }) => {
  const [sessions, setSessions] = useState<SessionListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = () => {
    setLoading(true);
    setError(null);
    apiClient
      .getSessions()
      .then((data) => { setSessions(data); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  };

  useEffect(() => { fetchSessions(); }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#09090B', letterSpacing: '-0.025em' }}>
            Monitoring Sessions
          </h1>
          <p style={{ fontSize: '0.8125rem', color: '#71717A', marginTop: '0.2rem' }}>
            All browser sessions captured by the Chrome extension.
          </p>
        </div>
        <Button variant="secondary" onClick={fetchSessions} icon={<RefreshCw size={13} />}>
          Refresh
        </Button>
      </div>

      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#71717A', background: '#fff', borderRadius: '8px', border: '1px solid #E4E4E7' }}>
          Loading sessions…
        </div>
      ) : error ? (
        <div style={{ padding: '1.25rem', background: '#fff', borderRadius: '8px', border: '1px solid #E4E4E7' }}>
          <strong style={{ color: '#09090B' }}>Failed to load sessions</strong>
          <p style={{ fontSize: '0.8125rem', color: '#71717A', marginTop: '0.25rem' }}>{error}</p>
        </div>
      ) : sessions.length === 0 ? (
        <EmptyState
          title="No sessions found"
          description="Capture sessions using the Chrome extension to inspect runtime traffic and trigger AI analysis."
        />
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '0.25rem' }}>
          {sessions.map((s) => {
            const durationSec = Math.round(s.durationMs / 1000);
            const dur = `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`;
            const isFinalized = s.status === 'finalized';

            return (
              <div
                key={s.sessionId}
                className="session-row"
                onClick={() => onNavigate(`/session?id=${s.sessionId}`)}
                role="button"
              >
                {/* Status dot */}
                <span
                  style={{
                    width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                    backgroundColor: isFinalized ? '#22C55E' : '#F59E0B'
                  }}
                />

                {/* Origin */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#09090B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.rootUrl || 'Unknown origin'}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: '#71717A', marginTop: '0.1rem' }}>
                    {s.sessionId}
                  </div>
                </div>

                {/* Meta */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexShrink: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: '#71717A' }}>
                    <Clock size={11} /> {dur}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#71717A' }}>
                    {new Date(s.startedAt).toLocaleDateString()}
                  </span>
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      padding: '0.15rem 0.45rem',
                      borderRadius: '999px',
                      backgroundColor: isFinalized ? '#DCFCE7' : '#FEF9C3',
                      color: isFinalized ? '#166534' : '#854D0E',
                      border: `1px solid ${isFinalized ? '#BBF7D0' : '#FEF08A'}`,
                      textTransform: 'capitalize'
                    }}
                  >
                    {s.status}
                  </span>
                  <ArrowRight size={14} color="#A1A1AA" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
