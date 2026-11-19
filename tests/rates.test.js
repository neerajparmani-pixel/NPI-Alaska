import { test } from "node:test";
import assert from "node:assert/strict";
import { validateRate, pricePreview } from "../public/three-view/rates.js";
const input = {
  side: "customer",
  site: "boney",
  task: "Snow clearing",
  basis: "hourly",
  amount: "25.99",
  from: "2026-11-01",
  to: "",
};
test("rate cents are exact; zero is valid; invalid dates and fractional cents fail", () => {
  assert.equal(validateRate(input).cents, 2599);
  assert.deepEqual(validateRate({ ...input, amount: "0" }).errors, {});
  for (const amount of ["-1", "1.001", "1e3", "Infinity", ""])
    assert.ok(validateRate({ ...input, amount }).errors["rate-amount"]);
  assert.ok(validateRate({ ...input, from: "2026-02-30" }).errors["rate-from"]);
});
test("overlapping rates cannot silently compete, with separate lists and companies", () => {
  const prior = { ...input, id: "one", company: "" };
  assert.ok(
    validateRate({ ...input, from: "2026-12-01" }, [prior]).errors["rate-from"],
  );
  assert.deepEqual(validateRate(input, [prior], "one").errors, {});
  assert.deepEqual(
    validateRate({ ...input, side: "subcontractor", company: "north" }, [prior])
      .errors,
    {},
  );
  assert.ok(
    validateRate({ ...input, side: "subcontractor" }).errors["rate-company"],
  );
});
test("quantity previews round cents; enforce whole visits/loads and single fixed service", () => {
  assert.equal(pricePreview({ cents: 2599, basis: "hourly" }, "1.75"), 4548);
  assert.throws(() => pricePreview({ cents: 100, basis: "per-load" }, "1.5"));
  assert.throws(() => pricePreview({ cents: 100, basis: "fixed" }, "2"));
  assert.throws(() => pricePreview({ cents: 100, basis: "hourly" }, "-1"));
});
