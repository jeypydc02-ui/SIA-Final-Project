// JSON bodies can carry any type. A field that should be a string but arrives
// as an object or an array used to reach .trim() or bcrypt and surface as a 500;
// these checks turn it into the 400 it deserves.
function isString(v) {
  return typeof v === "string";
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

// A usable money amount: a finite number (or numeric string) above zero and
// within the same ceiling the schemas enforce. Checked up front so a workflow
// never gets halfway through before the database rejects the figure.
const MIN_AMOUNT = 0.01;
const MAX_AMOUNT = 1e12;
function parseAmount(v) {
  if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
  if (typeof v !== "number" && typeof v !== "string") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < MIN_AMOUNT || n > MAX_AMOUNT) return null;
  return n;
}

const PASSWORD_MIN = 8;
// Generous for passphrases, but bounded so nobody can make the server hash a
// megabyte of text on every attempt.
const PASSWORD_MAX = 128;

// Returns a message describing what is wrong with a proposed password, or null.
function passwordProblem(pw, label = "Password") {
  if (!isString(pw) || !pw) return `${label} is required.`;
  if (pw.length < PASSWORD_MIN) return `${label} must be at least ${PASSWORD_MIN} characters.`;
  if (pw.length > PASSWORD_MAX) return `${label} cannot be longer than ${PASSWORD_MAX} characters.`;
  return null;
}

module.exports = { isString, isNonEmptyString, parseAmount, passwordProblem, MAX_AMOUNT };
