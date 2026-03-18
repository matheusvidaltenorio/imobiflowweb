import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { ToasterProvider } from '@/components/ui/toaster';
import { QueryProvider } from '@/components/providers/query-provider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ImobiFlow - Marketplace Imobiliário',
  description: 'Sistema completo de gestão imobiliária',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <QueryProvider>
          <AuthProvider>
            <ToasterProvider>{children}</ToasterProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
