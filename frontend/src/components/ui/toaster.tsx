'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Toast, ToastProvider, ToastViewport } from './toast';

type ToastType = 'success' | 'error' | 'default';

type ToastOptions = { title?: string; description?: string; type?: ToastType };

const ToastContext = createContext<{
  toast: (options: ToastOptions) => void;
} | null>(null);

export function ToasterProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Array<ToastOptions & { id: number }>>([]);

  const toast = useCallback((opts: ToastOptions) => {
    const id = Date.now();
    setToasts((t) => [...t, { ...opts, id }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastProvider>
        {children}
        <ToastViewport />
        {toasts.map((t) => (
          <Toast
            key={t.id}
            title={t.title}
            description={t.description}
            className={
              t.type === 'error'
                ? 'border-red-200 bg-red-50'
                : t.type === 'success'
                  ? 'border-green-200 bg-green-50'
                  : ''
            }
          />
        ))}
      </ToastProvider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToasterProvider');
  return ctx;
}
