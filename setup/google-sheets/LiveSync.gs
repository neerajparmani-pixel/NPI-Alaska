/** NPI Operations 2.0: seven visible management tabs; secrets remain in Script Properties. */
const NPI_LIVE = {
  spreadsheetId: "1FJkmwHbZaNLwT4awsSshJpysi95dwBtOOKadig_Ibz8",
  endpoint: "https://fyfjsqhnxcktjdihcaks.supabase.co/functions/v1/npi-admin",
  publishableKey: "sb_publishable_FmSUiw7lQNNPq3Wc--7EUA_yDG5vFXw",
};
const NPI_GROUPS = {
  Work: ["npi_work_orders", "npi_work_members", "npi_hour_reviews"],
  Attendance: ["npi_attendance_events"],
  People: ["npi_profiles"],
  Setup: [
    "npi_companies",
    "npi_contracts",
    "npi_contract_scopes",
    "npi_invitations",
    "npi_sites",
    "npi_tasks",
    "npi_notification_settings",
  ],
  Issues: ["npi_issues", "npi_issue_comments"],
  "Evidence & history": [
    "npi_evidence",
    "npi_work_history",
    "npi_audit",
    "npi_notifications",
    "npi_email_outbox",
    "npi_sync_changes",
  ],
};
const NPI_RECORD_LABELS = {
  npi_work_orders: "Assignment",
  npi_work_members: "Assigned worker",
  npi_hour_reviews: "Hours review",
  npi_attendance_events: "Attendance",
  npi_profiles: "Person",
  npi_companies: "Company",
  npi_contracts: "Contract",
  npi_contract_scopes: "Site responsibility",
  npi_invitations: "Invitation metadata",
  npi_sites: "Site",
  npi_tasks: "Service",
  npi_notification_settings: "Recipient settings",
  npi_issues: "Issue",
  npi_issue_comments: "Issue comment",
  npi_evidence: "Evidence file",
  npi_work_history: "Work history",
  npi_audit: "Audit event",
  npi_notifications: "In-app notice",
  npi_email_outbox: "Email status",
  npi_sync_changes: "Spreadsheet proposal",
};
function npiTable_(label) {
  return (
    Object.keys(NPI_RECORD_LABELS).find(
      (k) => NPI_RECORD_LABELS[k] === label,
    ) || label
  );
}
const NPI_EDITS = {
  npi_sites: ["name", "address"],
  npi_work_orders: ["planned_date", "equipment"],
};
const NPI_COLS = [
  "Record type",
  "ID",
  "Name / work",
  "Company",
  "Site",
  "Worker / actor",
  "Date / time",
  "Status",
  "Planned date (editable)",
  "Equipment (editable)",
  "Site name (editable)",
  "Address (editable)",
  "Recorded hours",
  "Claimed hours",
  "Accepted hours",
  "Detail / evidence link",
  "Version",
  "Source JSON",
];
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("NPI Operations")
    .addItem("1. Refresh management workbook", "npiPullLive")
    .addItem("2. Submit planning edits for NPI review", "npiSubmitLive")
    .addItem("3. Enable automatic sync & emails", "npiInstallLiveTriggers")
    .addItem("4. Dispatch queued emails now", "npiDispatchEmails")
    .addItem("5. Hide legacy tabs (preserve data)", "npiHideLegacyTabs")
    .addToUi();
}
function npiLiveAccess_() {
  const book = SpreadsheetApp.openById(NPI_LIVE.spreadsheetId);
  if (book.getId() !== NPI_LIVE.spreadsheetId)
    throw new Error("This script is bound to another workbook.");
  const owner = DriveApp.getFileById(book.getId()).getOwner();
  const actor = Session.getEffectiveUser().getEmail().toLowerCase();
  const props = PropertiesService.getScriptProperties();
  const managers = (props.getProperty("NPI_MANAGER_EMAILS") || "")
    .toLowerCase()
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  if (
    !actor ||
    !owner ||
    (actor !== owner.getEmail().toLowerCase() && !managers.includes(actor))
  )
    throw new Error("The workbook owner must authorize this manager.");
  const secret = props.getProperty("NPI_SHEETS_TOKEN");
  if (!secret || secret.length < 32)
    throw new Error(
      "Set NPI_SHEETS_TOKEN in Script Properties and the Edge Function secrets first.",
    );
  return { book, props, secret, owner: owner.getEmail() };
}
function npiLiveCall_(ctx, body) {
  const response = UrlFetchApp.fetch(NPI_LIVE.endpoint, {
    method: "post",
    contentType: "application/json",
    headers: {
      apikey: NPI_LIVE.publishableKey,
      "x-npi-sheet-token": ctx.secret,
    },
    payload: JSON.stringify(
      Object.assign({ spreadsheetId: NPI_LIVE.spreadsheetId }, body),
    ),
    muteHttpExceptions: true,
  });
  const result = JSON.parse(response.getContentText());
  if (response.getResponseCode() >= 300)
    throw new Error(
      "HTTP " +
        response.getResponseCode() +
        ": " +
        (result.error ||
          result.message ||
          result.msg ||
          "Supabase bridge request failed."),
    );
  return result;
}

