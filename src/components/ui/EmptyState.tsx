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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px' }}>
        {icon && (
          <div style={{ color: 'var(--text-muted)', fontSize: '3rem', marginBottom: '8px' }} aria-hidden="true">
            {icon}
          </div>
        )}
        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>{title}</h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', maxWidth: '400px', margin: 0 }}>{description}</p>
        {action && <div style={{ marginTop: '8px' }}>{action}</div>}
      </div>
    </Card>
  );
};
