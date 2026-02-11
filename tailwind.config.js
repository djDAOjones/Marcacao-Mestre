/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cap: {
          /* ── Adaptive neutrals (CSS vars, swap in light / dark) ── */
          bg:          'rgb(var(--cap-bg) / <alpha-value>)',
          surface:     'rgb(var(--cap-surface) / <alpha-value>)',
          panel:       'rgb(var(--cap-panel) / <alpha-value>)',
          btn:         'rgb(var(--cap-btn) / <alpha-value>)',
          'btn-hover': 'rgb(var(--cap-btn-hover) / <alpha-value>)',
          border:      'rgb(var(--cap-border) / <alpha-value>)',
          'border-sub':'rgb(var(--cap-border-sub) / <alpha-value>)',
          text:        'rgb(var(--cap-text) / <alpha-value>)',
          'text-sec':  'rgb(var(--cap-text-sec) / <alpha-value>)',
          muted:       'rgb(var(--cap-muted) / <alpha-value>)',
          disabled:    'rgb(var(--cap-disabled) / <alpha-value>)',

          /* ── Adaptive accents (CSS vars, contrast-adjusted per theme) ── */
          green:       'rgb(var(--cap-green) / <alpha-value>)',
          'green-deep':'rgb(var(--cap-green-deep) / <alpha-value>)',
          yellow:      'rgb(var(--cap-yellow) / <alpha-value>)',
          gold:        'rgb(var(--cap-gold) / <alpha-value>)',
          flag:        'rgb(var(--cap-flag) / <alpha-value>)',
          blue:        'rgb(var(--cap-blue) / <alpha-value>)',
          red:         'rgb(var(--cap-red) / <alpha-value>)',
          burgundy:    'rgb(var(--cap-burgundy) / <alpha-value>)',
          wood:        'rgb(var(--cap-wood) / <alpha-value>)',
          gourd:       'rgb(var(--cap-gourd) / <alpha-value>)',
          leather:     'rgb(var(--cap-leather) / <alpha-value>)',

          /* ── Vivid accent backgrounds (fixed, theme-independent) ── */
          'green-vivid':      '#009C3B',
          'green-deep-vivid': '#2E7D32',
          'gold-vivid':       '#C9A227',
          'blue-vivid':       '#002776',
          'red-vivid':        '#C62828',
          'gourd-vivid':      '#C98A2E',
          'burgundy-vivid':   '#6D213C',

          /* ── Fixed neutrals (always same regardless of theme) ── */
          ink:   '#111111',   // always dark (text on vivid buttons)
          paper: '#F7F7F4',   // always light (text on vivid buttons)
        },
      },
      keyframes: {
        'queue-enter': {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'queue-exit': {
          '0%': { opacity: '1', maxHeight: '64px', paddingTop: '0.5rem', paddingBottom: '0.5rem' },
          '100%': { opacity: '0', maxHeight: '0px', paddingTop: '0px', paddingBottom: '0px' },
        },
      },
      animation: {
        'queue-enter': 'queue-enter 200ms cubic-bezier(0.2, 0, 0.38, 0.9)',
        'queue-exit': 'queue-exit 200ms cubic-bezier(0.2, 0, 0.38, 0.9) forwards',
      },
    },
  },
  plugins: [],
}
