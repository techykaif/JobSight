"use client";
import React from 'react';

export interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  icon?: React.ReactNode;
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  children,
  variant = 'primary',
  size = 'medium',
  icon,
  className = '',
  ...props
}) => {
  const getStyles = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      borderRadius: '8px',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      border: '1px solid transparent',
      outline: 'none',
    };

    switch (size) {
      case 'small':
        base.padding = '6px 12px';
        base.fontSize = '0.875rem';
        break;
      case 'large':
        base.padding = '12px 24px';
        base.fontSize = '1.125rem';
        break;
      case 'medium':
      default:
        base.padding = '8px 16px';
        base.fontSize = '1rem';
        break;
    }

    switch (variant) {
      case 'secondary':
        base.backgroundColor = 'var(--text-main)';
        base.color = '#fff';
        break;
      case 'outline':
        base.backgroundColor = 'transparent';
        base.borderColor = 'var(--border-subtle)';
        base.color = 'var(--text-main)';
        break;
      case 'ghost':
        base.backgroundColor = 'transparent';
        base.color = 'var(--primary)';
        break;
      case 'primary':
      default:
        base.backgroundColor = 'var(--primary)';
        base.color = '#fff';
        break;
    }

    return base;
  };

  return (
    <button
      className={className}
      style={getStyles()}
      onMouseOver={(e) => {
        if (variant === 'outline' || variant === 'ghost') {
          e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.05)';
        } else {
          e.currentTarget.style.opacity = '0.9';
        }
      }}
      onMouseOut={(e) => {
        if (variant === 'outline' || variant === 'ghost') {
          e.currentTarget.style.backgroundColor = 'transparent';
        } else {
          e.currentTarget.style.opacity = '1';
        }
      }}
      onFocus={(e) => {
        e.currentTarget.style.boxShadow = `0 0 0 3px rgba(59, 130, 246, 0.3)`;
      }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = 'none';
      }}
      {...props}
    >
      {icon && <span aria-hidden="true" style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
      {children}
    </button>
  );
};
