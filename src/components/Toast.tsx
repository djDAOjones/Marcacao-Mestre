import { useState, useCallback, useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle, Info, X } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export type ToastVariant = 'error' | 'success' | 'info';

export interface ToastMessage {
  id: string;
  variant: ToastVariant;
  text: string;
}

// =============================================================================
// Hook: useToast
// =============================================================================

/** Auto-dismiss duration per variant (ms) */
const DISMISS_MS: Record<ToastVariant, number> = {
  error: 6000,
  success: 3000,
  info: 4000,
};

let toastCounter = 0;

/**
 * Hook providing toast state and push/dismiss methods.
 * Toasts auto-dismiss after a variant-dependent duration.
 *
 * Usage:
 *   const { toasts, pushToast, dismissToast } = useToast();
 *   pushToast('error', 'Something went wrong');
 */
export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const pushToast = useCallback((variant: ToastVariant, text: string) => {
    const id = `toast-${++toastCounter}`;
    const msg: ToastMessage = { id, variant, text };
    setToasts(prev => [...prev, msg]);

    // Auto-dismiss
    const timer = window.setTimeout(() => {
      dismissToast(id);
    }, DISMISS_MS[variant]);
    timers.current.set(id, timer);

    return id;
  }, [dismissToast]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      timers.current.forEach(t => clearTimeout(t));
    };
  }, []);

  return { toasts, pushToast, dismissToast };
}

// =============================================================================
// Component
// =============================================================================

const variantConfig: Record<ToastVariant, {
  icon: typeof AlertTriangle;
  bg: string;
  border: string;
  text: string;
  iconColor: string;
}> = {
  error: {
    icon: AlertTriangle,
    bg: 'bg-cap-red-vivid/10',
    border: 'border-cap-red',
    text: 'text-cap-text',
    iconColor: 'text-cap-red',
  },
  success: {
    icon: CheckCircle,
    bg: 'bg-cap-green-vivid/10',
    border: 'border-cap-green',
    text: 'text-cap-text',
    iconColor: 'text-cap-green',
  },
  info: {
    icon: Info,
    bg: 'bg-cap-blue-vivid/10',
    border: 'border-cap-blue-vivid',
    text: 'text-cap-text',
    iconColor: 'text-cap-blue-vivid',
  },
};

export interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

/**
 * Toast notification container — renders at top-center of viewport.
 *
 * Adheres to:
 *   - IBM Carbon: inline notification pattern, 48px dismiss target
 *   - WCAG AAA: role="status" for polite announcements, high contrast
 *   - Nielsen #1: Visibility of system status (user sees feedback)
 *   - Nielsen #9: Help users recognise & recover from errors
 */
export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-2 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 w-full max-w-md px-4"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map(toast => {
        const config = variantConfig[toast.variant];
        const Icon = config.icon;

        return (
          <div
            key={toast.id}
            role="status"
            className={`
              flex items-start gap-3 px-4 py-3 rounded-lg border-l-4
              ${config.bg} ${config.border}
              shadow-lg backdrop-blur-sm
              animate-in slide-in-from-top-2 fade-in duration-200
              motion-reduce:animate-none
            `}
          >
            <Icon size={18} className={`${config.iconColor} flex-shrink-0 mt-0.5`} aria-hidden="true" />
            <p className={`text-sm font-medium ${config.text} flex-1`}>{toast.text}</p>
            <button
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss notification"
              className="
                flex-shrink-0 p-2 rounded min-h-[44px] min-w-[44px]
                flex items-center justify-center
                text-cap-muted hover:text-cap-text
                transition-colors
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cap-text
              "
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
