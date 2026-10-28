import { test } from "node:test";
import assert from "node:assert/strict";
import { spreadsheetTest } from "./helpers/sheets-mock.js";
const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/H0AAAAASUVORK5CYII=";
let counter = 0;
const key = () => "request-test-" + String(++counter).padStart(12, "0");
const assignment = {
  site: "Courthouse",
  area: "Main lot",
  worker: "Alex (sample)",
  equipment: "Plow",
};
function change(test, job, action, data = {}) {
  return test.api({
    action,
    id: job?.id,
    version: job?.version,
    requestId: key(),
    data,
  }).job;
}
test("owner-only backend rejects empty identity, other editors and owner-executing impersonation", () => {
  const app = spreadsheetTest();
  app.identity("");
  assert.throws(() => app.api({ action: "list" }), /restricted/);
  app.identity("editor@example.test");
  assert.throws(() => app.api({ action: "list" }), /restricted/);
  app.identity("editor@example.test", "owner@example.test");
  assert.throws(
    () => app.api({ action: "create", requestId: key(), data: assignment }),
    /restricted/,
  );
  assert.equal(app.rows.length, 1);
});
test("sheet setup preserves records and full lifecycle saves approvals and real evidence references", () => {
  const app = spreadsheetTest();
  let job = change(app, null, "create", assignment);
  assert.equal(app.rows.length, 2);
  app.setup();
  assert.equal(app.rows.length, 2);
  job = change(app, job, "start");
  assert.throws(
    () => change(app, job, "submit", { tasks: ["Plowing"] }),
    /photo/,
  );
  job = change(app, job, "upload", {
    kind: "photo",
    type: "image/png",
    name: "photo.png",
    base64: png,
  });
  assert.equal(app.files.size, 1);
  job = change(app, job, "submit", { tasks: ["Plowing"], notes: "Completed" });
  assert.equal(job.status, "Submitted");
  const oldEnd = job.end;
  assert.throws(
    () => change(app, job, "return", { reason: "" }),
    /correction instructions/,
  );
  job = change(app, job, "return", { reason: "Add a sidewalk note" });
  assert.equal(job.status, "Correction requested");
  job = change(app, job, "submit", {
    tasks: ["Plowing"],
    notes: "Sidewalk checked",
  });
  assert.equal(job.end, oldEnd);
  job = change(app, job, "approve");
  assert.equal(job.status, "Approved");
  assert.throws(
    () => change(app, job, "save", { notes: "Changed" }),
    /not available/,
  );
  assert.equal(app.api({ action: "list" }).jobs[0].status, "Approved");
  assert.equal(job.history.at(-1).actor, "owner@example.test");
  const photo = app.api({
    action: "readFile",
    id: job.id,
    fileId: job.files[0].id,
  });
  assert.ok(photo.data.startsWith("data:image/png;base64,"));
});
test("retry keys prevent duplicate creation/upload and stale versions cannot overwrite", () => {
  const app = spreadsheetTest();
  const request = { action: "create", requestId: key(), data: assignment };
  let job = app.api(request).job;
  assert.equal(app.api(request).job.id, job.id);
  assert.equal(app.rows.length, 2);
  const stale = job;
  job = change(app, job, "start");
  assert.throws(() => change(app, stale, "start"), /changed/);
  const upload = {
    action: "upload",
    id: job.id,
    version: job.version,
    requestId: key(),
    data: { kind: "photo", type: "image/png", name: "photo.png", base64: png },
  };
  app.api(upload);
  app.api(upload);
  assert.equal(app.files.size, 1);
  assert.equal(app.api({ action: "list" }).jobs[0].files.length, 1);
});
test("server validates file signatures, private folders, site tasks, port requirements and formula safety", () => {
  const app = spreadsheetTest();
  let job = change(app, null, "create", {
    ...assignment,
    area: '=IMPORTXML("https://example.test")',
    site: "Tote Port",
  });
  assert.ok(app.rows[1][2].startsWith("'="));
  job = change(app, job, "start");
  assert.throws(
    () =>
      change(app, job, "upload", {
        kind: "photo",
        type: "image/png",
        name: "x.png",
        base64: Buffer.from("not an image").toString("base64"),
      }),
    /contents/,
  );
  assert.equal(app.files.size, 0);
  app.folder.getEditors = () => ["editor"];
  assert.throws(
    () =>
      change(app, job, "upload", {
        kind: "photo",
        type: "image/png",
        name: "x.png",
        base64: png,
      }),
    /private/,
  );
  app.folder.getEditors = () => [];
  assert.throws(
    () => change(app, job, "save", { tasks: ["Fake task"] }),
    /valid completed/,
  );
  job = change(app, job, "upload", {
    kind: "photo",
    type: "image/png",
    name: "x.png",
    base64: png,
  });
  assert.throws(
    () => change(app, job, "submit", { tasks: ["Hauling"], loads: 0 }),
    /timecard/,
  );
  job = change(app, job, "upload", {
    kind: "timecard",
    type: "application/pdf",
    name: "signed.pdf",
    base64: Buffer.from("%PDF-1.4\nexample test").toString("base64"),
  });
  job = change(app, job, "submit", { tasks: ["Hauling"], loads: 0 });
  assert.equal(job.status, "Submitted");
  assert.throws(
    () => app.api({ action: "readFile", id: job.id, fileId: "not-associated" }),
    /not found/,
  );
});

