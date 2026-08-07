"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { Card } from './Card';
import styles from './ui.module.css';

export interface MetricCardProps {
  label: string;
  value: string | number;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon?: React.ReactNode;
  className?: string;
  href?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  trend,
  icon,
  className = '',
  href,
}) => {
  const router = useRouter();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (href && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      router.push(href);
    }
  };

  return (
    <Card
      className={`${styles.metricCard} ${className}`}
      padding="medium"
      interactive={!!href}
      onClick={href ? () => router.push(href) : undefined}
      onKeyDown={handleKeyDown}
      role={href ? 'button' : undefined}
      tabIndex={href ? 0 : undefined}
      aria-label={href ? `Navigate to ${label}` : undefined}
    >
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className={styles.metricLabel}>{label}</div>
        {icon && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'var(--bg-subtle)',
            color: 'var(--text-muted)',
            flexShrink: 0,
          }}>
            {icon}
          </div>
        )}
      </div>

      {/* Value */}
      <div className={styles.metricValue} aria-label={`${label}: ${value}`}>
        {value}
      </div>

      {/* Trend */}
      {trend && (
        <div
          className={`${styles.metricTrend} ${trend.isPositive ? styles.trendUp : styles.trendDown}`}
          aria-label={`Trend: ${trend.isPositive ? 'up' : 'down'} ${Math.abs(trend.value)}%`}
        >
          {trend.isPositive ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="18 15 12 9 6 15"/>
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          )}
          {Math.abs(trend.value)}% this week
        </div>
      )}

      {/* Hover arrow indicator */}
      {href && (
        <div style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          color: 'var(--text-muted)',
          opacity: 0,
          transition: 'opacity 0.2s ease',
          pointerEvents: 'none',
        }} className="metric-card-arrow">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14m-7-7 7 7-7 7"/>
          </svg>
        </div>
      )}
    </Card>
  );
};
