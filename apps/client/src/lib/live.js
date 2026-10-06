// Live updates: keeps a Server-Sent Events stream open to /api/events and
// calls onChange whenever the server says something the user can see has
// changed (a notification arrived, an entry or bill changed, …). The app then
// reloads its data, so screens update without pressing refresh — the way a
// chat app shows a new message.
//
// fetch() is used instead of EventSource so the session token can travel in
// the Authorization header rather than in the URL. If the stream drops (lost
// signal, the phone slept, the server restarted) it reconnects with a growing
// pause, and reports when it reconnects so the caller can catch up on anything
// missed in between.
export function connectLive(token, { onChange, onReconnect }) {
  const controller = new AbortController();
  let attempt = 0;
  let stopped = false;

  async function run() {
    while (!stopped) {
      try {
        const res = await fetch("/api/events", {
          headers: { Authorization: "Bearer " + token, Accept: "text/event-stream" },
          signal: controller.signal,
          cache: "no-store",
        });
        // The session is over; the next normal request will show the sign-in dialog.
        if (res.status === 401 || res.status === 403) return;
        if (!res.ok || !res.body) throw new Error("stream unavailable");

        if (attempt > 0 && onReconnect) onReconnect();
        attempt = 0;
        await read(res.body.getReader());
      } catch (err) {
        if (stopped || err.name === "AbortError") return;
      }
      // Wait before reconnecting: 1s, 2s, 5s, 10s, then every 20s.
      const waits = [1000, 2000, 5000, 10000, 20000];
      await new Promise((r) => setTimeout(r, waits[Math.min(attempt, waits.length - 1)]));
      attempt += 1;
    }
  }

  async function read(reader) {
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      // Events are separated by a blank line.
      let split;
      while ((split = buffer.indexOf("\n\n")) >= 0) {
        const block = buffer.slice(0, split);
        buffer = buffer.slice(split + 2);
        const event = /^event: (.*)$/m.exec(block);
        const data = /^data: (.*)$/m.exec(block);
        if (event && event[1] === "change") {
          let payload = {};
          try { payload = JSON.parse(data ? data[1] : "{}"); } catch (e) { /* ignore */ }
          onChange(payload);
        }
      }
    }
  }

  run();
  return () => {
    stopped = true;
    controller.abort();
  };
}
