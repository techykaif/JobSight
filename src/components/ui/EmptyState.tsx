import React from 'react';
import { Card } from './Card';

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  className = '',
}) => {
  return (
    <Card className={className} padding="large">
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 16,
        padding: '24px 0',
      }}>
        {icon && (
          <div style={{
            fontSize: '2.5rem',
            opacity: 0.5,
            lineHeight: 1,
            marginBottom: 4,
          }} aria-hidden="true">
            {icon}
          </div>
        )}
        <div>
          <h3 style={{
            fontSize: '1.0625rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: '0 0 8px',
            letterSpacing: '-0.01em',
          }}>
            {title}
          </h3>
          <p style={{
            fontSize: '0.875rem',
            color: 'var(--text-muted)',
            maxWidth: 400,
            margin: '0 auto',
            lineHeight: 1.6,
          }}>
            {description}
          </p>
        </div>
        {action && (
          <div style={{ marginTop: 8 }}>
            {action}
          </div>
        )}
      </div>
    </Card>
  );
};
