import React from 'react';
import styles from './ui.module.css';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: string;
  variant?: BadgeVariant;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  variant = 'neutral',
  className = '',
  ...props
}) => {
  return (
    <span
      className={`${styles.badge} ${styles[`badge-${variant}`]} ${className}`}
      role="status"
      aria-label={`Status: ${status}`}
      {...props}
    >
      {status}
    </span>
  );
};
