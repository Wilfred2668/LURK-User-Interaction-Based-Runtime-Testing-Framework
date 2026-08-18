import React, { useEffect, useState } from 'react';
import { apiClient } from '../services/api-client.js';
import { SessionListItemDto } from '../types/api.js';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { ArrowRight, RefreshCw } from 'lucide-react';

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
      .then((data) => {
        setSessions(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '2rem'
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 600, color: '#171717', marginBottom: '0.25rem' }}>
            Monitoring Sessions
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#737373' }}>
            All browser sessions captured by the Chrome extension and stored in Supabase.
          </p>
        </div>
        <Button variant="secondary" onClick={fetchSessions} icon={<RefreshCw size={14} />}>
          Refresh
        </Button>
      </div>

      {loading ? (
        <Card style={{ padding: '3rem', textAlign: 'center', color: '#737373' }}>
          Loading sessions...
        </Card>
      ) : error ? (
        <Card style={{ padding: '2rem', borderColor: '#FEE2E2', backgroundColor: '#FEF2F2', color: '#991B1B' }}>
          <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Unable to load sessions</div>
          <div style={{ fontSize: '0.8125rem' }}>{error}</div>
        </Card>
      ) : sessions.length === 0 ? (
        <EmptyState
          title="No sessions found"
          description="Capture sessions using the extension to inspect runtime traffic and trigger AI analysis."
        />
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Session ID</th>
                <th>Root Origin</th>
                <th>Started At</th>
                <th>Duration</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const durationSec = Math.round(s.durationMs / 1000);
                const durationStr = `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`;

                return (
                  <tr
                    key={s.sessionId}
                    className="table-row-hover"
                    onClick={() => onNavigate(`/sessions/${s.sessionId}`)}
                  >
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: '#4F46E5', fontWeight: 500 }}>
                      {s.sessionId}
                    </td>
                    <td style={{ fontWeight: 500 }}>{s.rootUrl || 'Unknown'}</td>
                    <td style={{ color: '#737373' }}>
                      {new Date(s.startedAt).toLocaleString()}
                    </td>
                    <td style={{ color: '#737373' }}>{durationStr}</td>
                    <td>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          backgroundColor: '#F3F4F6',
                          color: '#374151',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          textTransform: 'capitalize'
                        }}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#4F46E5', fontSize: '0.8125rem', fontWeight: 500 }}>
                        Inspect <ArrowRight size={14} />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
