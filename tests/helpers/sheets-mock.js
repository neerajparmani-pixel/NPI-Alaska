import vm from "node:vm";
import { readFileSync } from "node:fs";
export function spreadsheetTest() {
  const files = new Map(),
    properties = new Map(),
    sheets = new Map();
  let active = "owner@example.test",
    effective = active,
    seq = 0,
    bound = true,
    failedSheet = null,
    sheetSequence = 0;
  function makeSheet(name) {
    const rows = [];
    let hidden = false,
      maxRows = 1000;
    const id = ++sheetSequence;
    const lastRow = () => {
      for (let i = rows.length - 1; i >= 0; i--)
        if (rows[i]?.some((v) => v !== "" && v !== null && v !== undefined))
          return i + 1;
      return 0;
    };
    return {
      rows,
      getName: () => name,
      getSheetId: () => id,
      getLastRow: lastRow,
      getLastColumn: () =>
        Math.max(
          0,
          ...rows.map((row) => {
            let end = row.length;
            while (end && [undefined, null, ""].includes(row[end - 1])) end--;
            return end;
          }),
        ),
      getMaxRows: () => maxRows,
      insertRowsAfter(row, count) {
        maxRows += count;
      },
      setFrozenRows() {},
      setFrozenColumns() {},
      setRowHeight() {},
      setColumnWidth() {},
      hideSheet() {
        hidden = true;
      },
      showSheet() {
        hidden = false;
      },
      isSheetHidden: () => hidden,
      getRange(row, column, count, width) {
        return {
          getValues() {
            return Array.from({ length: count }, (_, r) =>
              Array.from({ length: width }, (_, c) => {
                const value = rows[row - 1 + r]?.[column - 1 + c] ?? "";
                return typeof value === "string" && /^'[=+@\-\t\r]/.test(value)
                  ? value.slice(1)
                  : value;
              }),
            );
          },
          setValues(values) {
            if (failedSheet === name)
              throw Error("Simulated view write failure");
            values.forEach((r, i) => {
              rows[row - 1 + i] ??= [];
              r.forEach(
                (value, c) => (rows[row - 1 + i][column - 1 + c] = value),
              );
            });
            return this;
          },
          clearContent() {
            for (let r = 0; r < count; r++) {
              rows[row - 1 + r] ??= [];
              for (let c = 0; c < width; c++)
                rows[row - 1 + r][column - 1 + c] = "";
            }
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
          setFontFamily() {
            return this;
          },
          setVerticalAlignment() {
            return this;
          },
          setWrap() {
            return this;
          },
        };
      },
    };
  }
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
      return { hasNext: () => !!matches.length, next: () => matches.shift() };
    },
    createFile(blob) {
      const id = "file-" + ++seq,
        f = file(id, blob);
      files.set(id, f);
      return f;
    },
  };
  const book = {
    getId: () => "book-test",
    getSheetByName: (name) => sheets.get(name) || null,
    insertSheet: (name) => {
      if (sheets.has(name)) throw Error("Duplicate sheet");
      const sheet = makeSheet(name);
      sheets.set(name, sheet);
      return sheet;
    },
    setActiveSheet() {},
  };
  const output = (html) => ({
    getContent: () => html,
    setTitle(title) {
      this.title = title;
      return this;
    },
    addMetaTag() {
      return this;
    },
    setWidth() {
      return this;
    },
    setHeight() {
      return this;
    },
  });
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
    SpreadsheetApp: {
      getActiveSpreadsheet: () => (bound ? book : null),
      openById: (id) => {
        if (id !== "book-test") throw Error("Wrong spreadsheet ID");
        return book;
      },
      flush() {},
    },
    HtmlService: {
      createHtmlOutput: output,
      createHtmlOutputFromFile: (name) => {
        if (name !== "Index") throw Error("Missing HTML file");
        return output(
          readFileSync(
            new URL("../../spreadsheet-first/Index.html", import.meta.url),
            "utf8",
          ),
        );
      },
    },
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
      formatDate: (date, zone) =>
        new Intl.DateTimeFormat("en-US", {
          timeZone: zone,
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }).format(date),
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => properties.get(key),
        setProperty: (key, value) => properties.set(key, value),
        deleteProperty: (key) => properties.delete(key),
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
    rows: sheets.get("NPI_Test_Work").rows,
    sheets,
    files,
    folder,
    properties,
    setup: () => context.setupNpiTest(),
    api: (request) => context.npiTestApi(request),
    web: () => context.doGet(),
    rebuild: () => context.refreshNpiBackend(),
    setBound: (value) => (bound = value),
    failView: (name) => (failedSheet = name),
    identity: (a, e = a) => {
      active = a;
      effective = e;
    },
  };
}
