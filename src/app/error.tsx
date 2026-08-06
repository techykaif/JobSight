"use client";

import React, { useEffect } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { ActionButton } from '@/components/ui/ActionButton';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div style={{ maxWidth: '800px', margin: '4rem auto', padding: '0 1rem' }}>
      <EmptyState 
        title="Something went wrong" 
        description="An unexpected error occurred while loading this page." 
        icon="⚠️" 
        action={<ActionButton variant="primary" onClick={() => reset()}>Try again</ActionButton>} 
      />
    </div>
  );
}
