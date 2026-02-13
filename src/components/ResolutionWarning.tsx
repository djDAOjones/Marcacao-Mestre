/**
 * ResolutionWarning — Shows a dismissible warning when viewport is below
 * the minimum supported resolution (1024×768).
 *
 * Design: IBM Carbon inline notification pattern, WCAG AAA contrast.
 * Only shown once per session (dismissed state stored in sessionStorage).
 */

import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

const MIN_WIDTH = 1024;
const MIN_HEIGHT = 768;

export function ResolutionWarning() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Don't re-show if already dismissed this session
    if (sessionStorage.getItem('res-warning-dismissed')) return;

    const check = () => {
      const tooSmall = window.innerWidth < MIN_WIDTH || window.innerHeight < MIN_HEIGHT;
      setShow(tooSmall);
    };

    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (!show) return null;

  const handleDismiss = () => {
    setShow(false);
    sessionStorage.setItem('res-warning-dismissed', '1');
  };

  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center bg-cap-gold-vivid/95 text-cap-ink px-4 py-3"
    >
      <div className="flex items-center gap-3 max-w-xl">
        <AlertTriangle size={20} className="flex-shrink-0" />
        <p className="text-sm font-medium">
          Your screen ({window.innerWidth}×{window.innerHeight}) is below the minimum
          supported resolution of {MIN_WIDTH}×{MIN_HEIGHT}. Some elements may not display correctly.
        </p>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss resolution warning"
          className="flex-shrink-0 p-2 rounded min-h-[44px] min-w-[44px] flex items-center justify-center
                     hover:bg-cap-ink/10 transition-colors
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cap-ink"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
