import React from 'react';

interface BadgeProps {
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ severity = 'info', children, className = '' }) => {
  return (
    <span className={`badge badge-${severity.toLowerCase()} ${className}`}>
      <span className="badge-dot" />
      {children}
    </span>
  );
};
