import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// =============================================================================
// Service Worker registration (PWA offline support)
// =============================================================================

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(import.meta.env.BASE_URL + 'sw.js', {
        scope: import.meta.env.BASE_URL,
      })
      .then(reg => {
        console.log('[PWA] Service worker registered, scope:', reg.scope);
        // Check for updates periodically (every 60 min)
        setInterval(() => reg.update(), 60 * 60 * 1000);
      })
      .catch(err => console.warn('[PWA] Service worker registration failed:', err));
  });
}
