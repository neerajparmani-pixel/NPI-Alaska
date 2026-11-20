import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import crypto from "node:crypto";
const code = fs.readFileSync("setup/google-sheets/LiveSync.gs", "utf8");
const record = {
  id: "90000000-0000-0000-0000-000000000001",
  version: 3,
  planned_date: "2026-11-19",
  equipment: "Loader 01",
  status: "draft",
};
function harness(actor = "owner@npi.test") {
  const props = new Map([["NPI_SHEETS_TOKEN", "s".repeat(48)]]),
    requests = [];
  const rows = [
    Array(18).fill("Header"),
    [
      "npi_work_orders",
      record.id,
      "Work",
      "",
      "",
      "",
      "",
      "draft",
      record.planned_date,
      "Loader 02",
      "",
      "",
      "",
      "",
      "",
      "",
      3,
      JSON.stringify(record),
    ],
  ];
  const sheet = (values) => ({
    getLastRow: () => values.length,
    getLastColumn: () => values[0].length,
    getRange: (row, col, count, width) => ({
      getDisplayValues: () =>
        values
          .slice(row - 1, row - 1 + count)
          .map((r) => r.slice(col - 1, col - 1 + width)),
    }),
  });
  const tabs = { Work: sheet(rows) };
  const book = {
    getId: () => "1FJkmwHbZaNLwT4awsSshJpysi95dwBtOOKadig_Ibz8",
    getSheetByName: (n) => tabs[n],
    toast() {},
  };
  const context = vm.createContext({
    SpreadsheetApp: { getActiveSpreadsheet: () => book, openById: () => book },
    DriveApp: {
      getFileById: () => ({
        getOwner: () => ({ getEmail: () => "owner@npi.test" }),
      }),
    },
    Session: { getEffectiveUser: () => ({ getEmail: () => actor }) },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => props.get(k),
        setProperty: (k, v) => props.set(k, v),
      }),
    },
    LockService: {
      getDocumentLock: () => ({ tryLock: () => true, releaseLock() {} }),
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: "sha256" },
      computeDigest: (_, s) => [
        ...crypto.createHash("sha256").update(s).digest(),
      ],
      getUuid: () => crypto.randomUUID(),
    },
    UrlFetchApp: {
      fetch: (url, opts) => {
        const body = JSON.parse(opts.payload);
        requests.push({ url, opts, body });
        return {
          getResponseCode: () => 200,
          getContentText: () =>
            JSON.stringify({ id: body.change?.id, status: "pending" }),
        };
      },
    },
  });
  vm.runInContext(code, context);
  return { context, requests, rows, props };
}
test("live workbook submits only permitted versioned fields and reuses proposal identity", () => {
  const h = harness();
  h.context.npiSubmitLive();
  h.context.npiSubmitLive();
  assert.equal(h.requests.length, 2);
  const a = h.requests[0].body.change,
    b = h.requests[1].body.change;
  assert.equal(a.id, b.id);
  assert.equal(a.expected_version, 3);
  assert.equal(a.proposal.equipment, "Loader 02");
  assert.equal(a.record_table, "npi_work_orders");
  assert.equal(a.proposal.version, undefined);
  assert.equal(a.proposal.id, undefined);
});
test("unsent workbook edits stop refresh before any source overwrite or network call", () => {
  const h = harness();
  assert.throws(() => h.context.npiPullLive(), /Submit unsent edits/);
  assert.equal(h.requests.length, 0);
  assert.equal(h.rows[1][9], "Loader 02");
});
test("workbook rejects other editors and neutralizes formula cells", () => {
  const h = harness("foreign@npi.test");
  assert.equal(h.context.npiSafe_(1.75), 1.75);
  assert.throws(() => h.context.npiSubmitLive(), /authorize this manager/);
  assert.equal(h.requests.length, 0);
  assert.equal(
    h.context.npiSafe_('=IMPORTXML("example")'),
    '\'=IMPORTXML("example")',
  );
});

test("bridge reports HTTP failures before parsing and fails closed for an ownerless workbook", () => {
  const h = harness();
  h.context.UrlFetchApp.fetch = () => ({
    getResponseCode: () => 502,
    getContentText: () => "<html>Gateway failed</html>",
  });
  assert.throws(() => h.context.npiSubmitLive(), /HTTP 502.*non-JSON/);
  h.context.UrlFetchApp.fetch = () => ({
    getResponseCode: () => 200,
    getContentText: () => "not JSON",
  });
  assert.throws(() => h.context.npiSubmitLive(), /invalid server response/);
  h.context.DriveApp.getFileById = () => ({ getOwner: () => null });
  assert.throws(() => h.context.npiSubmitLive(), /no individual owner/);
});
