"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { Card, type CardProps } from './Card';

export interface InteractiveCardProps extends CardProps {
  href: string;
}

export const InteractiveCard: React.FC<InteractiveCardProps> = ({ href, children, ...props }) => {
  const router = useRouter();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      router.push(href);
    }
  };

  return (
    <Card
      {...props}
      interactive
      onClick={() => router.push(href)}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      {children}
    </Card>
  );
};
