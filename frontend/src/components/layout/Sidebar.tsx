import React from 'react';
import { Activity, Layers, Settings } from 'lucide-react';
import logoImg from '../../assets/logo-no-bg.png';

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPath, onNavigate }) => {
  const navItems = [
    { label: 'Overview',  path: '/',         icon: <Activity size={15} /> },
    { label: 'Sessions',  path: '/sessions',  icon: <Layers size={15} /> },
    { label: 'Settings',  path: '/settings',  icon: <Settings size={15} /> }
  ];

  const isCurrent = (itemPath: string) => {
    const raw = currentPath.startsWith('/') ? currentPath : `/${currentPath}`;
    const pathname = raw.split('?')[0] || '/';
    if (itemPath === '/' && (pathname === '/' || pathname === '')) return true;
    if (itemPath === '/sessions' && (pathname === '/sessions' || pathname === '/session' || pathname === '/website' || pathname === '/page' || pathname === '/analyze')) return true;
    if (itemPath !== '/' && pathname.startsWith(itemPath)) return true;
    return false;
  };

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div
        onClick={() => onNavigate('/')}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0.25rem 0.5rem 0.5rem 0.5rem',
          marginBottom: '1rem',
          cursor: 'pointer',
        }}
      >
        <img
          src={logoImg}
          alt="LURK"
          style={{
            height: '60px',
            width: 'auto',
            maxWidth: '100%',
            objectFit: 'contain',
            display: 'block'
          }}
        />
      </div>

      {/* Nav group label */}
      <div
        style={{
          fontSize: '0.625rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: '#3F3F46',
          padding: '0 0.5rem',
          marginBottom: '0.375rem'
        }}
      >
        Platform
      </div>

      {/* Navigation */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem', flex: 1 }}>
        {navItems.map((item) => {
          const active = isCurrent(item.path);
          return (
            <button
              key={item.path}
              onClick={() => onNavigate(item.path)}
              className={`nav-item${active ? ' active' : ''}`}
            >
              <span style={{ color: active ? '#F59E0B' : '#52525B', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                {item.icon}
              </span>
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
};
