import React, { useEffect, useState } from 'react';
import { apiClient } from '../services/api-client.js';
import { SessionListItemDto } from '../types/api.js';
import { Button } from '../components/ui/Button.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { Activity, Database, Sparkles, ArrowRight, Clock, Globe } from 'lucide-react';

interface OverviewPageProps {
  onNavigate: (path: string) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({ onNavigate }) => {
  const [sessions, setSessions] = useState<SessionListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .getSessions()
      .then((data) => { setSessions(data); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Fixed Page Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#09090B', letterSpacing: '-0.025em' }}>Overview</h1>
          <p style={{ fontSize: '0.8125rem', color: '#71717A', marginTop: '0.2rem' }}>
            Real-time summary of captured browser runtime sessions.
          </p>
        </div>
        <Button variant="primary" onClick={() => onNavigate('/sessions')}>
          View All Sessions <ArrowRight size={13} />
        </Button>
      </div>

      {/* Fixed Stats */}
      <div className="stat-grid" style={{ marginBottom: '1.25rem', flexShrink: 0 }}>
        <div className="stat-card" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div className="stat-label">Total Sessions</div>
            <div className="stat-value">{sessions.length}</div>
            <div className="stat-hint">Persisted in Supabase</div>
          </div>
          <Database
            size={76}
            strokeWidth={1.5}
            style={{
              position: 'absolute',
              right: '-8px',
              bottom: '-10px',
              color: '#09090B',
              opacity: 0.06,
              pointerEvents: 'none'
            }}
          />
        </div>

        <div className="stat-card" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div className="stat-label">Detection Engine</div>
            <div className="stat-value" style={{ fontSize: '1.25rem' }}>Automated</div>
            <div className="stat-hint">Layer 2 pattern analysis</div>
          </div>
          <Activity
            size={76}
            strokeWidth={1.5}
            style={{
              position: 'absolute',
              right: '-8px',
              bottom: '-10px',
              color: '#09090B',
              opacity: 0.06,
              pointerEvents: 'none'
            }}
          />
        </div>

        <div className="stat-card" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div className="stat-label">AI Engine</div>
            <div className="stat-value" style={{ fontSize: '1.25rem' }}>On-Demand</div>
            <div className="stat-hint">Groq LLM diagnostics</div>
          </div>
          <Sparkles
            size={76}
            strokeWidth={1.5}
            style={{
              position: 'absolute',
              right: '-8px',
              bottom: '-10px',
              color: '#09090B',
              opacity: 0.06,
              pointerEvents: 'none'
            }}
          />
        </div>
      </div>

      {/* Fixed Section Header */}
      <div className="section-header" style={{ flexShrink: 0, marginBottom: '0.75rem' }}>
        <h2>Recent Sessions</h2>
        <span style={{ fontSize: '0.75rem', color: '#71717A' }}>Click a row to inspect pages & trigger analysis</span>
      </div>

      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#71717A', background: '#fff', borderRadius: '8px', border: '1px solid #E4E4E7' }}>
          Loading sessions…
        </div>
      ) : error ? (
        <div style={{ padding: '1.25rem', background: '#fff', borderRadius: '8px', border: '1px solid #E4E4E7', color: '#09090B' }}>
          <strong>Failed to load sessions</strong>
          <p style={{ fontSize: '0.8125rem', color: '#71717A', marginTop: '0.25rem' }}>{error}</p>
        </div>
      ) : sessions.length === 0 ? (
        <EmptyState
          title="No sessions captured yet"
          description="Use the Chrome extension to start recording browser interactions and finalise a session."
          action={
            <Button variant="primary" onClick={() => onNavigate('/sessions')}>Go to Sessions</Button>
          }
        />
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '0.25rem' }}>
          {sessions.slice(0, 6).map((s) => {
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
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: '#71717A' }}>
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
