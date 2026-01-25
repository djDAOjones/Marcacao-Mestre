import { useRef, useCallback } from 'react';

export type ClickType = 'single' | 'double' | 'triple';

interface UseMultiClickOptions {
  delay?: number; // ms to wait before confirming click count
  onSingleClick?: () => void;
  onDoubleClick?: () => void;
  onTripleClick?: () => void;
}

/**
 * Hook to detect single, double, and triple clicks
 * Waits for `delay` ms after last click to determine final click count
 */
export function useMultiClick({
  delay = 300,
  onSingleClick,
  onDoubleClick,
  onTripleClick,
}: UseMultiClickOptions) {
  const clickCount = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = useCallback(() => {
    clickCount.current += 1;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Triple click - execute immediately
    if (clickCount.current >= 3) {
      clickCount.current = 0;
      onTripleClick?.();
      return;
    }

    // Wait to see if more clicks come
    timeoutRef.current = setTimeout(() => {
      const count = clickCount.current;
      clickCount.current = 0;

      if (count === 1) {
        onSingleClick?.();
      } else if (count === 2) {
        onDoubleClick?.();
      }
    }, delay);
  }, [delay, onSingleClick, onDoubleClick, onTripleClick]);

  return handleClick;
}
