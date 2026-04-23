import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
};

/**
 * Estado vazio reutilizável: mensagem clara, hierarquia e slot para CTA.
 */
export function EmptyState({ icon: Icon, title, description, children, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-surface-muted bg-surface/50 px-6 py-12 text-center',
        className,
      )}
    >
      {Icon ? (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 ring-1 ring-primary-100">
          <Icon className="h-7 w-7" strokeWidth={1.5} aria-hidden />
        </div>
      ) : null}
      <p className="text-base font-semibold text-primary-950">{title}</p>
      {description ? <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-600">{description}</p> : null}
      {children ? <div className="mt-6 flex flex-wrap items-center justify-center gap-2">{children}</div> : null}
    </div>
  );
}
