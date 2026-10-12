const Bill = require("../models/Bill");
const Transaction = require("../models/Transaction");
const { logAction } = require("./audit");
const { notify } = require("./notifications");
const { checkBudget } = require("./budgetAlerts");
const { publish } = require("./events");
const { todayISO, nextMonthlyDueISO } = require("../utils/dates");

const dayOf = (iso) => Number(String(iso).slice(8, 10));

// Marks a bill Paid and records the matching expense. This is the old "Mark
// Paid" logic, moved here: it now runs only AFTER an Approver approved the
// request and the gateway confirmed the payment.
//
//   owner    { id, name }  whose bill and money it is
//   approver { id, name }  who approved the request
//   gatewayRef             the gateway's reference, kept in the audit detail
//
// Returns { bill, transaction, nextBill }, or null if the bill was already paid
// or no longer exists.
async function settleBill(billId, amount, owner, approver, gatewayRef) {
  const paidOn = todayISO();
  // Claim the bill atomically: two callbacks can never produce two expenses.
  const claimed = await Bill.findOneAndUpdate(
    { _id: billId, paid: false },
    { $set: { paid: true, paidOn, paidAmount: amount } },
    { new: true }
  );
  if (!claimed) return null;

  let tx;
  try {
    tx = await Transaction.create({
      type: "Expense",
      category: claimed.category,
      amount,
      date: paidOn,
      note: `Bill payment: ${claimed.name}`,
      status: "Approved",
      autoApproved: true,
      submittedBy: owner.id,
      reviewedBy: approver.id,
      reviewComment: `Approved by ${approver.name}; confirmed by the simulated gateway.`,
    });
  } catch (err) {
    // A bill must never read Paid without the payment behind it.
    await Bill.updateOne({ _id: claimed._id }, { $set: { paid: false, paidOn: null, paidAmount: null } });
    throw err;
  }

  let nextBill = null;
  if (claimed.repeat === "monthly") {
    try {
      nextBill = await Bill.create({
        name: claimed.name,
        category: claimed.category,
        amount: claimed.amount,
        due: nextMonthlyDueISO(claimed.due, claimed.repeatDay || dayOf(claimed.due)),
        createdBy: claimed.createdBy,
        repeat: "monthly",
        repeatDay: claimed.repeatDay || dayOf(claimed.due),
        previousBill: claimed._id,
      });
    } catch (err) {
      console.error("[settle] could not schedule the next monthly bill:", err.message);
    }
  }

  await notify(
    "payment",
    `Payment confirmed for "${claimed.name}" — status updated to Paid.` +
      (nextBill ? ` Next bill scheduled for ${nextBill.due}.` : ""),
    owner.id
  );
  // Logged under the owner so it shows on their My Activity feed.
  await logAction(
    owner,
    "Payment Recorded",
    `${claimed.name} (${claimed._id}) marked Paid, amount ${amount}. Approved by ${approver.name}; gateway ref ${gatewayRef} (simulated). Expense entry ${tx._id}.` +
      (nextBill ? ` Next monthly bill due ${nextBill.due}.` : ""),
    { ref: claimed._id, scope: "user" }
  );
  await checkBudget(tx);
  publish(owner.id, "bills");
  return { bill: claimed, transaction: tx, nextBill };
}

module.exports = { settleBill };