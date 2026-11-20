import { photoStore } from "./recovery.js";
import { distanceMetres } from "./field-domain.js";
import { VisitFeatures } from "./visits.js";
import { FieldFeatures } from "./field.js";
import { api } from "./api.js";
import { showEnrollment } from "./enrollment.js";
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
  cancelled: "Cancelled",
};
let requestedWork = /^#work=([0-9a-f-]{36})$/i.exec(location.hash)?.[1] || null;
let data = null,
  busy = false,
  selected = null,
  feedback = "",
  feedbackError = false,
  returnFocus = null,
  dirty = false,
  latest = 0,
  lastLoadedView = "",
  captured = null,
  pending = new Map(),
  dialogRoute = "",
  suspendedDraft = null,
  accountState = null,
  opsData = { contracts: [], scopes: [], invitations: [] };
const features = new FieldFeatures(() => ({
  api,
  data,
  esc,
  button,
  panel,
  table,
  field,
  form,
  modal,
  close,
  head,
  person,
  site,
  task,
  company,
  job,
  photo,
  names,
  contracts: opsData.contracts,
  timestamp,
  recorded,
  load,
  render,
  message,
  endSession: () => {
    suspendDraft();
    data = null;
    close(true);
    login("Session ended. Sign in again to resume the same upload queue.");
  },
  markClean: () => {
    dirty = false;
  },
  markDirty: () => {
    dirty = true;
  },
  refreshDataOnly: async () => {
    const next = await api.snapshot("all", selected);
    next.field = await api.fieldSnapshot(selected);
    data = next;
  },
}));
const visits = new VisitFeatures(() => ({
  ...features.c,
  success: (...args) => features.success(...args),
  openVisit: async (id) => {
    selected = id;
    history.replaceState(null, "", location.pathname + "#detail");
    await load();
  },
}));
const person = (x) => data.people.find((p) => p.id === x),
  site = (x) => data.sites.find((s) => s.id === x),
  task = (x) => data.tasks.find((t) => t.id === x),
  company = (x) => data.companies.find((c) => c.id === x),
  job = () => data.work.find((w) => w.id === selected);
