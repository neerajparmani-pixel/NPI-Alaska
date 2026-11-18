// Pure workbook boundary: planning fields only; attendance and approvals are immutable.
export const workbookHeaders = [
  "work_id",
  "revision",
  "company_id",
  "status",
  "recorded_hours",
  "claimed_hours",
  "accepted_hours",
  "title",
  "planned_date",
  "equipment",
];
const safeCell = (value) => {
  const s = String(value ?? "");
  return (
    '"' + (/^[\s]*[=+@-]/.test(s) ? "'" + s : s).replaceAll('"', '""') + '"'
  );
};
export function csvText(rows) {
  return "\ufeff" + rows.map((row) => row.map(safeCell).join(",")).join("\r\n");
}
export function parseCsv(text) {
  if (typeof text !== "string" || text.length > 100000)
    throw Error("Use a CSV file smaller than 100 KB.");
  text = text.replace(/^\ufeff/, "");
  const rows = [];
  let row = [],
    cell = "",
    quoted = false,
    closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
      continue;
    }
    if (c === '"') {
      if (cell || closed) throw Error("Invalid CSV quotation.");
      quoted = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
      closed = false;
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
      cell = "";
      closed = false;
    } else {
      if (closed) throw Error("Unexpected text after a quoted CSV value.");
      cell += c;
    }
  }
  if (quoted) throw Error("Close the quoted CSV value.");
  row.push(cell);
  if (row.some((x) => x !== "")) rows.push(row);
  if (rows.length < 2 || rows.length > 21)
    throw Error("Include a header and 1–20 work rows.");
  return rows;
}
export function workbookRows(state, hours) {
  return [
    workbookHeaders,
    ...state.jobs.map((j) => [
      j.id,
      state.revision,
      j.company,
      j.status,
      hours(j).toFixed(2),
      j.claimedHours === undefined ? "" : Number(j.claimedHours).toFixed(2),
      j.acceptedHours === undefined ? "" : Number(j.acceptedHours).toFixed(2),
      j.title,
      j.date,
      j.equipment,
    ]),
  ];
}
export function previewWorkbook(text, state, hours) {
  const rows = parseCsv(text);
  if (JSON.stringify(rows[0]) !== JSON.stringify(workbookHeaders))
    throw Error("Keep the exported column names and order unchanged.");
  const current = new Map(
    workbookRows(state, hours)
      .slice(1)
      .map((r) => [r[0], r.map(String)]),
  );
  const seen = new Set(),
    changes = [];
  for (const row of rows.slice(1)) {
    if (row.length !== workbookHeaders.length)
      throw Error("Every row must have the exported number of columns.");
    const [id, revision] = row;
    if (seen.has(id)) throw Error("Duplicate work ID: " + id);
    seen.add(id);
    const old = current.get(id),
      j = state.jobs.find((j) => j.id === id);
    if (!old) throw Error("Unknown work ID: " + id);
    if (revision !== String(state.revision))
      throw Error(
        "This workbook is stale. Export a fresh copy; no changes were applied.",
      );
    if (row.slice(2, 7).some((value, i) => value !== old[i + 2]))
      throw Error("Company, status and hour totals are protected: " + id);
    if (row.slice(7).every((v, i) => v === old[i + 7])) continue;
    if (j.status !== "draft" || j.sessions.length)
      throw Error(
        "Only unstarted assignments can be edited from the workbook: " + id,
      );
    const [title, date, equipment] = row.slice(7);
    if (!title.trim() || title.length > 150 || equipment.length > 150)
      throw Error(
        "Use a work title and keep planning text within 150 characters.",
      );
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date + "T12:00:00Z")) ||
      new Date(date + "T12:00:00Z").toISOString().slice(0, 10) !== date
    )
      throw Error("Use a valid planned date in YYYY-MM-DD format.");
    if ([title, equipment].some((v) => /^[\s]*[=+@-]/.test(v)))
      throw Error("Formula-like planning values are not accepted.");
    changes.push({
      id,
      title: title.trim(),
      date,
      equipment: equipment.trim(),
      before: { title: j.title, date: j.date, equipment: j.equipment },
    });
  }
  return { revision: state.revision, changes };
}
