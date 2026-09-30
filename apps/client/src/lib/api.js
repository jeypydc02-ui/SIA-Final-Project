// Screens only ever see errors; the app shell needs to know about two kinds
// that are not the screen's problem at all — the session ending (401) and the
// account being required to change its password first (403 with a flag) — so
// those are also announced as window events App listens for.
export const SESSION_ENDED = "fts:session-ended";
export const PASSWORD_CHANGE_REQUIRED = "fts:password-change-required";

export async function api(path, opts = {}) {
  const token = sessionStorage.getItem("fts_token");
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = "Bearer " + token;

  let res;
  try {
    res = await fetch(path, {
      method: opts.method || "GET",
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch (networkError) {
    // fetch only rejects when the request never reached the server. Marking it
    // lets callers tell "you are signed out" apart from "the server is not
    // answering", which are very different things to tell someone.
    const err = new Error("Could not reach the server. Check your connection and try again.");
    err.offline = true;
    throw err;
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
    if (res.status === 403 && data && data.mustChangePassword) {
      window.dispatchEvent(new Event(PASSWORD_CHANGE_REQUIRED));
    }
    throw err;
  }
  return data;
}
