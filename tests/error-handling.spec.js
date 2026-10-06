const { test, expect } = require("@playwright/test");
const { PNG, pngBody, entryWithReceipt } = require("./receipt-helpers");
const { api, accounts, signIn, gotoScreen } = require("./helpers");

// Error-handling test cases (spec section 16: minimum 5), covering what
// section 7.5 asks for: missing, invalid, duplicate, and failed data.

test.describe("Error handling", () => {
  test("ET-01 missing required fields are rejected with a usable message", async () => {
    const { user } = accounts();

    const noName = await api("/api/bills", { method: "POST", token: user.token, body: { category: "Utilities", amount: 100, due: "2026-12-01" } });
    expect(noName.status).toBe(400);
    expect(noName.data.error).toContain("required");

    const noType = await api("/api/transactions", { method: "POST", token: user.token, body: { category: "Food", amount: 50 } });
    expect(noType.status).toBe(400);
    expect(noType.data.error).toContain("Income or Expense");
  });

  test("ET-02 invalid amounts are rejected at the boundary", async () => {
    const { user } = accounts();
    const base = { name: "Bad Amount", category: "Utilities", due: "2026-12-01" };

    const negative = await api("/api/bills", { method: "POST", token: user.token, body: { ...base, amount: -100 } });
    expect(negative.status).toBe(400);

    const zero = await api("/api/bills", { method: "POST", token: user.token, body: { ...base, amount: 0 } });
    expect(zero.status).toBe(400);

    const text = await api("/api/bills", { method: "POST", token: user.token, body: { ...base, amount: "abc" } });
    expect(text.status).toBe(400);
  });

  test("ET-03 duplicate data is refused and the reason is explained", async ({ page }) => {
    const { user } = accounts();

    // "Food" is already budgeted for this account by the seed.
    const dupe = await api("/api/budgets", { method: "POST", token: user.token, body: { category: "Food", limit: 1000 } });
    expect(dupe.status).toBe(409);
    expect(dupe.data.error).toContain("already have a budget");

    // And the message reaches the user rather than failing silently.
    await signIn(page, "user");
    await gotoScreen(page, "Budgets");
    await expect(page.locator(".card", { hasText: "Food" }).first()).toBeVisible();
  });

  test("ET-04 a malformed record id returns 400, not a crash or a hang", async () => {
    const { user } = accounts();

    const badVersion = await api("/api/transactions/not-a-real-id/versions", { token: user.token });
    expect(badVersion.status).toBe(400);
    expect(badVersion.data.error).toContain("not valid");

    const badBill = await api("/api/bills/12345/pay", { method: "POST", token: user.token, body: { amount: 10 } });
    expect(badBill.status).toBe(400);

    // A well-formed id that does not exist is a 404, not a 400.
    const missing = await api("/api/bills/507f1f77bcf86cd799439011", { method: "PUT", token: user.token, body: { amount: 10 } });
    expect(missing.status).toBe(404);
  });

  test("ET-05 an invalid workflow transition is refused", async () => {
    const { user } = accounts();

    // A bill cannot be paid twice.
    const bill = await api("/api/bills", {
      method: "POST", token: user.token,
      body: { name: "Double Pay Guard", category: "Credit", amount: 500, due: "2026-12-01" },
    });
    const first = await api(`/api/bills/${bill.data._id}/pay`, { method: "POST", token: user.token, body: { amount: 500 } });
    expect(first.status).toBe(200);
    const second = await api(`/api/bills/${bill.data._id}/pay`, { method: "POST", token: user.token, body: { amount: 500 } });
    expect(second.status).toBe(400);
    expect(second.data.error).toContain("already marked as paid");

    // The expense that payment created follows its bill: it cannot be edited
    // or deleted on its own.
    const fromBill = first.data.transaction._id;
    expect((await api(`/api/transactions/${fromBill}`, { method: "PUT", token: user.token, body: { amount: 1 } })).status).toBe(400);
    expect((await api(`/api/transactions/${fromBill}`, { method: "DELETE", token: user.token })).status).toBe(400);

    // An earlier version cannot be edited, and a deleted entry cannot be
    // deleted again.
    const tx = await api("/api/transactions", {
      method: "POST", token: user.token,
      body: { type: "Expense", category: "Food", amount: 120, note: "transition guard" },
    });
    const v2 = await api(`/api/transactions/${tx.data._id}`, { method: "PUT", token: user.token, body: { amount: 130 } });
    expect(v2.status).toBe(200);
    const editOld = await api(`/api/transactions/${tx.data._id}`, { method: "PUT", token: user.token, body: { amount: 140 } });
    expect(editOld.status).toBe(400);
    expect(editOld.data.error).toContain("can no longer be changed");
    expect((await api(`/api/transactions/${v2.data._id}`, { method: "DELETE", token: user.token })).status).toBe(200);
    expect((await api(`/api/transactions/${v2.data._id}`, { method: "DELETE", token: user.token })).status).toBe(400);
  });

  test("ET-06 invalid uploads are refused with a reason, and nothing is saved", async () => {
    const { user } = accounts();
    const entry = (await api("/api/transactions", { method: "POST", token: user.token, body: { type: "Expense", category: "Food", amount: 75 } })).data;
    const bad = [
      [{ kind: "file", mimeType: "application/x-msdownload", data: PNG.toString("base64") }, /photo .* or a PDF/],
      [{ kind: "file", mimeType: "image/png", data: Buffer.from("MZ this is a program").toString("base64") }, /not really a photo/],
      [{ kind: "file", mimeType: "application/pdf", data: PNG.toString("base64") }, /not really a PDF/],
      [{ kind: "file", mimeType: "image/png", data: Buffer.concat([PNG, Buffer.alloc(2.1 * 1024 * 1024)]).toString("base64") }, /larger than 2 MB/],
      [{ kind: "file", mimeType: "image/png", data: "" }, /Choose a file/],
      [{ kind: "link", url: "http://drive.google.com/insecure" }, /https/],
      [{ kind: "link", url: "javascript:alert(1)" }, /https/],
      [{ kind: "link", url: "not a link" }, /not a valid web address/],
      [{ kind: "carrier-pigeon" }, /file or a link/],
    ];
    for (const [body, message] of bad) {
      const res = await api("/api/receipts", { method: "POST", token: user.token, body: { ...body, transactionId: entry._id } });
      expect(res.status, JSON.stringify(body).slice(0, 60)).toBe(400);
      expect(res.data.error).toMatch(message);
    }
    const mine = await api("/api/receipts", { token: user.token });
    expect(mine.data.some((r) => String(r.entryId) === entry._id)).toBe(false);

    // A deleted entry cannot be given a receipt.
    await api(`/api/transactions/${entry._id}`, { method: "DELETE", token: user.token });
    const late = await api("/api/receipts", { method: "POST", token: user.token, body: { ...pngBody(), transactionId: entry._id } });
    expect(late.status).toBe(400);
  });

  test("ET-07 a failed review is refused cleanly and written to the log as Failed", async () => {
    const { user, admin } = accounts();
    const { receipt } = await entryWithReceipt(user.token);
    const id = receipt.data._id;
    // A note is required to send back or reject.
    const noNote = await api(`/api/receipts/${id}/review`, { method: "POST", token: admin.token, body: { action: "reject" } });
    expect(noNote.status).toBe(400);
    expect((await api(`/api/receipts/${id}/review`, { method: "POST", token: admin.token, body: { action: "approve-ish" } })).status).toBe(400);
    // Decided once; a second decision is refused.
    expect((await api(`/api/receipts/${id}/review`, { method: "POST", token: admin.token, body: { action: "verify" } })).status).toBe(200);
    const again = await api(`/api/receipts/${id}/review`, { method: "POST", token: admin.token, body: { action: "reject", note: "late" } });
    expect(again.status).toBe(409);
    // A verified receipt is final.
    const replace = await api("/api/receipts", { method: "POST", token: user.token, body: { ...receipt.data, ...pngBody(), transactionId: receipt.data.entryId } });
    expect(replace.status).toBe(409);
    // The refusals are in the integration log with status, reason and record id.
    const failed = await api("/api/audit-log?status=Failed", { token: admin.token });
    const line = failed.data.find((l) => l.ref === id && /409/.test(l.detail));
    expect(line).toBeTruthy();
    expect(line.status).toBe("Failed");
    expect(line.detail).toMatch(/already decided/);
  });
});
