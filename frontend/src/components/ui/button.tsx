import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'bg-accent-500 text-white shadow-cta hover:bg-accent-600 hover:shadow-lg hover:shadow-accent-500/30',
        brand: 'bg-primary-800 text-white shadow-md shadow-primary-950/15 hover:bg-primary-900',
        destructive: 'bg-red-600 text-white shadow-sm hover:bg-red-700',
        outline:
          'border-2 border-surface-muted bg-white text-primary-900 hover:border-primary-200 hover:bg-surface',
        secondary: 'border border-surface-muted bg-white text-primary-800 shadow-sm hover:bg-surface',
        ghost: 'text-primary-800 hover:bg-primary-50',
        link: 'text-primary-700 underline-offset-4 hover:underline shadow-none active:scale-100',
      },
      size: {
        default: 'h-11 px-5 py-2',
        sm: 'h-9 rounded-lg px-3.5 text-xs',
        lg: 'h-12 rounded-xl px-8 text-base',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  ),
);
Button.displayName = 'Button';

export { Button, buttonVariants };
