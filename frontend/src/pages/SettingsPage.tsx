import React from 'react';
import { Card } from '../components/ui/Card.js';
import { Server, Database, Sparkles, ShieldCheck } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 600, color: '#171717', marginBottom: '0.25rem' }}>
          System Configuration & Status
        </h1>
        <p style={{ fontSize: '0.875rem', color: '#737373' }}>
          Overview of application runtime connections, security boundaries, and layer topology.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '720px' }}>
        <Card style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: '#EEF2FF', color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Server size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#171717' }}>
              Application Read & Orchestration API
            </div>
            <div style={{ fontSize: '0.8125rem', color: '#737373' }}>
              Express Server · Port 3001
            </div>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#166534', backgroundColor: '#DCFCE7', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
            CONNECTED
          </span>
        </Card>

        <Card style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: '#F0FDF4', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Database size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#171717' }}>
              Persistent Database
            </div>
            <div style={{ fontSize: '0.8125rem', color: '#737373' }}>
              Supabase PostgreSQL (Sessions, Websites, Pages, Routes, Events, AI Batches)
            </div>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#166534', backgroundColor: '#DCFCE7', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
            ONLINE
          </span>
        </Card>

        <Card style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: '#F5F3FF', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#171717' }}>
              AI Analysis Service
            </div>
            <div style={{ fontSize: '0.8125rem', color: '#737373' }}>
              Python FastAPI Service (Groq Provider + Deterministic Fallback)
            </div>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#166534', backgroundColor: '#DCFCE7', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
            READY
          </span>
        </Card>

        <Card style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: '#F1F5F9', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#171717' }}>
              Security Boundary
            </div>
            <div style={{ fontSize: '0.8125rem', color: '#737373' }}>
              Frontend is strictly decoupled. Zero direct DB credentials or API keys in browser.
            </div>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#1E293B', backgroundColor: '#E2E8F0', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
            ENFORCED
          </span>
        </Card>
      </div>
    </div>
  );
};
