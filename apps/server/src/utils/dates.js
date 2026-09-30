// Every date in this system is a calendar date (YYYY-MM-DD) as the people
// using it see it, which is Philippine time. new Date().toISOString() gives the
// UTC date instead, and between midnight and 8 AM in Manila that is still
// yesterday — bills showed as "Due Today" a day late and payments were stamped
// with the wrong day. APP_TIMEZONE lets another deployment pick its own zone.
const APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Manila";

// en-CA formats as YYYY-MM-DD, which is exactly the stored shape.
const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
});

function todayISO(now = new Date()) {
  return formatter.format(now);
}

// Calendar arithmetic done in UTC so it never picks up the host's offset.
function addDaysISO(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// The same day of the next month, for monthly bills. `anchorDay` is the day
// the bill was first due, so a bill due on the 31st falls on the 30th in a
// 30-day month and returns to the 31st afterwards instead of drifting to the
// 28th for good after February.
function nextMonthlyDueISO(iso, anchorDay) {
  const [y, m] = iso.split("-").map(Number);
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const daysInNext = new Date(Date.UTC(nextY, nextM, 0)).getUTCDate();
  const day = Math.min(anchorDay, daysInNext);
  return `${nextY}-${String(nextM).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysBetweenISO(fromISO, toISO) {
  const [a, b] = [fromISO, toISO].map((iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  });
  return Math.round((a - b) / 86400000);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Catches 2026-02-30 and 2026-13-01, which JavaScript would otherwise roll
// over into a different, valid-looking date.
function isRealDate(v) {
  if (typeof v !== "string" || !ISO_DATE.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

module.exports = { APP_TIMEZONE, todayISO, addDaysISO, nextMonthlyDueISO, daysBetweenISO, isRealDate };