function npiSafe_(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v === null || v === undefined) return "";
  v = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /^[=+@-]/.test(v) ? "'" + v : v;
}
function npiRaw_(v) {
  v = String(v || "");
  return v.startsWith("'") && /^[=+@-]/.test(v.slice(1)) ? v.slice(1) : v;
}
function npiEdits_(ctx) {
  const edits = [];
  for (const group of ["Work", "Setup"]) {
    const sheet = ctx.book.getSheetByName(group);
    if (!sheet || sheet.getLastRow() < 2) continue;
    const rows = sheet
      .getRange(2, 1, sheet.getLastRow() - 1, 18)
      .getDisplayValues();
    for (const row of rows) {
      const table = npiTable_(row[0]),
        keys = NPI_EDITS[table];
      if (!keys) continue;
      let base;
      try {
        base = JSON.parse(npiRaw_(row[17]));
      } catch {
        throw Error(
          "Protected source metadata changed in " +
            group +
            ". Restore from a backup.",
        );
      }
      if (row[1] !== base.id) throw Error("Protected record ID changed.");
      const proposal =
        table === "npi_sites"
          ? { name: npiRaw_(row[10]), address: npiRaw_(row[11]) }
          : { planned_date: npiRaw_(row[8]), equipment: npiRaw_(row[9]) };
      if (
        keys.every((k) => String(base[k] || "") === String(proposal[k] || ""))
      )
        continue;
      const digest = Utilities.computeDigest(
        Utilities.DigestAlgorithm.SHA_256,
        JSON.stringify(proposal),
      )
        .map((b) => (b + 256).toString(16).slice(-2))
        .join("");
      edits.push({
        record_table: table,
        record_id: base.id,
        expected_version: Number(base.version),
        proposal,
        key:
          "NPI_V2_" + base.id + "_" + base.version + "_" + digest.slice(0, 24),
      });
    }
  }
  return edits;
}
function npiSubmitLive() {
  const ctx = npiLiveAccess_(),
    lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) throw Error("Another sync is running.");
  try {
    const edits = npiEdits_(ctx);
    for (const e of edits) {
      let request = ctx.props.getProperty(e.key);
      if (!request) {
        request = Utilities.getUuid();
        ctx.props.setProperty(e.key, request);
      }
      npiLiveCall_(ctx, {
        operation: "sheet_propose",
        change: {
          id: request,
          record_table: e.record_table,
          record_id: e.record_id,
          expected_version: e.expected_version,
          proposal: e.proposal,
        },
      });
      ctx.props.setProperty(e.key + "_sent", "yes");
    }
    ctx.book.toast(
      edits.length + " edits submitted. NPI must review them in the app.",
      "NPI Operations",
    );
  } finally {
    lock.releaseLock();
  }
}
function npiPullLive() {
  const ctx = npiLiveAccess_(),
    lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) throw Error("Another sync is running.");
  try {
    if (npiEdits_(ctx).some((e) => !ctx.props.getProperty(e.key + "_sent")))
      throw Error("Submit unsent edits first. No edits were overwritten.");
    for (const group of Object.keys(NPI_GROUPS)) {
      const sheet = ctx.book.getSheetByName(group);
      if (
        sheet &&
        sheet.getLastRow() &&
        sheet.getRange(1, 1).getDisplayValue() !== "Record type"
      )
        throw Error(
          group + " contains unrelated data. Rename it before initialising.",
        );
    }
    const fetched = {};
    for (const tables of Object.values(NPI_GROUPS))
      for (const table of tables) {
        let rows = [],
          more = true;
        for (let offset = 0; more; offset += 1000) {
          if (offset >= 20000)
            throw Error(
              "Export exceeds 20,000 rows in " +
                table +
                ". Use an archived export; workbook was not refreshed.",
            );
          const result = npiLiveCall_(ctx, {
            operation: "sheet_export",
            table,
            offset,
          });
          rows = rows.concat(result.rows);
          more = result.more;
        }
        fetched[table] = rows;
      }
    const find = (table, id) =>
      (fetched[table] || []).find((x) => x.id === id) || {};
    for (const [group, tables] of Object.entries(NPI_GROUPS)) {
      const values = [NPI_COLS];
      for (const table of tables)
        for (const r of fetched[table]) {
          const w = find("npi_work_orders", r.work_id) || {};
          const actor = find(
            "npi_profiles",
            r.worker_id ||
              r.actor_id ||
              r.uploaded_by ||
              r.reporter_id ||
              r.recipient_id ||
              r.created_by,
          );
          const workId =
            r.work_id || (table === "npi_work_orders" ? r.id : null);
          const detail =
            r.description ||
            r.resolution ||
            r.message ||
            r.reason ||
            r.title ||
            r.subject ||
            r.action ||
            r.filename ||
            r.instructions ||
            "";
          const recorded =
            r.recorded_minutes == null ? "" : Number(r.recorded_minutes) / 60;
          values.push(
            [
              NPI_RECORD_LABELS[table] || table,
              r.id ||
                (r.work_id && r.worker_id
                  ? r.work_id + ":" + r.worker_id
                  : r.scope),
              r.name || r.display_name || r.title || w.title || "",
              find("npi_companies", r.company_id || w.company_id).name || "",
              find("npi_sites", r.site_id || w.site_id).name || "",
              actor.display_name || "",
              r.created_at ||
                r.event_time ||
                r.received_at ||
                r.planned_date ||
                "",
              r.status || r.account_status || r.event_kind || "",
              table === "npi_work_orders" ? r.planned_date : "",
              table === "npi_work_orders" ? r.equipment : "",
              table === "npi_sites" ? r.name : "",
              table === "npi_sites" ? r.address : "",
              recorded,
              r.claimed_minutes == null ? "" : Number(r.claimed_minutes) / 60,
              r.accepted_minutes == null ? "" : Number(r.accepted_minutes) / 60,
              String(detail) +
                (workId
                  ? " · https://alaska.npi6030.com/live/#work=" + workId
                  : ""),
              r.version || "",
              JSON.stringify(r),
            ].map(npiSafe_),
          );
        }
      const sheet =
        ctx.book.getSheetByName(group) || ctx.book.insertSheet(group);
      if (
        sheet.getLastRow() &&
        sheet.getRange(1, 1).getDisplayValue() !== "Record type"
      )
        throw Error(
          group +
            " already contains unrelated data. Rename that sheet before initialisation.",
        );
      if (sheet.getMaxRows() < values.length)
        sheet.insertRowsAfter(
          sheet.getMaxRows(),
          values.length - sheet.getMaxRows(),
        );
      if (sheet.getMaxColumns() < 18)
        sheet.insertColumnsAfter(
          sheet.getMaxColumns(),
          18 - sheet.getMaxColumns(),
        );
      sheet.clearContents();
      sheet
        .getRange(1, 1, values.length, 18)
        .setNumberFormat("@")
        .setValues(values);
      if (values.length > 1)
        sheet.getRange(2, 13, values.length - 1, 3).setNumberFormat("0.00");
      sheet.setFrozenRows(1);
      sheet.setFrozenColumns(3);
      sheet.hideColumns(2);
      sheet
        .getRange(1, 1, 1, 18)
        .setBackground("#102c50")
        .setFontColor("white")
        .setFontWeight("bold");
      sheet.setColumnWidths(1, 16, 160);
      sheet.setColumnWidth(16, 340);
      sheet.hideColumns(17, 2);
      const protection =
        sheet
          .getProtections(SpreadsheetApp.ProtectionType.SHEET)
          .find((p) => p.getDescription() === "NPI Operations protected") ||
        sheet.protect().setDescription("NPI Operations protected");
      protection.setWarningOnly(false);
      const owner = DriveApp.getFileById(ctx.book.getId())
        .getOwner()
        .getEmail();
      protection.addEditor(owner);
      const others = protection
        .getEditors()
        .filter((e) => e.getEmail() !== owner);
      if (others.length) protection.removeEditors(others);
      if (protection.canDomainEdit()) protection.setDomainEdit(false);
      const unlocked = [];
      for (let row = 1; row < values.length; row++) {
        if (npiTable_(values[row][0]) === "npi_work_orders")
          unlocked.push(sheet.getRange(row + 1, 9, 1, 2));
        if (npiTable_(values[row][0]) === "npi_sites")
          unlocked.push(sheet.getRange(row + 1, 11, 1, 2));
      }
      protection.setUnprotectedRanges(unlocked);
    }
    const overview =
      ctx.book.getSheetByName("Overview") || ctx.book.insertSheet("Overview");
    const summary = [
      ["NPI Operations", "Management workbook"],
      ["Last refresh UTC", new Date().toISOString()],
      ["Work orders", fetched.npi_work_orders.length],
      [
        "Open issues",
        fetched.npi_issues.filter((i) => i.status !== "resolved").length,
      ],
      [
        "How to edit",
        "Only labelled planning/site cells can be edited. Submit edits, then NPI reviews them in the app.",
      ],
      [
        "Evidence",
        "Files stay private in Supabase. Open the work link and sign in to view photos.",
      ],
      [
        "Sync",
        "Automatic refresh preserves unsent edits. Original attendance and approvals are read-only.",
      ],
      ["Billing", "Deferred; no rates or invoice data is exported."],
    ];
    overview.clearContents();
    overview.getRange(1, 1, summary.length, 2).setValues(summary);
    overview.setColumnWidths(1, 2, 360);
    overview
      .getRange(1, 1, 1, 2)
      .setBackground("#102c50")
      .setFontColor("white");
    ctx.props.setProperty("NPI_LAST_SYNC", new Date().toISOString());
    ctx.book.toast("Seven management tabs refreshed.", "NPI Operations");
  } finally {
    lock.releaseLock();
  }
}
function npiDispatchEmails() {
  const ctx = npiLiveAccess_();
  const r = npiLiveCall_(ctx, { operation: "email_dispatch" });
  ctx.props.setProperty(
    "NPI_LAST_EMAIL_RUN",
    new Date().toISOString() + " processed " + r.processed + " sent " + r.sent,
  );
  return r;
}
function npiAutomaticRefresh() {
  try {
    npiPullLive();
  } catch (e) {
    PropertiesService.getScriptProperties().setProperty(
      "NPI_SYNC_ERROR",
      String(e.message),
    );
    throw e;
  }
}
function npiInstallLiveTriggers() {
  npiLiveAccess_();
  for (const t of ScriptApp.getProjectTriggers())
    if (
      ["npiAutomaticRefresh", "npiDispatchEmails"].includes(
        t.getHandlerFunction(),
      )
    )
      ScriptApp.deleteTrigger(t);
  ScriptApp.newTrigger("npiAutomaticRefresh")
    .timeBased()
    .everyMinutes(5)
    .create();
  ScriptApp.newTrigger("npiDispatchEmails")
    .timeBased()
    .everyMinutes(1)
    .create();
  SpreadsheetApp.getActiveSpreadsheet().toast(
    "Refresh every five minutes; email dispatcher every minute.",
    "NPI Operations",
  );
}
function npiHideLegacyTabs() {
  const ctx = npiLiveAccess_();
  if (!ctx.book.getSheetByName("Overview"))
    throw Error("Refresh the compact workbook first.");
  const keep = ["Overview", ...Object.keys(NPI_GROUPS)];
  for (const sheet of ctx.book.getSheets())
    if (!keep.includes(sheet.getName())) sheet.hideSheet();
  ctx.book.toast("Legacy sync tabs hidden; no data deleted.", "NPI Operations");
}
