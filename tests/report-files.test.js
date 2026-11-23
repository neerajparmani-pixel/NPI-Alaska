import { test } from "node:test";
import assert from "node:assert/strict";
import { unzipSync, strFromU8 } from "fflate";
import { csv, xlsx, pdf, evidenceZip } from "../src/report-files.js";
import { PDFDocument } from "pdf-lib";
import { readFile } from "node:fs/promises";
test("CSV neutralises formulas after whitespace and preserves quoted multiline text", () => {
  const out = csv(
    [{ name: '\t=HYPERLINK("evil")', notes: 'Line1\nLine2, "quote"' }],
    ["name", "notes"],
  );
  assert.ok(out.includes("'\t=HYPERLINK"));
  assert.ok(out.includes('Line1\nLine2, ""quote""'));
});
test("Excel workbook is a real XLSX ZIP with every row and typed numeric hours", () => {
  const rows = Array.from({ length: 603 }, (_, i) => ({
    name: i === 0 ? "=SUM(A1:A2)" : "Worker " + i,
    hours: 1.75,
  }));
  const files = unzipSync(xlsx(rows, ["name", "hours"]));
  assert.ok(files["[Content_Types].xml"]);
  const sheet = strFromU8(files["xl/worksheets/sheet1.xml"]);
  assert.equal((sheet.match(/<row r=/g) || []).length, 604);
  assert.ok(sheet.includes("<v>1.75</v>"));
  assert.ok(!sheet.includes("<f>"));
  assert.ok(sheet.includes("=SUM(A1:A2)"));
});
test("PDF summary is readable and produces real pages with the supplied brand icon", async () => {
  const bytes = await pdf(
    [{ date: "2026-11-23", worker: "Alex Méndez", recorded_hours: 1.75 }],
    ["date", "worker", "recorded_hours"],
    {
      filter: { kind: "hours", from: "2026-11-23", to: "2026-11-23" },
      created_at: "2026-11-23T12:00:00Z",
    },
    new Uint8Array(await readFile("public/live/vendor/report-font.ttf")),
    new Uint8Array(await readFile("public/live/icon-192.png")),
  );
  assert.equal((await PDFDocument.load(bytes)).getPageCount(), 1);
});
test("evidence ZIP preserves original bytes and sanitises path traversal names", () => {
  const original = new Uint8Array([1, 2, 3, 4]);
  const files = unzipSync(
    evidenceZip([{ name: "../../secret.jpg", bytes: original }]),
  );
  const [name] = Object.keys(files);
  assert.ok(!name.includes("/"));
  assert.deepEqual(files[name], original);
});
