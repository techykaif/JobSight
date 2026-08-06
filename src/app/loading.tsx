import React from 'react';
import { Card } from '@/components/ui/Card';

export default function GlobalLoading() {
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column', opacity: 0.7 }}>
        <div style={{ height: '40px', width: '200px', background: 'var(--bg-secondary)', borderRadius: '6px', animation: 'pulse 1.5s infinite' }} />
        <Card padding="large">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ height: '32px', width: '30%', background: 'var(--bg-secondary)', borderRadius: '6px', animation: 'pulse 1.5s infinite' }} />
            <div style={{ height: '20px', width: '100%', background: 'var(--bg-secondary)', borderRadius: '6px', animation: 'pulse 1.5s infinite 0.1s' }} />
            <div style={{ height: '20px', width: '80%', background: 'var(--bg-secondary)', borderRadius: '6px', animation: 'pulse 1.5s infinite 0.2s' }} />
            <div style={{ height: '20px', width: '90%', background: 'var(--bg-secondary)', borderRadius: '6px', animation: 'pulse 1.5s infinite 0.3s' }} />
          </div>
        </Card>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}} />
    </div>
  );
}