test("test dataset is paginated and incompatible headers are never overwritten", () => {
  const app = spreadsheetTest();
  for (let i = 0; i < 25; i++)
    change(app, null, "create", { ...assignment, area: "Area " + i });
  const first = app.api({ action: "list", page: 0 });
  assert.equal(first.jobs.length, 20);
  assert.equal(first.total, 25);
  assert.equal(first.jobs[0].area, "Area 24");
  const last = app.api({ action: "list", page: 99 });
  assert.equal(last.page, 1);
  assert.equal(last.jobs.length, 5);
  app.rows[0][1] = "Unexpected header";
  assert.throws(() => app.setup(), /headers/);
  assert.equal(app.rows[0][1], "Unexpected header");
  assert.equal(app.rows.length, 26);
});

test("multi-tab backend preserves original records and projects assignments, evidence and approvals", () => {
  const app = spreadsheetTest();
  assert.equal(app.sheets.size, 9);
  assert.ok(app.sheets.get("NPI_Test_Work").isSheetHidden());
  let job = change(app, null, "create", assignment);
  job = change(app, job, "start");
  job = change(app, job, "upload", {
    kind: "photo",
    type: "image/png",
    name: "photo.png",
    base64: png,
  });
  job = change(app, job, "submit", { tasks: ["Plowing"] });
  job = change(app, job, "approve");
  assert.equal(app.sheets.get("NPI_Assignments").rows[1][1], "Courthouse");
  assert.equal(app.sheets.get("NPI_WorkLogs").rows[1][4], "Approved");
  assert.equal(app.sheets.get("NPI_Attachments").rows[1][3], "photo");
  assert.equal(app.sheets.get("NPI_Approvals").rows[1][4], "Approved");
  assert.equal(app.sheets.get("NPI_AuditLog").getLastRow(), 6);
  app.setup();
  assert.equal(app.rows.length, 2);
  assert.equal(app.api({ action: "list" }).summary.approved, 1);
});
test("report failures never undo the saved work record and can be rebuilt from the record store", () => {
  const app = spreadsheetTest();
  app.failView("NPI_WorkLogs");
  const request = { action: "create", requestId: key(), data: assignment };
  const result = app.api(request);
  assert.match(result.warning, /record is saved/);
  assert.equal(app.rows.length, 2);
  assert.equal(app.api(request).job.id, result.job.id);
  assert.equal(app.rows.length, 2);
  app.failView(null);
  app.rebuild();
  assert.equal(app.sheets.get("NPI_WorkLogs").rows[1][0], result.job.id);
  assert.equal(app.properties.get("NPI_VIEW_DIRTY"), undefined);
});
test("full-page route loads saved spreadsheet ID and refuses other users", () => {
  const app = spreadsheetTest();
  app.setBound(false);
  assert.match(app.web().getContent(), /Settings & access/);
  assert.equal(app.web().title, "NPI Alaska | Field operations");
  assert.equal(app.api({ action: "list" }).appVersion, "2");
  app.identity("not-owner@example.test");
  assert.match(
    app.web().getContent(),
    /Open with the spreadsheet owner account/,
  );
  assert.throws(() => app.api({ action: "settings" }), /restricted/);
});
test("non-secret workspace settings persist through report rebuilds without changing login access", () => {
  const app = spreadsheetTest();
  const result = app.api({
    action: "saveSettings",
    data: {
      name: "NPI Alaska Operations",
      support: "Contact the site supervisor",
    },
  });
  assert.equal(result.workspace.name, "NPI Alaska Operations");
  assert.equal(result.companyLogin, "Not connected");
  app.rebuild();
  app.setup();
  assert.equal(
    app.api({ action: "settings" }).workspace.support,
    "Contact the site supervisor",
  );
  assert.equal(app.api({ action: "settings" }).tabs.length, 8);
});
