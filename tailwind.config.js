/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
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
