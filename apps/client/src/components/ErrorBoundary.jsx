import { Component } from "react";

// Without this, any rendering error blanked the whole app to a white page.
// `inline` renders the message as a card inside the shell instead of a full page.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    console.error("[ui] screen failed to render:", error);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    const body = (
      <div className="empty">
        <div className="big">!</div>
        Something went wrong showing this page.{" "}
        <button className="linkbtn" onClick={() => window.location.assign("/dashboard")}>Go to the dashboard</button>
      </div>
    );
    return this.props.inline ? <div className="card">{body}</div> : <div className="boot">{body}</div>;
  }
}
