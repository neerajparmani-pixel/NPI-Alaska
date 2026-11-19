// Decimal prices are stored as integer cents. No real rates are seeded.
export function validateRate(input, existing = [], ignoreId = null) {
  const errors = {};
  if (!["customer", "subcontractor"].includes(input.side))
    errors["rate-side"] = "Choose the price list.";
  if (!input.site) errors["rate-site"] = "Choose a location.";
  if (!input.task?.trim())
    errors["rate-task"] = "Enter the task or service name.";
  if (!["hourly", "fixed", "per-visit", "per-load"].includes(input.basis))
    errors["rate-basis"] = "Choose a billing unit.";
  if (input.side === "subcontractor" && !input.company)
    errors["rate-company"] = "Choose the subcontractor.";
  const amount = String(input.amount).trim();
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(amount))
    errors["rate-amount"] =
      "Enter a price from 0 to 9,999,999.99 with at most two decimals.";
  const validDate = (v) =>
    /^\d{4}-\d{2}-\d{2}$/.test(v || "") &&
    Number.isFinite(Date.parse(v + "T12:00:00Z")) &&
    new Date(v + "T12:00:00Z").toISOString().slice(0, 10) === v;
  if (!validDate(input.from))
    errors["rate-from"] = "Choose a valid start date.";
  if (input.to && (!validDate(input.to) || input.to < input.from))
    errors["rate-to"] = "End date must be on or after the start date.";
  if (
    !Object.keys(errors).length &&
    existing.some(
      (r) =>
        r.id !== ignoreId &&
        r.side === input.side &&
        r.site === input.site &&
        r.task.trim().toLowerCase() === input.task.trim().toLowerCase() &&
        r.basis === input.basis &&
        (r.company || "") ===
          (input.side === "customer" ? "" : input.company) &&
        r.from <= (input.to || "9999-12-31") &&
        input.from <= (r.to || "9999-12-31"),
    )
  )
    errors["rate-from"] =
      "These dates overlap another rate for this location, task and price list. Adjust the effective dates.";
  const cents = /^\d{1,7}(\.\d{1,2})?$/.test(amount)
    ? Number(amount.split(".")[0]) * 100 +
      Number((amount.split(".")[1] || "").padEnd(2, "0"))
    : 0;
  return { errors, cents };
}
export function pricePreview(rate, quantity) {
  const value = String(quantity).trim();
  if (!/^\d{1,7}(\.\d{1,4})?$/.test(value) || Number(value) <= 0)
    throw Error("Enter a positive quantity with at most four decimals.");
  if (
    ["per-load", "per-visit"].includes(rate.basis) &&
    !Number.isInteger(Number(value))
  )
    throw Error("Loads and visits must be whole numbers.");
  if (rate.basis === "fixed" && Number(value) !== 1)
    throw Error("Use quantity 1 for a fixed service.");
  const scaled =
    Number(value.split(".")[0]) * 10000 +
    Number((value.split(".")[1] || "").padEnd(4, "0"));
  const total = (BigInt(rate.cents) * BigInt(scaled) + 5000n) / 10000n;
  if (total > BigInt(Number.MAX_SAFE_INTEGER))
    throw Error("This amount is too large.");
  return Number(total);
}
