import { distanceMetres } from "./field-domain.js";
import { PhotoQueue } from "./photos.js";
export class FieldFeatures {
  constructor(context) {
    this.ctx = context;
    this.queue = null;
    this.previewLimit = 12;
    this.requests = new Map();
  }
  get c() {
    return this.ctx();
  }
  get state() {
    return (
      this.c.data.field || {
        issues: [],
        comments: [],
        history: [],
        notifications: [],
        email_status: [],
        settings: [],
      }
    );
  }
  async save(action, body) {
    const signature = action + JSON.stringify(body);
    let request = this.requests.get(signature);
    if (!request) {
      request = crypto.randomUUID();
      this.requests.set(signature, request);
    }
    const r = await this.c.api.fieldAction(action, body, request);
    this.requests.delete(signature);
    return r;
  }
  success(title, detail = "", important = false) {
    this.c.message(title);
    if (important)
      this.c.modal(
        title,
        `<p>${this.c.esc(detail)}</p>${this.c.button("Done", "close", "", "primary")}`,
      );
    else {
      let toast = document.querySelector("#success-toast");
      if (!toast) {
        toast = document.createElement("div");
        toast.id = "success-toast";
        toast.className = "success-toast";
        toast.setAttribute("aria-hidden", "true");
        document.body.append(toast);
      }
      toast.textContent = title;
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => toast.remove(), 5000);
    }
  }
  detail(w) {
    const { data, esc, button, panel, table, person, timestamp, site } = this.c;
    const members = data.members.filter((m) => m.work_id === w.id);
    const history = this.state.history.filter((h) => h.work_id === w.id);
    const owner = person(w.created_by);
    return (
      panel(
        "Assignment & team",
        `<p><b>Assigned by:</b> ${esc(owner?.display_name || (w.created_by ? "Assigned administrator (" + w.created_by.slice(0, 8) + ")" : "Legacy assignment — creator not recorded"))} · ${esc(timestamp(w.created_at))}</p><p><b>Subcontractor:</b> ${esc(this.c.company(w.company_id)?.name)}<br><b>Work area:</b> ${esc(w.area || "Follow the assignment instructions")}<br><b>Instructions:</b> ${esc(w.instructions || site(w.site_id)?.instructions || "No additional instructions")}</p>${table(
          ["Assigned worker", "Account", "Attendance"],
          members.map((m) => {
            const p = person(m.worker_id),
              e = data.events
                .filter(
                  (e) => e.work_id === w.id && e.worker_id === m.worker_id,
                )
                .sort(
                  (a, b) =>
                    Date.parse(a.received_at) - Date.parse(b.received_at),
                )
                .at(-1);
            return [
              esc(p?.display_name || m.worker_id),
              esc(p?.account_status || "Approved"),
              esc(
                e
                  ? e.event_kind === "check-in"
                    ? "Working"
                    : "Checked out"
                  : "Not started",
              ),
            ];
          }),
        )}<div class="actions">${button("Report a problem", "field-report", w.id)}${data.profile.role === "worker" && ["draft", "in-progress", "returned"].includes(w.status) ? button("Work outcome / problem completing", "field-outcome", w.id) : ""}${data.profile.role !== "worker" ? button("Assignment details / team", "field-plan", w.id) + button("Repeat assignment", "field-repeat", w.id) + (w.status === "draft" ? button("Cancel unstarted work", "field-cancel", w.id) : "") : ""}</div>${w.outcome && w.outcome !== "complete" ? `<p class="notice">${esc(w.outcome === "partial" ? "Partially completed" : "Unable to work")}: ${esc(w.outcome_reason)}. Explicit management review required.</p>` : ""}${w.evidence_exception_reason ? `<p class="notice">Evidence exception: ${esc(w.evidence_exception_reason)}. Explicit review required.</p>` : ""}`,
      ) +
      this.gallery(w) +
      panel(
        "Issues for this work",
        this.issueCards(this.state.issues.filter((i) => i.work_id === w.id)),
      ) +
      panel(
        "Assignment & review history",
        history.length
          ? table(
              ["When", "Who", "Action", "Details"],
              history.map((h) => [
                esc(timestamp(h.event_time)),
                esc(person(h.actor_id)?.display_name || h.actor_id),
                esc(
                  {
                    submit_hours: "Hours submitted",
                    company_approve: "Company approval",
                    npi_approve: "NPI verification",
                    return_work: "Correction requested",
                    plan_work: "Plan updated",
                    clock: "Attendance recorded",
                    report_issue: "Issue reported",
                    issue_update: "Issue updated",
                    outcome: "Outcome updated",
                  }[h.action] || h.action,
                ),
                esc(
                  h.detail?.reason ||
                    h.detail?.change?.reason ||
                    (h.detail?.members
                      ? "Assigned team: " +
                        h.detail.members
                          .map((id) => person(id)?.display_name || id)
                          .join(", ")
                      : ""),
                ),
              ]),
            )
          : "<p>No new history recorded. Original legacy events remain visible above.</p>",
      )
    );
  }
  gallery(w) {
    const { data, esc, panel, button, timestamp, person } = this.c;
    const all = data.evidence.filter((e) => e.work_id === w.id);
    let n = 0;
    return panel(
      "Photo & document gallery",
      ["before", "progress", "after", "issue", "timecard"]
        .map((stage) => {
          const files = all.filter((e) => (e.stage || "progress") === stage);
          return `<section class="evidence-group"><h3>${{ before: "Before work", progress: "Progress", after: "After work", issue: "Issue evidence", timecard: "Timecards / documents" }[stage]}</h3>${
            files.length
              ? '<div class="photo-grid">' +
                files
                  .filter(() => n++ < this.previewLimit)
                  .map(
                    (e) =>
                      `<article class="photo-card">${e.kind === "photo" ? `<img data-private-preview="${esc(e.preview_path || e.path)}" alt="${esc(stage)} work evidence" loading="lazy">` : ""}<p>${esc(e.filename || "Evidence file")}<br>${esc(person(e.uploaded_by)?.display_name || "Worker")}<br>Uploaded (server): ${esc(timestamp(e.created_at))}<br>${e.source === "app-camera" ? "Captured in app (device): " + esc(timestamp(e.captured_at)) : "Selected file: capture time not verified"}</p>${button("Open photo / original", "field-file", e.id)}</article>`,
                  )
                  .join("") +
                "</div>"
              : "<p>No " + stage + " evidence yet.</p>"
          }</section>`;
        })
        .join("") +
        (all.length > this.previewLimit
          ? button("Show more evidence", "field-more", w.id)
          : "") +
        '<p class="small muted">Stamped copies show device-reported capture or preparation time. Originals remain unchanged. Upload time above is server-recorded. Gallery metadata is not proof of a file’s capture location.</p>',
    );
  }
  async hydrate() {
    for (const img of document.querySelectorAll("[data-private-preview]")) {
      const path = img.dataset.privatePreview;
      try {
        const url = await this.c.api.fileUrl(path);
        if (img.isConnected) img.src = url;
      } catch {
        if (img.isConnected)
          img.alt = "Preview unavailable — use Open photo / original to retry";
      }
    }
  }
  issueCards(issues) {
    const { esc, button, site, data, timestamp } = this.c;
    return issues.length
      ? issues
          .map((i) => {
            const w = data.work.find((w) => w.id === i.work_id);
            return `<article class="issue-card"><div><span class="badge">${esc(i.urgency)} · ${esc(i.status)}</span><h3>${esc(i.category)} · ${esc(site(w?.site_id)?.name || "Assigned work")}</h3><p>${esc(i.description)}</p><p class="small">${esc(timestamp(i.created_at))}</p></div>${button("Open issue", "field-issue", i.id)}</article>`;
          })
          .join("")
      : "<p>No issues reported.</p>";
  }
  issuesView() {
    return (
      this.c.head(
        "Issues & problems",
        "Track acknowledgement, responsibility and resolution.",
      ) + this.issueCards(this.state.issues)
    );
  }
  notificationsView() {
    const { esc, button, timestamp, panel } = this.c;
    return (
      this.c.head(
        "Notifications",
        "Assignments, reviews and issue updates.",
        button("Mark all read", "field-read"),
      ) +
      this.state.notifications
        .map((n) =>
          panel(
            n.title,
            `<p>${esc(n.message)}</p><p>${esc(timestamp(n.created_at))} · ${n.read_at ? "Read" : "Unread"}</p>${n.work_id ? button("Open work", "open-work", n.work_id) : ""}`,
          ),
        )
        .join("") +
      (this.state.notifications.length ? "" : "<p>No notifications yet.</p>")
    );
  }
  settings() {
    const { data, esc, button, panel, table, timestamp } = this.c;
    const config = this.state.settings[0];
    const bytes = this.state.storage?.bytes || 0;
    return (
      panel(
        "Notification recipients",
        `<p>Send issue and review emails to your organisation’s recipients. NPI and each subcontractor manage separate lists.</p><p>${config?.emails?.length ? config.emails.map(esc).join(", ") : "No recipient emails configured."}</p><p>Urgent issue escalation: ${Number(config?.escalation_minutes || 60)} minutes.</p><div class="actions">${button("Edit recipient emails", "field-settings")}${button("Send test email", "field-test-email")}</div><p class="small">Email delivery requires the server sender configuration and scheduled dispatcher. “Sent” means accepted by the provider, not guaranteed inbox delivery.</p>`,
      ) +
      panel(
        "Evidence & storage",
        `<p>${Number(this.state.storage?.files || 0)} registered files · ${(bytes / 1048576).toFixed(1)} MB original-file volume in your permitted scope. Viewing copies also consume storage.</p><p>Originals are preserved. Automatic deletion is disabled. Retention changes require an approved policy and owner-controlled maintenance.</p>`,
      ) +
      (data.profile.role === "npi"
        ? panel(
            "Evidence requirements",
            table(
              ["Service", "Before", "After", "Action"],
              data.tasks.map((t) => [
                esc(t.name),
                t.evidence_policy?.before === false ? "Optional" : "Required",
                t.evidence_policy?.after === false ? "Optional" : "Required",
                button("Configure", "field-policy", t.id),
              ]),
            ),
          )
        : "") +
      panel(
        "Email queue",
        table(
          ["Created", "Recipient", "Status", "Attempts", "Detail"],
          this.state.email_status.map((e) => [
            esc(timestamp(e.created_at)),
            esc(e.recipient),
            esc(e.status === "sent" ? "Sent to provider" : e.status),
            Number(e.attempts || 0),
            esc(e.error || ""),
          ]),
        ),
      )
    );
  }
  workView() {
    const { data, esc, button, head, site, company, person, timestamp } =
      this.c;
    const q = new URLSearchParams(location.hash.split("?")[1] || "");
    const items = data.workSearch?.rows || data.work;
    const total = data.workSearch?.total ?? items.length;
    const page = Math.max(1, Number(q.get("page") || 1));
    const options = (records, selected, label) =>
      `<option value="">${label}</option>` +
      records
        .map(
          (x) =>
            `<option value="${esc(x.id)}" ${x.id === selected ? "selected" : ""}>${esc(x.name || x.display_name)}</option>`,
        )
        .join("");
    return (
      head(
        data.profile.role === "worker" ? "My work" : "Work orders",
        data.profile.role === "worker"
          ? "Your assignments and next steps."
          : "Assignments, locations and each company’s assigned team.",
        data.profile.role === "worker"
          ? ""
          : button("New work order", "new-work", "", "primary"),
      ) +
      `${data.profile.role === "worker" ? '<details class="work-filter-disclosure"><summary>Search / filter assignments</summary>' : ""}<form novalidate id="work-filters" class="work-filters"><div class="field"><label for="filter-q">Search work</label><input id="filter-q" name="q" value="${esc(q.get("q"))}"></div><div class="field"><label for="filter-company">Company</label><select id="filter-company" name="company">${options(data.companies, q.get("company"), "All permitted companies")}</select></div><div class="field"><label for="filter-site">Site</label><select id="filter-site" name="site">${options(data.sites, q.get("site"), "All permitted sites")}</select></div><div class="field"><label for="filter-contract">Contract</label><select id="filter-contract" name="contract">${options(this.c.contracts || [], q.get("contract"), "All permitted contracts")}</select></div><div class="field"><label for="filter-worker">Worker</label><select id="filter-worker" name="worker">${options(
        data.people.filter((p) => p.role === "worker"),
        q.get("worker"),
        "All assigned workers",
      )}</select></div><div class="field"><label for="filter-status">Status</label><select id="filter-status" name="status"><option value="">All statuses</option>${Object.entries(
        this.c.names,
      )
        .map(
          ([v, l]) =>
            `<option value="${v}" ${q.get("status") === v ? "selected" : ""}>${esc(l)}</option>`,
        )
        .join(
          "",
        )}</select></div><div class="field"><label for="filter-from">From</label><input id="filter-from" type="date" name="from" value="${esc(q.get("from"))}"></div><div class="field"><label for="filter-to">Through</label><input id="filter-to" type="date" name="to" value="${esc(q.get("to"))}"></div><button class="btn" type="submit">Apply filters</button>${button("Reset", "field-reset-filters")}</form>${data.profile.role === "worker" ? "</details>" : ""}<p>${total} matching assignments · page ${page}</p><div class="assignment-grid">` +
      items
        .map((w) => {
          const s = site(w.site_id),
            src = this.c.photo(s);
          const members =
            w.assigned_workers ||
            data.members
              .filter((m) => m.work_id === w.id)
              .map((m) => m.worker_id);
          return `<article class="panel work-card">${src ? `<img class="live-site-photo" src="../three-view/${src.replace("./", "")}" alt="${esc(s?.name)} site reference">` : ""}<span class="badge">${esc(this.c.names[w.status] || w.status)}</span><h2>${esc(s?.name || w.site_name || "Work site")}</h2><p>${esc(w.title)}</p>${w.outcome && w.outcome !== "complete" ? `<p class="notice">${w.outcome === "partial" ? "Partially completed" : "Unable to work"}</p>` : ""}<p>${esc(company(w.company_id)?.name)} · ${esc(w.planned_date)} · ${esc(w.equipment)}</p><p><b>Assigned by:</b> ${esc(w.assigned_by || person(w.created_by)?.display_name || (w.created_by ? "Assigned administrator" : "Legacy record"))}<br><b>Team:</b> ${members.map((id) => esc(person(id)?.display_name || id)).join(", ")}</p>${button(data.profile.role === "worker" ? "View assignment" : "Open work", "open-work", w.id, "primary")}</article>`;
        })
        .join("") +
      `</div>${items.length ? "" : "<p>No assignments match. Clear the filters or ask your administrator.</p>"}<div class="actions">${page > 1 ? button("Previous page", "field-page", String(page - 1)) : ""}${total > page * 50 ? button("Next page", "field-page", String(page + 1)) : ""}</div>`
    );
  }
  reportWork() {
    const q = new URLSearchParams(location.hash.split("?")[1] || "");
    return this.c.data.work.filter(
      (w) =>
        (!q.get("day") || w.planned_date === q.get("day")) &&
        (!q.get("company") || w.company_id === q.get("company")) &&
        (!q.get("site") || w.site_id === q.get("site")),
    );
  }
  reports() {
    const {
      data,
      esc,
      panel,
      table,
      site,
      company,
      person,
      timestamp,
      button,
    } = this.c;
    const work = this.reportWork();
    const filters = new URLSearchParams(location.hash.split("?")[1] || "");
    const exceptions = [];
    for (const w of work) {
      if (
        w.status === "draft" &&
        w.planned_date <
          new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Anchorage",
          }).format(new Date())
      )
        exceptions.push([w, "Overdue unstarted work"]);
      for (const m of data.members.filter((m) => m.work_id === w.id)) {
        const e = data.events
          .filter((e) => e.work_id === w.id && e.worker_id === m.worker_id)
          .sort((a, b) => Date.parse(a.received_at) - Date.parse(b.received_at))
          .at(-1);
        if (
          e?.event_kind === "check-in" &&
          Date.now() - Date.parse(e.received_at) > 12 * 3600000
        )
          exceptions.push([
            w,
            "Open shift over 12 hours — review missing checkout",
          ]);
        if (e?.accuracy_metres > 100)
          exceptions.push([w, "Poor GPS accuracy — inspect location"]);
        const review = data.reviews.find(
          (r) => r.work_id === w.id && r.worker_id === m.worker_id,
        );
        if (
          review?.claimed_minutes != null &&
          Math.abs(
            Number(review.claimed_minutes) - this.c.recorded(w, m.worker_id),
          ) > 0.01
        )
          exceptions.push([w, "Claim differs from recorded attendance"]);
      }
      if (w.outcome && w.outcome !== "complete")
        exceptions.push([w, "Reported " + w.outcome + ": " + w.outcome_reason]);
      if (
        ["contractor-review", "npi-review"].includes(w.status) &&
        !data.evidence.some((e) => e.work_id === w.id)
      )
        exceptions.push([w, "No registered work evidence"]);
    }
    for (const w of work) {
      for (const e of data.events.filter((e) => e.work_id === w.id)) {
        const distance = distanceMetres(e, site(w.site_id));
        if (
          distance != null &&
          distance > Number(site(w.site_id)?.radius_metres || 200)
        )
          exceptions.push([
            w,
            `GPS position about ${Math.round(distance)} m from configured site centre — review accuracy and access area`,
          ]);
      }
      if (w.evidence_exception_reason)
        exceptions.push([
          w,
          "Evidence exception: " + w.evidence_exception_reason,
        ]);
    }
    return (
      this.c.head(
        "Activity reports & exceptions",
        "Loaded records only; use Work orders filters to find older assignments.",
        button("Download activity CSV", "field-export"),
      ) +
      `<form novalidate id="report-filters" class="work-filters">${this.c.field("day", "Planned work date", "date", filters.get("day") || "")}${this.c.field("company", "Company", "select", filters.get("company") || "", [["", "All permitted companies"], ...data.companies.map((c) => [c.id, c.name])])}${this.c.field("site", "Site", "select", filters.get("site") || "", [["", "All permitted sites"], ...data.sites.map((s) => [s.id, s.name])])}<button class="btn" type="submit">Apply report filters</button></form>` +
      panel(
        "Review attention queue",
        table(
          ["Site / work", "Exception", "Action"],
          exceptions.map(([w, n]) => [
            esc(site(w.site_id)?.name) + " · " + esc(w.title),
            esc(n),
            button("Inspect", "open-work", w.id),
          ]),
        ),
      ) +
      panel(
        "Work activity",
        table(
          ["Date", "Site", "Company", "Status", "Team", "Outcome"],
          work.map((w) => [
            esc(w.planned_date),
            esc(site(w.site_id)?.name),
            esc(company(w.company_id)?.name),
            esc(this.c.names[w.status] || w.status),
            data.members
              .filter((m) => m.work_id === w.id)
              .map((m) => esc(person(m.worker_id)?.display_name))
              .join(", "),
            esc(w.outcome || "complete"),
          ]),
        ),
      )
    );
  }
  actions() {
    return {
      "field-report": (el) => {
        const { field, form } = this.c;
        form(
          "Report a problem",
          "field:report_issue",
          `<p>For immediate danger, contact emergency services or your supervisor directly. Do not wait for an email response.</p>${field(
            "category",
            "Problem type",
            "select",
            "access",
            [
              ["access", "Blocked access"],
              ["safety", "Safety"],
              ["equipment", "Equipment"],
              ["weather", "Weather"],
              ["work", "Work problem"],
              ["other", "Other"],
            ],
          )}${field("urgency", "Urgency", "select", "normal", [
            ["normal", "Normal"],
            ["urgent", "Urgent"],
          ])}${field("description", "Describe the problem", "textarea")}`,
          el.dataset.id,
        );
      },
      "field-issue": (el) => {
        const i = this.state.issues.find((i) => i.id === el.dataset.id);
        if (!i) return;
        const { data, field, form, esc, person, timestamp, table, button } =
          this.c;
        const admin = data.profile.role !== "worker";
        form(
          "Issue details",
          admin ? "field:issue_update" : "field:issue_comment",
          `<p><b>${esc(i.urgency)} · ${esc(i.category)}</b><br>${esc(i.description)}</p>${
            admin
              ? field("status", "Status", "select", i.status, [
                  ["open", "Open"],
                  ["acknowledged", "Acknowledged"],
                  ["in-progress", "In progress"],
                  ["resolved", "Resolved"],
                ]) +
                field(
                  "owner_id",
                  "Responsible administrator",
                  "select",
                  i.owner_id || "",
                  [
                    ["", "Not assigned"],
                    ...data.people
                      .filter((p) => p.role !== "worker" && p.active)
                      .map((p) => [p.id, p.display_name]),
                  ],
                ) +
                field(
                  "resolution",
                  "Resolution / update",
                  "textarea",
                  i.resolution,
                )
              : field("comment", "Add comment", "textarea")
          }<input name="version" type="hidden" value="${i.version}">${table(
            ["When", "Who", "Comment"],
            this.state.comments
              .filter((c) => c.issue_id === i.id)
              .map((c) => [
                esc(timestamp(c.created_at)),
                esc(person(c.actor_id)?.display_name),
                esc(c.body),
              ]),
          )}<p>${esc(i.resolution)}</p>${button("Open work", "open-work", i.work_id)}${admin ? button("Add comment", "field-comment", i.id) : ""}`,
          i.id,
        );
      },
      "field-comment": (el) =>
        this.c.form(
          "Add issue comment",
          "field:issue_comment",
          this.c.field("comment", "Comment", "textarea"),
          el.dataset.id,
        ),
      "field-settings": () => {
        const s = this.state.settings[0] || {};
        this.c.form(
          "Notification recipients",
          "field:notification_settings",
          this.c.field(
            "emails",
            "Recipient emails — one per line",
            "textarea",
            (s.emails || []).join("\n"),
          ) +
            this.c.field(
              "escalation_minutes",
              "Urgent acknowledgement deadline (minutes)",
              "number",
              s.escalation_minutes || 60,
            ),
        );
      },
      "field-test-email": () =>
        this.c.form(
          "Send test email",
          "field:test_email",
          "<p>Queue a test for the saved recipients. The configured dispatcher will send it. Check Email queue for the result.</p>",
        ),
      "field-policy": (el) => {
        const t = this.c.data.tasks.find((t) => t.id === el.dataset.id);
        this.c.form(
          "Evidence requirements for " + t.name,
          "field:service_policy",
          `<p>Applies to new assignments. Existing work keeps its original requirements.</p><label class="taskline"><input type="checkbox" name="before" ${t.evidence_policy?.before === false ? "" : "checked"}> Require before-work photos</label><label class="taskline"><input type="checkbox" name="after" ${t.evidence_policy?.after === false ? "" : "checked"}> Require after-work photos</label>`,
          t.id,
        );
      },
      "field-outcome": (el) => {
        const w = this.c.job();
        this.c.form(
          "Work outcome",
          "field:outcome",
          this.c.field(
            "outcome",
            "Outcome",
            "select",
            w.outcome || "complete",
            [
              ["complete", "Completed"],
              ["partial", "Partially completed"],
              ["unable", "Unable to work"],
            ],
          ) +
            this.c.field(
              "reason",
              "Explain any incomplete or unavailable work",
              "textarea",
              w.outcome_reason || "",
            ) +
            this.c.field(
              "evidence_exception_reason",
              "Reason for missing required photos / evidence",
              "textarea",
              w.evidence_exception_reason || "",
            ),
          el.dataset.id,
        );
      },
      "field-plan": (el) => {
        const { data, field, form } = this.c;
        const w = this.c.job();
        form(
          "Assignment details & crew",
          "field:work_plan",
          field("area", "Specific site area", "text", w.area) +
            field(
              "instructions",
              "Access instructions / hazards",
              "textarea",
              w.instructions,
            ) +
            field("reason", "Reason for this assignment change", "textarea") +
            (w.status === "draft"
              ? `<fieldset><legend>Assigned company workers</legend>${data.people
                  .filter(
                    (p) =>
                      p.role === "worker" &&
                      p.active &&
                      p.company_id === w.company_id,
                  )
                  .map(
                    (p) =>
                      `<label class="taskline"><input type="checkbox" name="members" value="${p.id}" ${data.members.some((m) => m.work_id === w.id && m.worker_id === p.id) ? "checked" : ""}>${this.c.esc(p.display_name)}</label>`,
                  )
                  .join("")}</fieldset>`
              : "<p>The original crew is preserved after work starts. Use a separate assignment for additional workers.</p>") +
            `<input type="hidden" name="version" value="${w.version}">`,
          w.id,
        );
      },
      "field-repeat": (el) =>
        this.c.form(
          "Repeat assignment",
          "field:repeat_work",
          "<p>Create up to twelve scheduled copies with the same approved team and checklist. Review the dates before saving.</p>" +
            this.c.field("first_date", "First repeated date", "date") +
            this.c.field(
              "interval_days",
              "Repeat every (days)",
              "number",
              "7",
            ) +
            this.c.field("count", "Number of copies", "number", "4"),
          el.dataset.id,
        ),
      "field-cancel": (el) =>
        this.c.form(
          "Cancel unstarted assignment",
          "field:cancel_work",
          "<p>This stops the unstarted job and preserves its history.</p>" +
            this.c.field("reason", "Cancellation reason", "textarea"),
          el.dataset.id,
        ),
      "field-site": (el) => {
        const s = this.c.site(el.dataset.id);
        this.c.form(
          "Site access & map position",
          "field:site_detail",
          this.c.field(
            "instructions",
            "Access instructions / hazards",
            "textarea",
            s.instructions,
          ) +
            this.c.field(
              "latitude",
              "Verified latitude (optional)",
              "text",
              s.latitude ?? "",
            ) +
            this.c.field(
              "longitude",
              "Verified longitude (optional)",
              "text",
              s.longitude ?? "",
            ) +
            this.c.field(
              "radius_metres",
              "GPS review radius (metres)",
              "number",
              s.radius_metres || 200,
            ) +
            `<input name="version" type="hidden" value="${s.version}">`,
          s.id,
        );
      },
      "field-read": async () => {
        await this.save("read_notifications", {});
        await this.c.load();
        this.success("Notifications marked read.");
      },
      "field-more": () => {
        this.previewLimit += 12;
        this.c.render();
      },
      "field-file": async (el) => {
        const e = this.c.data.evidence.find((e) => e.id === el.dataset.id);
        const original = await this.c.api.fileUrl(e.path),
          preview =
            e.kind === "photo"
              ? await this.c.api.fileUrl(e.preview_path || e.path)
              : null;
        this.c.modal(
          "Work evidence",
          `${preview ? `<img class="live-modal-photo" src="${this.c.esc(preview)}" alt="Stamped work evidence">` : ""}<p>Server upload time: ${this.c.esc(this.c.timestamp(e.created_at))}. Private links expire after one minute.</p><a class="btn primary" target="_blank" rel="noopener noreferrer" href="${this.c.esc(original)}">Open unchanged original</a>`,
        );
      },
      "field-export": () => {
        const { data, site, company, person } = this.c;
        const rows = [
          [
            "Date",
            "Site",
            "Company",
            "Instructions",
            "Status",
            "Assigned by",
            "Team",
          ],
          ...this.reportWork().map((w) => [
            w.planned_date,
            site(w.site_id)?.name,
            company(w.company_id)?.name,
            w.title,
            w.status,
            person(w.created_by)?.display_name,
            data.members
              .filter((m) => m.work_id === w.id)
              .map((m) => person(m.worker_id)?.display_name)
              .join("; "),
          ]),
        ];
        const safe = (v) => {
          v = String(v ?? "");
          if (/^[=+@-]/.test(v)) v = "'" + v;
          return '"' + v.replaceAll('"', '""') + '"';
        };
        const blob = new Blob(
          ["\ufeff" + rows.map((r) => r.map(safe).join(",")).join("\r\n")],
          { type: "text/csv" },
        );
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "NPI-loaded-activity.csv";
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      },
      "field-page": (el) => {
        const q = new URLSearchParams(location.hash.split("?")[1] || "");
        q.set("page", el.dataset.id);
        location.hash = "work?" + q;
      },
      "field-reset-filters": () => {
        location.hash = "work";
      },
    };
  }
  openUploads(w) {
    this.c.modal(
      "Add before / after photos & evidence",
      '<div id="photo-uploader"></div>',
    );
    this.queue?.dispose();
    this.queue = new PhotoQueue({
      root: document.querySelector("#photo-uploader"),
      api: this.c.api,
      work: w,
      profile: this.c.data.profile,
      site: this.c.site(w.site_id),
      markDirty: this.c.markDirty,
      onSaved: async ({ saved, failures }) => {
        if (!this.c.api.session) {
          this.c.endSession();
          return;
        }
        if (saved) {
          if (!failures) this.c.markClean();
          await this.c.refreshDataOnly();
          this.c.render();
          this.queue?.draw();
          this.success(
            failures
              ? "Some files saved; retry failed uploads."
              : `${saved} files saved successfully.`,
          );
        }
      },
    });
    this.queue.mount();
    const choices = document.querySelector("#photo-issue");
    for (const i of this.state.issues.filter((i) => i.work_id === w.id)) {
      const o = document.createElement("option");
      o.value = i.id;
      o.textContent = i.category + " · " + i.description.slice(0, 60);
      choices.append(o);
    }
  }
  async submit(kind, body, values) {
    const action = kind.slice(6);
    if (body.id && body.id === this.c.job()?.id && body.version == null)
      body.version = this.c.job().version;
    if (action === "notification_settings")
      body.emails = String(body.emails || "")
        .split(/[\n,;]/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    if (action === "service_policy") {
      body.before = values.get("before") === "on";
      body.after = values.get("after") === "on";
    }
    if (action === "work_plan" && this.c.job()?.status === "draft")
      body.members = values.getAll("members");
    const integer = (value, min, max, label) => {
      const n = Number(value);
      if (!Number.isInteger(n) || n < min || n > max)
        throw Error(`${label} must be a whole number from ${min} to ${max}.`);
    };
    if (action === "notification_settings") {
      integer(
        body.escalation_minutes,
        15,
        1440,
        "Urgent acknowledgement deadline",
      );
      if (
        body.emails.length > 10 ||
        body.emails.some((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
      )
        throw Error("Enter up to ten valid email addresses, one per line.");
    }
    if (action === "repeat_work") {
      integer(body.count, 1, 12, "Number of copies");
      integer(body.interval_days, 1, 365, "Repeat interval");
      if (!body.first_date) throw Error("Choose the first repeated date.");
    }
    if (action === "site_detail") {
      body.radius_metres = Number(body.radius_metres || 200);
      integer(body.radius_metres, 50, 5000, "GPS review radius");
      if (!!body.latitude != !!body.longitude)
        throw Error("Enter both latitude and longitude, or leave both blank.");
      if (
        body.latitude &&
        (!Number.isFinite(Number(body.latitude)) ||
          Math.abs(Number(body.latitude)) > 90 ||
          !Number.isFinite(Number(body.longitude)) ||
          Math.abs(Number(body.longitude)) > 180)
      )
        throw Error("Enter valid latitude and longitude coordinates.");
    }
    if (action === "report_issue" && !String(body.description || "").trim())
      throw Error("Describe the problem before reporting it.");
    if (action === "issue_comment" && !String(body.comment || "").trim())
      throw Error("Enter your comment.");
    if (
      action === "issue_update" &&
      body.status === "resolved" &&
      !String(body.resolution || "").trim()
    )
      throw Error("Explain how the issue was resolved.");
    if (
      ["work_plan", "cancel_work"].includes(action) &&
      !String(body.reason || "").trim()
    )
      throw Error("Explain the reason for this change.");
    if (
      action === "outcome" &&
      body.outcome !== "complete" &&
      !String(body.reason || "").trim()
    )
      throw Error("Explain the incomplete or unavailable work.");
    const result = await this.save(action, body);
    this.c.close(true);
    await this.c.load();
    if (action === "report_issue") {
      this.success(
        "Issue reported",
        "The issue was saved and in-app notifications were created. Email delivery uses the configured recipients and dispatcher. Add issue photos from the work evidence uploader.",
        true,
      );
    } else
      this.success(
        {
          test_email:
            "Test email queued. Check Email queue for the delivery result.",
          repeat_work: "Repeated assignments created.",
          issue_update: "Issue updated.",
          notification_settings: "Recipient emails saved.",
          cancel_work: "Assignment cancelled.",
        }[action] || "Changes saved successfully.",
        "Your changes are saved.",
        action === "cancel_work",
      );
    return result;
  }
}
