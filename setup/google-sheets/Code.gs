/** Bound-script workbook initializer. No public endpoint, credentials or live sync. */
function setupNpiWorkbook() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  const owner = DriveApp.getFileById(book.getId()).getOwner();
  const actor = Session.getEffectiveUser().getEmail();
  if (
    !owner ||
    !actor ||
    owner.getEmail().toLowerCase() !== actor.toLowerCase()
  ) {
    throw new Error("Only the spreadsheet owner can initialize this workbook.");
  }
  const tabs = {
    Guide: ["Topic", "Explanation"],
    Sites: ["ID", "Version", "Name", "Address", "Timezone", "Photo reference"],
    Tasks: ["ID", "Version", "Service name", "Description", "Active"],
    Companies: ["ID", "Version", "Company name", "Active"],
    Customer_Rates: [
      "ID",
      "Version",
      "Site ID",
      "Task ID",
      "Billing basis",
      "Price USD",
      "Effective from",
      "Effective through",
      "Change status",
    ],
    Subcontractor_Rates: [
      "ID",
      "Version",
      "Company ID",
      "Site ID",
      "Task ID",
      "Billing basis",
      "Price USD",
      "Effective from",
      "Effective through",
      "Change status",
    ],
    Work_Orders: [
      "ID",
      "Version",
      "Company ID",
      "Site ID",
      "Task ID",
      "Planned date",
      "Equipment",
      "Status",
    ],
    Attendance: [
      "ID",
      "Work ID",
      "Worker ID",
      "Event type",
      "Event time UTC",
      "Latitude",
      "Longitude",
      "Accuracy metres",
      "Source",
    ],
    Hours_Review: [
      "Work ID",
      "Worker ID",
      "Recorded hours",
      "Claimed hours",
      "Company reviewed by",
      "NPI accepted hours",
      "NPI reviewed by",
      "Reason",
      "Version",
    ],
    Subcontractor_Bills: [
      "ID",
      "Company ID",
      "Reference",
      "Status",
      "Currency",
      "Subtotal",
      "Tax",
      "Total",
      "Version",
    ],
    Customer_Invoices: [
      "ID",
      "Reference",
      "Status",
      "Currency",
      "Subtotal",
      "Tax",
      "Total",
      "Version",
    ],
    Sync_Review: [
      "Change ID",
      "Table",
      "Record ID",
      "Expected version",
      "Proposed change",
      "Status",
      "Validation message",
    ],
    Audit_Log: ["Event ID", "Actor ID", "Action", "Record ID", "Time UTC"],
  };
  for (const [name, columns] of Object.entries(tabs)) {
    const sheet = book.getSheetByName(name) || book.insertSheet(name);
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, columns.length).setValues([columns]);
    } else {
      const current = sheet
        .getRange(1, 1, 1, columns.length)
        .getDisplayValues()[0];
      if (JSON.stringify(current) !== JSON.stringify(columns)) {
        throw new Error(
          name +
            ": headers differ. Existing data was preserved; review before retrying.",
        );
      }
    }
    sheet
      .getRange(1, 1, 1, columns.length)
      .setBackground("#102d50")
      .setFontColor("#ffffff")
      .setFontWeight("bold")
      .setWrap(true);
    sheet.setFrozenRows(1);
    sheet.setColumnWidths(1, columns.length, 160);
    if (
      !sheet
        .getProtections(SpreadsheetApp.ProtectionType.SHEET)
        .some((p) => p.getDescription() === "NPI owner-managed table")
    ) {
      const protection = sheet
        .protect()
        .setDescription("NPI owner-managed table");
      protection.removeEditors(protection.getEditors());
      if (protection.canDomainEdit()) protection.setDomainEdit(false);
    }
  }
  const guide = book.getSheetByName("Guide");
  if (guide.getLastRow() === 1)
    guide.getRange(2, 1, 6, 2).setValues([
      [
        "Connection",
        "Not connected. This initializer creates table headers only.",
      ],
      [
        "Prices",
        "Management enters customer and subcontractor rates separately. No real prices are loaded.",
      ],
      [
        "Source of truth",
        "Supabase will own accepted records after the authenticated bridge is implemented.",
      ],
      [
        "Sheet changes",
        "Planning/rate edits require version checks and validation; no automatic sync is configured.",
      ],
      [
        "Protected records",
        "Original GPS, attendance, approvals and issued invoice snapshots are server-owned.",
      ],
      [
        "Access",
        "Management workbook only. Never put worker passwords or service-role secrets here.",
      ],
    ]);
  guide.setColumnWidth(2, 700);
  guide.getDataRange().setWrap(true);
  book.setSpreadsheetTimeZone("America/Anchorage");
}
