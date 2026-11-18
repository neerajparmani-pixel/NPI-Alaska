import test from "node:test";
import assert from "node:assert/strict";
import {
  csvText,
  parseCsv,
  workbookRows,
  previewWorkbook,
} from "../public/three-view/workbook.js";
const hours = (j) => j.hours || 0;
const state = () => ({
  revision: 7,
  jobs: [
    {
      id: "DEMO-104",
      company: "north",
      status: "draft",
      hours: 0,
      sessions: [],
      title: "Clear access",
      date: "2026-11-18",
      equipment: "Loader",
    },
    {
      id: "DEMO-100",
      company: "north",
      status: "approved",
      hours: 2,
      claimedHours: 2,
      acceptedHours: 2,
      sessions: [{}],
      title: "Completed work",
      date: "2026-11-17",
      equipment: "Plow",
    },
  ],
});
test("CSV round trip preserves quotes, commas, newlines and BOM", () => {
  const rows = [
    ["a", "b"],
    ['a,"b"', "line\nnext"],
  ];
  assert.deepEqual(parseCsv(csvText(rows)), rows);
  assert.throws(() => parseCsv('a,b\n"unfinished,x'), /quoted/);
});
test("worksheet preview changes planning only without mutating source records", () => {
  const s = state(),
    before = structuredClone(s),
    rows = workbookRows(s, hours);
  rows[1][7] = "Clear north entrance";
  rows[1][8] = "2026-11-19";
  const out = previewWorkbook(csvText(rows), s, hours);
  assert.equal(out.changes.length, 1);
  assert.equal(out.changes[0].date, "2026-11-19");
  assert.deepEqual(s, before);
});
test("stale batches, duplicates, invalid dates and protected decisions fail atomically", () => {
  for (const change of [
    (r) => (r[1][1] = 6),
    (r) => (r[1][3] = "approved"),
    (r) => (r[1][6] = "10"),
    (r) => r.push(r[1]),
    (r) => (r[1][8] = "2026-02-30"),
    (r) => (r[2][7] = "Alter approved work"),
  ]) {
    const s = state(),
      before = structuredClone(s),
      rows = workbookRows(s, hours);
    change(rows);
    assert.throws(() => previewWorkbook(csvText(rows), s, hours));
    assert.deepEqual(s, before);
  }
});
test("CSV export neutralizes spreadsheet formula cells", () => {
  assert.equal(
    csvText([['=HYPERLINK("x")', " @SUM(1)", "ordinary"]]),
    '\ufeff"\'=HYPERLINK(""x"")","\' @SUM(1)","ordinary"',
  );
});
