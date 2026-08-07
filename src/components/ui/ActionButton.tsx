"use client";
import React from 'react';

export interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'small' | 'medium' | 'large';
  icon?: React.ReactNode;
}

const SIZE_STYLES: Record<string, React.CSSProperties> = {
  small:  { padding: '5px 10px', fontSize: '0.8125rem', gap: '5px' },
  medium: { padding: '7px 14px', fontSize: '0.875rem',  gap: '6px' },
  large:  { padding: '10px 20px', fontSize: '1rem',     gap: '8px' },
};

const VARIANT_STYLES: Record<string, React.CSSProperties> = {
  primary: {
    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    color: '#fff',
    borderColor: 'rgba(59,130,246,0.6)',
  },
  secondary: {
    backgroundColor: 'var(--bg-subtle)',
    color: 'var(--text-primary)',
    borderColor: 'var(--border-default)',
  },
  outline: {
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    borderColor: 'var(--border-default)',
  },
  ghost: {
    backgroundColor: 'transparent',
    color: 'var(--text-muted)',
    borderColor: 'transparent',
  },
  danger: {
    backgroundColor: 'var(--danger-bg)',
    color: 'var(--danger-text)',
    borderColor: 'var(--danger-border)',
  },
};

const HOVER_STYLES: Record<string, Partial<React.CSSProperties>> = {
  primary: { opacity: '0.9' as any },
  secondary: { backgroundColor: 'var(--bg-hover)', borderColor: 'var(--border-strong)' },
  outline: { backgroundColor: 'var(--bg-subtle)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' },
  ghost: { backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)' },
  danger: { backgroundColor: 'rgba(239,68,68,0.18)' },
};

export const ActionButton: React.FC<ActionButtonProps> = ({
  children,
  variant = 'primary',
  size = 'medium',
  icon,
  className = '',
  style,
  ...props
}) => {
  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-md)',
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
    border: '1px solid transparent',
    outline: 'none',
    whiteSpace: 'nowrap',
    lineHeight: 1.4,
    userSelect: 'none',
    letterSpacing: '0.01em',
    ...SIZE_STYLES[size],
    ...VARIANT_STYLES[variant],
    ...style,
  };

  return (
    <button
      className={className}
      style={baseStyle}
      onMouseOver={e => {
        const h = HOVER_STYLES[variant];
        if (h) Object.assign(e.currentTarget.style, h);
      }}
      onMouseOut={e => {
        // reset to base
        Object.assign(e.currentTarget.style, VARIANT_STYLES[variant]);
      }}
      onFocus={e => {
        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.25)';
      }}
      onBlur={e => {
        e.currentTarget.style.boxShadow = 'none';
      }}
      onMouseDown={e => {
        e.currentTarget.style.transform = 'scale(0.98)';
      }}
      onMouseUp={e => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
      {...props}
    >
      {icon && <span aria-hidden="true" style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
      {children}
    </button>
  );
};
