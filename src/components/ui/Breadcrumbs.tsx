"use client";
import React from 'react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, className = '' }) => {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol style={{ display: 'flex', listStyle: 'none', padding: 0, margin: 0, gap: '8px', alignItems: 'center' }}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {item.href && !isLast ? (
                <a
                  href={item.href}
                  style={{
                    color: 'var(--text-muted)',
                    textDecoration: 'none',
                    fontSize: '0.875rem',
                    transition: 'color 0.2s',
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.color = 'var(--primary)')}
                  onMouseOut={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  {item.label}
                </a>
              ) : (
                <span
                  style={{
                    color: isLast ? 'var(--text-main)' : 'var(--text-muted)',
                    fontWeight: isLast ? 600 : 400,
                    fontSize: '0.875rem',
                  }}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
              {!isLast && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--border-subtle)' }} aria-hidden="true">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
