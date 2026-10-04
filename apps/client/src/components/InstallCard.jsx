import { useEffect, useState } from "react";
import { canInstall, isInstalled, isIOS, promptInstall, onInstallChange } from "../lib/pwa.js";

// Lets people add FinTrack Stark to their home screen or desktop like an app.
// Chrome, Edge and Android offer a real install button; iPhone Safari has no
// such prompt, so it gets the Share-menu instructions instead.
export default function InstallCard() {
  const [, rerender] = useState(0);
  useEffect(() => onInstallChange(() => rerender((n) => n + 1)), []);

  let body;
  if (isInstalled()) {
    body = <p className="hint" style={{ marginTop: 0 }}>FinTrack Stark is installed on this device. You are using the app version.</p>;
  } else if (canInstall()) {
    body = (
      <>
        <p className="hint" style={{ marginTop: 0 }}>Add FinTrack Stark to your home screen or desktop. It opens in its own window, like any other app.</p>
        <button type="button" className="btn" onClick={promptInstall}>Install app</button>
      </>
    );
  } else if (isIOS()) {
    body = <p className="hint" style={{ marginTop: 0 }}>On iPhone or iPad: tap the <strong>Share</strong> button in Safari, then <strong>Add to Home Screen</strong>.</p>;
  } else {
    body = <p className="hint" style={{ marginTop: 0 }}>Open this site in Chrome or Edge to install it as an app. On a phone, use the browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p>;
  }

  return (
    <div className="card">
      <h3>Install the App</h3>
      {body}
    </div>
  );
}
