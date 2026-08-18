import React from 'react';
import { Sidebar } from './Sidebar.js';

interface AppLayoutProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentPath,
  onNavigate,
  children
}) => {
  return (
    <div className="app-container">
      <Sidebar currentPath={currentPath} onNavigate={onNavigate} />
      <main className="main-content">{children}</main>
    </div>
  );
};
