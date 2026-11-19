import { api } from "./api.js";
import { icon } from "../three-view/icons.js";
import { config } from "./config.js";
import { suppliedArtwork } from "../three-view/assets.js";
const $ = (s, r = document) => r.querySelector(s),
  app = $("#app"),
  dialog = $("#dialog");
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (v) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(v || 0) / 100,
  );
const hour = (v) => (Number(v || 0) / 60).toFixed(2);
const timestamp = (v) =>
  v
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Anchorage",
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(v)) + " AK"
    : "—";
const id = () => crypto.randomUUID();
const names = {
  draft: "Assigned",
  "in-progress": "In progress",
  "contractor-review": "Company review",
  "npi-review": "NPI verification",
  approved: "NPI approved",
  returned: "Correction requested",
};
const basis = [
  ["hourly", "Hourly"],
  ["fixed", "Fixed service"],
  ["per-visit", "Per visit"],
  ["per-load", "Per load"],
];
let data = null,
  busy = false,
  selected = null,
  feedback = "",
  feedbackError = false,
  returnFocus = null,
  dirty = false,
  latest = 0,
  captured = null,
  pending = new Map(),
  dialogRoute = "",
  suspendedDraft = null;
const person = (x) => data.people.find((p) => p.id === x),
  site = (x) => data.sites.find((s) => s.id === x),
  task = (x) => data.tasks.find((t) => t.id === x),
  company = (x) => data.companies.find((c) => c.id === x),
  job = () => data.work.find((w) => w.id === selected);
const photo = (s) => suppliedArtwork.sites[s?.photo_path] || "";
const button = (label, action, value = "", classes = "") =>
  `<button type="button" class="btn ${classes}" data-action="${action}" data-id="${esc(value)}">${label}</button>`;
const panel = (title, body, action = "") =>
  `<section class="panel"><header class="panel-head"><h2>${esc(title)}</h2>${action}</header>${body}</section>`;
const roles = {
  npi: "NPI Admin",
  sub: "Subcontractor Admin",
  worker: "Subcontractor Worker",
};
const routeIcons = {
  overview: "home",
  work: "work",
  review: "check",
  hours: "clock",
  sites: "snow",
  companies: "building",
  rates: "file",
  documents: "file",
  people: "users",
  sheets: "file",
  settings: "settings",
};
const emblem = (kind) =>
  `<img class="brand-image ${kind}" src="../three-view/${suppliedArtwork.logo.replace("./", "")}" alt="NPI company emblem">`;
const head = (title, description, action = "") =>
  `<header class="pagehead"><div><p class="eyebrow">${data.profile.role === "worker" ? "YOUR WORKDAY" : "ALASKA OPERATIONS"}</p><h1>${esc(title)}</h1><p>${esc(description)}</p></div>${action}</header>`;
const initials = () =>
  data.profile.display_name
    .trim()
    .split(/\s+/)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "N";
