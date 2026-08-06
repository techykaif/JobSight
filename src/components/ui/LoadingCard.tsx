import React from 'react';
import { Card } from './Card';
import { Skeleton } from './Skeleton';

export interface LoadingCardProps {
  className?: string;
}

export const LoadingCard: React.FC<LoadingCardProps> = ({ className = '' }) => {
  return (
    <Card className={className} padding="medium" aria-busy="true" aria-live="polite">
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
        <Skeleton variant="circular" width={48} height={48} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Skeleton variant="text" width="60%" height={20} />
          <Skeleton variant="text" width="40%" height={16} />
          <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
            <Skeleton variant="rectangular" width={60} height={24} />
            <Skeleton variant="rectangular" width={60} height={24} />
          </div>
        </div>
      </div>
    </Card>
  );
};
