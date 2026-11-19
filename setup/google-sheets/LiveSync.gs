/** Connected management workbook. Never store service-role keys or worker passwords here. */
const NPI_LIVE = {
  spreadsheetId: "1FJkmwHbZaNLwT4awsSshJpysi95dwBtOOKadig_Ibz8",
  endpoint: "https://fyfjsqhnxcktjdihcaks.supabase.co/functions/v1/npi-admin",
  publishableKey: "sb_publishable_FmSUiw7lQNNPq3Wc--7EUA_yDG5vFXw",
  tables: [
    "npi_profiles",
    "npi_sites",
    "npi_tasks",
    "npi_companies",
    "npi_contracts",
    "npi_contract_scopes",
    "npi_work_orders",
    "npi_attendance_events",
    "npi_hour_reviews",
    "npi_sync_changes",
    "npi_audit",
  ],
  editable: {
    npi_sites: ["name", "address"],
    npi_work_orders: ["planned_date", "equipment"],
  },
};
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("NPI Live")
    .addItem("1. Refresh from Supabase", "npiPullLive")
    .addItem("2. Submit edits for NPI review", "npiSubmitLive")
    .addToUi();
}
function npiLiveAccess_() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
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
    throw new Error("HTTP " + response.getResponseCode() + ": " + (result.error || result.message || result.msg || "Supabase bridge request failed."));
  return result;
}
function npiTab_(table) {
  return "Live_" + table.replace("npi_", "");
}
function npiSafe_(value) {
  if (value === null || value === undefined) return "";
  const text =
    typeof value === "object" ? JSON.stringify(value) : String(value);
  return /^[=+@-]/.test(text) ? "'" + text : text;
}
function npiLabel_(table, key) {
  const common = {
    id: "ID",
    version: "Version",
    name: "Name",
    address: "Address",
    timezone: "Timezone",
    photo_path: "Site photo",
    display_name: "Full name",
    username: "Username",
    role: "Role",
    active: "Active",
    contract_id: "Contract ID",
    client: "Customer / main source",
    account_status: "Account status",
    side: "Price list",
    company_id: "Company ID",
    site_id: "Location ID",
    task_id: "Service ID",
    worker_id: "Worker ID",
    work_id: "Work ID",
    basis: "Billing unit",
    amount_cents: "Price USD",
    currency: "Currency",
    effective_from: "Effective from",
    effective_through: "Effective through",
    planned_date: "Planned date",
    equipment: "Equipment",
    title: "Work instructions",
    status: "Status",
    event_kind: "Event",
    device_time: "Device time UTC",
    received_at: "Received time UTC",
    latitude: "Latitude",
    longitude: "Longitude",
    accuracy_metres: "Accuracy metres",
    break_minutes: "Break minutes",
    claimed_minutes: "Claimed hours",
    accepted_minutes: "NPI accepted hours",
    recorded_minutes: "Recorded hours",
    company_reviewer: "Company reviewer ID",
    npi_reviewer: "NPI reviewer ID",
    reason: "Reason",
    kind: "Document type",
    reference: "Reference",
    subtotal_cents: "Subtotal USD",
    tax_cents: "Tax USD",
    total_cents: "Total USD",
    record_table: "Table",
    record_id: "Record ID",
    expected_version: "Expected version",
    proposal: "Proposed change",
    message: "Review message",
    description: "Description",
    _contract_name: "Contract name",
    _site_name: "Location name",
    _task_name: "Service name",
    _company_name: "Company name",
    _worker_name: "Worker name",
    actor_id: "Actor ID",
    action: "Action",
    event_time: "Event time UTC",
    _actor_name: "Actor name",
  };
  return common[key] || key;
}
function npiDisplay_(key, value) {
  if (value === null || value === undefined) return "";
  if (
    ["amount_cents", "subtotal_cents", "tax_cents", "total_cents"].includes(key)
  )
    return (Number(value) / 100).toFixed(2);
  if (["claimed_minutes", "accepted_minutes", "recorded_minutes"].includes(key))
    return (Number(value) / 60).toFixed(2);
  return npiSafe_(value);
}
function npiRows_(sheet, table) {
  if (sheet.getLastRow() < 2) return [];
  const labels = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0];
  const known = ["id", "version", ...(NPI_LIVE.editable[table] || [])];
  const headers = labels.map(
    (label) => known.find((k) => npiLabel_(table, k) === label) || label,
  );
  return sheet
    .getRange(2, 1, sheet.getLastRow() - 1, headers.length)
    .getDisplayValues()
    .map((row) =>
      Object.fromEntries(
        headers.map((key, i) => {
          let value = row[i];
          if (labels[i] === "Price USD") {
            if (!/^\d{1,7}(\.\d{1,2})?$/.test(value))
              throw new Error(
                "Price USD needs a nonnegative price with at most two decimals.",
              );
            const parts = value.split(".");
            value = String(
              Number(parts[0]) * 100 + Number((parts[1] || "").padEnd(2, "0")),
            );
          }
          return [key, value];
        }),
      ),
    );
}
function npiBaseline_(ctx) {
  const s = ctx.book.getSheetByName("__NPI_BASE");
  if (!s || s.getLastRow() < 2) return [];
  return s
    .getRange(2, 1, s.getLastRow() - 1, 3)
    .getDisplayValues()
    .map((r) => ({ table: r[0], id: r[1], record: JSON.parse(r[2]) }));
}
function npiChange_(row, base, table) {
  const keys = NPI_LIVE.editable[table];
  if (!keys) return null;
  const proposal = {};
  for (const key of keys) {
    let v = row[key] ?? "";
    if (v.startsWith("'") && /^[=+@-]/.test(v.slice(1))) v = v.slice(1);
    if (key === "amount_cents") {
      if (!/^\d+$/.test(v))
        throw new Error(
          "amount_cents must be a nonnegative whole number of cents.",
        );
      v = Number(v);
    } else if (v === "") v = null;
    proposal[key] = v;
  }
  if (keys.every((k) => String(proposal[k] ?? "") === String(base[k] ?? "")))
    return null;
  const raw = JSON.stringify(proposal);
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw)
    .map((b) => (b + 256).toString(16).slice(-2))
    .join("");
  return {
    record_table: table,
    record_id: base.id,
    expected_version: Number(base.version),
    proposal,
    key:
      "NPI_CHANGE_" + base.id + "_" + base.version + "_" + digest.slice(0, 24),
  };
}
function npiPendingEdits_(ctx) {
  const edits = [];
  const baseline = npiBaseline_(ctx);
  for (const table of Object.keys(NPI_LIVE.editable)) {
    const sheet = ctx.book.getSheetByName(npiTab_(table));
    if (!sheet) continue;
    for (const row of npiRows_(sheet, table)) {
      const base = baseline.find(
        (b) => b.table === table && b.id === row.id,
      )?.record;
      if (!base)
        throw new Error("Unknown row: create new records in the app first.");
      const change = npiChange_(row, base, table);
      if (change) edits.push(change);
    }
  }
  return edits;
}
function npiPullLive() {
  const ctx = npiLiveAccess_(),
    lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000))
    throw new Error("Another workbook sync is running.");
  try {
    const edits = npiPendingEdits_(ctx);
    if (edits.some((c) => !ctx.props.getProperty(c.key)))
      throw new Error(
        "Submit unsent edits before refreshing. No data was overwritten.",
      );
    const fetched = {};
    for (const table of NPI_LIVE.tables) {
      let rows = [],
        more = true;
      for (let offset = 0; more; offset += 1000) {
        if (offset >= 20000)
          throw new Error(
            "More than 20,000 records: request an archived/reporting export.",
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
    const base = [];
    for (const [table, records] of Object.entries(fetched)) {
      const name = npiTab_(table);
      const sheet = ctx.book.getSheetByName(name) || ctx.book.insertSheet(name);
      if (
        sheet.getLastRow() > 1 &&
        !npiBaseline_(ctx).some((b) => b.table === table)
      )
        throw new Error(
          "Existing " +
            name +
            " data has no baseline. Preserve it before initializing.",
        );
      const displayRecords = records.map((r) => {
        const x = Object.assign({}, r);
        for (const spec of [
          ["contract_id", "_contract_name", "npi_contracts", "name"],
          ["site_id", "_site_name", "npi_sites", "name"],
          ["task_id", "_task_name", "npi_tasks", "name"],
          ["company_id", "_company_name", "npi_companies", "name"],
          ["worker_id", "_worker_name", "npi_profiles", "display_name"],
          ["actor_id", "_actor_name", "npi_profiles", "display_name"],
        ])
          if (r[spec[0]])
            x[spec[1]] =
              (fetched[spec[2]] || []).find((v) => v.id === r[spec[0]])?.[
                spec[3]
              ] || "";
        return x;
      });
      const headers = displayRecords.length
        ? Object.keys(displayRecords[0])
        : ["id"];
      const values = [
        headers.map((k) => npiLabel_(table, k)),
        ...displayRecords.map((r) => headers.map((k) => npiDisplay_(k, r[k]))),
      ];
      if (sheet.getMaxRows() < values.length)
        sheet.insertRowsAfter(
          sheet.getMaxRows(),
          values.length - sheet.getMaxRows(),
        );
      sheet.clearContents();
      sheet
        .getRange(1, 1, values.length, headers.length)
        .setNumberFormat("@")
        .setValues(values);
      sheet.setFrozenRows(1);
      sheet
        .getRange(1, 1, 1, headers.length)
        .setBackground("#102d50")
        .setFontColor("#ffffff")
        .setFontWeight("bold");
      sheet.setColumnWidths(1, headers.length, 150);
      const protectedSheet =
        sheet
          .getProtections(SpreadsheetApp.ProtectionType.SHEET)
          .find((p) => p.getDescription() === "NPI live protection") ||
        sheet.protect().setDescription("NPI live protection");
      protectedSheet.removeEditors(protectedSheet.getEditors());
      if (protectedSheet.canDomainEdit()) protectedSheet.setDomainEdit(false);
      const editable = [];
      for (const key of NPI_LIVE.editable[table] || []) {
        const col = headers.indexOf(key) + 1;
        if (col > 0 && sheet.getMaxRows() > 1) {
          const range = sheet.getRange(2, col, sheet.getMaxRows() - 1, 1);
          range.setBackground("#fff6d9");
          editable.push(range);
        }
      }
      protectedSheet.setUnprotectedRanges(editable);
      records.forEach((r) => base.push([table, r.id, JSON.stringify(r)]));
    }
    const baseline =
      ctx.book.getSheetByName("__NPI_BASE") ||
      ctx.book.insertSheet("__NPI_BASE");
    if (baseline.getMaxRows() < base.length + 1)
      baseline.insertRowsAfter(
        baseline.getMaxRows(),
        base.length + 1 - baseline.getMaxRows(),
      );
    baseline.clearContents();
    baseline
      .getRange(1, 1, 1, 3)
      .setValues([["Table", "ID", "Server snapshot"]]);
    if (base.length) baseline.getRange(2, 1, base.length, 3).setValues(base);
    baseline.hideSheet();
    ctx.book.toast(
      "Refreshed from Supabase. Yellow fields can be proposed for review.",
      "NPI Live",
      8,
    );
  } finally {
    lock.releaseLock();
  }
}
function npiSubmitLive() {
  const ctx = npiLiveAccess_(),
    lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000))
    throw new Error("Another workbook sync is running.");
  try {
    const changes = npiPendingEdits_(ctx);
    for (const change of changes) {
      const existing = ctx.props.getProperty(change.key);
      change.id = existing || Utilities.getUuid();
      npiLiveCall_(ctx, {
        operation: "sheet_propose",
        change: {
          id: change.id,
          record_table: change.record_table,
          record_id: change.record_id,
          expected_version: change.expected_version,
          proposal: change.proposal,
        },
      });
      ctx.props.setProperty(change.key, change.id);
    }
    ctx.book.toast(
      changes.length + " proposal(s) queued. NPI must review them in the app.",
      "NPI Live",
      10,
    );
  } finally {
    lock.releaseLock();
  }
}

/** Run once as workbook owner, then copy the generated value from Script Properties to Edge Function Secrets. */
function npiCreateSyncToken() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  const owner = DriveApp.getFileById(book.getId()).getOwner();
  const actor = Session.getEffectiveUser().getEmail();
  if (
    book.getId() !== NPI_LIVE.spreadsheetId ||
    !owner ||
    !actor ||
    owner.getEmail().toLowerCase() !== actor.toLowerCase()
  )
    throw new Error(
      "Only the workbook owner may initialize the bridge credential.",
    );
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty("NPI_SHEETS_TOKEN"))
    throw new Error(
      "A bridge token already exists; it was not changed. Use the existing value.",
    );
  props.setProperty(
    "NPI_SHEETS_TOKEN",
    (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ""),
  );
  book.toast(
    "Bridge token saved. Copy NPI_SHEETS_TOKEN from Apps Script Project Settings → Script Properties to Supabase Edge Function Secrets. Do not share it in chat.",
    "NPI Live",
    15,
  );
}
