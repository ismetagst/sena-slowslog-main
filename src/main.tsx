import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Skip service worker on preview/iframe hosts to avoid stale caches.
const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();
const isPreviewHost =
  window.location.hostname.includes('id-preview--') ||
  window.location.hostname.includes('lovableproject.com');

if ('serviceWorker' in navigator) {
  if (isPreviewHost || isInIframe) {
    navigator.serviceWorker.getRegistrations().then((regs) =>
      regs.forEach((r) => r.unregister())
    );
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        // Check for updates every time the page loads
        reg.update().catch(() => {});

        // If a new SW is waiting, activate it immediately
        if (reg.waiting) {
          reg.waiting.postMessage('SKIP_WAITING');
        }

        // Listen for new SW installs and prompt activation
        reg.addEventListener('updatefound', () => {
          const newSW = reg.installing;
          if (!newSW) return;
          newSW.addEventListener('statechange', () => {
            if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
              newSW.postMessage('SKIP_WAITING');
            }
          });
        });
      }).catch(() => {});

      // Reload once when the new SW takes control. Guard with sessionStorage
      // so a misbehaving SW cannot trap the tab in a reload loop.
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        const key = 'sw-reloaded-at';
        const last = Number(sessionStorage.getItem(key) || 0);
        const now = Date.now();
        if (now - last < 5000) return; // debounce: ignore rapid repeats
        sessionStorage.setItem(key, String(now));
        refreshing = true;
        window.location.reload();
      });
    });
  }
}
