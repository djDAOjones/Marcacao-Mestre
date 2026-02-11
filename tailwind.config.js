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
          /* ── Neutral scale (dark → light) ── */
          black:   '#111111',  // Berimbau Black — body bg
          950:     '#1A1A1A',  // deep surface
          900:     '#1E1E1E',  // card / dropdown bg
          800:     '#2B2B2B',  // Charcoal — nav / sidebar
          700:     '#3D3D3D',  // buttons / borders
          600:     '#4A4A4A',  // button hover
          500:     '#6B6B6B',  // disabled text

          /* ── Warm text scale ── */
          sand:    '#D8C3A5',  // Arena Sand — muted labels
          cotton:  '#E8E2D5',  // Cord Cotton — secondary text
          white:   '#F7F7F4',  // Abadá White — primary text

          /* ── Accent: greens ── */
          green:       '#009C3B',  // Brazil Green — playing state
          'green-deep':'#2E7D32',  // Leaf Green — green backgrounds

          /* ── Accent: yellows / golds ── */
          yellow:  '#F4C300',  // Pastinha Yellow — BPM, queued
          gold:    '#C9A227',  // Ocre Dourado — muted yellow
          flag:    '#FFDF00',  // Flag Yellow — highlight

          /* ── Accent: blue ── */
          blue:    '#002776',  // Flag Blue — buttons

          /* ── Accent: reds ── */
          red:     '#C62828',  // Rasteira Red — alerts
          burgundy:'#6D213C',  // Atabaque Burgundy — deep accent

          /* ── Warm instrument tones ── */
          wood:    '#8B5E3C',  // Biriba Wood
          gourd:   '#C98A2E',  // Cabaça Gourd
          leather: '#5A3A22',  // Leather Strap
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
