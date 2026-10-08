// Screens only ever see errors; the app shell also needs to know when the
// session itself has ended (401), which is not the screen's problem at all,
// so that is announced as a window event App listens for.
export const SESSION_ENDED = "fts:session-ended";
const REQUEST_TIMEOUT_MS = 60000;

export async function api(path, opts = {}) {
  const token = sessionStorage.getItem("fts_token");
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = "Bearer " + token;

  // A request the server never answers (a dead connection, a hung host) would
  // otherwise leave its button on "Saving…" for good. Generous, because free
  // hosting can take most of a minute to wake up after a quiet spell.
  const method = opts.method || "GET";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
  } catch (networkError) {
    // fetch only rejects when the request never reached the server. Marking it
    // lets callers tell "you are signed out" apart from "the server is not
    // answering", which are very different things to tell someone.
    const timedOut = networkError.name === "AbortError";
    const err = new Error(timedOut
      // A change that timed out may still have been saved; say so, rather
      // than invite a second save of the same thing.
      ? (method === "GET"
        ? "The server is taking too long to answer. Please try again."
        : "The server is taking too long to answer. Your change may still have been saved — check before trying again.")
      : "Could not reach the server. Check your connection and try again.");
    err.offline = true;
    throw err;
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  try { data = await res.json(); } catch (e) { /* empty body */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || ("Request failed (" + res.status + ")"));
    err.status = res.status;
    // The server flags a 401 that is about the session itself (expired, or
    // ended from another device). A wrong password typed into a form is also
    // a 401, but carries no flag, so it is not announced.
    if (res.status === 401 && data && data.sessionEnded && !opts.quiet) {
      window.dispatchEvent(new Event(SESSION_ENDED));
    }
    throw err;
  }
  return data;
}
