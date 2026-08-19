import React, { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { apiClient } from '../services/api-client.js';
import { SystemStatusDto } from '../types/api.js';
import { Server, Database, Sparkles, ShieldCheck, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [status, setStatus] = useState<SystemStatusDto | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = () => {
    setLoading(true);
    apiClient
      .getSystemStatus()
      .then((data) => {
        setStatus(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const dbConnected = status?.components?.database?.status === 'connected';
  const aiAvailable = status?.components?.aiService?.status === 'available';
  const appConnected = status?.components?.applicationApi?.status === 'connected';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#09090B', marginBottom: '0.25rem', letterSpacing: '-0.03em' }}>
            System Configuration & Status
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#71717A' }}>
            Live status of application runtime connections, security boundaries, and layer topology.
          </p>
        </div>

        <Button variant="secondary" onClick={fetchStatus} icon={<RefreshCw size={14} className={loading ? 'spinner' : ''} />}>
          Refresh Status
        </Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '780px' }}>
        {/* Application API */}
        <Card style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: '#F4F4F5', color: '#09090B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Server size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#09090B' }}>
              Application Read & Ingestion API
            </div>
            <div style={{ fontSize: '0.8125rem', color: '#71717A' }}>
              Express Server · Port {status?.components?.applicationApi?.port || 3001}
            </div>
          </div>
          <span
            style={{
              fontSize: '0.75rem',
              color: appConnected ? '#166534' : '#991B1B',
              backgroundColor: appConnected ? '#DCFCE7' : '#FEE2E2',
              padding: '0.25rem 0.625rem',
              borderRadius: '4px',
              fontWeight: 600
            }}
          >
            {appConnected ? 'CONNECTED' : 'DISCONNECTED'}
          </span>
        </Card>

        {/* Supabase Database */}
        <Card style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: '#F4F4F5', color: '#09090B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Database size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#09090B' }}>
              Persistent Database
            </div>
            <div style={{ fontSize: '0.8125rem', color: '#71717A' }}>
              Supabase PostgreSQL (Sessions, Websites, Pages, Routes, Events, AI Batches)
            </div>
            {status?.components?.database?.error && (
              <div style={{ fontSize: '0.75rem', color: '#DC2626', marginTop: '0.25rem' }}>
                {status.components.database.error}
              </div>
            )}
          </div>
          <span
            style={{
              fontSize: '0.75rem',
              color: dbConnected ? '#166534' : '#991B1B',
              backgroundColor: dbConnected ? '#DCFCE7' : '#FEE2E2',
              padding: '0.25rem 0.625rem',
              borderRadius: '4px',
              fontWeight: 600
            }}
          >
            {dbConnected ? 'CONNECTED' : 'DISCONNECTED'}
          </span>
        </Card>

        {/* Python AI Service */}
        <Card style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: '#F4F4F5', color: '#09090B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#09090B' }}>
              Python AI Analysis Service
            </div>
            <div style={{ fontSize: '0.8125rem', color: '#71717A' }}>
              FastAPI Service (Groq Provider + Deterministic Fallback Engine)
            </div>
            <div style={{ fontSize: '0.75rem', color: '#A1A1AA', marginTop: '0.15rem' }}>
              Endpoint: {status?.components?.aiService?.url || 'http://localhost:8000'}
            </div>
          </div>
          <span
            style={{
              fontSize: '0.75rem',
              color: aiAvailable ? '#166534' : '#92400E',
              backgroundColor: aiAvailable ? '#DCFCE7' : '#FEF3C7',
              padding: '0.25rem 0.625rem',
              borderRadius: '4px',
              fontWeight: 600
            }}
          >
            {aiAvailable ? 'AVAILABLE' : 'STANDBY / FALLBACK'}
          </span>
        </Card>

        {/* Security Boundary */}
        <Card style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: '#F4F4F5', color: '#09090B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#09090B' }}>
              Security Boundary Enforcement
            </div>
            <div style={{ fontSize: '0.8125rem', color: '#71717A' }}>
              Frontend is strictly decoupled. Zero direct DB credentials or Groq API keys in browser.
            </div>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#18181B', backgroundColor: '#F4F4F5', border: '1px solid #E4E4E7', padding: '0.25rem 0.625rem', borderRadius: '4px', fontWeight: 600 }}>
            ENFORCED
          </span>
        </Card>
      </div>
    </div>
  );
};