function summary() {
  return (
    data.summary || {
      active: data.work.filter((w) => w.status === "in-progress").length,
      company_review: data.work.filter((w) => w.status === "contractor-review")
        .length,
      npi_review: data.work.filter((w) => w.status === "npi-review").length,
      approved: data.work.filter((w) => w.status === "approved").length,
      work_count: data.work.length,
    }
  );
}
function field(name, label, type = "text", value = "", options = []) {
  return `<div class="field"><label for="${name}">${esc(label)}</label>${type === "select" ? `<select id="${name}" name="${name}">${options.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(value) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>` : type === "textarea" ? `<textarea id="${name}" name="${name}" style="resize:none" maxlength="2000">${esc(value)}</textarea>` : `<input id="${name}" name="${name}" type="${type}" value="${esc(value)}" ${type === "password" ? 'autocomplete="new-password"' : type === "number" ? 'min="0" max="1000000" step="0.0001"' : `maxlength="${{ name: 150, display_name: 150, username: 50, equipment: 150, title: 200, address: 300, reference: 100 }[name] || 300}"`}>`}<span class="err" id="${name}-error"></span></div>`;
}
function table(headers, rows) {
  return `<div class="table-scroll" tabindex="0" role="region" aria-label="${esc(headers.join(", "))}"><table><thead><tr>${headers.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}">No records yet.</td></tr>`}</tbody></table></div>`;
}
function message(text, error = false) {
  feedback = text;
  feedbackError = error;
  const box = $("#feedback");
  if (box) {
    box.textContent = text;
    box.classList.toggle("error", error);
  }
  $("#notice").textContent = text;
}
function nav() {
  return data.profile.role === "worker"
    ? [
        ["work", "My work"],
        ["hours", "My hours"],
        ["sites", "Sites"],
      ]
    : [
        ["overview", "Overview"],
        ["work", "Work orders"],
        [
          "review",
          data.profile.role === "npi" ? "NPI verification" : "Review hours",
        ],
        ["sites", "Sites & locations"],
        ...(data.profile.role === "npi"
          ? [["companies", "Subcontractors"]]
          : []),
        ...(data.profile.role === "npi" ? [["rates", "Rates"]] : []),
        ["documents", "Billing drafts"],
        ["people", "People & access"],
        ...(data.profile.role === "npi"
          ? [["sheets", "Spreadsheet review"]]
          : []),
        ["settings", "Settings"],
      ];
}
function login(error = "") {
  document.body.dataset.role = "";
  document.title = "Sign in · Alaska NPI";
  app.innerHTML = `<div class="login-layout"><section class="login-brand-panel" aria-label="NPI identity"><p class="login-wordmark">NPI / ALASKA OPERATIONS</p><div class="login-emblem"><img class="brand-image login" src="../three-view/${suppliedArtwork.logo.replace("./", "")}" alt="NPI company emblem"></div><div class="login-brand-copy"><p class="eyebrow">PERFORMANCE · POWER · PRECISION</p><h2><span>Every site.</span> <span>Every shift.</span> <span>Accounted for.</span></h2><p>Work records, hours and verification in one place.</p></div></section><main id="main" class="login-main"><div class="login-form-wrap"><h1>Welcome to Alaska NPI</h1><p>Sign in with your company account.</p><form id="login-form" class="live-form" novalidate><div class="field"><label for="username">Company username or admin email</label><input id="username" name="username" autocomplete="username" autocapitalize="none" spellcheck="false"></div><div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password"></div>${button("Show password", "show-password")}<button class="btn primary" type="submit">Sign in</button><p id="feedback" class="live-feedback error" role="alert">${esc(error)}</p></form><p class="small muted">Need access or a password reset? Contact your company administrator. Sessions end when you reload this page; saved work stays in Supabase.</p></div></main></div>`;
}
function render() {
  if (!data) {
    login(feedbackError ? feedback : "");
    return;
  }
  document.body.dataset.role = data.profile.role;
  const pages = nav();
  let page = location.hash.slice(1) || "work";
  if (!pages.some(([p]) => p === page) && page !== "detail") page = "work";
  document.title =
    (pages.find(([p]) => p === page)?.[1] || "Work details") + " · Alaska NPI";
  const content = (
    {
      overview: overviewView,
      work: workView,
      review: reviewView,
      sites: siteView,
      rates: rateView,
      documents: documentView,
      people: peopleView,
      companies: companiesView,
      sheets: sheetView,
      settings: settingsView,
      hours: hoursView,
      detail: detailView,
    }[page] || workView
  )();
  const label = pages.find(([p]) => p === page)?.[1] || "Work details";
  const reviewCount =
    data.profile.role === "npi"
      ? summary().npi_review
      : summary().company_review;
  const initialsText = esc(initials());
  app.innerHTML = `<div class="reference-shell"><aside class="reference-sidebar" aria-label="Workspace navigation"><div class="side-brand">${emblem("sidebar")}<h2>ALASKA NPI</h2><p>CONTRACT OVERSIGHT</p></div><p class="side-label">OPERATIONS WORKSPACE</p><nav class="side-nav" aria-label="Main navigation">${pages.map(([p, l]) => `<a href="#${p}" ${page === p ? 'aria-current="page"' : ""}>${icon(routeIcons[p])}<span>${esc(l)}</span>${p === "review" && reviewCount ? `<b class="side-count">${reviewCount}</b>` : ""}</a>`).join("")}</nav><div class="side-bottom"><span class="avatar">${initialsText}</span><div class="grow"><b>${esc(data.profile.display_name)}</b><p>${roles[data.profile.role]}</p></div>${button("Sign out", "logout", "", "ghost")}</div></aside><div class="reference-workspace"><header class="reference-topbar"><div class="top-crumb"><b>${emblem("header")} ALASKA NPI</b><p>Operations / ${esc(label)}</p></div><div class="top-controls"><span class="live-role">${roles[data.profile.role]}</span>${button(icon("clock") + "<span>Refresh</span>", "refresh")}${button("Sign out", "logout", "", "live-top-signout")}<span class="top-avatar" aria-label="${esc(data.profile.display_name)}">${initialsText}</span></div><div class="mobile-navigation"><label for="live-nav">Go to</label><select id="live-nav" aria-label="Go to page">${page === "detail" ? '<option value="detail" selected>Work details</option>' : ""}${pages.map(([p, l]) => `<option value="${p}" ${p === page ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></div></header><main id="main" class="main live-main"><div class="live-banner live-connection"><span class="live-connection-label">${icon("check")} Connected to Supabase</span><span>Updated ${esc(timestamp(latest))}</span></div>${!navigator.onLine ? '<p class="live-banner error">Offline. New changes cannot be saved until your connection returns.</p>' : ""}${data.work.length >= 500 ? '<p class="notice">Showing the latest 500 permitted assignments in this view.</p>' : ""}<p id="feedback" class="live-feedback ${feedbackError ? "error" : ""}" role="status">${esc(feedback)}</p><div class="reference-content">${content}</div><footer class="footer"><span>ALASKA NPI · Performance. Power. Precision.</span><span>Alaska work time · ${roles[data.profile.role]}</span></footer></main>${data.profile.role === "worker" ? `<nav class="worker-bottom-nav" aria-label="Worker navigation">${pages.map(([p, l]) => `<a href="#${p}" ${page === p ? 'aria-current="page"' : ""}>${icon(routeIcons[p])}<span>${esc(l)}</span></a>`).join("")}</nav>` : ""}</div></div>`;
  document.querySelectorAll("button").forEach((b) => (b.disabled = busy));
}
async function load() {
  const route = location.hash.slice(1) || "work";
  const stage =
    route === "review"
      ? data?.profile.role === "npi"
        ? "npi-review"
        : "contractor-review"
      : route === "documents"
        ? "approved"
        : "all";
  const snapshot = await api.snapshot(
    stage,
    route === "detail" ? selected : null,
  );
  data = snapshot;
  latest = Date.now();
  render();
}
function overviewView() {
  const s = summary(),
    npi = data.profile.role === "npi";
  const awaiting = npi ? s.npi_review : s.company_review;
  const priority = {
    "npi-review": 0,
    "contractor-review": 1,
    "in-progress": 2,
    returned: 3,
    draft: 4,
    approved: 5,
  };
  const activity = [...data.work]
    .sort((a, b) => (priority[a.status] ?? 6) - (priority[b.status] ?? 6))
    .slice(0, 6);
  const metric = (label, value, detail, glyph) =>
    `<div class="metric"><div class="row"><span class="metric-label">${label}</span>${icon(glyph)}</div><strong>${value}</strong><small>${detail}</small></div>`;
  const queue = `<ul class="attention-list"><li>${awaiting} work order(s) await ${npi ? "NPI verification" : "company review"}.</li><li>${s.active} work order(s) are in progress.</li><li>${s.approved} work order(s) have NPI approval.</li></ul><div class="live-card-actions">${button("Review records", "goto", "review", "primary")}${button("Work orders", "goto", "work")}</div>`;
  const activityRows = activity
    .map((w) => {
      const workers = data.members
        .filter((m) => m.work_id === w.id)
        .map((m) => person(m.worker_id)?.display_name)
        .filter(Boolean);
      return `<div class="activity-row"><span class="activity-symbol">${icon(w.kind === "hauling" ? "truck" : "snow")}</span><div class="grow"><b>${esc(workers.join(", ") || w.title || "Assignment")}</b><p>${esc(site(w.site_id)?.name || "Location unavailable")} · ${esc(w.equipment || task(w.task_id)?.name)}</p><small>${esc(company(w.company_id)?.name || "")}</small></div>${button(esc(names[w.status]), "open-work", w.id, "activity-status")}</div>`;
    })
    .join("");
  const siteHours = data.sites
    .filter((s) => data.work.some((w) => w.site_id === s.id))
    .map((s) => {
      const work = data.work.filter((w) => w.site_id === s.id);
      const totals = work.reduce(
        (sum, w) => {
          for (const m of data.members.filter((m) => m.work_id === w.id)) {
            sum.recorded += recorded(w, m.worker_id);
            sum.accepted += Number(
              data.reviews.find(
                (r) => r.work_id === w.id && r.worker_id === m.worker_id,
              )?.accepted_minutes || 0,
            );
          }
          return sum;
        },
        { recorded: 0, accepted: 0 },
      );
      return `<article class="mini-site"><h3>${esc(s.name)}</h3><div class="row between"><div><b>${hour(totals.recorded)}</b><small> recorded h</small><p class="small muted">${hour(totals.accepted)} NPI-accepted h</p></div>${button("View work", "goto", "work")}</div></article>`;
    })
    .join("");
  return (
    head(
      npi ? "NPI contract oversight" : "Subcontractor operations",
      npi
        ? "Monitor activity. Verify delivery. Review contractor charges."
        : "Coordinate crews. Review hours. Keep NPI updated.",
    ) +
    `<section class="oversight-hero"><div><p>CUSTOMER → NPI → SUBCONTRACTOR</p><h2>Work visibility, before the invoice.</h2><span>Crews belong to the subcontractor. NPI monitors and verifies service.</span></div><div class="hero-stat"><strong>${s.approved}/${s.work_count ?? data.work.length}</strong><span>NPI verified</span></div></section><section class="metrics" aria-label="Operational summary">${metric("Active work", s.active, "Recorded work in progress", "work")}${metric(npi ? "NPI review" : "Company review", awaiting, "Hours awaiting verification", "check")}${metric("Verified records", s.approved, "Accepted after NPI review", "pin")}${metric(npi ? "Company review" : "NPI review", npi ? s.company_review : s.npi_review, "Next approval handoff", "users")}</section><div class="two oversight-grid"><div class="stack">${panel("Worker activity", activityRows || '<div class="live-empty"><span class="activity-symbol">' + icon("work") + "</span><h3>No work activity yet</h3><p>Assign work to see crew activity, locations and approval progress here.</p></div>", button("All work", "goto", "work", "compact"))}${panel("Hours by location", '<p class="small muted">Worker-hours for assignments loaded in this view.</p><div class="site-summary">' + (siteHours || '<p class="live-empty-copy">Recorded and accepted hours will appear after workers start their assignments.</p>') + "</div>")}${panel("Work register", workRegister(activity), npi ? button("New work order", "new-work", "", "primary") : "")}</div><aside class="stack" aria-label="Review and setup">${panel("Attention queue", queue)}${panel("Approval handoff", '<ol class="flow"><li><span class="step">1</span><div><b>Subcontractor Worker</b><p>Check in, complete tasks, upload evidence and check out.</p></div></li><li><span class="step">2</span><div><b>Subcontractor Admin</b><p>Review workers’ hours and forward them to NPI.</p></div></li><li><span class="step">3</span><div><b>NPI Admin</b><p>Cross-check original records and accept hours.</p></div></li></ol>')}${!data.work.length && npi ? panel("Set up your workspace", '<p>Add your subcontractor, locations and worker accounts, then create the first work order.</p><div class="live-setup-links">' + button("Add subcontractor", "new-company") + button("Add location", "new-site") + button("Add service", "new-task") + button("Manage people", "goto", "people") + "</div>") : ""}</aside></div>`
  );
}
function workRegister(list) {
  return table(
    ["Location / task", "Company", "Status", "Action"],
    list.map((w) => [
      esc(site(w.site_id)?.name) +
        "<br><small>" +
        esc(w.title || task(w.task_id)?.name) +
        "</small>",
      esc(company(w.company_id)?.name),
      `<span class="badge">${esc(names[w.status])}</span>`,
      button("Open", "open-work", w.id),
    ]),
  );
}
function workView() {
  const worker = data.profile.role === "worker";
  return (
    head(
      worker ? "My work" : "Work orders",
      worker
        ? "Your assignments, locations and next steps."
        : "Assigned work, site evidence and approval progress.",
      data.profile.role === "npi"
        ? button("New work order", "new-work", "", "primary")
        : "",
    ) +
    (data.work.length
      ? `<div class="live-work-grid">${data.work.map((w) => `<article class="panel live-work-card">${photo(site(w.site_id)) ? `<img class="live-photo" src="../three-view/${photo(site(w.site_id)).replace("./", "")}" alt="${esc(site(w.site_id)?.name)}">` : ""}<div class="live-work-card-body"><span class="badge">${esc(names[w.status])}</span><h2>${esc(site(w.site_id)?.name)}</h2><p>${esc(w.title || task(w.task_id)?.name)}</p><p class="small muted">${esc(w.planned_date)} · ${esc(w.equipment)}</p>${button("View assignment", "open-work", w.id, "primary")}</div></article>`).join("")}</div>`
      : panel(
          "No assignments yet",
          data.profile.role === "npi"
            ? '<p>First add a company, location, service and worker profiles. Then create a work order.</p><div class="live-card-actions">' +
                button("Add company", "new-company") +
                button("Add location", "new-site") +
                button("Add service", "new-task") +
                button("Manage people", "goto", "people") +
                "</div>"
            : "<p>Your administrator has not assigned any work yet.</p>",
        ))
  );
}
function recorded(work, worker) {
  const review = data.reviews.find(
    (r) => r.work_id === work.id && r.worker_id === worker,
  );
  if (review?.recorded_minutes != null) return Number(review.recorded_minutes);
  const events = data.events
    .filter((e) => e.work_id === work.id && e.worker_id === worker)
    .sort((a, b) => Date.parse(a.received_at) - Date.parse(b.received_at));
  let total = 0,
    previous;
  for (const e of events) {
    if (e.event_kind === "check-out" && previous?.event_kind === "check-in")
      total +=
        (Date.parse(e.received_at) - Date.parse(previous.received_at)) / 60000 -
        Number(e.break_minutes);
    previous = e;
  }
  return Math.max(0, total);
}
function comparison(w) {
  return table(
    ["Worker", "Recorded hours", "Claimed hours", "NPI accepted hours"],
    data.members
      .filter((m) => m.work_id === w.id)
      .map((m) => {
        const r = data.reviews.find(
          (r) => r.work_id === w.id && r.worker_id === m.worker_id,
        );
        return [
          esc(person(m.worker_id)?.display_name),
          hour(recorded(w, m.worker_id)),
          r?.claimed_minutes == null ? "—" : hour(r.claimed_minutes),
          r?.accepted_minutes == null ? "—" : hour(r.accepted_minutes),
        ];
      }),
  );
}
function reviewView() {
  const stage =
    data.profile.role === "npi" ? "npi-review" : "contractor-review";
  return (
    "<h1>Review hours</h1>" +
    data.work
      .filter((w) => w.status === stage)
      .map((w) =>
        panel(
          site(w.site_id)?.name || "Assignment",
          comparison(w) +
            button("Inspect work & evidence", "open-work", w.id, "primary"),
        ),
      )
      .join("") +
    (data.work.some((w) => w.status === stage)
      ? ""
      : "<p>No work is waiting for your review.</p>")
  );
}
function detailView() {
  const w = job();
  if (!w)
    return (
      "<h1>Assignment unavailable</h1>" + button("Back to work", "goto", "work")
    );
  const events = data.events
    .filter((e) => e.work_id === w.id)
    .sort((a, b) => Date.parse(a.received_at) - Date.parse(b.received_at));
  const files = data.evidence.filter((e) => e.work_id === w.id);
  const actions =
    data.profile.role === "worker" &&
    ["draft", "in-progress", "returned"].includes(w.status)
      ? (function () {
          const mine = events
            .filter((e) => e.worker_id === data.profile.id)
            .at(-1);
          return (
            (mine?.event_kind === "check-in"
              ? button("Check out", "clock-out", w.id, "primary")
              : button("Check in", "clock-in", w.id, "primary")) +
            (w.status === "draft"
              ? ""
              : button("Update tasks / loads", "tasks", w.id) +
                button("Upload evidence", "upload", w.id) +
                (mine?.event_kind === "check-out"
                  ? button("Submit my hours", "claim", w.id)
                  : ""))
          );
        })()
      : data.profile.role === "sub" && w.status === "contractor-review"
        ? button(
            "Approve & forward to NPI",
            "company-approve",
            w.id,
            "primary",
          ) + button("Request correction", "return", w.id)
        : data.profile.role === "npi" && w.status === "npi-review"
          ? button("Verify & accept hours", "npi-approve", w.id, "primary") +
            button("Return to company", "return", w.id)
          : "";
  return `<h1 class="live-detail-name">${esc(site(w.site_id)?.name)}</h1><p>${esc(w.title)} · ${esc(names[w.status])}</p><p>${esc(w.equipment)} · ${esc(site(w.site_id)?.address || "Address not set")}</p>${w.review_note ? `<p class="live-banner live-note">${esc(w.review_note)}</p>` : ""}<div class="live-card-actions">${data.profile.role === "npi" && w.status === "draft" ? button("Edit plan", "plan", w.id) : ""}${actions}</div>${panel("Hours comparison", comparison(w))}${panel("Tasks", `<ul>${w.checklist.map((t, i) => `<li>${w.completed_tasks.includes(i) ? "✓" : "○"} ${esc(t)}</li>`).join("")}</ul><p>Recorded loads: ${w.loads}</p>`)}${panel(
    "Attendance evidence",
    table(
      ["Worker / event", "Device time", "Server received", "Location"],
      events.map((e) => [
        esc(person(e.worker_id)?.display_name) + "<br>" + esc(e.event_kind),
        esc(timestamp(e.device_time)),
        esc(timestamp(e.received_at)),
        `<a class="live-map" href="https://www.google.com/maps?q=${e.latitude},${e.longitude}" target="_blank" rel="noopener noreferrer">${esc(e.latitude)}, ${esc(e.longitude)}</a><br>Accuracy: ${esc(e.accuracy_metres)} m<br>Captured by ${esc(person(e.captured_by)?.display_name)}`,
      ]),
    ),
  )}${panel("Uploaded evidence", `<div class="live-evidence">${files.map((e) => button("Open " + e.kind, "view-file", e.id)).join("") || "<p>No evidence uploaded.</p>"}</div>`)}${button("Back to work", "goto", "work")}`;
}
function siteView() {
  return (
    '<div class="page-head"><h1>Locations</h1>' +
    (data.profile.role === "npi"
      ? button("Add location", "new-site", "", "primary")
      : "") +
    '</div><div class="three">' +
    data.sites
      .map((s) =>
        panel(
          s.name,
          (photo(s)
            ? `<img class="live-photo" src="../three-view/${photo(s).replace("./", "")}" alt="${esc(s.name)}">`
            : "") + `<p>${esc(s.address || "Address not configured")}</p>`,
        ),
      )
      .join("") +
    "</div>"
  );
}
function rateView() {
  return (
    '<div class="page-head"><h1>Location & task rates</h1>' +
    button("Add rate", "new-rate", "", "primary") +
    "</div>" +
    table(
      [
        "Price list",
        "Location / service",
        "Unit",
        "Price",
        "Effective dates",
        "Action",
      ],
      data.rates.map((r) => [
        esc(r.side),
        esc(site(r.site_id)?.name) + "<br>" + esc(task(r.task_id)?.name),
        esc(r.basis),
        money(r.amount_cents),
        esc(r.effective_from) + " → " + esc(r.effective_through || "Open"),
        button("Edit", "edit-rate", r.id),
      ]),
    )
  );
}
function companiesView() {
  return (
    head(
      "Subcontractors",
      "Companies delivering work for NPI.",
      button("Add company", "new-company", "", "primary"),
    ) +
    panel(
      "Company register",
      table(
        ["Name", "Status"],
        data.companies.map((c) => [
          esc(c.name),
          c.active ? "Active" : "Inactive",
        ]),
      ),
    ) +
    panel(
      "Company accounts",
      "<p>Assign each subcontractor administrator and worker to the correct company.</p>" +
        button("Manage people & access", "goto", "people"),
    )
  );
}
function peopleView() {
  return (
    '<div class="page-head"><h1>People & companies</h1><div class="live-card-actions">' +
    (data.profile.role === "npi" ? button("Add company", "new-company") : "") +
    button("Create company account", "new-person", "", "primary") +
    "</div></div>" +
    table(
      ["Person", "Company", "Username", "Role", "Active", "Action"],
      data.people.map((p) => [
        esc(p.display_name),
        esc(company(p.company_id)?.name || "NPI"),
        esc(p.username),
        esc(p.role),
        p.active ? "Yes" : "No",
        p.role === "npi"
          ? "—"
          : button("Reset password", "reset-password", p.id),
      ]),
    ) +
    panel(
      "Company register",
      table(
        ["Name", "Active"],
        data.companies.map((c) => [esc(c.name), c.active ? "Yes" : "No"]),
      ),
    )
  );
}
function documentView() {
  return (
    '<div class="page-head"><h1>Billing drafts</h1>' +
    button("New priced draft", "new-document", "", "primary") +
    "</div><p>Draft subtotals only. Confirm tax, legal invoice details and payment terms before issuance. No invoice is sent and no payment is recorded.</p>" +
    table(
      ["Reference", "Kind", "Status", "Subtotal", "Action"],
      data.documents.map((d) => [
        esc(d.reference),
        esc(d.kind),
        esc(d.status),
        money(d.subtotal_cents),
        button("View / print draft", "document", d.id),
      ]),
    )
  );
}
function hoursView() {
  return (
    "<h1>My hours</h1>" +
    table(
      ["Location / date", "Recorded", "Claimed", "Accepted", "Status"],
      data.work.map((w) => {
        const r = data.reviews.find(
          (r) => r.work_id === w.id && r.worker_id === data.profile.id,
        );
        return [
          esc(site(w.site_id)?.name) + "<br>" + esc(w.planned_date),
          hour(recorded(w, data.profile.id)),
          r?.claimed_minutes == null ? "—" : hour(r.claimed_minutes),
          r?.accepted_minutes == null ? "—" : hour(r.accepted_minutes),
          esc(names[w.status]),
        ];
      }),
    )
  );
}
function sheetView() {
  return (
    '<h1>Spreadsheet changes</h1><p>Management edits are queued for NPI review. Original attendance and approved decisions cannot be changed from Sheets.</p><a class="live-map" href="https://docs.google.com/spreadsheets/d/' +
    config.spreadsheetId +
    '/edit" target="_blank" rel="noopener noreferrer">Open management workbook</a>' +
    table(
      ["Record", "Expected version", "Proposal", "Status", "Action"],
      data.changes.map((c) => [
        esc(c.record_table) + "<br>" + esc(c.record_id),
        esc(c.expected_version),
        "<pre>" + esc(JSON.stringify(c.proposal, null, 2)) + "</pre>",
        esc(c.status),
        c.status === "pending"
          ? button("Review & apply", "sheet-accept", c.id) +
            button("Reject", "sheet-reject", c.id)
          : esc(c.message),
      ]),
    )
  );
}
function settingsView() {
  return (
    "<h1>Workspace settings</h1>" +
    panel(
      "Company identity",
      `<img class="brand-image settings" src="../three-view/${suppliedArtwork.logo.replace("./", "")}" alt="NPI company emblem"><p>Work timezone: America/Anchorage</p>`,
    ) +
    (data.profile.role === "npi"
      ? panel(
          "Location & task prices",
          "<p>Manage separate customer charges and subcontractor costs, with effective dates.</p>" +
            button("Manage rates", "goto", "rates"),
        )
      : "") +
    panel(
      "Services",
      table(
        ["Service", "Description"],
        data.tasks.map((t) => [esc(t.name), esc(t.description)]),
      ) +
        (data.profile.role === "npi" ? button("Add service", "new-task") : ""),
    ) +
    panel(
      "Your account",
      `<p>${esc(data.profile.display_name)} · ${esc({ npi: "NPI Admin", sub: "Subcontractor Admin", worker: "Worker" }[data.profile.role])}</p><p>Sign in again after reloading. Your saved work remains in the shared database.</p>`,
    ) +
    (data.profile.role === "npi"
      ? `<details class="sample-tools"><summary>Connection details</summary><p>Database refreshed ${esc(timestamp(latest))}.</p><p>${data.changes.length ? "Latest spreadsheet proposal received " + esc(timestamp(data.changes[0].received_at)) + "." : "No spreadsheet proposals received yet."}</p><a class="live-map" href="https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/edit" target="_blank" rel="noopener noreferrer">Open management workbook</a></details>`
      : "")
  );
}

function modal(title, body) {
  dialogRoute = location.hash;
  returnFocus = document.activeElement;
  dirty = false;
  captured = null;
  dialog.innerHTML = `<header class="dialog-head"><h2 id="dialog-title">${esc(title)}</h2>${button("Close", "close")}</header><div class="dialog-body">${body}<p id="dialog-error" class="error" role="alert"></p></div>`;
  dialog.showModal();
}
function form(title, kind, body, record = "") {
  modal(
    title,
    `<form id="action-form" class="live-form" data-kind="${kind}" data-id="${esc(record)}" data-version="${(data.work.find((w) => w.id === record) || data.rates.find((r) => r.id === record) || {}).version || 0}" novalidate>${body}<div class="actions">${button("Cancel", "close")}<button type="submit" class="btn primary">${{ create_work: "Create work order", staff: "Create account", company_approve: "Approve & forward", npi_approve: "Accept hours", submit_hours: "Submit hours", return_work: "Request correction", clock: "Record attendance", draft_document: "Create draft", tasks: "Save tasks", upload: "Upload evidence", reset_password: "Reset password", review_sheet: "Confirm review" }[kind] || "Save changes"}</button></div></form>`,
  );
}
function close(force = false) {
  if (dirty && !force) {
    $("#dialog-error").textContent =
      "Unsaved changes: save your work or choose Discard changes.";
    if (!$("#discard"))
      $("#dialog-error").insertAdjacentHTML(
        "afterend",
        '<button id="discard" class="btn danger" type="button" data-action="discard">Discard changes</button>',
      );
    return;
  }
  dialog.close();
  dialog.innerHTML = "";
  dirty = false;
  captured = null;
  returnFocus?.focus();
}
const options = (items) => items.map((x) => [x.id, x.name || x.display_name]);
function currentVersion(w) {
  return { id: w.id, version: w.version };
}
async function mutate(action, body) {
  const signature = action + JSON.stringify(body);
  let nonce = pending.get(signature);
  if (!nonce) {
    nonce = id();
    pending.set(signature, nonce);
  }
  const result = await api.action(action, body, nonce);
  pending.delete(signature);
  await load();
  return result;
}
function companyForm() {
  form("Add company", "save_company", field("name", "Company name"));
}
function siteForm() {
  form(
    "Add location",
    "save_site",
    field("name", "Location name") +
      field("address", "Verified address") +
      field("photo_path", "Bundled site photo", "select", "", [
        ["", "No photo"],
        ["boney", "Boney"],
        ["nesbit", "Nesbit"],
        ["snowden", "Snowden"],
        ["youth", "Anchorage Youth Court"],
      ]),
  );
}
function taskForm() {
  form(
    "Add service",
    "save_task",
    field("name", "Service name") +
      field("description", "Description", "textarea"),
  );
}
function workForm() {
  form(
    "Create assignment",
    "create_work",
    field(
      "company_id",
      "Subcontractor",
      "select",
      "",
      options(data.companies),
    ) +
      field("site_id", "Location", "select", "", options(data.sites)) +
      field("task_id", "Service", "select", "", options(data.tasks)) +
      field("title", "Work instructions") +
      field("planned_date", "Planned date", "date") +
      field("equipment", "Equipment") +
      field("kind", "Work category", "select", "site", [
        ["site", "Site service"],
        ["hauling", "Hauling"],
      ]) +
      `<fieldset><legend>Assigned workers — select from one company</legend><div class="live-checks">${data.people
        .filter((p) => p.role === "worker" && p.active)
        .map(
          (p) =>
            `<label><input type="checkbox" name="members" value="${p.id}">${esc(p.display_name)} · ${esc(company(p.company_id)?.name)}</label>`,
        )
        .join("")}</div></fieldset>` +
      field(
        "checklist",
        "Required tasks (one per line)",
        "textarea",
        "Complete assigned work\nInspect work area",
      ),
  );
}
function rateForm(record) {
  const r = data.rates.find((r) => r.id === record) || {};
  form(
    "Location & task rate",
    "save_rate",
    field("side", "Price list", "select", r.side || "customer", [
      ["customer", "Customer charges"],
      ["subcontractor", "Subcontractor costs"],
    ]) +
      field(
        "company_id",
        "Company (costs only)",
        "select",
        r.company_id || "",
        [["", "Not applicable"], ...options(data.companies)],
      ) +
      field("site_id", "Location", "select", r.site_id, options(data.sites)) +
      field("task_id", "Service", "select", r.task_id, options(data.tasks)) +
      field("basis", "Billing unit", "select", r.basis || "hourly", basis) +
      field(
        "price",
        "Unit price (USD)",
        "text",
        r.id ? (Number(r.amount_cents) / 100).toFixed(2) : "",
      ) +
      field("effective_from", "Effective from", "date", r.effective_from) +
      field(
        "effective_through",
        "Effective through (optional)",
        "date",
        r.effective_through,
      ),
    r.id || "",
  );
}
function staffForm() {
  const companies =
    data.profile.role === "sub"
      ? data.companies.filter((c) => c.id === data.profile.company_id)
      : data.companies;
  form(
    "Create company-issued account",
    "staff",
    field("display_name", "Full name") +
      field("username", "Company username") +
      field("password", "Temporary password (12–72 characters)", "password") +
      button("Show temporary password", "show-staff-password") +
      field("company_id", "Company", "select", "", options(companies)) +
      field(
        "role",
        "Role",
        "select",
        "worker",
        data.profile.role === "npi"
          ? [
              ["worker", "Subcontractor Worker"],
              ["sub", "Subcontractor Admin"],
            ]
          : [["worker", "Subcontractor Worker"]],
      ) +
      "<p>Share the temporary password privately. Accounts use managed Supabase authentication; passwords are not stored in the workbook.</p>",
  );
}
function clockForm(kind) {
  const w = job();
  form(
    kind === "check-in" ? "Record check-in" : "Record checkout",
    "clock",
    `<p>A new location capture is required for this event. Server receipt time is used for recorded duration.</p><input name="event_kind" type="hidden" value="${kind}"><div class="live-checks">${data.members
      .filter((m) => m.work_id === w.id)
      .map(
        (m) =>
          `<label><input type="checkbox" name="members" value="${m.worker_id}" ${m.worker_id === data.profile.id ? "checked disabled" : ""}>${esc(person(m.worker_id)?.display_name)}</label>`,
      )
      .join(
        "",
      )}</div>${button("Capture current location", "gps")}<p id="gps-result" role="status">Location not captured.</p>${kind === "check-out" ? field("break_minutes", "Unpaid break (minutes)", "number", "0") : ""}`,
    w.id,
  );
}
function claimForm() {
  const w = job();
  form(
    "Submit my hours",
    "submit_hours",
    `<p>Recorded hours: ${hour(recorded(w, data.profile.id))} (display rounded). All crew members must check out before submission.</p><label class="taskline"><input type="checkbox" name="use_recorded" checked> Use the exact recorded time</label>` +
      field(
        "claimed_hours",
        "Claimed hours (manual correction)",
        "number",
        hour(recorded(w, data.profile.id)),
      ) +
      field("reason", "Reason for any difference", "textarea"),
    w.id,
  );
  $("#claimed_hours").disabled = true;
}
function approveForm() {
  const w = job();
  form(
    "NPI verification",
    "npi_approve",
    comparison(w) +
      '<label class="taskline"><input type="checkbox" name="accept_claimed" checked> Accept the exact claimed hours without changes</label>' +
      data.reviews
        .filter((r) => r.work_id === w.id)
        .map((r) =>
          field(
            "accepted_" + r.worker_id,
            person(r.worker_id)?.display_name +
              " accepted hours (manual correction)",
            "number",
            hour(r.claimed_minutes),
          ),
        )
        .join("") +
      field("reason", "Reason for changed hours", "textarea"),
    w.id,
  );
  dialog
    .querySelectorAll("input[name^=accepted_]")
    .forEach((e) => (e.disabled = true));
}

function documentForm() {
  form(
    "Prepare priced draft",
    "draft_document",
    field(
      "kind",
      "Document type",
      "select",
      data.profile.role === "npi" ? "customer-invoice" : "subcontractor-bill",
      data.profile.role === "npi"
        ? [
            ["customer-invoice", "Customer invoice draft"],
            ["subcontractor-bill", "Subcontractor bill draft"],
          ]
        : [["subcontractor-bill", "Subcontractor bill draft"]],
    ) +
      field("reference", "Document reference") +
      field(
        "work_id",
        "NPI-approved assignment",
        "select",
        "",
        data.work
          .filter((w) => w.status === "approved")
          .map((w) => [
            w.id,
            (site(w.site_id)?.name || "") +
              " · " +
              w.planned_date +
              " · " +
              w.title,
          ]),
      ) +
      field(
        "rate_id",
        "Agreed rate (must match side, location, company, task and service date)",
        "select",
        "",
        data.rates.map((r) => [
          r.id,
          r.side +
            " · " +
            (site(r.site_id)?.name || "") +
            " · " +
            money(r.amount_cents) +
            " / " +
            r.basis,
        ]),
      ) +
      field("quantity", "Billable quantity", "number", "1") +
      "<p>Verify the contract unit: equipment-hours may differ from worker-hours. This creates a subtotal draft with a rate snapshot. Tax, legal invoice details and issuance remain for review.</p>",
  );
}
function docView(docid) {
  const d = data.documents.find((d) => d.id === docid);
  if (!d) return;
  modal(
    "Draft " + d.reference,
    `<p><b>DRAFT · NOT ISSUED</b></p><p>${d.kind === "customer-invoice" ? "Customer invoice draft · Performed by" : "Subcontractor bill draft · Supplier"}: ${esc(company(d.company_id)?.name)}</p>${table(
      ["Description", "Quantity", "Unit price", "Subtotal"],
      data.lines
        .filter((l) => l.document_id === d.id)
        .map((l) => [
          esc(l.description),
          esc(l.quantity),
          money(l.unit_cents),
          money(l.line_cents),
        ]),
    )}<h3>Subtotal: ${money(d.subtotal_cents)}</h3><p>Tax and final invoice details are not confirmed. No payment is recorded.</p>${button("Print draft / Save PDF", "print")}`,
  );
}
const actions = {
  "show-staff-password": (el) => {
    const p = $("#password", dialog);
    p.type = p.type === "password" ? "text" : "password";
    el.textContent =
      p.type === "password"
        ? "Show temporary password"
        : "Hide temporary password";
  },
  "show-password": (el) => {
    const p = $("#password");
    p.type = p.type === "password" ? "text" : "password";
    el.textContent = p.type === "password" ? "Show password" : "Hide password";
  },
  goto: (el) => {
    location.hash = el.dataset.id;
  },
  "open-work": (el) => {
    selected = el.dataset.id;
    location.hash = "detail";
    render();
  },
  refresh: () => load(),
  logout: async () => {
    await api.logout();
    data = null;
    selected = null;
    pending.clear();
    $("#print-document")?.remove();
    suspendedDraft = null;
    feedback = "";
    login();
  },
  close: () => close(),
  discard: () => close(true),
  "reset-password": (el) =>
    form(
      "Reset company account password",
      "reset_password",
      "<p>This replaces the account password. Share the new password privately.</p>" +
        field(
          "password",
          "New temporary password (12–72 characters)",
          "password",
        ) +
        button("Show temporary password", "show-staff-password"),
      el.dataset.id,
    ),
  "new-company": companyForm,
  "new-site": siteForm,
  "new-task": taskForm,
  "new-work": workForm,
  "new-rate": () => rateForm(),
  "edit-rate": (el) => rateForm(el.dataset.id),
  "new-person": staffForm,
  "new-document": documentForm,
  document: (el) => docView(el.dataset.id),
  print: () => {
    const root = document.createElement("section");
    root.id = "print-document";
    root.innerHTML = $(".dialog-body", dialog).innerHTML;
    root.querySelectorAll("button").forEach((b) => b.remove());
    document.body.append(root);
    window.addEventListener("afterprint", () => root.remove(), { once: true });
    window.print();
  },
  "clock-in": () => clockForm("check-in"),
  "clock-out": () => clockForm("check-out"),
  claim: claimForm,
  "npi-approve": approveForm,
  plan: () =>
    form(
      "Edit unstarted work plan",
      "plan_work",
      field("planned_date", "Planned date", "date", job().planned_date) +
        field("equipment", "Equipment", "text", job().equipment),
      job().id,
    ),
  "company-approve": () =>
    form(
      "Company approval",
      "company_approve",
      "<p>Confirm your workers’ claimed hours against the recorded attendance and evidence. This forwards the record to NPI.</p>",
      job().id,
    ),
  return: () =>
    form(
      "Request correction",
      "return_work",
      field("reason", "Correction reason", "textarea"),
      job().id,
    ),
  tasks: () => {
    const w = job();
    form(
      "Tasks and loads",
      "tasks",
      `<div class="live-checks">${w.checklist.map((t, i) => `<label><input name="completed_tasks" type="checkbox" value="${i}" ${w.completed_tasks.includes(i) ? "checked" : ""}>${esc(t)}</label>`).join("")}</div>` +
        (w.kind === "hauling"
          ? field("loads", "Completed whole loads", "number", w.loads)
          : ""),
      w.id,
    );
  },
  upload: () =>
    form(
      "Upload work evidence",
      "upload",
      field("kind", "Evidence type", "select", "photo", [
        ["photo", "Work photo"],
        ["timecard", "Hauling timecard"],
      ]) +
        '<div class="field"><label for="file">File (up to 8 MB)</label><input id="file" name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf"></div>',
      job().id,
    ),
  "view-file": async (el) => {
    const e = data.evidence.find((e) => e.id === el.dataset.id);
    if (!e) return;
    const url = await api.fileUrl(e.path);
    modal(
      "Private evidence",
      `<p>This link expires after one minute.</p><a class="btn primary" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Open private file</a>`,
    );
  },
  gps: async (el) => {
    if (!navigator.geolocation)
      throw Error("Location is not supported by this browser.");
    captured = null;
    el.disabled = true;
    $("#gps-result").textContent = "Capturing a fresh position…";
    try {
      const p = await new Promise((ok, no) =>
        navigator.geolocation.getCurrentPosition(ok, no, {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 20000,
        }),
      );
      captured = {
        latitude: p.coords.latitude,
        longitude: p.coords.longitude,
        accuracy_metres: p.coords.accuracy,
        device_time: new Date(p.timestamp).toISOString(),
      };
      $("#gps-result").textContent =
        `Captured ${p.coords.latitude}, ${p.coords.longitude} · accuracy ${Math.round(p.coords.accuracy)} m`;
    } catch {
      $("#gps-result").textContent =
        "Location unavailable. Enable permission and retry.";
      throw Error(
        "Location failed. Allow precise location, check your connection and try again.",
      );
    } finally {
      el.disabled = false;
    }
  },
  "sheet-accept": (el) =>
    form(
      "Apply spreadsheet change",
      "review_sheet",
      '<p>Apply this proposed change after checking its values and expected version? Stale changes will be rejected.</p><input name="decision" type="hidden" value="accept">',
      el.dataset.id,
    ),
  "sheet-reject": (el) =>
    form(
      "Reject spreadsheet change",
      "review_sheet",
      '<p>Reject this pending proposal?</p><input name="decision" type="hidden" value="reject">',
      el.dataset.id,
    ),
};
function validateForm(f, action) {
  f.querySelectorAll("[aria-invalid]").forEach((e) =>
    e.removeAttribute("aria-invalid"),
  );
  f.querySelectorAll(".err").forEach((e) => (e.textContent = ""));
  const required =
    {
      save_company: ["name"],
      save_site: ["name"],
      save_task: ["name"],
      plan_work: ["planned_date"],
      create_work: [
        "company_id",
        "site_id",
        "task_id",
        "planned_date",
        "checklist",
      ],
      save_rate: ["side", "site_id", "task_id", "price", "effective_from"],
      staff: ["display_name", "username", "password", "company_id", "role"],
      submit_hours: ["claimed_hours"],
      return_work: ["reason"],
      draft_document: ["kind", "reference", "work_id", "rate_id", "quantity"],
      reset_password: ["password"],
    }[action] || [];
  if (
    action === "npi_approve" &&
    !f.elements.namedItem("accept_claimed")?.checked
  ) {
    for (const input of f.querySelectorAll("input[name^=accepted_]"))
      required.push(input.name);
  }
  for (const name of required) {
    const input = f.elements.namedItem(name);
    if (input?.disabled) continue;
    if (input && !input.value.trim()) {
      input.setAttribute("aria-invalid", "true");
      input.setAttribute("aria-describedby", name + "-error");
      const error = f.querySelector("#" + name + "-error");
      if (error) error.textContent = "Complete this field.";
      input.focus();
      return false;
    }
  }
  return true;
}
function suspendDraft() {
  if (!dialog.open || !dirty || !data) return;
  const fields = [...dialog.querySelectorAll("input,select,textarea")]
    .filter(
      (e) =>
        e.name !== "password" && e.type !== "password" && e.type !== "file",
    )
    .map((e) => ({
      name: e.name,
      value: e.value,
      checked: e.checked,
      type: e.type,
    }));
  suspendedDraft = {
    user: data.profile.id,
    html: dialog.innerHTML,
    fields,
    selected,
    route: dialogRoute,
  };
}
function restoreDraft() {
  const draft = suspendedDraft;
  suspendedDraft = null;
  if (!draft || draft.user !== data.profile.id) return;
  dialog.innerHTML = draft.html;
  selected = draft.selected;
  dialogRoute = draft.route;
  captured = null;
  dirty = true;
  for (const item of draft.fields) {
    for (const input of dialog.querySelectorAll("input,select,textarea"))
      if (
        input.name === item.name &&
        (input.type !== "checkbox" || input.value === item.value)
      ) {
        if (input.type === "checkbox") input.checked = item.checked;
        else input.value = item.value;
      }
  }
  dialog.querySelectorAll("input[name=password]").forEach((e) => {
    e.type = "password";
    e.value = "";
  });
  const showButton = dialog.querySelector(
    '[data-action="show-staff-password"]',
  );
  if (showButton) showButton.textContent = "Show temporary password";
  $("#dialog-error").textContent =
    "Draft restored after sign-in. Reselect any file and capture location again if required. The original record version is preserved.";
  dialog.showModal();
}
async function guarded(fn) {
  if (busy) return;
  busy = true;
  document.querySelectorAll("button").forEach((b) => (b.disabled = true));
  try {
    await fn();
  } catch (e) {
    if (dialog.open) $("#dialog-error").textContent = e.message;
    else message(e.message, true);
    if (!api.session && data) {
      suspendDraft();
      data = null;
      close(true);
      login("Session ended. Sign in again.");
    }
  } finally {
    busy = false;
    document.querySelectorAll("button").forEach((b) => (b.disabled = false));
  }
}
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const fn = actions[el.dataset.action];
  if (fn) guarded(() => fn(el));
});
document.addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.target;
  guarded(async () => {
    if (f.id === "login-form") {
      const values = new FormData(f);
      const password = String(values.get("password") || "");
      if (!values.get("username") || !password)
        throw Error("Enter your username and password.");
      try {
        data = await api.login(String(values.get("username")).trim(), password);
      } catch (e) {
        $("#password").value = "";
        throw e;
      }
      latest = Date.now();
      f.reset();
      feedback = "";
      history.replaceState(
        null,
        "",
        location.pathname +
          (data.profile.role === "worker" ? "#work" : "#overview"),
      );
      render();
      restoreDraft();
      return;
    }
    if (f.id !== "action-form") return;
    const values = new FormData(f);
    const body = Object.fromEntries(
      [...values].filter(
        ([k]) =>
          !["password", "file", "members", "completed_tasks"].includes(k),
      ),
    );
    const action = f.dataset.kind;
    if (!validateForm(f, action)) return;
    const w = data.work.find((w) => w.id === f.dataset.id);
    if (f.dataset.id) {
      body.id = f.dataset.id;
      if (w) body.version = Number(f.dataset.version);
    }
    if (action === "reset_password") {
      await api.resetPassword(
        f.dataset.id,
        String(values.get("password") || ""),
      );
    } else if (action === "staff") {
      await api.staff({
        ...body,
        username: body.username.toLowerCase(),
        password: String(values.get("password") || ""),
      });
    } else if (action === "upload") {
      const file = values.get("file");
      if (!file?.size) throw Error("Choose a file.");
      await api.upload(
        { ...w, version: Number(f.dataset.version) },
        file,
        body.kind,
      );
    } else {
      if (action === "create_work") {
        body.members = values.getAll("members");
        body.checklist = body.checklist
          .split("\n")
          .map((v) => v.trim())
          .filter(Boolean);
      }
      if (action === "save_rate") {
        const r = data.rates.find((r) => r.id === f.dataset.id);
        if (r) body.version = Number(f.dataset.version);
        if (!/^\d{1,7}(\.\d{1,2})?$/.test(body.price))
          throw Error("Enter a USD price with at most two decimals.");
        const [whole, part = ""] = body.price.split(".");
        body.amount_cents = Number(whole) * 100 + Number(part.padEnd(2, "0"));
        delete body.price;
      }
      if (action === "clock") {
        if (!captured || Date.now() - Date.parse(captured.device_time) > 120000)
          throw Error("Capture a fresh location before saving.");
        body.members = [
          ...new Set([data.profile.id, ...values.getAll("members")]),
        ];
        Object.assign(body, captured);
      }
      if (action === "tasks") {
        body.completed_tasks = values.getAll("completed_tasks").map(Number);
        body.loads = Number(body.loads || 0);
      }
      if (action === "submit_hours") {
        body.use_recorded = values.get("use_recorded") === "on";
        body.claimed_minutes = body.use_recorded
          ? recorded(w, data.profile.id)
          : Number(body.claimed_hours) * 60;
        delete body.claimed_hours;
      }
      if (action === "npi_approve") {
        body.accept_claimed = values.get("accept_claimed") === "on";
        body.accepted_minutes = {};
        for (const r of data.reviews.filter((r) => r.work_id === w.id)) {
          body.accepted_minutes[r.worker_id] = body.accept_claimed
            ? Number(r.claimed_minutes)
            : Number(body["accepted_" + r.worker_id]) * 60;
          delete body["accepted_" + r.worker_id];
        }
      }
      await mutate(action, body);
    }
    close(true);
    await load();
    message("Saved to Supabase.");
  });
});
dialog.addEventListener("input", () => (dirty = true));
dialog.addEventListener("cancel", (e) => {
  e.preventDefault();
  if (!busy) close();
});
dialog.addEventListener("keydown", (e) => {
  if (e.key !== "Tab") return;
  const nodes = [
    ...dialog.querySelectorAll("button,input,select,textarea,a[href]"),
  ].filter((x) => !x.disabled && x.getClientRects().length);
  const a = nodes[0],
    b = nodes.at(-1);
  if (e.shiftKey && document.activeElement === a) {
    e.preventDefault();
    b?.focus();
  } else if (!e.shiftKey && document.activeElement === b) {
    e.preventDefault();
    a?.focus();
  }
});
document.addEventListener("change", (e) => {
  if (e.target.name === "use_recorded")
    $("#claimed_hours").disabled = e.target.checked;
  if (e.target.name === "accept_claimed")
    dialog
      .querySelectorAll("input[name^=accepted_]")
      .forEach((input) => (input.disabled = e.target.checked));
  if (e.target.id === "live-nav") location.hash = e.target.value;
});
window.addEventListener("hashchange", () => {
  if (dialog.open && dirty) {
    history.replaceState(
      null,
      "",
      location.pathname + (dialogRoute || "#work"),
    );
    $("#dialog-error").textContent = "Save or discard your changes first.";
    return;
  }
  if (dialog.open) close(true);
  if (data) guarded(() => load());
  else render();
});
window.addEventListener("beforeunload", (e) => {
  if (dirty || busy) {
    e.preventDefault();
    e.returnValue = "";
  }
});
window.addEventListener("online", () => {
  if (data) guarded(() => load());
});
window.addEventListener("offline", () => {
  if (data) render();
});
if ("serviceWorker" in navigator && location.protocol === "https:")
  navigator.serviceWorker.register("./sw.js").catch(() => {});
login();
