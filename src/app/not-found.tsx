import React from 'react';
import Link from 'next/link';
import { EmptyState } from '@/components/ui/EmptyState';
import { ActionButton } from '@/components/ui/ActionButton';

export default function GlobalNotFound() {
  return (
    <div style={{ maxWidth: '800px', margin: '4rem auto', padding: '0 1rem' }}>
      <EmptyState 
        title="Page Not Found" 
        description="The page you are looking for does not exist." 
        icon="🧭" 
        action={<Link href="/"><ActionButton variant="primary">Return Home</ActionButton></Link>} 
      />
    </div>
  );
}
