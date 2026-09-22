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
    throw err;
  }
  return data;
}
