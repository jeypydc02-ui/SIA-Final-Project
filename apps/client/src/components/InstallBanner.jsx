import { useEffect, useState } from "react";
import { canInstall, isInstalled, isIOS, promptInstall, onInstallChange } from "../lib/pwa.js";
import Icon from "./Icon.jsx";

// Suggests installing the app, the way installable sites do. Shown when the
// browser says the app can be installed (Chrome, Edge, Android), or on an
// iPhone/iPad in Safari, which has no install prompt of its own. "Not now"
// hides it for two weeks on this device.
const KEY = "fts_install_dismissed_at";
const QUIET_MS = 14 * 86400000;

function dismissedRecently() {
  try { return Date.now() - Number(localStorage.getItem(KEY) || 0) < QUIET_MS; } catch (e) { return false; }
}

export default function InstallBanner() {
  const [, rerender] = useState(0);
  const [hidden, setHidden] = useState(dismissedRecently);
  useEffect(() => onInstallChange(() => rerender((n) => n + 1)), []);

  if (hidden || isInstalled()) return null;
  const ios = isIOS();
  if (!canInstall() && !ios) return null;

  function dismiss() {
    try { localStorage.setItem(KEY, String(Date.now())); } catch (e) { /* private mode */ }
    setHidden(true);
  }

  return (
    <div className="install-banner" role="region" aria-label="Install the app">
      <span className="brand-logo">FS</span>
      <div className="install-text">
        <strong>Install FinTrack Stark</strong>
        <span>
          {ios
            ? <>Tap <b>Share</b> in Safari, then <b>Add to Home Screen</b>.</>
            : "Open it from your home screen like an app — it even opens without a connection."}
        </span>
      </div>
      {!ios && (
        <button type="button" className="btn small" onClick={promptInstall}>
          <Icon name="download" size={15} /> Install
        </button>
      )}
      <button type="button" className="btn small ghost" onClick={dismiss}>Not now</button>
    </div>
  );
}
