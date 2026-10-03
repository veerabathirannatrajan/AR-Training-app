import { CircleAlert, CircleCheck } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { cn } from './utils';

interface Toast {
  id: number;
  text: string;
  tone: 'ok' | 'error';
}

const ToastContext = createContext<(text: string, tone?: Toast['tone']) => void>(() => undefined);
let nextId = 0;

/** Small confirmations ("Saved", "Exported …") at the bottom of the screen. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = ++nextId;
    setToasts((current) => [...current.slice(-2), { id, text, tone }]);
    window.setTimeout(
      () => setToasts((current) => current.filter((toast) => toast.id !== id)),
      4000,
    );
  }, []);
  const value = useMemo(() => show, [show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="safe-bottom pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={cn(
              'pointer-events-auto flex max-w-md items-start gap-2 rounded-lg border bg-card px-4 py-3 text-sm shadow-lg',
              toast.tone === 'error' && 'border-red-200',
            )}
          >
            {toast.tone === 'ok' ? (
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-green-600" />
            ) : (
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-red-600" />
            )}
            {toast.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
