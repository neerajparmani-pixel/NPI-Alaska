import { zipSync, strToU8 } from "fflate";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
const text = (v) =>
  v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
const label = (k) =>
  k.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
export function csvCell(v) {
  const s = text(v);
  return (
    '"' + (/^[\s]*[=+@-]/.test(s) ? "'" + s : s).replaceAll('"', '""') + '"'
  );
}
export function csv(rows, columns) {
  return (
    "\uFEFF" +
    [columns.map(label), ...rows.map((r) => columns.map((k) => r[k]))]
      .map((r) => r.map(csvCell).join(","))
      .join("\r\n")
  );
}
const xml = (v) =>
  text(v)
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "")
    .replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&apos;",
        })[c],
    );
const column = (i) => {
  let s = "";
  for (i++; i; i = Math.floor((i - 1) / 26))
    s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
};
export function xlsx(rows, columns) {
  const values = [
    columns.map(label),
    ...rows.map((r) => columns.map((k) => r[k])),
  ];
  const cells = values
    .map(
      (r, i) =>
        '<row r="' +
        (i + 1) +
        '">' +
        r
          .map((v, j) =>
            typeof v === "number" && Number.isFinite(v)
              ? `<c r="${column(j)}${i + 1}"><v>${v}</v></c>`
              : `<c r="${column(j)}${i + 1}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`,
          )
          .join("") +
        "</row>",
    )
    .join("");
  const parts = {
    "[Content_Types].xml":
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    "_rels/.rels":
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    "xl/workbook.xml":
      '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Operations" sheetId="1" r:id="rId1"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels":
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    "xl/worksheets/sheet1.xml":
      '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="' +
      columns.length +
      '" width="24" customWidth="1"/></cols><sheetData>' +
      cells +
      '</sheetData><autoFilter ref="A1:' +
      column(columns.length - 1) +
      values.length +
      '"/></worksheet>',
  };
  return zipSync(
    Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, strToU8(v)])),
  );
}
export function evidenceZip(files) {
  return zipSync(
    Object.fromEntries(
      files.map((f, i) => [
        String(i + 1).padStart(2, "0") +
          "-" +
          f.name.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 140),
        f.bytes,
      ]),
    ),
  );
}
export async function pdf(rows, columns, meta, fontBytes, logoBytes) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes, { subset: true });
  const logo = await doc.embedPng(logoBytes);
  const navy = rgb(0.063, 0.173, 0.314),
    grey = rgb(0.32, 0.4, 0.48);
  let page, y;
  const draw = (s, x, size = 9, color = navy) => {
    page.drawText(text(s), { x, y, size, font, color });
  };
  const add = () => {
    page = doc.addPage([842, 595]);
    y = 552;
    page.drawImage(logo, { x: 32, y: 524, width: 40, height: 40 });
    draw("ALASKA NPI  |  " + label(meta.filter.kind) + " report", 84, 17);
    y = 520;
    draw(
      "Snapshot: " + meta.created_at + "  ·  America/Anchorage service dates",
      32,
      9,
      grey,
    );
    y = 500;
    draw(
      "Period: " +
        meta.filter.from +
        " to " +
        meta.filter.to +
        "  ·  " +
        rows.length +
        " matching rows",
      32,
    );
    y = 480;
  };
  add();
  const hours = ["recorded_hours", "claimed_hours", "approved_hours"];
  if (columns.includes("recorded_hours")) {
    draw(
      hours
        .map(
          (k) =>
            label(k) +
            ": " +
            (rows.some((r) => r[k] != null)
              ? rows.reduce((n, r) => n + Number(r[k] || 0), 0).toFixed(2)
              : "—"),
        )
        .join("     "),
      32,
    );
    y -= 22;
  }
  const shown = rows.slice(0, 200);
  draw(
    "Summary lists " +
      shown.length +
      " of " +
      rows.length +
      " rows. CSV / Excel contain every matching row.",
    32,
    9,
    grey,
  );
  y -= 26;
  const preferred = {
    work: [
      "date",
      "company",
      "site",
      "workers",
      "recorded_hours",
      "claimed_hours",
      "approved_hours",
    ],
    hours: [
      "date",
      "company",
      "worker",
      "recorded_hours",
      "claimed_hours",
      "approved_hours",
    ],
    evidence: [
      "date",
      "site",
      "stage",
      "filename",
      "source",
      "measurement_inches",
    ],
    issues: [
      "date",
      "site",
      "category",
      "urgency",
      "issue_status",
      "description",
    ],
  };
  const cols = preferred[meta.filter.kind].filter((k) => columns.includes(k));
  const width = 778 / Math.max(cols.length, 1);
  const fit = (s, max) => {
    s = text(s).replace(/[\r\n]+/g, " ");
    let shortened = false;
    while (s.length && font.widthOfTextAtSize(s, 8) > max - 14) {
      s = s.slice(0, -2);
      shortened = true;
    }
    return shortened ? s + "…" : s;
  };
  const header = () => {
    cols.forEach((c, i) => draw(fit(label(c), width), 32 + i * width, 9));
    y -= 22;
  };
  header();
  for (const row of shown) {
    if (y < 48) {
      add();
      header();
    }
    cols.forEach((c, i) => draw(fit(row[c], width), 32 + i * width, 8));
    y -= 19;
  }
  const pages = doc.getPages();
  pages.forEach((p, i) =>
    p.drawText(
      "Alaska NPI  ·  Private management report  ·  " +
        (i + 1) +
        " / " +
        pages.length,
      { x: 32, y: 22, size: 8, font, color: grey },
    ),
  );
  return doc.save();
}
