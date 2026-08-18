import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  textured?: boolean;
}

export const Card: React.FC<CardProps> = ({
  interactive = false,
  textured = false,
  children,
  className = '',
  ...props
}) => {
  const classes = [
    textured ? 'stat-card' : 'card',
    interactive ? 'card-interactive' : '',
    className
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
};
