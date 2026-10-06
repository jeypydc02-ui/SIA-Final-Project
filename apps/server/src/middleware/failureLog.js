const { logFailure } = require("../services/audit");

// Integration log for failures (spec sections 7.6 and 15): every refused or
// failed change made by a signed-in person — a payment on a bill already
// paid, an invalid upload, a review of a receipt someone else already
// decided — is written to the audit log as a Failed line, with the error
// message the person saw and the id of the record involved.
//
// Reads are not logged (nothing changed), and neither are 401s: a request
// with no valid session has no one to attribute it to, and failed sign-ins
// are already logged by the login route itself.
function failureLog(req, res, next) {
  if (req.method === "GET") return next();
  const json = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 400 && res.statusCode !== 401 && req.user) {
      // Built from the address itself: by the time a database validation
      // error reaches the central error handler, Express has already
      // forgotten which router matched. Record ids become ":id".
      const route = req.originalUrl.split("?")[0].replace(/^\/api\//, "").replace(/[0-9a-f]{24}/gi, ":id");
      const reason = (body && body.error) || `HTTP ${res.statusCode}`;
      logFailure(req.user.name, `Failed: ${req.method} ${route}`, `${res.statusCode} — ${reason}`, req.params && req.params.id);
    }
    return json(body);
  };
  next();
}

module.exports = { failureLog };
