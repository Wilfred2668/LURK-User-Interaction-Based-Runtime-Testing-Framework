import React from 'react';
import {
  Activity,
  Layers,
  Sparkles,
  Settings,
  Terminal
} from 'lucide-react';

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPath, onNavigate }) => {
  const navItems = [
    { label: 'Overview', path: '/', icon: <Activity size={17} /> },
    { label: 'Sessions', path: '/sessions', icon: <Layers size={17} /> },
    { label: 'Settings', path: '/settings', icon: <Settings size={17} /> }
  ];

  const isCurrent = (path: string) => {
    if (path === '/' && currentPath === '/') return true;
    if (path !== '/' && currentPath.startsWith(path)) return true;
    return false;
  };

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '2rem',
          padding: '0.375rem 0.5rem',
          cursor: 'pointer',
          borderRadius: '8px',
          transition: 'background-color 150ms ease'
        }}
        onClick={() => onNavigate('/')}
      >
        <div
          style={{
            width: '30px',
            height: '30px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #18181B 0%, #3F3F46 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            boxShadow: '0 2px 4px rgba(0,0,0,0.12)',
            border: '1px solid rgba(255,255,255,0.15)'
          }}
        >
          <Sparkles size={16} />
        </div>
        <div>
          <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#09090B', letterSpacing: '-0.03em' }}>
            RuntimeLens
          </div>
          <div style={{ fontSize: '0.6875rem', color: '#71717A', letterSpacing: '0.01em' }}>
            Engineering Intelligence
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
        <div
          style={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: '#A1A1AA',
            padding: '0.5rem 0.625rem 0.25rem 0.625rem'
          }}
        >
          Platform
        </div>
        {navItems.map((item) => {
          const active = isCurrent(item.path);
          return (
            <button
              key={item.path}
              onClick={() => onNavigate(item.path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.625rem',
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: active ? '#F4F4F5' : 'transparent',
                color: active ? '#09090B' : '#71717A',
                fontWeight: active ? 600 : 500,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                transition: 'all 150ms ease',
                position: 'relative'
              }}
            >
              {active && (
                <div
                  style={{
                    position: 'absolute',
                    left: '0px',
                    top: '6px',
                    bottom: '6px',
                    width: '3px',
                    backgroundColor: '#4F46E5',
                    borderRadius: '0 2px 2px 0'
                  }}
                />
              )}
              <span style={{ color: active ? '#4F46E5' : '#71717A', display: 'flex', alignItems: 'center' }}>
                {item.icon}
              </span>
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Live Service Status Footer */}
      <div
        style={{
          borderTop: '1px solid #E4E4E7',
          paddingTop: '1rem',
          paddingLeft: '0.5rem',
          fontSize: '0.75rem',
          color: '#71717A'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
          <div className="live-indicator">
            <div className="live-indicator-ping" />
            <div className="live-indicator-dot" />
          </div>
          <span style={{ fontWeight: 600, color: '#09090B', fontSize: '0.75rem' }}>
            Application API Live
          </span>
        </div>
        <div style={{ fontSize: '0.6875rem', color: '#A1A1AA', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <Terminal size={11} /> Layer 4 · Port 3001
        </div>
      </div>
    </aside>
  );
};
