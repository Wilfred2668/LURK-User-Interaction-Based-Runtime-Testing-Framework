import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Code2, Terminal } from 'lucide-react';

interface TechnicalEvidenceDrawerProps {
  evidence: Record<string, unknown>;
  findingType?: string;
}

export const TechnicalEvidenceDrawer: React.FC<TechnicalEvidenceDrawerProps> = ({
  evidence
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const eventIds = Array.isArray(evidence['eventIds']) ? (evidence['eventIds'] as string[]) : [];
  const aggregationId = typeof evidence['aggregationId'] === 'string' ? evidence['aggregationId'] : null;
  const count = typeof evidence['count'] === 'number' ? evidence['count'] : eventIds.length || 1;
  const url = typeof evidence['url'] === 'string' ? evidence['url'] : null;
  const method = typeof evidence['method'] === 'string' ? evidence['method'] : null;
  const status = evidence['status'] !== undefined ? String(evidence['status']) : null;
  const durationMs = evidence['durationMs'] || evidence['duration'] || null;

  return (
    <div
      style={{
        marginTop: '1rem',
        borderTop: '1px solid #F0F0F0',
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
          color: '#4F46E5',
          fontSize: '0.8125rem',
          fontWeight: 500,
          cursor: 'pointer',
          padding: 0
        }}
      >
        <Code2 size={14} />
        <span>{isOpen ? 'Hide technical evidence' : 'View technical evidence'}</span>
        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {isOpen && (
        <div
          style={{
            marginTop: '0.875rem',
            backgroundColor: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '6px',
            padding: '1rem',
            fontSize: '0.8125rem'
          }}
        >
          {/* Structured Parameters */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '0.75rem',
              marginBottom: '1rem'
            }}
          >
            {url && (
              <div>
                <div style={{ color: '#64748B', fontSize: '0.6875rem', textTransform: 'uppercase', fontWeight: 600 }}>
                  Target Endpoint
                </div>
                <div style={{ color: '#0F172A', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
                  {method ? `${method} ` : ''}{url}
                </div>
              </div>
            )}

            {status && (
              <div>
                <div style={{ color: '#64748B', fontSize: '0.6875rem', textTransform: 'uppercase', fontWeight: 600 }}>
                  HTTP Status
                </div>
                <div style={{ color: '#0F172A', fontWeight: 500 }}>
                  {status}
                </div>
              </div>
            )}

            {count > 1 && (
              <div>
                <div style={{ color: '#64748B', fontSize: '0.6875rem', textTransform: 'uppercase', fontWeight: 600 }}>
                  Total Occurrences
                </div>
                <div style={{ color: '#0F172A', fontWeight: 500 }}>
                  {count} captures
                </div>
              </div>
            )}

            {durationMs !== null && (
              <div>
                <div style={{ color: '#64748B', fontSize: '0.6875rem', textTransform: 'uppercase', fontWeight: 600 }}>
                  Observed Duration
                </div>
                <div style={{ color: '#0F172A', fontWeight: 500 }}>
                  {String(durationMs)} ms
                </div>
              </div>
            )}
          </div>

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
