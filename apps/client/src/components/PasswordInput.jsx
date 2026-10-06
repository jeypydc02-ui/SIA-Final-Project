import { useState } from "react";
import Icon from "./Icon.jsx";

// A password field with a show/hide button, so people can check what they
// typed — especially on a phone keyboard. Any other input props pass through.
export default function PasswordInput({ className, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={"password-field" + (className ? " " + className : "")}>
      <input {...props} type={visible ? "text" : "password"} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        title={visible ? "Hide password" : "Show password"}
      >
        <Icon name={visible ? "eyeOff" : "eye"} size={18} />
      </button>
    </div>
  );
}
