import React from 'react';
import { FindingDto } from '../../types/api.js';
import { Badge } from '../ui/Badge.js';
import { Card } from '../ui/Card.js';
import { TechnicalEvidenceDrawer } from '../evidence/TechnicalEvidenceDrawer.js';
import { HelpCircle, Sparkles, Activity } from 'lucide-react';

interface FindingCardProps {
  finding: FindingDto;
}

export const FindingCard: React.FC<FindingCardProps> = ({ finding }) => {
  const sev = (finding.severity || 'info').toLowerCase() as 'critical' | 'high' | 'medium' | 'low' | 'info';

  const sevAccentBorder =
    sev === 'critical' || sev === 'high'
      ? '#EF4444'
      : sev === 'medium'
      ? '#F59E0B'
      : '#64748B';

  return (
    <Card
      style={{
        marginBottom: '1.25rem',
        borderLeft: `3px solid ${sevAccentBorder}`,
        backgroundColor: '#FFFFFF',
        padding: '1.35rem 1.5rem',
        position: 'relative'
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '0.875rem'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
            <Badge severity={sev}>{finding.severity.toUpperCase()}</Badge>
            <span
              style={{
                fontSize: '0.6875rem',
                color: '#71717A',
                textTransform: 'capitalize',
                backgroundColor: '#F4F4F5',
                border: '1px solid #E4E4E7',
                padding: '0.15rem 0.45rem',
                borderRadius: '4px',
                fontWeight: 500
              }}
            >
              {finding.category || 'runtime'}
            </span>
          </div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#09090B', letterSpacing: '-0.02em' }}>
            {finding.title}
          </h3>
        </div>
      </div>

      {/* Observed Fact */}
      <div style={{ marginBottom: '0.875rem' }}>
        <p style={{ fontSize: '0.875rem', color: '#27272A', lineHeight: '1.55' }}>
          {finding.observedFact}
        </p>
      </div>

      {/* Possible Interpretation & Analysis */}
      {finding.possibleInterpretation && (
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>
            Possible Interpretation
          </div>
          <p style={{ fontSize: '0.8125rem', color: '#52525B' }}>
            {finding.possibleInterpretation}
          </p>
        </div>
      )}

      {/* Likely Impact */}
      {finding.likelyImpact && (
        <div
          style={{
            backgroundColor: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderLeft: '3px solid #6366F1',
            padding: '0.625rem 0.875rem',
            borderRadius: '4px',
            marginBottom: '0.875rem'
          }}
        >
          <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#4F46E5', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.15rem' }}>
            Likely Impact
          </div>
          <div style={{ fontSize: '0.8125rem', color: '#334155' }}>
            {finding.likelyImpact}
          </div>
        </div>
      )}

      {/* Required Additional Context */}
      {finding.requiredAdditionalContext && (
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.6875rem', fontWeight: 600, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>
            <HelpCircle size={12} />
            <span>Recommended Next Steps / Context</span>
          </div>
          <p style={{ fontSize: '0.8125rem', color: '#52525B' }}>
            {finding.requiredAdditionalContext}
          </p>
        </div>
      )}

      {/* Collapsible Technical Evidence Drawer */}
      <TechnicalEvidenceDrawer evidence={finding.evidence} />
    </Card>
  );
};
