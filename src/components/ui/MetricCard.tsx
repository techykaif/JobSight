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
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className={styles.metricLabel} aria-label={label}>{label}</div>
        {icon && <div style={{ color: 'var(--text-muted)' }}>{icon}</div>}
      </div>
      <div className={styles.metricValue}>{value}</div>
      {trend && (
        <div
          className={`${styles.metricTrend} ${
            trend.isPositive ? styles.trendUp : styles.trendDown
          }`}
          aria-label={`Trend is ${trend.isPositive ? 'up' : 'down'} by ${trend.value}%`}
        >
          {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
        </div>
      )}
    </Card>
  );
};
