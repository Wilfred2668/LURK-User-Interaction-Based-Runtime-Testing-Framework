import React, { useEffect, useState } from 'react';
import { apiClient } from '../services/api-client.js';
import { SessionListItemDto } from '../types/api.js';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { ArrowRight, Activity, Database, Sparkles } from 'lucide-react';

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
      .then((data) => {
        setSessions(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const totalSessions = sessions.length;

  return (
    <div>
      {/* Clean Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#09090B', marginBottom: '0.25rem', letterSpacing: '-0.03em' }}>
          Overview
        </h1>
        <p style={{ fontSize: '0.875rem', color: '#71717A' }}>
          Real-time summary of captured browser runtime sessions and telemetry.
        </p>
      </div>

      {/* Metrics Row with Textured Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1.25rem',
          marginBottom: '2.5rem'
        }}
      >
        <Card textured>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#71717A', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>
              Total Sessions
            </div>
            <Database size={15} color="#A1A1AA" />
          </div>
          <div style={{ fontSize: '1.875rem', fontWeight: 700, color: '#09090B', letterSpacing: '-0.03em' }}>
            {totalSessions}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#10B981', marginTop: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#10B981' }} />
            Persisted in Supabase
          </div>
        </Card>

        <Card textured>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#71717A', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>
              Deterministic Engine
            </div>
            <Activity size={15} color="#A1A1AA" />
          </div>
          <div style={{ fontSize: '1.875rem', fontWeight: 700, color: '#09090B', letterSpacing: '-0.03em' }}>
            Automated
          </div>
          <div style={{ fontSize: '0.75rem', color: '#4F46E5', marginTop: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#4F46E5' }} />
            Layer 2 pattern detection
          </div>
        </Card>

        <Card textured>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#71717A', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>
              AI Analysis Engine
            </div>
            <Sparkles size={15} color="#A1A1AA" />
          </div>
          <div style={{ fontSize: '1.875rem', fontWeight: 700, color: '#09090B', letterSpacing: '-0.03em' }}>
            User Controlled
          </div>
          <div style={{ fontSize: '0.75rem', color: '#71717A', marginTop: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#71717A' }} />
            Groq LLM / Deterministic 3C
          </div>
        </Card>
      </div>

      {/* Recent Sessions Section */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#09090B' }}>
            Recent Monitoring Sessions
          </h2>
          <p style={{ fontSize: '0.8125rem', color: '#71717A' }}>
            Select a session to inspect websites, pages, and trigger AI analysis.
          </p>
        </div>
        <Button variant="secondary" onClick={() => onNavigate('/sessions')}>
          View All Sessions
        </Button>
      </div>

      {loading ? (
        <Card style={{ padding: '3.5rem', textAlign: 'center', color: '#71717A' }}>
          Loading monitoring sessions...
        </Card>
      ) : error ? (
        <Card style={{ padding: '2rem', borderColor: '#FECACA', backgroundColor: '#FEF2F2', color: '#991B1B' }}>
          <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Unable to load sessions</div>
          <div style={{ fontSize: '0.8125rem' }}>{error}</div>
        </Card>
      ) : sessions.length === 0 ? (
        <EmptyState
          title="No sessions captured yet"
          description="Use the Chrome extension to start recording browser interactions and finalise a session."
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
              {sessions.slice(0, 5).map((s) => {
                const durationSec = Math.round(s.durationMs / 1000);
                const durationStr = `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`;

                return (
                  <tr
                    key={s.sessionId}
                    className="table-row-hover"
                    onClick={() => onNavigate(`/sessions/${s.sessionId}`)}
                  >
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: '#4F46E5', fontWeight: 600 }}>
                      {s.sessionId}
                    </td>
                    <td style={{ fontWeight: 500, color: '#09090B' }}>{s.rootUrl || 'Unknown'}</td>
                    <td style={{ color: '#71717A' }}>
                      {new Date(s.startedAt).toLocaleString()}
                    </td>
                    <td style={{ color: '#71717A', fontFamily: 'var(--font-mono)' }}>{durationStr}</td>
                    <td>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          backgroundColor: '#F4F4F5',
                          color: '#3F3F46',
                          border: '1px solid #E4E4E7',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          textTransform: 'capitalize',
                          fontWeight: 500
                        }}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#4F46E5', fontSize: '0.8125rem', fontWeight: 600 }}>
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
