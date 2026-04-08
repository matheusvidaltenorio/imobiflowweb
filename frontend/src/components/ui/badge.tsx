import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary-100 text-primary-900',
        success: 'border-transparent bg-success-100 text-success-700',
        warning: 'border-transparent bg-warning-100 text-warning-900',
        danger: 'border-transparent bg-danger-100 text-danger-800',
        muted: 'border-surface-muted bg-surface text-gray-700',
        outline: 'border-surface-muted bg-white text-gray-800',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
