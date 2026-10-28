import vm from "node:vm";
import { readFileSync } from "node:fs";
export function spreadsheetTest() {
  const rows = [],
    files = new Map(),
    properties = new Map();
  let active = "owner@example.test",
    effective = "owner@example.test",
    seq = 0;
  const file = (id, blob) => ({
    getId: () => id,
    getBlob: () => blob,
    getName: () => blob?.name,
    getOwner: () => ({ getEmail: () => "owner@example.test" }),
  });
  const folder = {
    getId: () => "folder-test",
    getSharingAccess: () => "PRIVATE",
    getEditors: () => [],
    getViewers: () => [],
    getFilesByName(name) {
      const matches = [...files.values()].filter((f) => f.getName() === name);
      return { hasNext: () => matches.length > 0, next: () => matches.shift() };
    },
    createFile(blob) {
      const id = "file-" + ++seq;
      const f = file(id, blob);
      files.set(id, f);
      return f;
    },
  };
  const sheet = {
    getLastRow: () => rows.length,
    getLastColumn: () => (rows.length ? rows[0].length : 0),
    setFrozenRows() {},
    getRange(row, column, count, width) {
      return {
        getValues() {
          return Array.from({ length: count }, (_, r) =>
            Array.from({ length: width }, (_, c) => {
              const v = rows[row - 1 + r]?.[column - 1 + c] ?? "";
              return typeof v === "string" && /^'[=+@\-\t\r]/.test(v)
                ? v.slice(1)
                : v;
            }),
          );
        },
        setValues(values) {
          values.forEach((v, r) => {
            rows[row - 1 + r] ??= [];
            v.forEach((cell, c) => (rows[row - 1 + r][column - 1 + c] = cell));
          });
          return this;
        },
        setBackground() {
          return this;
        },
        setFontColor() {
          return this;
        },
        setFontWeight() {
          return this;
        },
      };
    },
  };
  let created = false;
  const book = {
    getId: () => "book-test",
    getSheetByName: () => (created ? sheet : null),
    insertSheet: () => {
      created = true;
      return sheet;
    },
  };
  const context = {
    Session: {
      getActiveUser: () => ({ getEmail: () => active }),
      getEffectiveUser: () => ({ getEmail: () => effective }),
    },
    DriveApp: {
      Access: { PRIVATE: "PRIVATE" },
      getFileById: (id) => (id === "book-test" ? file(id) : files.get(id)),
      getFolderById: () => folder,
      createFolder: () => folder,
    },
    SpreadsheetApp: { getActiveSpreadsheet: () => book, flush() {} },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: {
      getUuid: () =>
        `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`,
      base64Decode: (s) => [...Buffer.from(s, "base64")],
      base64Encode: (bytes) => Buffer.from(bytes).toString("base64"),
      newBlob: (bytes, type, name) => ({
        bytes,
        type,
        name,
        getBytes: () => bytes,
      }),
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => properties.get(key),
        setProperty: (key, val) => properties.set(key, val),
      }),
    },
  };
  vm.createContext(context);
  vm.runInContext(
    readFileSync(
      new URL("../../spreadsheet-first/Code.gs", import.meta.url),
      "utf8",
    ),
    context,
  );
  context.setupNpiTest();
  return {
    rows,
    files,
    folder,
    setup: () => context.setupNpiTest(),
    api: (request) => context.npiTestApi(request),
    identity: (a, e = a) => {
      active = a;
      effective = e;
    },
  };
}
