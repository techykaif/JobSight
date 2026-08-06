import React from 'react';

export interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  width,
  height,
  className = '',
}) => {
  const getBorderRadius = () => {
    switch (variant) {
      case 'circular':
        return '50%';
      case 'rectangular':
        return '8px';
      case 'text':
      default:
        return '4px';
    }
  };

  const style: React.CSSProperties = {
    width: width || (variant === 'text' ? '100%' : '100px'),
    height: height || (variant === 'text' ? '1rem' : '100px'),
    borderRadius: getBorderRadius(),
    background: 'linear-gradient(90deg, var(--border-subtle) 25%, #f3f4f6 50%, var(--border-subtle) 75%)',
    backgroundSize: '200% 100%',
    animation: 'skeleton-loading 1.5s infinite',
  };

  return (
    <>
      <style>
        {`
          @keyframes skeleton-loading {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}
      </style>
      <div className={className} style={style} aria-hidden="true" />
    </>
  );
};
