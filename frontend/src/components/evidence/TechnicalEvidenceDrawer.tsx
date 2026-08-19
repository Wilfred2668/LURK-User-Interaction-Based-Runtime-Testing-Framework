import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Code2, Terminal, MousePointerClick, Clock } from 'lucide-react';

interface TechnicalEvidenceDrawerProps {
  evidence: Record<string, unknown>;
  findingType?: string;
}

export const TechnicalEvidenceDrawer: React.FC<TechnicalEvidenceDrawerProps> = ({
  evidence,
  findingType
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const eventIds = Array.isArray(evidence['eventIds']) ? (evidence['eventIds'] as string[]) : [];
  const aggregationId = typeof evidence['aggregationId'] === 'string' ? evidence['aggregationId'] : null;
  const count = typeof evidence['count'] === 'number' ? evidence['count'] : eventIds.length || 1;
  const url = typeof evidence['url'] === 'string' ? evidence['url'] : null;
  const method = typeof evidence['method'] === 'string' ? evidence['method'] : null;
  const status = evidence['status'] !== undefined && evidence['status'] !== null ? String(evidence['status']) : null;
  const durationMs = evidence['durationMs'] || evidence['duration'] || null;
  const stack = typeof evidence['stack'] === 'string' ? evidence['stack'] : null;
  const representativeTasks = Array.isArray(evidence['representativeTasks']) ? evidence['representativeTasks'] : [];
  const interactionTrigger = evidence['interactionTrigger'] as Record<string, any> | undefined;

  let host: string | null = null;
  let pathname: string | null = null;
  if (url) {
    try {
      const parsed = new URL(url);
      host = parsed.host;
      pathname = parsed.pathname;
    } catch {
      pathname = url;
    }
  }

  return (
    <div
      style={{
        marginTop: '1rem',
        borderTop: '1px solid #F4F4F5',
        paddingTop: '0.875rem'
      }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.375rem',
          background: 'none',
          border: 'none',
          color: '#71717A',
          fontSize: '0.75rem',
          fontWeight: 500,
          cursor: 'pointer',
          padding: 0
        }}
      >
        <Code2 size={13} />
        <span>{isOpen ? 'Hide technical evidence' : 'View technical evidence'}</span>
        {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {isOpen && (
        <div
          style={{
            marginTop: '0.75rem',
            backgroundColor: '#FAFAFA',
            border: '1px solid #E4E4E7',
            borderRadius: '6px',
            padding: '1rem',
            fontSize: '0.75rem'
          }}
        >
          {/* Structured Parameters */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '0.875rem',
              marginBottom: '1rem'
            }}
          >
            {url && (
              <div>
                <div style={{ color: '#64748B', fontSize: '0.6875rem', textTransform: 'uppercase', fontWeight: 600 }}>
                  Target Endpoint
                </div>
                <div style={{ color: '#0F172A', fontFamily: 'var(--font-mono)', wordBreak: 'break-all', fontWeight: 500 }}>
                  {method ? `${method} ` : ''}{pathname}
                </div>
                {host && (
                  <div style={{ color: '#94A3B8', fontSize: '0.6875rem', marginTop: '0.15rem' }}>
                    Host: {host}
                  </div>
                )}
              </div>
            )}

            {status && (
              <div>
                <div style={{ color: '#64748B', fontSize: '0.6875rem', textTransform: 'uppercase', fontWeight: 600 }}>
                  HTTP Status
                </div>
                <div style={{ color: '#0F172A', fontWeight: 600 }}>
                  {status}
                </div>
              </div>
            )}

            {count > 1 && (
              <div>
                <div style={{ color: '#64748B', fontSize: '0.6875rem', textTransform: 'uppercase', fontWeight: 600 }}>
                  Total Occurrences
                </div>
                <div style={{ color: '#0F172A', fontWeight: 600 }}>
                  {count} captures
                </div>
              </div>
            )}

            {durationMs !== null && (
              <div>
                <div style={{ color: '#64748B', fontSize: '0.6875rem', textTransform: 'uppercase', fontWeight: 600 }}>
                  Observed Duration
                </div>
                <div style={{ color: '#0F172A', fontWeight: 600 }}>
                  {String(durationMs)} ms
                </div>
              </div>
            )}
          </div>

          {/* Interaction Trigger Correlation Detail */}
          {interactionTrigger && (
            <div style={{ marginBottom: '1rem', backgroundColor: '#EEF2FF', border: '1px solid #E0E7FF', borderRadius: '6px', padding: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#4338CA', fontSize: '0.6875rem', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.25rem' }}>
                <MousePointerClick size={12} />
                <span>Preceding Interaction Correlation</span>
              </div>
              <div style={{ color: '#1E1B4B', fontSize: '0.75rem', lineHeight: '1.4' }}>
                Event occurred <strong>{interactionTrigger.timeDeltaMs}ms</strong> after user interaction on <code>{interactionTrigger.selector || interactionTrigger.elementTag}</code> ({interactionTrigger.textPreview ? `"${interactionTrigger.textPreview}"` : 'interactive element'}).
              </div>
            </div>
          )}

          {/* Representative Severe Tasks (for Performance Degradation) */}
          {representativeTasks.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#64748B', fontSize: '0.6875rem', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.35rem' }}>
                <Clock size={12} />
                <span>Representative Severe Blocking Tasks</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {representativeTasks.map((t: any, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      padding: '0.35rem 0.625rem',
                      borderRadius: '4px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem'
                    }}
                  >
                    <span style={{ color: '#334155' }}>Task #{idx + 1} ({t.eventId})</span>
                    <span style={{ color: '#EF4444', fontWeight: 600 }}>{Math.round(t.durationMs)} ms</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stack Trace Preview if present */}
          {stack && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ color: '#64748B', fontSize: '0.6875rem', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.25rem' }}>
                Error Stack Trace
              </div>
              <pre
                style={{
                  backgroundColor: '#0F172A',
                  color: '#F87171',
                  padding: '0.625rem 0.875rem',
                  borderRadius: '4px',
                  fontSize: '0.6875rem',
                  overflowX: 'auto',
                  lineHeight: '1.4'
                }}
              >
                {stack}
              </pre>
            </div>
          )}

          {/* Developer Trace Box */}
          <div
            style={{
              borderTop: '1px dashed #CBD5E1',
              paddingTop: '0.75rem',
              marginTop: '0.5rem'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                color: '#64748B',
                fontSize: '0.75rem',
                fontWeight: 600,
                marginBottom: '0.5rem'
              }}
            >
              <Terminal size={12} />
              <span>Developer Trace</span>
            </div>

            {aggregationId && (
              <div style={{ fontSize: '0.75rem', color: '#475569', marginBottom: '0.375rem' }}>
                <span style={{ color: '#64748B' }}>Aggregation ID:</span>{' '}
                <code style={{ fontFamily: 'var(--font-mono)', backgroundColor: '#E2E8F0', padding: '1px 4px', borderRadius: '3px' }}>
                  {aggregationId}
                </code>
              </div>
            )}

            {eventIds.length > 0 && (
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748B', marginBottom: '0.25rem' }}>
                  Captured Event IDs ({eventIds.length}):
                </div>
                <div
                  style={{
                    backgroundColor: '#0F172A',
                    color: '#94A3B8',
                    padding: '0.625rem',
                    borderRadius: '4px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.6875rem',
                    maxHeight: '120px',
                    overflowY: 'auto',
                    lineHeight: '1.5'
                  }}
                >
                  {eventIds.map((id) => (
                    <div key={id} style={{ color: '#38BDF8' }}>
                      {id}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
