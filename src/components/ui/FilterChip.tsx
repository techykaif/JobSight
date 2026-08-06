"use client";
import React from 'react';

export interface FilterChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  selected?: boolean;
  onDelete?: () => void;
}

export const FilterChip: React.FC<FilterChipProps> = ({
  label,
  selected = false,
  onDelete,
  className = '',
  ...props
}) => {
  return (
    <button
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 14px',
        borderRadius: '9999px',
        fontSize: '0.875rem',
        fontWeight: 500,
        border: `1px solid ${selected ? 'var(--primary)' : 'var(--border-subtle)'}`,
        backgroundColor: selected ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-card)',
        color: selected ? 'var(--primary)' : 'var(--text-main)',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
      aria-pressed={selected}
      {...props}
    >
      {label}
      {onDelete && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              onDelete();
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            backgroundColor: selected ? 'var(--primary)' : 'var(--text-muted)',
            color: '#fff',
            fontSize: '10px',
          }}
          aria-label={`Remove filter ${label}`}
        >
          ✕
        </span>
      )}
    </button>
  );
};
