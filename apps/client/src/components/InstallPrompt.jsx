import { useEffect, useState } from "react";
import { canInstall, isInstalled, isIOS, promptInstall, onInstallChange } from "../lib/pwa.js";
import Icon from "./Icon.jsx";

// "Install this app" pop-up. Browsers do not open an install dialog on their
// own (desktop Chrome only shows a small icon in the address bar), so the app
// offers it itself: a card that slides in a few seconds after the page opens,
// on the landing page and inside the app alike.
//
// Shown when the browser reports the app can be installed (Chrome, Edge,
// Samsung Internet, Android), or on iPhone/iPad, where Safari has no install
// prompt and the card explains Share -> Add to Home Screen instead.
// "Not now" keeps it away for two weeks on this device.
const KEY = "fts_install_dismissed_at";
const QUIET_MS = 14 * 86400000;
const DELAY_MS = 3000;

function dismissedRecently() {
  try { return Date.now() - Number(localStorage.getItem(KEY) || 0) < QUIET_MS; } catch (e) { return false; }
}

export default function InstallPrompt() {
  const [, rerender] = useState(0);
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(dismissedRecently);

  useEffect(() => onInstallChange(() => rerender((n) => n + 1)), []);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  if (!ready || dismissed || isInstalled()) return null;
  const ios = isIOS();
  if (!canInstall() && !ios) return null;

  function close() {
    try { localStorage.setItem(KEY, String(Date.now())); } catch (e) { /* private mode */ }
    setDismissed(true);
  }
  async function install() {
    const accepted = await promptInstall();
    if (!accepted) close();
  }

  return (
    <div className="install-pop" role="dialog" aria-modal="false" aria-labelledby="install-pop-title">
      <button type="button" className="install-pop-x" onClick={close} aria-label="Close">×</button>
      <div className="install-pop-head">
        <img src="/icons/icon-192.png" alt="" width="48" height="48" />
        <div>
          <div id="install-pop-title" className="install-pop-title">Install FinTrack Stark</div>
          <div className="install-pop-sub">Add it to your home screen or desktop</div>
        </div>
      </div>
      <ul className="install-pop-list">
        <li><Icon name="check" size={16} /> Opens in its own window, like an app</li>
        <li><Icon name="check" size={16} /> Still opens without a connection</li>
        <li><Icon name="check" size={16} /> No app store, no extra download</li>
      </ul>
      {ios ? (
        <div className="install-pop-ios">
          Tap <b>Share</b> <span aria-hidden="true">⎙</span> in Safari, then <b>Add to Home Screen</b>.
          <button type="button" className="pill outline" onClick={close}>Got it</button>
        </div>
      ) : (
        <div className="install-pop-actions">
          <button type="button" className="pill outline" onClick={close}>Not now</button>
          <button type="button" className="pill" onClick={install}><Icon name="download" size={16} /> Install</button>
        </div>
      )}
    </div>
  );
}
