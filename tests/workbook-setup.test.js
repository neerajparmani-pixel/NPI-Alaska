import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
const source = fs.readFileSync("setup/google-sheets/Code.gs", "utf8");
function harness(actor = "owner@npi.test") {
  const sheets = new Map();
  const book = {
    getId: () => "test-book",
    getSheetByName: (n) => sheets.get(n),
    insertSheet: (n) => {
      const s = {
        rows: [],
        getLastRow() {
          return this.rows.length;
        },
        getRange(row, col, count, width) {
          return {
            setValues: (values) => {
              values.forEach((v, i) => (s.rows[row - 1 + i] = [...v]));
              return this;
            },
            getDisplayValues: () => [s.rows[row - 1]?.slice(0, width) || []],
            setBackground() {
              return this;
            },
            setFontColor() {
              return this;
            },
            setFontWeight() {
              return this;
            },
            setWrap() {
              return this;
            },
          };
        },
        setFrozenRows() {},
        setColumnWidths() {},
        setColumnWidth() {},
        getDataRange() {
          return { setWrap() {} };
        },
        getProtections() {
          return this.protections || [];
        },
        protect() {
          const p = {
            getDescription: () => "NPI owner-managed table",
            setDescription() {
              return this;
            },
            getEditors: () => [],
            removeEditors() {},
            canDomainEdit: () => false,
          };
          this.protections = [p];
          return p;
        },
      };
      sheets.set(n, s);
      return s;
    },
    setSpreadsheetTimeZone() {},
  };
  const ctx = vm.createContext({
    SpreadsheetApp: {
      getActiveSpreadsheet: () => book,
      ProtectionType: { SHEET: "sheet" },
    },
    DriveApp: {
      getFileById: () => ({
        getOwner: () => ({ getEmail: () => "owner@npi.test" }),
      }),
    },
    Session: { getEffectiveUser: () => ({ getEmail: () => actor }) },
  });
  vm.runInContext(source, ctx);
  return { ctx, sheets };
}
test("workbook initializer rejects non-owner before mutation", () => {
  const h = harness("other@npi.test");
  assert.throws(() => h.ctx.setupNpiWorkbook(), /Only the spreadsheet owner/);
  assert.equal(h.sheets.size, 0);
});
test("workbook initializer creates separate empty rate tables and preserves existing rows", () => {
  const h = harness();
  h.ctx.setupNpiWorkbook();
  assert.equal(h.sheets.size, 13);
  assert.equal(h.sheets.get("Customer_Rates").rows.length, 1);
  assert.equal(h.sheets.get("Subcontractor_Rates").rows.length, 1);
  const s = h.sheets.get("Sites");
  s.rows.push(["keep-this-record"]);
  h.ctx.setupNpiWorkbook();
  assert.equal(s.rows[1][0], "keep-this-record");
  s.rows[0][0] = "unexpected";
  assert.throws(() => h.ctx.setupNpiWorkbook(), /headers differ/);
});
