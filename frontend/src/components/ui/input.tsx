import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-11 w-full rounded-xl border-2 border-surface-muted bg-white px-3.5 py-2 text-sm text-gray-900 transition-colors',
        'ring-offset-white placeholder:text-gray-400',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium',
        'focus-visible:border-primary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 focus-visible:ring-offset-0',
        'disabled:cursor-not-allowed disabled:bg-surface disabled:opacity-60',
        'aria-invalid:border-red-400 aria-invalid:ring-red-200',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
