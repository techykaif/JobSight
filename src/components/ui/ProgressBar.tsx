import React from 'react';

export interface ProgressBarProps {
  progress: number; // 0 to 100
  color?: string;
  height?: number;
  showLabel?: boolean;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  color = 'var(--primary)',
  height = 8,
  showLabel = false,
  className = '',
}) => {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className={className} style={{ width: '100%' }} role="progressbar" aria-valuenow={clampedProgress} aria-valuemin={0} aria-valuemax={100}>
      {showLabel && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
          {clampedProgress.toFixed(0)}%
        </div>
      )}
      <div style={{ width: '100%', height: `${height}px`, background: 'var(--border-subtle)', borderRadius: '9999px', overflow: 'hidden' }}>
        <div
          style={{
            width: `${clampedProgress}%`,
            height: '100%',
            background: color,
            borderRadius: '9999px',
            transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </div>
    </div>
  );
};
