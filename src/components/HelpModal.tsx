import { useEffect, useRef, useCallback } from 'react';
import { X, HelpCircle, MousePointerClick, GripVertical } from 'lucide-react';

// =============================================================================
// Constants
// =============================================================================

/** localStorage key to track whether user has seen help on first visit */
const HELP_SEEN_KEY = 'marcacao-help-seen';

/** Help content sections — each maps to a UI interaction */
const HELP_SECTIONS = [
  {
    icon: MousePointerClick,
    title: 'Track Buttons',
    items: [
      'Click — add track to end of queue',
      'Double-click — insert as next in queue',
      'Triple-click — immediate mix (plays now)',
    ],
  },
  {
    icon: GripVertical,
    title: 'Queue Panel',
    items: [
      'Drag to reorder queued tracks',
      'Double-click a queued item to remove it',
      'X button also removes (hover to reveal)',
    ],
  },
  {
    title: 'Transport Controls',
    items: [
      'TALK — duck music volume for speaking',
      'BACK — restart current track from beginning',
      'NEXT — skip to the next queued track',
      'PAUSE / PLAY — pause with fade, resume with rewind',
    ],
  },
  {
    title: 'Settings (gear icon)',
    items: [
      'MIX / CUT — crossfade or quick-cut transitions',
      'Tempo Lock — time-stretch all tracks to same BPM',
      'Mix Duration — 1, 2, or 4 bar crossfade length',
      'When Queue Ends — auto-advance mode (BPM ↑ / BPM ↓ / stop)',
      'Clear Queue — two-step confirmation to clear all',
      'Theme — toggle light / dark mode',
    ],
  },
] as const;

// =============================================================================
// Hook: first-visit auto-show
// =============================================================================

/**
 * Returns true if this is the user's first visit (help not yet dismissed).
 * Marks help as seen when called with `markSeen()`.
 */
export function useFirstVisitHelp(): { isFirstVisit: boolean; markSeen: () => void } {
  const seen = localStorage.getItem(HELP_SEEN_KEY) === 'true';
  const markSeen = useCallback(() => {
    localStorage.setItem(HELP_SEEN_KEY, 'true');
  }, []);
  return { isFirstVisit: !seen, markSeen };
}

// =============================================================================
// Component
// =============================================================================

export interface HelpModalProps {
  /** Whether the modal is visible */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
}

/**
 * Help / onboarding modal.
 *
 * Displays interaction instructions grouped by UI area.
 * Adheres to:
 *   - IBM Carbon: 48px close button, productive-02 motion, 8px grid
 *   - WCAG AAA: focus trap, Escape to close, aria-modal, high-contrast text
 *   - Nielsen #10: Help & documentation — always accessible via ? button
 *
 * Auto-shown on first visit (localStorage flag). Can be re-opened from ControlBar.
 */
export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Focus trap: focus close button on open, return focus on close
  useEffect(() => {
    if (isOpen) {
      closeRef.current?.focus();
    }
  }, [isOpen]);

  // Escape key closes (Nielsen #3: user control)
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Click-outside closes
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-cap-ink/60 backdrop-blur-sm p-4
        motion-reduce:backdrop-blur-none"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Help — how to use Marcação Mestre"
        className="
          bg-cap-panel border border-cap-border rounded-2xl shadow-2xl
          w-full max-w-lg max-h-[85vh] overflow-y-auto
          animate-in fade-in zoom-in-95 duration-200
          motion-reduce:animate-none
        "
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cap-border sticky top-0 bg-cap-panel z-10">
          <div className="flex items-center gap-2">
            <HelpCircle size={20} className="text-cap-blue-vivid" />
            <h2 className="text-lg font-bold text-cap-text">How to Use</h2>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close help"
            className="
              p-2 rounded-lg min-h-[48px] min-w-[48px] flex items-center justify-center
              text-cap-muted hover:text-cap-text hover:bg-cap-btn-hover
              transition-colors
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cap-text
            "
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-5">
          {HELP_SECTIONS.map((section) => (
            <section key={section.title} aria-label={section.title}>
              <h3 className="text-sm font-bold text-cap-text uppercase tracking-wider mb-2 flex items-center gap-2">
                {'icon' in section && section.icon && <section.icon size={14} className="text-cap-muted" />}
                {section.title}
              </h3>
              <ul className="space-y-1 text-sm text-cap-text-sec" role="list">
                {section.items.map((item) => (
                  <li key={item} className="flex items-start gap-2" role="listitem">
                    <span className="text-cap-muted mt-0.5 flex-shrink-0" aria-hidden="true">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {/* Workflow hint */}
          <div className="bg-cap-bg rounded-lg px-4 py-3 border border-cap-border">
            <p className="text-sm font-semibold text-cap-text mb-1">Quick Start</p>
            <p className="text-sm text-cap-text-sec">
              Upload a ZIP of MP3s → click a track to start playing →
              click more tracks to build your queue → the app handles transitions automatically.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-cap-border">
          <button
            onClick={onClose}
            className="
              w-full py-3 rounded-lg text-base font-bold min-h-[48px]
              bg-cap-blue-vivid text-cap-paper hover:bg-cap-blue-vivid/90
              transition-colors
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cap-text focus-visible:ring-offset-2 focus-visible:ring-offset-cap-panel
            "
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
