import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type BreadcrumbItem = { label: string; href?: string };

type PageHeaderProps = {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({ title, description, breadcrumbs, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('mb-8 border-b border-surface-muted/80 pb-6', className)}>
      {breadcrumbs?.length ? (
        <nav className="mb-3 flex flex-wrap items-center gap-1 text-sm" aria-label="Breadcrumb">
          {breadcrumbs.map((item, i) => (
            <span key={`${item.label}-${i}`} className="inline-flex items-center gap-1">
              {i > 0 ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden /> : null}
              {item.href ? (
                <Link
                  href={item.href}
                  className="font-medium text-gray-500 transition-colors hover:text-primary-800 hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="font-semibold text-gray-800">{item.label}</span>
              )}
            </span>
          ))}
        </nav>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-primary-950 md:text-3xl">{title}</h1>
          {description ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-600 md:text-base">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
