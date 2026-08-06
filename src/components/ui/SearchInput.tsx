import React from 'react';
import styles from './ui.module.css';

export interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onSearch?: (value: string) => void;
  debounceMs?: number;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  onSearch,
  debounceMs = 300,
  className = '',
  ...props
}) => {
  return (
    <div style={{ position: 'relative', width: '100%' }} className={className}>
      <svg
        style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
        width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
      <input
        type="search"
        style={{
          width: '100%',
          padding: '12px 12px 12px 40px',
          borderRadius: '8px',
          border: '1px solid var(--border-subtle)',
          outline: 'none',
          fontSize: '1rem',
          transition: 'border-color 0.2s, box-shadow 0.2s',
          backgroundColor: 'var(--bg-card)'
        }}
        onFocus={(e) => {
          e.target.style.borderColor = 'var(--primary)';
          e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
        }}
        onBlur={(e) => {
          e.target.style.borderColor = 'var(--border-subtle)';
          e.target.style.boxShadow = 'none';
        }}
        onChange={(e) => {
          if (props.onChange) props.onChange(e);
          // Simplified search trigger for this demo component
          if (onSearch) onSearch(e.target.value);
        }}
        aria-label="Search"
        {...props}
      />
    </div>
  );
};
