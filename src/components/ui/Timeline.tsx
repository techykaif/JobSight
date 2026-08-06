import React from 'react';
import styles from './ui.module.css';

export interface TimelineItem {
  id: string;
  title: string;
  description?: string;
  date?: string;
  isActive?: boolean;
}

export interface TimelineProps {
  items: TimelineItem[];
  className?: string;
}

export const Timeline: React.FC<TimelineProps> = ({ items, className = '' }) => {
  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} role="list" aria-label="Timeline">
      {items.map((item, index) => (
        <div key={item.id} style={{ display: 'flex', gap: '16px' }} role="listitem">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: item.isActive ? 'var(--primary)' : 'var(--border-subtle)',
                marginTop: '6px'
              }}
              aria-hidden="true"
            />
            {index < items.length - 1 && (
              <div style={{ width: '2px', flex: 1, background: 'var(--border-subtle)', marginTop: '4px' }} aria-hidden="true" />
            )}
          </div>
          <div style={{ paddingBottom: index < items.length - 1 ? '16px' : '0' }}>
            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{item.title}</div>
            {item.date && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{item.date}</div>}
            {item.description && <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '4px' }}>{item.description}</div>}
          </div>
        </div>
      ))}
    </div>
  );
};
