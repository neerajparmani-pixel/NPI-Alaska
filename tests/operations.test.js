import { test } from "node:test";
import assert from "node:assert/strict";
import {
  recordedHours,
  hasBothLocations,
  quantity,
  charge,
  eligible,
  approveHours,
} from "../public/operations/domain.js";
const point = (time) => ({ time, lat: 61.2, lng: -149.9, accuracy: 10 });
const sample = () => ({
  id: "W1",
  status: "npi-review",
  claimedHours: 7,
  loads: 3,
  sessions: [
    {
      in: point("2026-11-13T15:00:00Z"),
      out: point("2026-11-13T17:00:00Z"),
      breakMinutes: 0,
      members: ["a", "b", "c"],
    },
  ],
  rates: {
    customer: { basis: "visit", cents: 50000 },
    contractor: { basis: "hourly", cents: 4500 },
  },
});
test("subcontract: crew elapsed time, person-hours, breaks and missing checkout remain distinct", () => {
  const w = sample();
  assert.equal(recordedHours(w), 6);
  w.sessions[0].breakMinutes = 30;
  assert.equal(recordedHours(w), 4.5);
  w.sessions[0].out = null;
  assert.equal(recordedHours(w), 0);
  assert.equal(hasBothLocations(w), false);
});
test("subcontract: separate reviews preserve evidence and require adjustment reason", () => {
  const w = sample(),
    original = structuredClone(w.sessions);
  assert.throws(() =>
    approveHours({ ...w, status: "contractor-review" }, 6, "reason"),
  );
  assert.throws(() => approveHours(w, 6, ""));
  const a = approveHours(w, 6, "Recorded crew: 3 × 2 hours");
  assert.equal(a.acceptedHours, 6);
  assert.deepEqual(a.sessions, original);
  assert.equal(w.status, "npi-review");
});
test("subcontract: mixed pricing uses approved units and prevents duplicate allocation", () => {
  const w = approveHours(sample(), 6, "verified");
  assert.equal(charge(w, "customer"), 50000);
  assert.equal(charge(w, "contractor"), 27000);
  assert.equal(quantity(w, "fixed"), 1);
  assert.equal(quantity(w, "load"), 3);
  assert.equal(eligible([w], [{ workIds: ["W1"] }]).length, 0);
  assert.throws(() => charge(sample(), "customer"));
});
test("subcontract: both events require valid coordinates; zero coordinates are valid", () => {
  const w = sample();
  assert.equal(hasBothLocations(w), true);
  w.sessions[0].out.lat = undefined;
  assert.equal(hasBothLocations(w), false);
  w.sessions[0].out.lat = 0;
  w.sessions[0].out.lng = 0;
  assert.equal(hasBothLocations(w), true);
  w.sessions[0].in.lng = -181;
  assert.equal(hasBothLocations(w), false);
});

test("subcontract: overlapping attendance flags the shared worker", async () => {
  const { overlappingWorkers } = await import("../public/operations/domain.js");
  const w = sample(),
    other = {
      ...sample(),
      id: "W2",
      sessions: [{ ...sample().sessions[0], members: ["b", "other"] }],
    };
  assert.deepEqual(overlappingWorkers(w, [w, other]), ["b"]);
  other.sessions[0].in = point("2026-11-13T17:00:00Z");
  other.sessions[0].out = point("2026-11-13T18:00:00Z");
  assert.deepEqual(overlappingWorkers(w, [w, other]), []);
});
