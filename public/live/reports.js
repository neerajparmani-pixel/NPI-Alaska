const schemas = {
  work: [
    "work_id",
    "date",
    "company",
    "site",
    "address",
    "contract",
    "status",
    "title",
    "services",
    "workers",
    "recorded_hours",
    "claimed_hours",
    "approved_hours",
    "evidence_exception",
    "below_threshold",
    "record_link",
  ],
  hours: [
    "work_id",
    "date",
    "company",
    "site",
    "worker",
    "status",
    "check_in_utc",
    "check_out_utc",
    "check_in_latitude",
    "check_in_longitude",
    "check_in_accuracy_metres",
    "check_out_latitude",
    "check_out_longitude",
    "check_out_accuracy_metres",
    "check_in_map",
    "check_out_map",
    "break_minutes",
    "recorded_hours",
    "claimed_hours",
    "approved_hours",
    "review_reason",
    "record_link",
  ],
  evidence: [
    "work_id",
    "evidence_id",
    "date",
    "company",
    "site",
    "stage",
    "filename",
    "source",
    "captured_at",
    "uploaded_at",
    "bytes",
    "measurement_inches",
    "below_threshold",
    "record_link",
  ],
  issues: [
    "work_id",
    "date",
    "company",
    "site",
    "category",
    "urgency",
    "issue_status",
    "description",
    "resolution",
    "reported_at",
    "updated_at",
    "record_link",
  ],
};
export class ReportFeatures {
  constructor(context) {
    this.ctx = context;
    this.run = null;
    this.rows = [];
    this.page = 0;
    this.request = null;
    this.working = false;
    this.chosen = new Set();
  }
  get c() {
    return this.ctx();
  }
  clear() {
    this.run = null;
    this.rows = [];
    this.chosen.clear();
  }
  view() {
    const c = this.c,
      f = new URLSearchParams(location.hash.split("?")[1] || "");
    const end = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Anchorage",
    }).format(new Date());
    const start = new Date(Date.now() - 29 * 86400000)
      .toISOString()
      .slice(0, 10);
    const kind = f.get("kind") || "work";
    const fields =
      c.field("kind", "Report", "select", kind, [
        ["work", "Work"],
        ["hours", "Hours"],
        ["evidence", "Evidence"],
        ["issues", "Issues"],
      ]) +
      c.field("from", "From", "date", f.get("from") || start) +
      c.field("to", "Through", "date", f.get("to") || end) +
      c.field("company", "Company", "select", f.get("company") || "", [
        ["", "All permitted companies"],
        ...c.data.companies.map((x) => [x.id, x.name]),
      ]) +
      c.field("site", "Site", "select", f.get("site") || "", [
        ["", "All permitted sites"],
        ...c.data.sites.map((x) => [x.id, x.name]),
      ]) +
      c.field("worker", "Worker", "select", f.get("worker") || "", [
        ["", "All permitted workers"],
        ...c.data.people
          .filter((x) => x.role === "worker")
          .map((x) => [x.id, x.display_name]),
      ]) +
      c.field(
        "service",
        "Service / sub-line",
        "select",
        f.get("service") || "",
        [
          ["", "All services"],
          ...(c.data.field.visits.items || []).map((x) => [
            x.id,
            x.code + " · " + x.name,
          ]),
        ],
      ) +
      c.field("status", "Work status", "select", f.get("status") || "", [
        ["", "All statuses"],
        ...Object.entries(c.names),
      ]);
    let body =
      c.head(
        "Reports",
        "Complete database exports. Worker attendance is counted once per visit, even with several service lines.",
      ) +
      `<form id="complete-report-filters" novalidate class="work-filters">${fields}<button type="submit" class="btn primary">Generate report</button><p class="error" role="alert" id="report-error"></p></form><p class="small">Date filters use Alaska service dates. Selecting a service finds matching visits; it does not allocate attendance hours to individual service lines.</p><p id="report-progress" role="status" aria-live="polite"></p>`;
    if (!this.run)
      return (
        body +
        c.panel(
          "Ready to generate",
          "<p>Choose a period and report. Exports include all matching authorised records, not just the dashboard.</p>",
        )
      );
    const columns = schemas[this.run.filter.kind];
    const preview = {
      work: [
        "date",
        "company",
        "site",
        "status",
        "workers",
        "recorded_hours",
        "claimed_hours",
        "approved_hours",
      ],
      hours: [
        "date",
        "company",
        "site",
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
        "below_threshold",
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
    const visible = preview[this.run.filter.kind];
    const rows = this.rows.slice(this.page * 50, this.page * 50 + 50);
    body += c.panel(
      "Report ready",
      `<p><strong>${this.rows.length} rows</strong> · ${c.esc(this.run.filter.from)} through ${c.esc(this.run.filter.to)} · Snapshot ${c.esc(c.timestamp(this.run.created_at))}. Downloads remain available for one hour.</p><div class="actions">${c.button("Download CSV", "report-csv")}${c.button("Download Excel", "report-xlsx")}${c.button("PDF summary", "report-pdf")}</div><p class="small">CSV and Excel contain every matching row. PDF is a printable summary of up to 200 rows, with totals across all rows. Long text may be shortened; use CSV or Excel for full detail.</p>` +
        (this.run.filter.kind === "evidence"
          ? "<p>Photo files stay private. Select up to 20 files to download originals (100 MB maximum). Share downloaded files only with authorised people.</p>" +
            c.button("Download selected evidence", "report-evidence")
          : "") +
        c.table(
          [
            ...(this.run.filter.kind === "evidence" ? ["Select"] : []),
            ...visible.map((k) => k.replaceAll("_", " ")),
            "Work record",
          ],
          rows.map((r) => [
            ...(this.run.filter.kind === "evidence"
              ? [
                  `<input type="checkbox" data-evidence-select="${c.esc(r.evidence_id)}" aria-label="Select ${c.esc(r.filename)}" ${this.chosen.has(r.evidence_id) ? "checked" : ""}>`,
                ]
              : []),
            ...visible.map((k) => c.esc(r[k] ?? "—")),
            `<a href="#work=${r.work_id}">Open work</a>`,
          ]),
        ) +
        `<div class="actions">${this.page ? c.button("Previous", "report-prev") : ""}<span>Page ${this.page + 1} of ${Math.max(1, Math.ceil(this.rows.length / 50))}</span>${(this.page + 1) * 50 < this.rows.length ? c.button("Next", "report-next") : ""}</div>`,
    );
    return body;
  }
  async generate(values) {
    const c = this.c;
    const filter = Object.fromEntries(values);
    if (
      !filter.from ||
      !filter.to ||
      filter.from > filter.to ||
      new Date(filter.to) - new Date(filter.from) > 366 * 86400000
    )
      throw Error("Choose a valid date range of at most 367 days.");
    const key = JSON.stringify(filter);
    if (this.request?.key !== key)
      this.request = { key, id: crypto.randomUUID() };
    this.working = true;
    this.clear();
    this.progress("Preparing the complete database snapshot…");
    const actor = c.data.profile.id;
    try {
      const run = await c.api.reportStart(filter, this.request.id);
      const rows = [];
      for (let page = 1; rows.length < run.total; page++) {
        this.progress(`Loading report: ${rows.length} of ${run.total} rows…`);
        const part = await c.api.reportPage(run.id, page);
        if (!part.rows.length)
          throw Error(
            "Report is incomplete. Generate it again; nothing was downloaded.",
          );
        rows.push(...part.rows);
      }
      if (this.c.data.profile.id !== actor)
        throw Error("Account changed. Generate the report again.");
      if (rows.length !== run.total)
        throw Error("Report count changed; generate again.");
      this.run = run;
      this.rows = rows;
      this.page = 0;
      this.request = null;
      history.replaceState(
        null,
        "",
        location.pathname + "#reports?" + new URLSearchParams(filter),
      );
      c.render();
      this.progress("Report ready. All matching rows are included.");
    } finally {
      this.working = false;
    }
  }
  progress(s) {
    const e = document.querySelector("#report-progress");
    if (e) e.textContent = s;
  }
  async tools() {
    this.progress("Preparing download tools…");
    return import("./vendor/report-tools.js");
  }
  download(data, type, name) {
    const url = URL.createObjectURL(new Blob([data], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  async export(kind) {
    if (!this.run) throw Error("Generate a report first.");
    if (this.working) return;
    this.working = true;
    try {
      await this.c.api.reportPage(this.run.id, 1);
      const tools = await this.tools();
      const cols = schemas[this.run.filter.kind];
      const name =
        "NPI-" +
        this.run.filter.kind +
        "-" +
        this.run.filter.from +
        "-" +
        this.run.filter.to;
      if (kind === "csv")
        this.download(
          tools.csv(this.rows, cols),
          "text/csv;charset=utf-8",
          name + ".csv",
        );
      else if (kind === "xlsx")
        this.download(
          tools.xlsx(this.rows, cols),
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          name + ".xlsx",
        );
      else {
        const [font, logo] = await Promise.all(
          ["./vendor/report-font.ttf", "./icon-192.png"].map(async (path) => {
            const r = await fetch(path);
            if (!r.ok)
              throw Error("Report assets unavailable; reconnect and retry.");
            return new Uint8Array(await r.arrayBuffer());
          }),
        );
        this.download(
          await tools.pdf(this.rows, cols, this.run, font, logo),
          "application/pdf",
          name + "-summary.pdf",
        );
      }
      this.progress("Download prepared successfully.");
    } finally {
      this.working = false;
    }
  }
  async evidence() {
    if (!this.chosen.size || this.chosen.size > 20)
      throw Error("Select between 1 and 20 evidence files.");
    if (this.working) return;
    this.working = true;
    try {
      const files = await this.c.api.reportEvidence(this.run.id, [
        ...this.chosen,
      ]);
      if (files.length !== this.chosen.size)
        throw Error("Evidence access changed. Generate the report again.");
      if (files.reduce((n, f) => n + Number(f.bytes), 0) > 100 * 1024 * 1024)
        throw Error("Select fewer files: 100 MB maximum.");
      let total = 0;
      const originals = [];
      for (const [i, file] of files.entries()) {
        this.progress(
          `Downloading private original ${i + 1} of ${files.length}…`,
        );
        const url = await this.c.api.fileUrl(file.path);
        const r = await fetch(url, {
          signal: AbortSignal.timeout(30000),
          cache: "no-store",
        });
        if (!r.ok)
          throw Error(
            "A private file could not be downloaded. Retry; no bundle was created.",
          );
        const bytes = new Uint8Array(await r.arrayBuffer());
        total += bytes.length;
        if (total > 100 * 1024 * 1024)
          throw Error("Bundle exceeds 100 MB. Select fewer files.");
        originals.push({ name: file.filename || file.id, bytes });
      }
      const tools = await this.tools();
      this.download(
        tools.evidenceZip(originals),
        "application/zip",
        "NPI-private-evidence.zip",
      );
      this.progress("Selected originals downloaded successfully.");
    } finally {
      this.working = false;
    }
  }
  actions() {
    return {
      "report-csv": () => this.export("csv"),
      "report-xlsx": () => this.export("xlsx"),
      "report-pdf": () => this.export("pdf"),
      "report-evidence": () => this.evidence(),
      "report-prev": () => {
        this.page--;
        this.c.render();
      },
      "report-next": () => {
        this.page++;
        this.c.render();
      },
    };
  }
}
