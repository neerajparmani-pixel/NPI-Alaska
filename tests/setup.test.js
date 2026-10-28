import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
const source = readFileSync(
  new URL("../backend/Setup.gs", import.meta.url),
  "utf8",
);
function spreadsheet(initial = {}) {
  const sheets = new Map(Object.entries(initial));
  const book = {
    getSheetByName: (name) => sheets.get(name),
    insertSheet: (name) => {
      const sheet = {
        values: [],
        getLastRow() {
          return this.values.length ? 1 : 0;
        },
        getLastColumn() {
          return this.values.length;
        },
        getRange() {
          const owner = this;
          return {
            getValues: () => [owner.values],
            setValues(values) {
              owner.values = values[0];
              return this;
            },
            setFontWeight() {
              return this;
            },
            setBackground() {
              return this;
            },
            setFontColor() {
              return this;
            },
          };
        },
        setFrozenRows() {},
      };
      sheets.set(name, sheet);
      return sheet;
    },
  };
  return { book, sheets };
}
test("spreadsheet schema initializer is repeatable", () => {
  const { book, sheets } = spreadsheet();
  const context = {
    SpreadsheetApp: { getActiveSpreadsheet: () => book, flush() {} },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  assert.equal(context.setupPhaseOne().length, 12);
  assert.equal(sheets.size, 12);
  const headers = JSON.stringify(
    [...sheets].map(([name, s]) => [name, s.values]),
  );
  context.setupPhaseOne();
  assert.equal(
    JSON.stringify([...sheets].map(([name, s]) => [name, s.values])),
    headers,
  );
});
test("initializer refuses incompatible existing data before creating tabs", () => {
  const incompatible = {
    getLastRow: () => 1,
    getLastColumn: () => 1,
    getRange: () => ({ getValues: () => [["Unexpected header"]] }),
  };
  const { book, sheets } = spreadsheet({ UsersRoles: incompatible });
  const context = { SpreadsheetApp: { getActiveSpreadsheet: () => book } };
  vm.createContext(context);
  vm.runInContext(source, context);
  assert.throws(() => context.setupPhaseOne(), /Existing headers differ/);
  assert.equal(sheets.size, 1);
});
