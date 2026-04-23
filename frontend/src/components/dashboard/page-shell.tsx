import { cn } from '@/lib/utils';

type PageShellProps = {
  children: React.ReactNode;
  className?: string;
  /** Classe Tailwind para largura máxima (ex.: max-w-6xl, max-w-[1600px]). */
  maxWidthClass?: string;
};

/**
 * Container padrão para páginas do painel: padding responsivo e largura máxima consistente.
 */
export function PageShell({ children, className, maxWidthClass = 'max-w-[1600px]' }: PageShellProps) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8',
        maxWidthClass,
        className,
      )}
    >
      {children}
    </div>
  );
}