const photo = (s) =>
  Object.hasOwn(suppliedArtwork.sites, s?.photo_path)
    ? suppliedArtwork.sites[s.photo_path]
    : "";
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
  issues: "file",
  reports: "clock",
  notifications: "file",
  contracts: "building",
  overview: "home",
  work: "work",
  review: "check",
  hours: "clock",
  sites: "snow",
  companies: "building",
  people: "users",
  sheets: "file",
  settings: "settings",
};
const emblem = (kind) =>
  `<img class="brand-image ${kind}" src="./brand-logo.webp" alt="NPI company emblem">`;
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
  $("#notice").textContent = box?.getAttribute("role") === "alert" ? "" : text;
}
function nav() {
  return data.profile.role === "worker"
    ? [
        ["work", "My work"],
        ["hours", "My hours"],
        ["sites", "Sites"],
        ["issues", "Issues"],
      ]
    : [
        ["overview", "Overview"],
        [
          "contracts",
          data.profile.role === "npi" ? "Contracts & sites" : "My subcontract",
        ],
        ["work", "Work orders"],
        [
          "review",
          data.profile.role === "npi" ? "NPI verification" : "Review hours",
        ],
        ["sites", "Sites & locations"],
        ...(data.profile.role === "npi"
          ? [["companies", "Subcontractors"]]
          : []),

        ["people", data.profile.role === "sub" ? "My team" : "People & access"],
        ...(data.profile.role === "npi"
          ? [["sheets", "Spreadsheet review"]]
          : []),
        ["issues", "Issues & problems"],
        ["reports", "Activity & exceptions"],
        ["notifications", "Notifications"],
        ["settings", "Settings"],
      ];
}
function login(error = "") {
  opsData = { contracts: [], scopes: [], invitations: [] };
  document.body.dataset.role = "";
  document.title = "Sign in · Alaska NPI";
  app.innerHTML = `<div class="login-layout"><section class="login-brand-panel" aria-label="NPI identity"><p class="login-wordmark">NPI / ALASKA OPERATIONS</p><div class="login-emblem"><img class="brand-image login" src="./brand-logo.webp" alt="NPI company emblem"></div><div class="login-brand-copy"><p class="eyebrow">PERFORMANCE · POWER · PRECISION</p><h2><span>Every site.</span> <span>Every shift.</span> <span>Accounted for.</span></h2><p>Work records, hours and verification in one place.</p></div></section><main id="main" class="login-main"><div class="login-form-wrap"><h1>Welcome to Alaska NPI</h1><p>Sign in with your company account.</p><form id="login-form" class="live-form" novalidate><div class="field"><label for="username">Company username or admin email</label><input id="username" name="username" autocomplete="username" autocapitalize="none" spellcheck="false"></div><div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password"></div>${button("Show password", "show-password")}<label class="taskline"><input name="remember_device" type="checkbox"> Keep me signed in on this personal device</label><button class="btn primary" type="submit">Sign in</button><p id="feedback" class="live-feedback error" role="alert">${esc(error)}</p></form><p class="small muted">Need access or a password reset? Contact your company administrator. Use this option only on your own device. Original work records stay in Supabase.</p></div></main></div>`;
}
function pendingAccount(status) {
  accountState = status;
  data = null;
  login();
  const content = $(".login-form-wrap");
  const title =
    {
      pending: "Your account is awaiting approval",
      rejected: "Your registration was not approved",
      suspended: "Your account is paused",
      unassigned: "Account setup is incomplete",
    }[status.status] || "Account unavailable";
  content.innerHTML = `<h1>${title}</h1><p>${esc(status.display_name || "")}${status.company ? " · " + esc(status.company) : ""}</p><p>Contact your subcontractor administrator for help. Work access becomes available only after approval.</p><div class="live-card-actions">${button("Check approval", "check-approval", "", "primary")}${button("Sign out", "logout")}</div><p id="feedback" class="live-feedback" role="status"></p>`;
}
async function enterInvitation(token) {
  if (api.session) await api.logout();
  data = null;
  accountState = null;
  return showEnrollment({
    token,
    api,
    root: app,
    prepareLogin: login,
    escape: esc,
  });
}
function render() {
  if (!data) {
    login(feedbackError ? feedback : "");
    return;
  }
  document.body.dataset.role = data.profile.role;
  const pages = nav();
  let page = location.hash.slice(1).split("?")[0] || "work";
  if (
    !pages.some(([p]) => p === page) &&
    page !== "detail" &&
    page !== "notifications"
  )
    page = "work";
  document.title =
    (pages.find(([p]) => p === page)?.[1] || "Work details") + " · Alaska NPI";
  const content = (
    {
      contracts: contractsView,
      overview: overviewView,
      work: workView,
      review: reviewView,
      sites: siteView,

      people: peopleView,
      companies: companiesView,
      sheets: sheetView,
      settings: settingsView,
      hours: hoursView,
      detail: detailView,
      issues: () => features.issuesView(),
      reports: () => visits.exceptionReport() + features.reports(),
      notifications: () => features.notificationsView(),
    }[page] || workView
  )();
  const label = pages.find(([p]) => p === page)?.[1] || "Work details";
  const reviewCount =
    data.profile.role === "npi"
      ? summary().npi_review
      : summary().company_review;
  const initialsText = esc(initials());
  app.innerHTML = `<div class="reference-shell"><aside class="reference-sidebar" aria-label="Workspace navigation"><div class="side-brand">${emblem("sidebar")}<h2>ALASKA NPI</h2><p>CONTRACT OVERSIGHT</p></div><p class="side-label">OPERATIONS WORKSPACE</p><nav class="side-nav" aria-label="Main navigation">${pages.map(([p, l]) => `<a href="#${p}" ${page === p ? 'aria-current="page"' : ""}>${icon(routeIcons[p])}<span>${esc(l)}</span>${p === "review" && reviewCount ? `<b class="side-count">${reviewCount}</b>` : ""}</a>`).join("")}</nav><div class="side-bottom"><span class="avatar">${initialsText}</span><div class="grow"><b>${esc(data.profile.display_name)}</b><p>${roles[data.profile.role]}</p></div>${button("Sign out", "logout", "", "ghost")}</div></aside><div class="reference-workspace"><header class="reference-topbar"><div class="top-crumb"><b>${emblem("header")} ALASKA NPI</b><p>Operations / ${esc(label)}</p></div><div class="top-controls"><span class="live-role">${roles[data.profile.role]}</span>${button(icon("clock") + "<span>Refresh</span>", "refresh")}${button("Alerts (" + (data.field?.notifications?.filter((n) => !n.read_at).length || 0) + ")", "goto", "notifications")}${button("Sign out", "logout", "", "live-top-signout")}<span class="top-avatar" aria-label="${esc(data.profile.display_name)}">${initialsText}</span></div><div class="mobile-navigation"><label for="live-nav">Go to</label><select id="live-nav" aria-label="Go to page">${page === "detail" ? '<option value="detail" selected>Work details</option>' : ""}${pages.map(([p, l]) => `<option value="${p}" ${p === page ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></div></header><main id="main" class="main live-main"><div class="live-banner live-connection"><span class="live-connection-label">${icon("check")} Connected to Supabase</span><span>Updated ${esc(timestamp(latest))}</span></div>${!navigator.onLine ? '<p class="live-banner error">Offline. New changes cannot be saved until your connection returns.</p>' : ""}${data.work.length >= 500 ? '<p class="notice">Showing the latest 500 permitted assignments in this view.</p>' : ""}<p id="feedback" class="live-feedback ${feedbackError ? "error" : ""}" >${esc(feedback)}</p><div class="reference-content">${content}</div><footer class="footer"><span>ALASKA NPI · Performance. Power. Precision.</span><span>Alaska work time · ${roles[data.profile.role]}</span></footer></main>${data.profile.role === "worker" ? `<nav class="worker-bottom-nav" aria-label="Worker navigation">${pages.map(([p, l]) => `<a href="#${p}" ${page === p ? 'aria-current="page"' : ""}>${icon(routeIcons[p])}<span>${esc(l)}</span></a>`).join("")}</nav>` : ""}</div></div>`;
  document.querySelectorAll("button").forEach((b) => (b.disabled = busy));
  features.hydrate();
}
async function load() {
  const route = location.hash.slice(1).split("?")[0] || "work";
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
  data.field = await api.fieldSnapshot(route === "detail" ? selected : null);
  if (route === "work")
    data.workSearch = await api.workSearch(
      Object.fromEntries(
        new URLSearchParams(location.hash.split("?")[1] || ""),
      ),
      Number(
        new URLSearchParams(location.hash.split("?")[1] || "").get("page") || 1,
      ),
    );
  if (data.profile.role !== "worker") opsData = await api.opsContext();
  latest = Date.now();
  render();
  const viewKey = route + (route === "detail" ? selected : "");
  if (viewKey !== lastLoadedView) window.scrollTo(0, 0);
  lastLoadedView = viewKey;
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
        ? "Monitor activity. Verify tasks, photos and hours."
        : "Coordinate crews. Review hours. Keep NPI updated.",
    ) +
    `<section class="oversight-hero"><div><p>CUSTOMER → NPI → SUBCONTRACTOR</p><h2>Every site. Every shift. Verified.</h2><span>Crews belong to the subcontractor. NPI monitors and verifies service.</span></div><div class="hero-stat"><strong>${s.approved}/${s.work_count ?? data.work.length}</strong><span>NPI verified</span></div></section><section class="metrics" aria-label="Operational summary">${metric("Active work", s.active, "Recorded work in progress", "work")}${metric(npi ? "NPI review" : "Company review", awaiting, "Hours awaiting verification", "check")}${metric("Verified records", s.approved, "Accepted after NPI review", "pin")}${metric(npi ? "Company review" : "NPI review", npi ? s.company_review : s.npi_review, "Next approval handoff", "users")}</section><div class="two oversight-grid"><div class="stack">${panel("Worker activity", activityRows || '<div class="live-empty"><span class="activity-symbol">' + icon("work") + "</span><h3>No work activity yet</h3><p>Worker-started visits appear here automatically.</p></div>", button("All work", "goto", "work", "compact"))}${panel("Hours by location", '<p class="small muted">Worker-hours for assignments loaded in this view.</p><div class="site-summary">' + (siteHours || '<p class="live-empty-copy">Recorded and accepted hours will appear after workers start their assignments.</p>') + "</div>")}${panel("Work register", workRegister(activity), npi ? button("View subcontractors", "goto", "companies") : button("New assignment", "new-work", "", "primary"))}</div><aside class="stack" aria-label="Review and setup">${panel("Attention queue", queue)}${panel("Approval handoff", '<ol class="flow"><li><span class="step">1</span><div><b>Subcontractor Worker</b><p>Start a visit, record services and photos, then finish and submit.</p></div></li><li><span class="step">2</span><div><b>Subcontractor Admin</b><p>Review workers’ hours and forward them to NPI.</p></div></li><li><span class="step">3</span><div><b>NPI Admin</b><p>Cross-check original records and accept hours.</p></div></li></ol>')}${!data.work.length && npi ? panel("Set up your workspace", '<p>Set up the contract and sites, then invite your subcontractor. Their approved workers can start visits at authorised sites.</p><div class="live-setup-links">' + button("Add subcontractor", "new-company") + button("Add location", "new-site") + button("Add service", "new-task") + button("Contracts & sites", "goto", "contracts") + "</div>") : ""}</aside></div>`
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
  return visits.workerHeader() + features.workView();
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
          hour(recorded(w, m.worker_id)) +
            (() => {
              const latestEvent = data.events
                .filter(
                  (e) => e.work_id === w.id && e.worker_id === m.worker_id,
                )
                .sort(
                  (a, b) =>
                    Date.parse(a.received_at) - Date.parse(b.received_at),
                )
                .at(-1);
              return latestEvent?.event_kind === "check-in"
                ? `<br><small>Active shift: ${hour(Math.max(0, (Date.now() - Date.parse(latestEvent.received_at)) / 60000))} h elapsed at refresh</small>`
                : "";
            })(),
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
  const currentEvent = events
    .filter((e) => e.worker_id === data.profile.id)
    .at(-1);
  const visitActions =
    w.worker_led &&
    data.profile.role === "worker" &&
    ["draft", "in-progress", "returned"].includes(w.status)
      ? w.status === "draft"
        ? button("Add before photos", "upload", w.id, "primary") +
          button("Start work", "clock-in", w.id)
        : button("Add photos", "upload", w.id) +
          (currentEvent?.event_kind === "check-in"
            ? button("Finish work", "clock-out", w.id, "primary")
            : button("Submit hours", "claim", w.id, "primary") +
              (w.status === "returned"
                ? button("Resume work", "clock-in", w.id)
                : ""))
      : actions;
  return `<h1 class="live-detail-name">${esc(site(w.site_id)?.name)}</h1><p>${esc(w.title)} · ${esc(w.worker_led && w.status === "draft" ? "Prepared" : names[w.status])}</p><p>${esc(w.equipment)} · ${esc(site(w.site_id)?.address || "Address not set")}</p>${w.review_note ? `<p class="live-banner live-note">${esc(w.review_note)}</p>` : ""}<div class="live-card-actions">${["npi", "sub"].includes(data.profile.role) && w.status === "draft" ? button("Edit plan", "plan", w.id) : ""}${visitActions}</div>${visits.detail(w)}${panel("Hours comparison", comparison(w))}${w.worker_led ? "" : panel("Tasks", `<ul>${w.checklist.map((t, i) => `<li>${w.completed_tasks.includes(i) ? "✓" : "○"} ${esc(t)}</li>`).join("")}</ul><p>Recorded loads: ${w.loads}</p>`)}${panel(
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
  )}${features.detail(w)}${button("Back to work", "goto", "work")}`;
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
            : "") +
            `<p>${esc(s.address || "Address not configured")}</p><p>${esc(s.instructions || "")}</p><a class="btn" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address || s.name)}" target="_blank" rel="noopener noreferrer">Open site map</a>` +
            (data.profile.role === "npi"
              ? button("Access instructions / map", "field-site", s.id)
              : ""),
        ),
      )
      .join("") +
    "</div>"
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
  const npi = data.profile.role === "npi";
  const pendingWorkers = data.people.filter(
    (p) => p.role === "worker" && p.account_status === "pending",
  );
  const accountButtons = (p) =>
    p.role === "npi" || (!npi && p.role !== "worker")
      ? "—"
      : p.account_status === "pending" && npi
        ? "Company approval pending"
        : p.account_status === "pending"
          ? button("Approve", "access-approve_worker", p.id, "primary") +
            button("Reject", "access-reject_worker", p.id)
          : button("Reset password", "reset-password", p.id) +
            (p.account_status === "suspended"
              ? button("Restore access", "access-restore_account", p.id)
              : p.active
                ? button("Pause access", "access-suspend_account", p.id)
                : "");
  return (
    head(
      npi ? "People & access" : "My team",
      npi
        ? "Invite subcontractor administrators. Each company manages its own workers."
        : "Invite workers, approve registrations and manage your team.",
      button(
        npi ? "Invite subcontractor admin" : "Invite workers",
        "new-invitation",
        "",
        "primary",
      ),
    ) +
    panel(
      "Pending workers",
      pendingWorkers.length
        ? table(
            ["Worker", "Company", "Username", "Action"],
            pendingWorkers.map((p) => [
              esc(p.display_name),
              esc(company(p.company_id)?.name),
              esc(p.username),
              accountButtons(p),
            ]),
          )
        : "<p>No worker registrations are waiting for approval.</p>",
    ) +
    panel(
      npi ? "Account register" : "Team accounts",
      table(
        ["Person", "Company", "Username", "Role", "Status", "Action"],
        data.people.map((p) => [
          esc(p.display_name),
          esc(company(p.company_id)?.name || "NPI"),
          esc(p.username),
          roles[p.role],
          esc(p.account_status || (p.active ? "approved" : "paused")),
          accountButtons(p),
        ]),
      ),
    ) +
    panel(
      "Invitation links",
      table(
        ["Company", "Access", "Expires", "Status", "Action"],
        opsData.invitations.map((i) => [
          esc(company(i.company_id)?.name),
          i.role === "sub" ? "Subcontractor admin" : "Worker signup",
          esc(timestamp(i.expires_at)),
          i.revoked
            ? "Disabled"
            : Date.parse(i.expires_at) < Date.now()
              ? "Expired"
              : Number(i.uses) >= i.max_uses
                ? "Used / full"
                : "Active",
          !i.revoked ? button("Disable link", "revoke-invitation", i.id) : "—",
        ]),
      ),
    ) +
    '<p class="small muted">Links expire after 7 days. Admin invitations work once; worker signup links allow up to 100 registrations. A worker’s access needs company approval.</p>'
  );
}
function contractsView() {
  const npi = data.profile.role === "npi";
  return (
    head(
      npi ? "Contracts & sites" : "My subcontract",
      npi
        ? "Set the contract, then assign sites to the subcontractor responsible."
        : "Your company can assign work only at these contracted sites.",
      npi ? button("Add contract", "new-contract", "", "primary") : "",
    ) +
    panel(
      "Contracts",
      table(
        ["Contract", "Customer", "Reference"],
        opsData.contracts.map((c) => [
          esc(c.name),
          esc(c.client),
          esc(c.reference),
        ]),
      ),
    ) +
    panel(
      "Site responsibilities",
      table(
        ["Contract", "Company", "Site", "Status"],
        opsData.scopes.map((x) => [
          esc(opsData.contracts.find((c) => c.id === x.contract_id)?.name),
          esc(company(x.company_id)?.name),
          esc(site(x.site_id)?.name),
          x.active ? "Active" : "Inactive",
        ]),
      ),
      npi
        ? button("Assign site to subcontractor", "new-scope", "", "primary")
        : "",
    ) +
    (npi
      ? panel(
          "Setup order",
          '<p>Add your company and locations, create the contract, then assign the sites and send the administrator invitation.</p><div class="live-card-actions">' +
            button("Add subcontractor", "new-company") +
            button("Add location", "new-site") +
            button("Add service", "new-task") +
            button("Invite subcontractor admin", "new-invitation") +
            "</div>",
        )
      : "")
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
    "<h1>Workspace settings</h1><p class=small>Operations v3.1.0 · Backend migration 007</p>" +
    visits.catalogue() +
    features.settings() +
    panel(
      "Company identity",
      `<img class="brand-image settings" src="./brand-logo.webp" alt="NPI company emblem"><p>Work timezone: America/Anchorage</p>`,
    ) +
    (data.profile.role === "npi"
      ? panel(
          "Contracts and subcontractors",
          "<p>Assign sites to companies, then invite each company administrator.</p>" +
            button("Manage contracts & sites", "goto", "contracts"),
        )
      : panel(
          "Company team",
          "<p>Invite workers and approve their accounts before they start work.</p>" +
            button("Manage my team", "goto", "people"),
        )) +
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
  $("#notice").textContent = "";
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
    `<form id="action-form" class="live-form" data-kind="${kind}" data-id="${esc(record)}" data-version="${(data.work.find((w) => w.id === record) || {}).version || 0}" novalidate>${body}<div class="actions">${button("Cancel", "close")}<button type="submit" class="btn primary">${
      {
        "visit:create_visit": "Prepare visit",
        "visit:save_line": "Save service",
        "visit:save_item": "Save item",
        "visit:add_service": "Add service",
        "visit:cancel_prepared": "Cancel visit",
        "field:report_issue": "Report issue & notify admins",
        "field:notification_settings": "Save recipients",
        "field:issue_update": "Save issue update",
        "field:issue_comment": "Add comment",
        "field:repeat_work": "Create scheduled copies",
        "field:cancel_work": "Cancel assignment",
        "field:test_email": "Queue test email",
        create_work: "Create assignment",
        invitation: "Create invitation link",
        "ops:create_contract": "Save contract",
        "ops:assign_scope": "Assign site",
        "ops:approve_worker": "Approve worker",
        "ops:reject_worker": "Reject registration",
        "ops:suspend_account": "Pause access",
        "ops:restore_account": "Restore access",
        "ops:revoke_invite": "Disable link",
        staff: "Create account",
        company_approve: "Approve & forward",
        npi_approve: "Accept hours",
        submit_hours: "Submit hours",
        return_work: "Request correction",
        clock: "Record attendance",
        draft_document: "Create draft",
        tasks: "Save tasks",
        upload: "Upload evidence",
        reset_password: "Reset password",
        review_sheet: "Confirm review",
      }[kind] || "Save changes"
    }</button></div></form>`,
  );
}
function close(force = false) {
  if (features.queue?.uploading && !force) {
    $("#dialog-error").textContent = "Wait for the current upload to finish.";
    return;
  }
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
  features.queue?.dispose();
  features.queue = null;
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
  if (
    !opsData.scopes.some(
      (x) =>
        x.active &&
        (data.profile.role === "npi" ||
          x.company_id === data.profile.company_id),
    )
  ) {
    message(
      "NPI must assign contract sites to your company before work can be scheduled.",
      true,
    );
    return;
  }
  if (!data.people.some((p) => p.role === "worker" && p.active)) {
    modal(
      "Add your team first",
      "<p>Invite your workers and approve their accounts. You can then assign their work.</p>" +
        button("Invite workers", "new-invitation", "", "primary") +
        button("Manage my team", "goto", "people"),
    );
    return;
  }
  if (!data.tasks.some((t) => t.active !== false)) {
    message("Ask NPI to add a service type before scheduling work.", true);
    return;
  }
  form(
    "Create assignment",
    "create_work",
    field(
      "scope_id",
      "Contract / site",
      "select",
      "",
      opsData.scopes
        .filter(
          (x) =>
            x.active &&
            (data.profile.role === "npi" ||
              x.company_id === data.profile.company_id),
        )
        .map((x) => [
          x.id,
          (opsData.contracts.find((c) => c.id === x.contract_id)?.name ||
            "Contract") +
            " · " +
            (site(x.site_id)?.name || "Site"),
        ]),
    ) +
      field("task_id", "Service", "select", "", options(data.tasks)) +
      field("title", "Work instructions") +
      field("area", "Specific site area") +
      field("instructions", "Access instructions / hazards", "textarea") +
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
function belowThresholdCheck() {
  return data.field?.visits?.lines?.some(
    (l) => l.work_id === job()?.id && l.review_required,
  )
    ? '<label class="taskline"><input name="acknowledge_below_threshold" type="checkbox"> I reviewed below-two-inch work and its evidence.</label>'
    : "";
}
function approveForm() {
  const w = job();
  form(
    "NPI verification",
    "npi_approve",
    comparison(w) +
      belowThresholdCheck() +
      ((w.outcome && w.outcome !== "complete") || w.evidence_exception_reason
        ? `<p class="notice">Reported ${esc(w.outcome)}: ${esc(w.outcome_reason)} ${esc(w.evidence_exception_reason)}</p><label class="taskline"><input type="checkbox" name="acknowledge_outcome"> I reviewed the incomplete-work outcome and evidence exception.</label>`
        : "") +
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

async function operation(action, body) {
  const signature = "ops:" + action + JSON.stringify(body);
  let nonce = pending.get(signature);
  if (!nonce) {
    nonce = id();
    pending.set(signature, nonce);
  }
  const result = await api.opsAction(action, body, nonce);
  pending.delete(signature);
  return result;
}
function inviteForm() {
  if (data.profile.role === "npi" && !data.companies.some((c) => c.active)) {
    message("Add the subcontractor company first.");
    return;
  }
  form(
    "Invite " +
      (data.profile.role === "npi" ? "subcontractor administrator" : "workers"),
    "invitation",
    data.profile.role === "npi"
      ? field(
          "company_id",
          "Subcontractor",
          "select",
          "",
          options(data.companies.filter((c) => c.active)),
        ) +
          "<p>This single-use link lets the subcontractor administrator choose their own username and password. They then invite their workers.</p>"
      : "<p>This link belongs to your company. Workers register themselves and await your approval. It expires after 7 days.</p>",
  );
}
const actions = {
  upload: () => features.openUploads(job()),
  ...features.actions(),
  ...visits.actions(),
  "new-invitation": inviteForm,
  "new-contract": () =>
    form(
      "Add contract",
      "ops:create_contract",
      field("name", "Contract name") +
        field("client", "Customer / main source") +
        field("reference", "Reference (optional)"),
    ),
  "new-scope": () =>
    form(
      "Assign site to subcontractor",
      "ops:assign_scope",
      field(
        "contract_id",
        "Contract",
        "select",
        "",
        options(opsData.contracts),
      ) +
        field(
          "company_id",
          "Subcontractor",
          "select",
          "",
          options(data.companies.filter((c) => c.active)),
        ) +
        field("site_id", "Site", "select", "", options(data.sites)),
    ),
  "revoke-invitation": (el) =>
    form(
      "Disable invitation link",
      "ops:revoke_invite",
      "<p>New registrations using this link will be blocked. Existing accounts stay unchanged.</p>",
      el.dataset.id,
    ),
  "check-approval": async () => {
    const status = await api.accountStatus();
    if (status.status === "approved") {
      accountState = null;
      data = await api.snapshot();
      if (data.profile.role !== "worker") opsData = await api.opsContext();
      latest = Date.now();
      history.replaceState(
        null,
        "",
        location.pathname +
          (data.profile.role === "worker" ? "#work" : "#overview"),
      );
      render();
    } else {
      pendingAccount(status);
      message("Approval status checked.");
    }
  },
  "copy-invitation": async () => {
    const input = $("#invitation-url", dialog);
    input.select();
    try {
      await navigator.clipboard.writeText(input.value);
      $("#dialog-error").textContent =
        "Link copied. Share it privately with the intended company or workers.";
    } catch {
      $("#dialog-error").textContent = "Select and copy the link above.";
    }
  },

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
    if (dialog.open) close(true);
    selected = el.dataset.id;
    location.hash = "detail";
    render();
  },
  refresh: () => load(),
  logout: async () => {
    const owner = data?.profile.id;
    const drafts = owner ? await photoStore.list(owner).catch(() => []) : [];
    if (drafts.length) {
      modal(
        "Sign out and remove device photos",
        `<p>${drafts.length} unsent photo(s) are saved on this device. Upload them first, or remove them and sign out. Cloud records are retained.</p>${button("Keep working", "close")}${button("Remove device photos & sign out", "logout-confirm", "", "danger")}`,
      );
      return;
    }
    await actions["logout-confirm"]();
  },
  "logout-confirm": async () => {
    const owner = data?.profile.id;
    if (owner && globalThis.indexedDB) await photoStore.clear(owner);
    close(true);
    const signingOut = api.logout();
    data = null;
    accountState = null;
    selected = null;
    pending.clear();
    $("#print-document")?.remove();
    suspendedDraft = null;
    feedback = "";
    login();
    await signingOut;
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
      "<p>Confirm your workers’ claimed hours against the recorded attendance and evidence. This forwards the record to NPI.</p>" +
        belowThresholdCheck() +
        ((job().outcome && job().outcome !== "complete") ||
        job().evidence_exception_reason
          ? `<p class="notice">${esc(job().outcome_reason)} ${esc(job().evidence_exception_reason)}</p><label class="taskline"><input type="checkbox" name="acknowledge_outcome"> I reviewed the incomplete-work outcome.</label>`
          : ""),
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
  "legacy-upload": () =>
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
      "Work evidence",
      `${e.kind === "photo" ? `<img class="live-modal-photo" src="${esc(url)}" alt="Uploaded work evidence">` : ""}<p>Private access link expires after one minute.</p><a class="btn primary" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Open original file</a>`,
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
        `Captured ${p.coords.latitude}, ${p.coords.longitude} · accuracy ${Math.round(p.coords.accuracy)} m` +
        (() => {
          const s = site(job()?.site_id),
            d = distanceMetres(captured, s);
          return d != null && d > Number(s?.radius_metres || 200)
            ? " · Outside configured site radius: management will review this position."
            : "";
        })();
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
      "ops:create_contract": ["name"],
      "ops:assign_scope": ["contract_id", "company_id", "site_id"],
      invitation: ["company_id"],
      save_company: ["name"],
      save_site: ["name"],
      save_task: ["name"],
      plan_work: ["planned_date"],
      create_work: ["scope_id", "task_id", "planned_date", "checklist"],
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
    photos: features.queue?.items.map((item) => ({ ...item })),
  };
}
function restoreDraft() {
  const draft = suspendedDraft;
  suspendedDraft = null;
  if (!draft || draft.user !== data.profile.id) return;
  selected = draft.selected;
  if (draft.photos) {
    if (!job()) {
      message(
        "This work is no longer available. Contact your administrator.",
        true,
      );
      return;
    }
    features.openUploads(job());
    features.queue.items = draft.photos.map((item) => ({
      ...item,
      url: item.preview ? URL.createObjectURL(item.preview) : "",
    }));
    features.queue.draw();
    dirty = true;
    return;
  }
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
for (const op of [
  "approve_worker",
  "reject_worker",
  "suspend_account",
  "restore_account",
])
  actions["access-" + op] = (el) => {
    const p = person(el.dataset.id);
    if (!p) return;
    const labels = {
      approve_worker: "Approve worker",
      reject_worker: "Reject registration",
      suspend_account: "Pause access",
      restore_account: "Restore access",
    };
    form(
      labels[op],
      "ops:" + op,
      `<p>${esc(p.display_name)} · ${esc(company(p.company_id)?.name)}</p><p>${op === "approve_worker" ? "This grants worker access. Work hours will still need separate review." : op === "reject_worker" ? "This registration will not receive work access." : op === "suspend_account" ? "This account will lose work access. Original work records are preserved." : "This restores access to the company’s permitted work."}</p><input type="hidden" name="version" value="${p.access_version || 1}">`,
      p.id,
    );
  };
async function guarded(fn) {
  if (busy) return;
  busy = true;
  document.querySelectorAll("button").forEach((b) => (b.disabled = true));
  try {
    await fn();
  } catch (e) {
    if (dialog.open) $("#dialog-error").textContent = e.message;
    else message(e.message, true);
    if (!api.session && (data || accountState)) {
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
  if (
    dialog.open &&
    dirty &&
    ![
      "visit-read",
      "visit-nearest",
      "close",
      "discard",
      "gps",
      "copy-invitation",
      "show-staff-password",
      "show-password",
    ].includes(el.dataset.action)
  ) {
    close();
    return;
  }
  const fn = actions[el.dataset.action];
  if (fn) guarded(() => fn(el));
});
document.addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.target;
  if (f.id === "report-filters") {
    location.hash =
      "reports?" +
      new URLSearchParams([...new FormData(f)].filter(([, v]) => v));
    return;
  }
  if (f.id === "work-filters") {
    const q = new URLSearchParams([...new FormData(f)].filter(([, v]) => v));
    location.hash = "work?" + q;
    return;
  }
  guarded(async () => {
    if (f.id === "login-form") {
      const values = new FormData(f);
      const password = String(values.get("password") || "");
      if (!values.get("username") || !password)
        throw Error("Enter your username and password.");
      try {
        data = await api.login(
          String(values.get("username")).trim(),
          password,
          values.get("remember_device") === "on",
        );
      } catch (e) {
        $("#password").value = "";
        throw e;
      }
      if (data.accountStatus) {
        const status = data.accountStatus;
        f.reset();
        pendingAccount(status);
        return;
      }
      accountState = null;
      if (data.profile.role !== "worker") opsData = await api.opsContext();
      data.field = await api.fieldSnapshot();
      if (data.profile.role === "worker")
        data.workSearch = await api.workSearch();
      latest = Date.now();
      f.reset();
      feedback = "";
      history.replaceState(
        null,
        "",
        location.pathname +
          (data.profile.role === "worker" ? "#work" : "#overview"),
      );
      if (requestedWork) {
        selected = requestedWork;
        requestedWork = null;
        history.replaceState(null, "", location.pathname + "#detail");
        await load();
      } else render();
      restoreDraft();
      if (
        !dialog.open &&
        selected &&
        job() &&
        (await photoStore.list(data.profile.id, selected).catch(() => []))
          .length
      )
        features.openUploads(job());
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
    if (action.startsWith("visit:")) {
      if (f.dataset.id && !body.id) body.id = f.dataset.id;
      await visits.submit(action, body, values);
      return;
    }
    if (action.startsWith("field:")) {
      if (f.dataset.id) body.id = f.dataset.id;
      await features.submit(action, body, values);
      return;
    }
    if (action === "invitation") {
      let token = f.dataset.token;
      if (!token) {
        token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
          .map((x) => x.toString(16).padStart(2, "0"))
          .join("");
        f.dataset.token = token;
      }
      const hash = Array.from(
        new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(token),
          ),
        ),
      )
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("");
      await operation("create_invite", {
        company_id:
          data.profile.role === "npi"
            ? body.company_id
            : data.profile.company_id,
        role: data.profile.role === "npi" ? "sub" : "worker",
        token_hash: hash,
      });
      const url = location.origin + location.pathname + "#join=" + token;
      close(true);
      await load();
      modal(
        "Share invitation link",
        `<p>Share this privately. It is shown only now; you can disable it from People & access.</p><div class="field"><label for="invitation-url">Invitation link</label><input id="invitation-url" readonly value="${esc(url)}"></div>${button("Copy link", "copy-invitation", "", "primary")}`,
      );
      return;
    }
    if (action.startsWith("ops:")) {
      if (f.dataset.id) body.id = f.dataset.id;
      await operation(action.slice(4), body);
      close(true);
      await load();
      features.success("Changes saved successfully.");
      return;
    }
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
        const scope = opsData.scopes.find((x) => x.id === body.scope_id);
        if (!scope) throw Error("Choose a site assigned to your subcontract.");
        body.company_id = scope.company_id;
        body.site_id = scope.site_id;
        body.contract_id = scope.contract_id;
        delete body.scope_id;
        body.members = values.getAll("members");
        body.checklist = body.checklist
          .split("\n")
          .map((v) => v.trim())
          .filter(Boolean);
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
    const outcomes = {
      clock:
        body.event_kind === "check-in"
          ? "Check-in recorded."
          : "Checkout recorded.",
      submit_hours: "Work submitted for company review.",
      company_approve: "Work forwarded to NPI.",
      npi_approve: "Work verified and hours accepted.",
      return_work: "Correction requested.",
      create_work: "Assignment created.",
      tasks: "Task progress saved.",
    };
    features.success(
      outcomes[action] || "Changes saved successfully.",
      {
        submit_hours:
          "Your company administrator will review your hours and evidence.",
        company_approve: "NPI can now verify the attendance, photos and hours.",
        npi_approve: "The accepted hours are now visible in the work record.",
        return_work: "The correction reason is visible to the team.",
      }[action] || "",
      [
        "submit_hours",
        "company_approve",
        "npi_approve",
        "return_work",
      ].includes(action),
    );
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
  const workLink = /^#work=([0-9a-f-]{36})$/i.exec(location.hash);
  if (workLink) {
    if (data) {
      selected = workLink[1];
      history.replaceState(null, "", location.pathname + "#detail");
      guarded(() => load());
    } else requestedWork = workLink[1];
    return;
  }
  if (location.hash.startsWith("#join=")) {
    location.reload();
    return;
  }
  if (location.hash === "#signin") {
    accountState = null;
    login();
    return;
  }
  if (!data && (location.hash === "#register" || accountState)) return;
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
  else if (api.session) guarded(resumeSession);
});
window.addEventListener("offline", () => {
  if (data) render();
});
let waitingWorker = null,
  applyUpdateRequested = false;
if ("serviceWorker" in navigator && location.protocol === "https:")
  navigator.serviceWorker
    .register("./sw.js")
    .then((reg) => {
      const offer = () => {
        waitingWorker = reg.waiting;
        if (waitingWorker) {
          const banner = document.querySelector(".live-connection");
          if (banner && !document.querySelector("#apply-app-update"))
            banner.insertAdjacentHTML(
              "beforeend",
              '<button id="apply-app-update" type="button" class="btn compact" data-action="apply-update">Update available</button>',
            );
        }
      };
      offer();
      reg.addEventListener("updatefound", () => {
        reg.installing?.addEventListener("statechange", offer);
      });
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (applyUpdateRequested) location.reload();
      });
    })
    .catch(() => {});
actions["apply-update"] = async () => {
  const rows = data
    ? await photoStore.list(data.profile.id).catch(() => [])
    : [];
  if (dirty || features.queue?.uploading || rows.length) {
    message("Finish uploads and save your work before updating.", true);
    return;
  }
  applyUpdateRequested = true;
  waitingWorker?.postMessage({ type: "APPLY_UPDATE" });
};
async function resumeSession() {
  try {
    const status = await api.accountStatus();
    if (status.status !== "approved") {
      pendingAccount(status);
      return;
    }
    data = await api.snapshot();
    if (requestedWork) {
      selected = requestedWork;
      requestedWork = null;
      history.replaceState(null, "", location.pathname + "#detail");
    } else if (!location.hash || location.hash === "#detail")
      history.replaceState(
        null,
        "",
        location.pathname +
          (data.profile.role === "worker" ? "#work" : "#overview"),
      );
    await load();
  } catch (error) {
    data = null;
    if (!api.session) {
      api.bridge.clear();
      login("Session expired. Sign in again.");
    } else if (error.message.includes("migration 007")) login(error.message);
    else
      login(
        "Connection unavailable. Reconnect to restore your session. Device photos are retained.",
      );
  }
}
if (location.hash.startsWith("#join="))
  guarded(() => enterInvitation(location.hash.slice(6)));
else if (api.session) guarded(resumeSession);
else login();
window.addEventListener("npi-session-change", (e) => {
  if (e.detail.signedOut) {
    features.queue?.dispose();
    close(true);
    data = null;
    selected = null;
    suspendedDraft = null;
    login("Signed out or account changed in another tab.");
  }
});

// Foreground notices update without replacing forms, uploads or a different account's view.
let noticePoll = false;
async function pollNotices() {
  if (
    noticePoll ||
    busy ||
    !data ||
    !api.session ||
    dialog.open ||
    document.visibilityState !== "visible" ||
    !navigator.onLine
  )
    return;
  noticePoll = true;
  const account = data.profile.id;
  const previous =
    data.field?.notifications?.filter((n) => !n.read_at).length || 0;
  try {
    const field = await api.fieldSnapshot();
    if (data?.profile.id !== account) return;
    data.field = field;
    const count = field.notifications.filter((n) => !n.read_at).length;
    const target = document.querySelector(
      '.top-controls [data-action="goto"][data-id="notifications"]',
    );
    if (target) target.textContent = "Alerts (" + count + ")";
    if (count > previous)
      document.querySelector("#notice").textContent =
        "New update received. Open Alerts.";
  } catch {
    if (!api.session && data?.profile.id === account && !busy && !dialog.open) {
      data = null;
      login("Session ended. Sign in again.");
    }
  } finally {
    noticePoll = false;
  }
}
setInterval(pollNotices, 30000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") pollNotices();
  else features.queue?.stop();
});
