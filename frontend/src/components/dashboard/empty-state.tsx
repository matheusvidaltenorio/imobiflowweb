import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-surface-muted bg-white px-6 py-14 text-center shadow-sm',
        className,
      )}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
        <Icon className="h-7 w-7" strokeWidth={1.75} />
      </div>
      <h2 className="text-lg font-bold text-primary-950">{title}</h2>
      {description ? <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-600">{description}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
