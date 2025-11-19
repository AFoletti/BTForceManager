import * as React from 'react';
import { cn } from '../../lib/utils';

export function Badge({ className, variant = 'default', ...props }) {
  const variants = {
    default: 'bg-primary text-primary-foreground',
    secondary: 'bg-secondary text-secondary-foreground',
    operational: 'bg-green-600 text-white',
    damaged: 'bg-amber-600 text-white',
    disabled: 'bg-red-600 text-white',
    destroyed: 'bg-red-600 text-white',
    repairing: 'bg-blue-600 text-white',
    missingPilot: 'bg-red-700 text-white',
    outline: 'border border-border text-foreground',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium uppercase tracking-wider',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
