const crypto = require("crypto");
const { promisify } = require("util");
const bcrypt = require("bcryptjs");

const scrypt = promisify(crypto.scrypt);

// Password hashing uses Node's built-in scrypt. bcryptjs is pure JavaScript and
// runs on the main thread: under load test, 100 simultaneous logins took 13
// seconds each and stalled every other request behind them. scrypt runs in
// libuv's thread pool, so the API keeps answering while passwords are checked.
//
// Stored format: scrypt$N$r$p$<salt b64>$<hash b64>. Hashes created before the
// switch start with "$2" (bcrypt); they still verify, and are upgraded to
// scrypt the next time their owner logs in successfully.
const N = 16384, R = 8, P = 1, KEYLEN = 64;

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, KEYLEN, { N, r: R, p: P });
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

// Returns { ok, needsRehash }.
async function verifyPassword(password, stored) {
  if (typeof password !== "string" || typeof stored !== "string") return { ok: false, needsRehash: false };

  if (stored.startsWith("$2")) {
    const ok = await bcrypt.compare(password, stored);
    return { ok, needsRehash: ok };
  }

  const [scheme, n, r, p, saltB64, keyB64] = stored.split("$");
  if (scheme !== "scrypt") return { ok: false, needsRehash: false };
  const expected = Buffer.from(keyB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(n), r: Number(r), p: Number(p),
  });
  const ok = actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  return { ok, needsRehash: ok && (Number(n) !== N || Number(r) !== R || Number(p) !== P) };
}

// A hash of a random string, compared against when the email is unknown, so
// "no such account" takes as long as "wrong password" and response timing
// does not reveal which addresses are registered.
let dummyHash = null;
async function burnTime(password) {
  if (!dummyHash) dummyHash = await hashPassword(crypto.randomBytes(16).toString("hex"));
  await verifyPassword(typeof password === "string" ? password : "", dummyHash);
}

module.exports = { hashPassword, verifyPassword, burnTime };
