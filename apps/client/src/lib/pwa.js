// Progressive web app wiring: the service worker, and the browser's
// "install this app" prompt.

// Chrome and Edge fire beforeinstallprompt once, early, when the app is
// installable. It is kept here so Settings can offer an Install button later.
let deferredPrompt = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

export function setupPwa() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });

  // Only the production build registers the worker: in development Vite
  // serves files that change constantly, and a cache would hide the changes.
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("[pwa] service worker registration failed:", err);
      });
    });
  }
}

export const canInstall = () => !!deferredPrompt;

export function isInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export async function promptInstall() {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  notify();
  return outcome === "accepted";
}

export function onInstallChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
