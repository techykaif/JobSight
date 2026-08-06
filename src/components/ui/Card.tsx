import React from 'react';
import styles from './ui.module.css';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  padding?: 'none' | 'small' | 'medium' | 'large';
  interactive?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ children, padding = 'medium', interactive = false, className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`${styles.card} ${styles[`padding-${padding}`]} ${
          interactive ? styles.interactiveCard : ''
        } ${className}`}
        tabIndex={interactive ? 0 : undefined}
        role={interactive ? 'button' : undefined}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = 'Card';
