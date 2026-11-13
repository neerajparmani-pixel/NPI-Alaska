import {
  recordedHours,
  hasBothLocations,
  approveHours,
  overlappingWorkers,
} from "../operations/domain.js";
const KEY = "npi-three-view-v1",
  $ = (s, r = document) => r.querySelector(s),
  app = $("#app"),
  dlg = $("#dialog");
const escape = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const paths = {
  home: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  work: '<rect x="4" y="6" width="16" height="15" rx="2"/><path d="M9 6V3h6v3M4 11h16"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m5 12 4 4L20 5"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  users:
    '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 5a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-4-5"/>',
  camera: '<path d="M4 6h4l2-3h4l2 3h4v14H4Z"/><circle cx="12" cy="12" r="4"/>',
  building: '<path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6M8 10h1m6 0h1"/>',
  truck:
    '<path d="M2 6h12v12H2zM14 11h4l4 4v3h-8"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/>',
  file: '<path d="M14 3H5v18h14V8Z M14 3v6h5M8 13h8M8 17h6"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  settings:
    '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  snow: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M8 4l4 4 4-4M8 20l4-4 4 4"/>',
};
const icon = (n) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[n] || paths.work}</svg>`;
const btn = (text, a, id = "", classes = "", extra = "") =>
  `<button type="button" class="btn ${classes}" data-action="${a}" data-id="${escape(id)}" ${extra}>${text}</button>`;
const roles = {
  npi: {
    name: "NPI Admin",
    subtitle: "All companies & final approval",
    icon: "home",
  },
  sub: {
    name: "Subcontractor Admin",
    subtitle: "Your company & your crews",
    icon: "users",
  },
  worker: {
    name: "Subcontractor Worker",
    subtitle: "Your assignments & hours",
    icon: "work",
  },
};
const labels = {
  draft: "Assigned",
  "in-progress": "In progress",
  "contractor-review": "Company review",
  "npi-review": "NPI verification",
  approved: "NPI approved",
  returned: "Correction requested",
};
const h = (n) => Number(n || 0).toFixed(2),
  date = (t) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Anchorage",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(t)) + " AK";
const point = (time, lat = 61.2184, lng = -149.899) => ({
  time,
  positionTime: time,
  lat,
  lng,
  accuracy: 12,
  source: "Example GPS",
  address: "Example position. Street address has not been verified.",
});
function seed() {
  const people = [
    {
      id: "alex",
      name: "Alex Morgan",
      company: "north",
      username: "alex.demo",
      active: true,
    },
    {
      id: "jamal",
      name: "Jamal Reed",
      company: "north",
      username: "jamal.demo",
      active: true,
    },
    {
      id: "lee",
      name: "Lee Parker",
      company: "north",
      username: "lee.demo",
      active: true,
    },
    {
      id: "miles",
      name: "Miles Taylor",
      company: "summit",
      username: "miles.demo",
      active: true,
    },
  ];
  const sites = [
    {
      id: "boney",
      name: "Boney Courthouse",
      family: "courthouse",
      area: "Assigned exterior areas",
      address: "",
      photo: "",
    },
    {
      id: "nesbit",
      name: "Nesbit Courthouse",
      family: "courthouse",
      area: "Assigned exterior areas",
      address: "",
      photo: "",
    },
    {
      id: "snowden",
      name: "Snowden Courthouse",
      family: "courthouse",
      area: "Assigned exterior areas",
      address: "",
      photo: "",
    },
    {
      id: "youth",
      name: "Anchorage Youth Court",
      family: "courthouse",
      area: "Assigned exterior areas",
      address: "",
      photo: "",
    },
    {
      id: "tote",
      name: "Tote Port",
      family: "hauling",
      area: "Assigned haul route",
      address: "",
      photo: "",
    },
  ];
  const session = (a, b, ids) => ({
    in: point(a),
    out: point(b),
    members: ids,
    operator: ids[0],
    breakMinutes: 0,
  });
  const jobs = [
    {
      id: "DEMO-104",
      site: "boney",
      family: "courthouse",
      service: "Snow clearing",
      title: "Clear the assigned access areas",
      worker: "alex",
      company: "north",
      equipment: "Loader",
      date: "2026-11-13",
      status: "draft",
      sessions: [],
      tasks: [],
      photos: [],
      timecard: null,
      loads: 0,
      claimedBy: {},
      acceptedBy: {},
    },
    {
      id: "DEMO-103",
      site: "tote",
      family: "hauling",
      service: "Hauling",
      title: "Complete the assigned hauling shift",
      worker: "alex",
      company: "north",
      equipment: "End dump",
      date: "2026-11-13",
      status: "draft",
      sessions: [],
      tasks: [],
      photos: [],
      timecard: null,
      loads: 0,
      claimedBy: {},
      acceptedBy: {},
    },
    {
      id: "DEMO-102",
      site: "youth",
      family: "courthouse",
      service: "Sidewalk clearing",
      title: "Entry and access route cleanup",
      worker: "jamal",
      company: "north",
      equipment: "Hand tools",
      date: "2026-11-12",
      status: "contractor-review",
      sessions: [
        session("2026-11-12T15:00:00Z", "2026-11-12T17:30:00Z", ["jamal"]),
      ],
      tasks: [0, 1, 2],
      photos: [{ name: "Example completion evidence", example: true }],
      timecard: null,
      loads: 0,
      claimedHours: 3,
      claimedBy: { jamal: 3 },
      acceptedBy: {},
      note: "Example: worker requests additional cleanup time.",
    },
    {
      id: "DEMO-101",
      site: "nesbit",
      family: "courthouse",
      service: "Snow clearing",
      title: "Crew clearance and safety check",
      worker: "alex",
      company: "north",
      equipment: "Loader and hand tools",
      date: "2026-11-10",
      status: "npi-review",
      sessions: [
        session("2026-11-10T15:00:00Z", "2026-11-10T17:00:00Z", [
          "alex",
          "jamal",
          "lee",
        ]),
      ],
      tasks: [0, 1, 2],
      photos: [{ name: "Example completion evidence", example: true }],
      timecard: null,
      loads: 0,
      claimedHours: 7,
      claimedBy: { alex: 3, jamal: 2, lee: 2 },
      acceptedBy: {},
      note: "Example discrepancy: 7 claimed vs 6 recorded worker-hours.",
    },
    {
      id: "DEMO-100",
      site: "snowden",
      family: "courthouse",
      service: "Safety check",
      title: "Completed exterior check",
      worker: "alex",
      company: "north",
      equipment: "Hand tools",
      date: "2026-11-09",
      status: "approved",
      sessions: [
        session("2026-11-09T15:00:00Z", "2026-11-09T17:00:00Z", ["alex"]),
      ],
      tasks: [0, 1, 2],
      photos: [{ name: "Example completion evidence", example: true }],
      timecard: null,
      loads: 0,
      claimedHours: 2,
      acceptedHours: 2,
      claimedBy: { alex: 2 },
      acceptedBy: { alex: 2 },
    },
    {
      id: "DEMO-099",
      site: "boney",
      family: "courthouse",
      service: "Sanding",
      title: "Other company sample work",
      worker: "miles",
      company: "summit",
      equipment: "Sander",
      date: "2026-11-08",
      status: "approved",
      sessions: [
        session("2026-11-08T15:00:00Z", "2026-11-08T16:00:00Z", ["miles"]),
      ],
      tasks: [0, 1, 2],
      photos: [{ name: "Example completion evidence", example: true }],
      timecard: null,
      loads: 0,
      claimedHours: 1,
      acceptedHours: 1,
      claimedBy: { miles: 1 },
      acceptedBy: { miles: 1 },
    },
  ];
  return {
    version: 1,
    revision: 0,
    people,
    sites,
    jobs,
    companies: [
      { id: "north", name: "Northern Field Services", example: true },
      { id: "summit", name: "Summit Site Services", example: true },
    ],
    bills: [],
    invoices: [],
    audit: [],
    sheetChanges: [],
  };
}
let state,
  role = "npi",
  page = "overview",
  selected = "DEMO-104",
  filter = "All",
  query = "",
  dateFilter = "",
  siteFilter = "all",
  dirty = false,
  busy = false,
  conflict = false,
  capture = null,
  captureToken = 0,
  returnFocus = null,
  toastTimer,
  keepDialog = null;
try {
  state = JSON.parse(localStorage.getItem(KEY)) || seed();
  if (
    state.version !== 1 ||
    !Array.isArray(state.jobs) ||
    !Array.isArray(state.people) ||
    !Array.isArray(state.sites)
  )
    throw Error("Bad sample");
} catch {
  state = seed();
}
const site = (id) => state.sites.find((s) => s.id === id),
  person = (id) => state.people.find((p) => p.id === id),
  company = (id) => state.companies.find((c) => c.id === id),
  job = (id) => state.jobs.find((j) => j.id === id),
  roster = (j) => [...new Set(j.sessions.flatMap((s) => s.members))];
const ownHours = (j, id = "alex") =>
  j.sessions.reduce(
    (a, s) =>
      a +
      (s.out && s.members.includes(id)
        ? Math.max(
            0,
            (Date.parse(s.out.time) - Date.parse(s.in.time)) / 3600000 -
              (s.breakMinutes || 0) / 60,
          )
        : 0),
    0,
  );
const visible = () =>
  state.jobs.filter(
    (j) =>
      role === "npi" ||
      (j.company === "north" &&
        (role === "sub" || j.worker === "alex" || roster(j).includes("alex"))),
  );
const menu = () =>
  role === "worker"
    ? [
        ["work", "My work", "work"],
        ["hours", "My hours", "clock"],
        ["sites", "Locations", "pin"],
        ["help", "Help", "file"],
      ]
    : role === "sub"
      ? [
          ["overview", "Overview", "home"],
          ["orders", "Work orders", "work"],
          ["review", "Review hours", "check"],
          ["team", "My team", "users"],
          ["hours", "Hours & evidence", "clock"],
          ["bills", "My bills", "file"],
          ["sites", "Locations", "pin"],
          ["settings", "Settings", "settings"],
        ]
      : [
          ["overview", "Overview", "home"],
          ["orders", "Work orders", "work"],
          ["review", "Verify hours", "check"],
          ["hours", "Hours & evidence", "clock"],
          ["bills", "Billing workflow", "file"],
          ["sites", "Locations", "pin"],
          ["settings", "Settings", "settings"],
        ];
const badge = (j) =>
  `<span class="badge ${j.status === "approved" ? "green" : j.status === "returned" ? "red" : ["contractor-review", "npi-review"].includes(j.status) ? "orange" : j.status === "in-progress" ? "blue" : ""}"><span class="dot"></span>${labels[j.status]}</span>`;
const tasks = (j) =>
  j.family === "hauling"
    ? [
        "Complete the assigned haul work",
        "Record loads and attach a timecard",
        "Check the truck and work area",
      ]
    : [
        "Complete the assigned site task",
        "Check access routes and work areas",
        "Record completion evidence",
      ];
function notice(text) {
  clearTimeout(toastTimer);
  $("#notice").textContent = text;
  toastTimer = setTimeout(() => ($("#notice").textContent = ""), 6500);
}
function save(fn, text = "Saved on this device.") {
  if (conflict) {
    notice("Another tab changed this sample. Reload before saving.");
    return false;
  }
  try {
    const current = JSON.parse(localStorage.getItem(KEY) || "null");
    if (current && current.revision !== state.revision) {
      conflict = true;
      notice("The sample changed in another tab. Reload before saving.");
      return false;
    }
    const next = structuredClone(state);
    fn(next);
    next.revision++;
    localStorage.setItem(KEY, JSON.stringify(next));
    state = next;
    dirty = false;
    notice(text);
    return true;
  } catch {
    notice(
      "Could not save on this device. Your current input is still on screen. Free browser storage and retry.",
    );
    return false;
  }
}
function field(id, label, type = "text", value = "", options = [], hint = "") {
  return `<div class="field"><label for="${id}">${label}</label>${type === "select" ? `<select id="${id}">${options.map(([v, l]) => `<option value="${escape(v)}" ${String(value) === String(v) ? "selected" : ""}>${escape(l)}</option>`).join("")}</select>` : type === "textarea" ? `<textarea id="${id}" style="resize:none" maxlength="1000">${escape(value)}</textarea>` : `<input id="${id}" type="${type}" value="${escape(value)}" ${type === "number" ? 'min="0" max="10000" step="0.01"' : 'maxlength="150"'}>`}${hint ? `<small id="${id}-hint">${hint}</small>` : ""}<span class="err" id="${id}-error"></span></div>`;
}
function validate(errors) {
  dlg
    .querySelectorAll("[aria-invalid]")
    .forEach((e) => e.removeAttribute("aria-invalid"));
  dlg.querySelectorAll(".err").forEach((e) => (e.textContent = ""));
  for (const [id, text] of Object.entries(errors)) {
    const el = $("#" + id, dlg);
    el?.setAttribute("aria-invalid", "true");
    el?.setAttribute("aria-describedby", id + "-error");
    const out = $("#" + id + "-error", dlg);
    if (out) out.textContent = text;
  }
  const first = Object.keys(errors)[0];
  if (first) $("#" + first, dlg)?.focus();
  return !first;
}
function modal(title, body) {
  returnFocus = document.activeElement;
  dirty = false;
  dlg.innerHTML = `<header class="dialog-head"><h2 id="dialog-title">${title}</h2>${btn(icon("close"), "close", "", "ghost", 'aria-label="Close dialog"')}</header><div class="dialog-body">${body}<div id="dialog-error" class="error mt12" role="alert"></div></div>`;
  dlg.showModal();
}
function close(force = false) {
  if (busy) {
    notice(
      "Location capture is still in progress. It will time out if unavailable.",
    );
    return;
  }
  if (dirty && !force) {
    $("#dialog-error").textContent =
      "These changes have not been saved. Keep editing, or discard the changes below.";
    if (!$("[data-action=discard]", dlg))
      $(".dialog-body", dlg).insertAdjacentHTML(
        "beforeend",
        btn("Discard changes", "discard", "", "danger mt12"),
      );
    return;
  }
  capture = null;
  captureToken++;
  dirty = false;
  dlg.close();
  returnFocus?.focus();
}
function fail(text) {
  $("#dialog-error").textContent = text;
}
function table(headers, rows, caption) {
  return `<div class="table-scroll" tabindex="0" role="region" aria-label="${escape(caption)}"><table><caption>${caption}</caption><thead><tr>${headers.map((t) => `<th scope="col">${t}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}"><div class="empty"><h3>No matching records</h3><p>Try another filter or create sample work from NPI Admin.</p>${btn("Clear filters", "clear")}</div></td></tr>`}</tbody></table></div>`;
}
function head(title, desc, action = "") {
  return `<header class="pagehead"><div><p class="eyebrow">${role === "worker" ? "YOUR WORKDAY" : role === "sub" ? "NORTHERN FIELD SERVICES / SAMPLE COMPANY" : "NPI / OPERATIONS WORKSPACE"}</p><h1 id="page-title" tabindex="-1">${title}</h1><p>${desc}</p></div>${action || '<div class="datebox">Sample work records<br>Alaska time · AKST / AKDT</div>'}</header>`;
}
function metric(label, value, detail, i = "clock") {
  return `<div class="metric"><div class="row"><label>${label}</label>${icon(i)}</div><strong>${value}</strong><small>${detail}</small></div>`;
}
function panel(title, body, action = "") {
  return `<section class="panel"><header class="panel-head"><h2>${title}</h2>${action}</header>${body}</section>`;
}
function render() {
  const nav = menu(),
    reviewCount = visible().filter(
      (j) => j.status === (role === "sub" ? "contractor-review" : "npi-review"),
    ).length;
  document.title = `NPI Alaska · ${roles[role].name} · ${nav.find((x) => x[0] === page)?.[1] || "Work details"}`;
  document.body.dataset.role = role;
  app.innerHTML = `<header class="top"><div class="top-inner"><div class="brand"><span class="mark">NPI</span><div><b>NPI ALASKA</b><small>WORK · PEOPLE · OPERATIONS</small></div></div><div class="row"><span class="status">${icon("pin")} Alaska field operations</span><span class="badge">Three-view sample</span></div></div></header><section class="rolebar" aria-label="Choose a sample view"><div class="role-inner"><div class="rolechoices">${Object.entries(
    roles,
  )
    .map(
      ([id, r]) =>
        `<button type="button" class="role" data-action="role" data-id="${id}" aria-pressed="${role === id}">${icon(r.icon)}<span class="role-label">${r.name}<small>${r.subtitle}</small></span></button>`,
    )
    .join(
      "",
    )}</div><div class="identity row"><span class="avatar">${role === "worker" ? "AM" : role === "sub" ? "NF" : "NP"}</span><div><b class="small">${role === "worker" ? "Alex Morgan" : role === "sub" ? "Company office" : "NPI office"}</b><p class="small muted">Preview identity</p></div></div></div></section><div class="samplebar"><span><b>Interactive sample</b> · Fictional records, saved on this device. Contracts and prices are excluded.</span>${btn("Guide", "guide", "", "ghost")}</div>${!navigator.onLine ? '<div class="samplebar" role="status">Offline · This sample stays on this device. No server sync occurs.</div>' : ""}${conflict ? `<div class="samplebar notice error" role="alert">Another tab changed the sample. Reload before saving. ${btn("Reload", "reload", "", "danger")}</div>` : ""}<div class="navwrap"><nav class="tabs" aria-label="Workspace navigation">${nav.map(([id, l, i]) => `<a href="#${id}" ${page === id ? 'aria-current="page"' : ""}>${icon(i)}${l}${id === "review" && reviewCount ? `<span class="counter">${reviewCount}</span>` : ""}</a>`).join("")}</nav></div><main id="main" class="main">${content()}<footer class="footer"><span>NPI Alaska · Performance. Power. Precision.</span><span>Preview roles only · No connected backend · No contract documents or prices</span></footer></main>`;
}
function content() {
  return (
    {
      overview,
      orders,
      review,
      hours,
      sites,
      bills,
      settings,
      team,
      work: worker,
      detail,
      help,
    }[page]?.() || overview()
  );
}
function go(next) {
  if (!menu().some((x) => x[0] === next) && next !== "detail")
    next = menu()[0][0];
  page = next;
  history.replaceState(null, "", "#" + page);
  render();
  window.scrollTo(0, 0);
  $("#page-title")?.focus();
}
function setRole(next) {
  if (!roles[next]) return;
  role = next;
  query = "";
  filter = "All";
  siteFilter = "all";
  dateFilter = "";
  go(next === "worker" ? "work" : "overview");
}
function overview() {
  const list = visible(),
    recorded = list.reduce((a, j) => a + recordedHours(j), 0),
    accepted = list.reduce((a, j) => a + (j.acceptedHours || 0), 0);
  return (
    head(
      role === "npi" ? "Your operations, in view." : "Your company’s workday.",
      role === "npi"
        ? "Follow the work from assignment to company review and final NPI acceptance."
        : "Keep your crews moving. Review their hours before sending them to NPI.",
      role === "npi"
        ? btn(icon("plus") + " Create work order", "new-job", "", "primary")
        : "",
    ) +
    `<div class="dispatch"><span class="round">${icon("snow")}</span><div class="grow"><h3>${role === "npi" ? "A clear handoff from the field to the office." : "Your review comes before NPI verification."}</h3><p>Snow operations, site tasks and hauling have separate work records. No private contract terms are preloaded.</p></div>${btn("View work", "goto", "orders")}</div><section class="metrics" aria-label="Operational summary">${metric("Work orders", list.length, "Within this view’s scope", "work")}${metric("Recorded worker-hours", h(recorded), "Ended intervals, less breaks")}${metric("NPI-accepted hours", h(accepted), "Final accepted quantities", "check")}${metric(role === "npi" ? "Awaiting NPI" : "Awaiting company review", list.filter((j) => j.status === (role === "npi" ? "npi-review" : "contractor-review")).length, "Claims needing a decision", "file")}</section><div class="two"><div class="stack">${panel(
      "Hours by location",
      `<div class="site-summary">${state.sites
        .filter((s) => list.some((j) => j.site === s.id))
        .map((s) => {
          const js = list.filter((j) => j.site === s.id);
          return `<article class="mini-site"><h3>${escape(s.name)}</h3><div class="row between"><div><b>${h(js.reduce((a, j) => a + recordedHours(j), 0))}</b><small> recorded h</small><p class="small muted">${h(js.reduce((a, j) => a + (j.acceptedHours || 0), 0))} NPI-accepted h</p></div>${btn("Open", "site", s.id)}</div></article>`;
        })
        .join("")}</div>`,
    )}${panel("Work moving through the system", workTable(list.slice(0, 6)), btn("All work", "goto", "orders", "", ""))}</div><aside class="stack" style="align-content:start">${panel("Who does what", `<ol class="flow"><li><span class="step">1</span><div><b>Subcontractor Worker</b><p>Check in and out with location. Record tasks and evidence. Submit claimed hours.</p></div></li><li><span class="step">2</span><div><b>Subcontractor Admin</b><p>Review your workers’ hours, correct issues, then forward the claim to NPI.</p></div></li><li><span class="step">3</span><div><b>NPI Admin</b><p>Compare original app evidence with the claim. Accept hours and review billing quantities.</p></div></li></ol>${btn("Open review queue", "goto", "review", "primary wide mt")}`)}${panel(
      "Recent activity",
      state.audit.length
        ? `<ol class="log">${state.audit
            .filter((a) => role === "npi" || a.company === "north")
            .slice(0, 5)
            .map(
              (a) =>
                `<li>${escape(a.text)}<small>${escape(a.actor)} · ${date(a.at)}</small></li>`,
            )
            .join("")}</ol>`
        : '<p class="small muted">Your sample actions and decisions will appear here.</p>',
    )}${panel("Connections", `<div class="line"><span>Supabase</span><b>Not connected</b></div><div class="line"><span>Management spreadsheet</span><b>Two-way workflow planned</b></div><p class="pill-note mt12">No real logins, uploads or sync jobs are running in this sample.</p>`)}</aside></div>`
  );
}
function workTable(list) {
  return table(
    [
      "Work / location",
      "Crew lead",
      "Recorded · claimed · accepted",
      "Status",
      "Action",
    ],
    list.map((j) => [
      `<b>${escape(site(j.site).name)}</b><p class="small muted">${j.id} · ${escape(j.service)}</p>`,
      `${escape(person(j.worker).name)}<p class="small muted">${escape(company(j.company).name)}</p>`,
      role === "worker"
        ? `${h(ownHours(j))} · ${j.claimedBy.alex === undefined ? "—" : h(j.claimedBy.alex)} · ${j.acceptedBy.alex === undefined ? "—" : h(j.acceptedBy.alex)}`
        : `${h(recordedHours(j))} · ${j.claimedHours === undefined ? "—" : h(j.claimedHours)} · ${j.acceptedHours === undefined ? "—" : h(j.acceptedHours)}`,
      badge(j),
      btn("Open", role === "worker" ? "open-job" : "evidence", j.id) +
        (role === "sub" && j.status === "draft" && !j.sessions.length
          ? " " + btn("Assign worker", "assign-worker", j.id)
          : ""),
    ]),
    "Sample work records · hours are worker-hours, not pricing units",
  );
}
function orders() {
  let list = visible().filter(
    (j) =>
      (filter === "All" || j.family === filter) &&
      `${j.id} ${site(j.site).name} ${j.title} ${person(j.worker).name}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    head(
      "Work orders",
      "One assignment, one location and a clear owner.",
      role === "npi"
        ? btn(icon("plus") + " Create work order", "new-job", "", "primary")
        : "",
    ) +
    `<div class="toolbar"><div class="chips">${[
      ["All", "All work"],
      ["courthouse", "Courthouse"],
      ["hauling", "Hauling"],
    ]
      .map(([v, l]) =>
        btn(l, "filter", v, "chip", `aria-pressed="${v === filter}"`),
      )
      .join(
        "",
      )}</div><div class="search"><input id="search" aria-label="Search work orders" value="${escape(query)}" placeholder="Search site, work or person">${query ? btn(icon("close"), "clear-search", "", "ghost", 'aria-label="Clear search"') : ""}</div></div>${panel("Assignment register", workTable(list))}`
  );
}
function card(j) {
  return `<article class="jobcard"><div class="card-art ${j.family === "hauling" ? "port" : ""}"><span class="eyebrow">${j.family === "hauling" ? "PORT OPERATIONS" : "SITE OPERATIONS"}</span>${icon(j.family === "hauling" ? "truck" : "building")}</div><div class="card-body"><div class="row between">${badge(j)}<small class="muted">${j.id}</small></div><h2>${escape(site(j.site).name)}</h2><p>${escape(j.title)}</p><div class="card-detail"><div><small>Equipment</small><b>${escape(j.equipment)}</b></div><div><small>Work type</small><b>${escape(j.service)}</b></div></div>${btn("View assignment " + icon("arrow"), "open-job", j.id, "primary wide")}</div></article>`;
}
function worker() {
  const list = visible().filter((j) =>
    ["draft", "in-progress", "returned"].includes(j.status),
  );
  return (
    head(
      "Let’s get to work.",
      "Your assignments, in one place. Choose a job to get started.",
    ) +
    `<details class="panel" style="padding:17px 20px"><summary class="small bold">View my work summary</summary><div class="metrics">${metric("Your recorded hours", h(visible().reduce((a, j) => a + ownHours(j), 0)), "Your ended intervals only")}${metric("Your claimed hours", h(visible().reduce((a, j) => a + (j.claimedBy.alex || 0), 0)), "Sent through company review")}${metric("Your accepted hours", h(visible().reduce((a, j) => a + (j.acceptedBy.alex || 0), 0)), "Accepted by NPI", "check")}</div></details><div class="panel-head mt"><div><h2>Your assignments</h2><p class="small muted mt12">Check the details before you start.</p></div><small class="muted">${list.length} jobs</small></div><div class="three">${list.map(card).join("") || '<div class="panel empty"><h3>You’re up to date.</h3><p>Submitted and approved records are in My hours.</p></div>'}</div><div class="notice mt">${icon("camera")} A clear completion photo makes review easier. Evidence in this sample stays on this device.</div>`
  );
}
function elapsed(time) {
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(time)) / 1000),
  );
  return [
    Math.floor(seconds / 3600),
    Math.floor(seconds / 60) % 60,
    seconds % 60,
  ]
    .map((x) => String(x).padStart(2, "0"))
    .join(":");
}
function detail() {
  const j = job(selected);
  if (!visible().some((x) => x.id === j.id))
    return '<div class="notice error">This sample record is outside your current view.</div>';
  const active = j.sessions.find((s) => !s.out),
    editable =
      role === "worker" &&
      j.worker === "alex" &&
      ["draft", "in-progress", "returned"].includes(j.status);
  return (
    head(
      site(j.site).name,
      `${j.id} · ${j.title}`,
      btn("Back to my work", "goto", "work"),
    ) +
    `<div class="two"><section class="panel"><div class="row between wrap"><h2>${escape(j.service)}</h2>${badge(j)}</div><p class="small muted mt12">${escape(j.equipment)} · ${escape(site(j.site).area)}</p>${j.returnReason ? `<p class="notice warning mt12"><b>Correction requested:</b> ${escape(j.returnReason)}</p>` : ""}<div class="mt">${editable ? (!j.sessions.length ? btn(icon("pin") + " Check in · location required", "capture-in", j.id, "primary wide") : active ? btn(icon("pin") + " Check out · location required", "capture-out", j.id, "primary wide") : '<p class="notice">Both attendance events have recorded positions. Complete your evidence and submit hours.</p>') : '<p class="notice">This record is read-only while it is reviewed or approved.</p>'}</div>${active ? `<p class="small muted mt12">Provisional elapsed time: <b id="live-timer">${elapsed(active.in.time)}</b>. Final hours account for breaks at checkout.</p>` : ""}<div class="metrics" style="grid-template-columns:1fr 1fr">${metric("Your recorded hours", h(ownHours(j)), "Ended intervals only")}${metric("Your NPI-accepted hours", j.acceptedBy.alex === undefined ? "—" : h(j.acceptedBy.alex), "After both review stages", "check")}</div><div class="row between"><h3>Work checklist</h3><small class="muted">${j.tasks.length} / ${tasks(j).length}</small></div><div class="progress" role="progressbar" aria-label="Completed tasks" aria-valuemin="0" aria-valuenow="${j.tasks.length}" aria-valuemax="${tasks(j).length}"><span style="width:${(j.tasks.length / tasks(j).length) * 100}%"></span></div>${tasks(
      j,
    )
      .map(
        (text, i) =>
          `<label class="taskline"><input type="checkbox" data-task="${i}" ${j.tasks.includes(i) ? "checked" : ""} ${editable && j.sessions.length ? "" : "disabled"}>${text}</label>`,
      )
      .join(
        "",
      )}<h3 class="mt">Completion evidence</h3><div class="evidence mt12">${icon("camera")}<div class="grow"><b class="small">${j.photos.length ? "Completion evidence recorded" : "Completion photo"}</b><p>${j.photos.length ? j.photos.map((p) => escape(p.name)).join(", ") : "Add a photo before sending your hours for review."}</p></div>${editable ? btn("Add example", "example-photo", j.id) : ""}</div>${editable ? `<label class="photo-input">Or select a real completion photo (stored locally only)<input type="file" data-photo="${j.id}" accept="image/jpeg,image/png,image/webp"></label>` : ""}${j.family === "hauling" ? `<div class="line mt12"><span>Loads recorded</span><b>${j.loads}</b></div><div class="line"><span>Timecard evidence</span><b>${j.timecard ? "Example timecard recorded" : "Not yet attached"}</b></div>${editable ? `<div class="row wrap mt12">${btn("Record loads", "loads", j.id)}${btn("Add example timecard", "timecard", j.id)}</div>` : ""}` : ""}${editable && j.sessions.length && !active ? btn("Submit hours to my company " + icon("arrow"), "claim", j.id, "primary wide mt") : ""}</section><aside class="stack" style="align-content:start">${panel("Your attendance", events(j))}${panel("Your approval progress", `<ol class="flow"><li><span class="step">1</span><div><b>Your claim</b><p>${j.claimedBy.alex === undefined ? "Not submitted" : h(j.claimedBy.alex) + " hours claimed"}</p></div></li><li><span class="step">2</span><div><b>Subcontractor Admin</b><p>${["npi-review", "approved"].includes(j.status) ? "Reviewed and forwarded to NPI" : "Pending company review"}</p></div></li><li><span class="step">3</span><div><b>NPI Admin</b><p>${j.acceptedBy.alex === undefined ? "Pending final verification" : h(j.acceptedBy.alex) + " hours accepted"}</p></div></li></ol>`)}${panel("Location & support", `<p class="small muted">A fresh position is required separately at check-in and checkout. GPS is evidence, not proof of every crew member’s presence.</p><div class="mt12">${btn("View site details", "site", j.site)}</div>`)}</aside></div>`
  );
}
function events(j) {
  if (!j.sessions.length)
    return '<p class="small muted">Check in to begin your attendance record. No location is captured automatically.</p>';
  return j.sessions
    .map(
      (s) =>
        `<div class="line"><span>${s.members.length > 1 ? "Crew" : "Individual"} entry</span><b>${s.members.map((id) => escape(person(id)?.name || id)).join(", ")}</b></div><p class="pill-note mt12">Device operator: ${escape(person(s.operator)?.name || "Crew lead")}. ${s.members.length > 1 ? "Crew capture is not separate GPS proof for every person." : ""}</p>${[
          ["Check-in", s.in],
          ["Checkout", s.out],
        ]
          .map(
            ([l, e]) =>
              `<div class="line"><span>${l}</span><div>${e ? `<b>${date(e.time)}</b><p class="pill-note">${escape(e.source)} · ±${Math.round(e.accuracy)} m</p>${btn("Map & address", "point", encodeURIComponent(JSON.stringify(e)), "mt12")}` : '<span class="badge orange">Not recorded</span>'}</div></div>`,
          )
          .join(
            "",
          )}<div class="line"><span>Break</span><b>${s.breakMinutes} minutes</b></div>`,
    )
    .join(
      '<hr style="border:0;border-top:1px solid var(--line);margin:20px 0">',
    );
}
function hours() {
  const list = visible().filter(
    (j) =>
      (siteFilter === "all" || j.site === siteFilter) &&
      (!dateFilter || j.date === dateFilter),
  );
  return (
    head(
      role === "worker" ? "My hours & history" : "Hours & evidence",
      "Original attendance, claimed hours and accepted hours are kept separately.",
    ) +
    `<div class="filter-fields"><div>${field("filter-date", "Planned work date · blank for all", "date", dateFilter)}</div><div>${field("filter-site", "Location", "select", siteFilter, [["all", "All permitted locations"], ...state.sites.filter((s) => visible().some((j) => j.site === s.id)).map((s) => [s.id, s.name])])}</div></div><div class="metrics">${metric(role === "worker" ? "Your recorded hours" : "Recorded worker-hours", h(list.reduce((a, j) => a + (role === "worker" ? ownHours(j) : recordedHours(j)), 0)), "Completed attendance intervals")}${metric("Claimed hours", h(list.reduce((a, j) => a + (role === "worker" ? j.claimedBy.alex || 0 : j.claimedHours || 0), 0)), "Before NPI acceptance")}${metric("Accepted hours", h(list.reduce((a, j) => a + (role === "worker" ? j.acceptedBy.alex || 0 : j.acceptedHours || 0), 0)), "Final NPI decision", "check")}</div>${panel("Timesheet register", workTable(list), role !== "worker" ? btn("Export CSV", "export") : "")}`
  );
}
function review() {
  const target = role === "sub" ? "contractor-review" : "npi-review",
    list = visible().filter((j) => j.status === target);
  return (
    head(
      role === "sub"
        ? "Review your workers’ hours."
        : "Verify the hours. Keep the evidence.",
      role === "sub"
        ? "Approve your company’s claims before forwarding them to NPI."
        : "Only company-reviewed claims appear here. Compare attendance, locations and task evidence.",
    ) +
    `<div class="stack">${list.map((j) => `<article class="panel"><div class="panel-head"><div><h2>${escape(site(j.site).name)}</h2><p class="small muted mt12">${j.id} · ${escape(company(j.company).name)}</p></div>${badge(j)}</div><div class="metrics" style="grid-template-columns:repeat(3,1fr)">${metric("Recorded worker-hours", h(recordedHours(j)), "Original ended intervals")}${metric("Claimed hours", h(j.claimedHours), "Submitted for this work")}${metric("Difference", h(j.claimedHours - recordedHours(j)), "Claimed minus recorded")}</div><p class="notice ${j.claimedHours !== recordedHours(j) ? "warning" : ""}">${escape(j.note || "Compare the roster, breaks, both recorded positions and completion evidence.")}</p><div class="row wrap mt">${btn("Inspect evidence", "evidence", j.id)}${btn("Request correction", "return", j.id)}${btn(role === "sub" ? "Approve & forward to NPI" : "Verify & accept hours", role === "sub" ? "company-approve" : "npi-approve", j.id, "primary")}</div></article>`).join("") || '<section class="panel empty"><h2>No claims waiting here.</h2><p>Submit work as Subcontractor Worker, then pass it through both admin views.</p></section>'}</div>`
  );
}
function team() {
  return (
    head(
      "Your people, your crews.",
      "Sample profiles for Northern Field Services. No login accounts are created here.",
      btn(icon("plus") + " Add sample worker", "new-person", "", "primary"),
    ) +
    panel(
      "Company team",
      table(
        [
          "Worker / username",
          "Profile",
          "Recorded h",
          "Claimed h",
          "Accepted h",
        ],
        state.people
          .filter((p) => p.company === "north")
          .map((p) => [
            `<b>${escape(p.name)}</b><p class="small muted">${escape(p.username)}</p>`,
            p.active ? "Active sample" : "Inactive",
            h(visible().reduce((a, j) => a + ownHours(j, p.id), 0)),
            h(visible().reduce((a, j) => a + (j.claimedBy[p.id] || 0), 0)),
            h(visible().reduce((a, j) => a + (j.acceptedBy[p.id] || 0), 0)),
          ]),
        "Company-scoped sample profiles · not authenticated identities",
      ),
    )
  );
}
function sites() {
  const ids = new Set(visible().map((j) => j.site));
  return (
    head(
      "Know your locations.",
      "Separate site records, evidence and photo slots. No contract addresses are imported.",
    ) +
    `<div class="notice">Actual photos are not embedded because the originals are only visible in chat. Select a different photo for each site below; it stays on this device. No illustration is labeled as a real property photo.</div><div class="three mt">${state.sites
      .filter((s) => ids.has(s.id))
      .map(
        (s) =>
          `<article class="jobcard"><div class="sitephoto">${s.photo ? `<img src="${s.photo}" alt="Locally selected photo of ${escape(s.name)}">` : icon(s.family === "hauling" ? "truck" : "building")}</div><div class="card-body"><span class="badge">${s.family === "hauling" ? "Port operations" : "Site operations"}</span><h2>${escape(s.name)}</h2><p>${escape(s.address || "Address not configured in this sample")}</p><div class="row wrap mt12">${btn("Site work & hours", "site", s.id)}${role === "npi" ? btn("Edit site", "edit-site", s.id) : ""}</div><label class="photo-input">Choose an actual site photo (up to 600 KB)<input type="file" data-site-photo="${s.id}" accept="image/jpeg,image/png,image/webp"></label></div></article>`,
      )
      .join("")}</div>`
  );
}
function bills() {
  const docs = state.bills.filter(
    (b) => role === "npi" || b.company === "north",
  );
  return (
    head(
      role === "sub" ? "Your billing submissions" : "Billing workflow",
      "Review approved work quantities. This sample contains no prices or financial amounts.",
      role === "sub"
        ? btn(
            icon("file") + " Prepare quantity claim",
            "new-bill",
            "",
            "primary",
          )
        : btn(
            icon("file") + " Create invoice checklist",
            "new-invoice",
            "",
            "primary",
          ),
    ) +
    `<p class="notice">These are workflow records, not priced invoices. No contract files, rate tables, currency values or bank transfers are included.</p>${
      role === "npi"
        ? panel(
            "Customer invoice checklists",
            table(
              ["Reference", "Approved work", "Status"],
              state.invoices.map((d) => [
                escape(d.reference),
                d.jobIds.join(", "),
                '<span class="badge blue">Unpriced draft</span>',
              ]),
              "Customer and subcontractor allocations are kept separate",
            ),
          )
        : ""
    }<section class="panel mt"><header class="panel-head"><h2>Subcontractor quantity claims</h2></header>${table(
      [
        "Reference / company",
        "Approved work",
        "Quantities",
        "Status",
        "Action",
      ],
      docs.map((d) => [
        `${escape(d.reference)}<p class="small muted">${escape(company(d.company).name)}</p>`,
        d.jobIds.join(", "),
        `${h(d.hours)} accepted worker-h<br>${d.loads} recorded loads`,
        `<span class="badge ${d.status === "Accepted" ? "green" : d.status === "Returned" ? "red" : "orange"}">${d.status}</span>`,
        role === "npi" && d.status === "Submitted"
          ? btn("Review quantities", "review-bill", d.id)
          : role === "sub" && d.status === "Returned"
            ? btn("Revise submission", "revise-bill", d.id)
            : "—",
      ]),
      "NPI reviews quantity submissions separately from worker hours",
    )}</section>`
  );
}
function settings() {
  return (
    head(
      "Workspace settings",
      "Keep the roles simple and the responsibilities clear.",
    ) +
    `<div class="two"><div class="stack">${panel(
      "The three views",
      `<ol class="flow">${Object.values(roles)
        .map(
          (r, i) =>
            `<li><span class="step">${i + 1}</span><div><b>${r.name}</b><p>${r.subtitle}</p></div></li>`,
        )
        .join("")}</ol>`,
    )}${panel("Account setup preview", `<p class="small muted">Company-issued usernames and managed passwords are planned. Real account creation, reset and permissions require the backend.</p><div class="line"><span>Authentication service</span><b>Not connected</b></div><div class="line"><span>Passwords in Sheets</span><b>Never</b></div>${role === "sub" ? btn("Manage sample workers", "goto", "team", "mt12") : btn("View companies", "companies", "", "mt12")}`)}</div><div class="stack">${panel("Backend workflow", `<div class="line"><span>Supabase</span><b>Proposed primary records and identity</b></div><div class="line"><span>Google Sheets</span><b>Management workspace with controlled two-way changes</b></div><div class="line"><span>Original time events</span><b>Protected; corrections remain separate</b></div><p class="pill-note mt12">No connection or synchronization occurs in this prototype.</p>`)}${panel("Sample controls", `<p class="small muted">Reset only this three-view sample’s local records and selected photos.</p>${btn("Reset sample", "reset", "", "danger mt12")}`)}</div></div>`
  );
}
function help() {
  return (
    head("A clear next step.", "How to use your work view.") +
    panel(
      "Your workday",
      `<ol class="flow"><li><span class="step">1</span><div><b>Open your assignment</b><p>Check the site, equipment and task before starting.</p></div></li><li><span class="step">2</span><div><b>Capture check-in and checkout separately</b><p>Allow location when prompted. If location fails, fix permissions and retry. The sample also offers clearly labeled example GPS.</p></div></li><li><span class="step">3</span><div><b>Send your hours to your company</b><p>Your Subcontractor Admin reviews first. NPI then verifies and accepts the final hours.</p></div></li></ol><p class="notice mt">All sample actions stay on your device. Real GPS needs permission and a supported secure browser context, usually HTTPS.</p>`,
    )
  );
}
function evidence(id) {
  const j = job(id);
  if (!visible().some((x) => x.id === id)) return;
  modal(
    `${j.id} · work evidence`,
    `<div class="row between wrap"><h3>${escape(site(j.site).name)}</h3>${badge(j)}</div><p class="small muted mt12">${escape(j.title)} · ${escape(company(j.company).name)}</p><div class="mt">${events(j)}</div><h3 class="mt">Worker-hour comparison</h3>${table(
      ["Worker", "Recorded h", "Claimed h", "NPI accepted h"],
      roster(j).map((id) => [
        escape(person(id).name),
        h(ownHours(j, id)),
        j.claimedBy[id] === undefined ? "—" : h(j.claimedBy[id]),
        j.acceptedBy[id] === undefined ? "—" : h(j.acceptedBy[id]),
      ]),
      "Crew totals do not replace individual worker-hour allocations",
    )}<div class="line"><span>Tasks completed</span><b>${j.tasks.length} / ${tasks(j).length}</b></div><div class="line"><span>Completion evidence</span><b>${j.photos.length} item(s)</b></div>${j.photos
      .filter((p) => p.data)
      .map(
        (p) =>
          `<img src="${p.data}" alt="Locally selected completion evidence" style="width:100%;max-height:240px;object-fit:contain;margin-top:12px;border-radius:9px">`,
      )
      .join(
        "",
      )}<p class="notice mt12">Original events are preserved. ${escape(j.note || j.npiReason || "These records and example GPS positions are fictional.")}</p>`,
  );
}
function showPoint(encoded) {
  const p = JSON.parse(decodeURIComponent(encoded));
  modal(
    "Recorded location & address",
    `<p class="notice ${p.source === "Example GPS" ? "warning" : ""}">${p.source === "Example GPS" ? "Example position for reviewing the sample, not verified attendance." : "Position captured from the device at your request. It has not been server-verified."}</p><div class="line"><span>Event time</span><b>${date(p.time)}</b></div><div class="line"><span>Coordinates</span><b>${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}</b></div><div class="line"><span>Accuracy</span><b>±${Math.round(p.accuracy)} metres</b></div><div class="line"><span>Recorded address</span><b>${escape(p.address)}</b></div><p class="pill-note mt12">This map opens the recorded coordinates. The map provider can show the surrounding street address. No unverified site address is substituted for your recorded position.</p><div class="actions"><a class="btn primary" target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/search/?api=1&query=${p.lat}%2C${p.lng}">Open recorded point on map</a>${btn("Close", "close")}</div>`,
  );
}
function siteDialog(id) {
  const s = site(id),
    list = visible().filter((j) => j.site === id);
  modal(
    escape(s.name),
    `<p class="small muted">${escape(s.area)}</p><p class="notice mt12">${escape(s.address || "No verified street address is configured. Original contract addresses were not imported.")}</p>${s.address ? `<div class="mt12"><a class="btn" target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address)}">Open site address on map</a></div>` : ""}<div class="metrics" style="grid-template-columns:1fr 1fr">${metric("Recorded worker-hours", h(list.reduce((a, j) => a + recordedHours(j), 0)), "Completed attendance")}${metric("Accepted worker-hours", h(list.reduce((a, j) => a + (j.acceptedHours || 0), 0)), "Final NPI decisions")}</div>${workTable(list)}`,
  );
}
function captureDialog(id, out) {
  const j = job(id);
  if (
    role !== "worker" ||
    j.worker !== "alex" ||
    !["draft", "in-progress", "returned"].includes(j.status)
  )
    return;
  const open = j.sessions.find((s) => !s.out);
  if (out && !open) return;
  if (!out && j.sessions.length) return;
  capture = { id, out, point: null, token: ++captureToken };
  modal(
    out ? "Check out with location" : "Check in with location",
    `<p class="notice">A fresh position is required for this ${out ? "checkout" : "check-in"}. The previous event’s position is not reused.</p><div class="mt">${
      out
        ? field("break", "Break minutes for this interval", "number", 0)
        : field("mode", "Attendance mode", "select", "individual", [
            ["individual", "Individual — Alex Morgan"],
            ["crew", "Crew — select everyone present"],
          ])
    }${
      !out
        ? `<fieldset id="crew-list" hidden><legend>Crew present at check-in</legend>${state.people
            .filter((p) => p.company === j.company && p.active)
            .map(
              (p) =>
                `<label class="taskline"><input type="checkbox" name="crew" value="${p.id}" ${p.id === "alex" ? "checked" : ""}>${escape(p.name)}</label>`,
            )
            .join(
              "",
            )}<p class="pill-note mt12">Alex’s device captures the crew position. Other members are not independently GPS-verified.</p></fieldset>`
        : ""
    }</div><div class="row wrap mt12">${btn(icon("pin") + " Get device location", "gps", "", "primary")}${btn("Use example GPS", "example-gps")}</div><p class="pill-note mt12">Example GPS is only for trying the sample. Real attendance will require the connected service and device location.</p><div id="capture-state" class="mt" aria-live="polite"><p class="small muted">No location captured yet.</p></div><div class="actions">${btn("Cancel", "close")}${btn(out ? "Confirm checkout" : "Confirm check-in", "capture-confirm", "", "primary", "disabled")}</div>`,
  );
}
function setPoint(p) {
  if (!capture || !dlg.open) return;
  capture.point = p;
  $("#capture-state").innerHTML =
    `<p class="notice ${p.source === "Example GPS" ? "warning" : ""}"><b>${escape(p.source)}</b> · ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}<br>Accuracy ±${Math.round(p.accuracy)} m${p.accuracy > 100 ? " · Low accuracy; reviewer attention needed" : ""}<br>${p.source === "Example GPS" ? "Simulated position and time." : "Street address lookup is unavailable; the map opens these coordinates."}</p>`;
  $("[data-action=capture-confirm]", dlg).disabled = false;
}
function claimDialog(id) {
  const j = job(id);
  if (!hasBothLocations(j)) {
    notice(
      "Both check-in and checkout need recorded positions before submission.",
    );
    return;
  }
  if (j.tasks.length !== tasks(j).length || !j.photos.length) {
    notice("Complete the checklist and add completion evidence first.");
    return;
  }
  if (j.family === "hauling" && !j.timecard) {
    notice("Add the sample timecard before submitting this hauling job.");
    return;
  }
  modal(
    "Submit hours to your company",
    `<form id="claim-form" data-id="${id}" novalidate><p class="notice">Claimed hours are reviewed by your Subcontractor Admin first. Original attendance remains unchanged.</p><div class="mt">${roster(
      j,
    )
      .map((id) =>
        field(
          "claim-" + id,
          `${escape(person(id).name)} · recorded ${h(ownHours(j, id))} h`,
          "number",
          j.claimedBy[id] ?? ownHours(j, id),
        ),
      )
      .join(
        "",
      )}${field("claim-note", "Note / reason for any difference", "textarea", j.note || "")}</div><div class="actions">${btn("Keep editing work", "close")}<button type="submit" class="btn primary">Send to company review</button></div></form>`,
  );
}
function verification(id) {
  const j = job(id);
  if (role !== "npi" || j.status !== "npi-review") return;
  const overlaps = overlappingWorkers(j, state.jobs);
  if (overlaps.length) {
    notice("Overlapping attendance must be resolved before NPI acceptance.");
    return;
  }
  modal(
    "NPI final verification",
    `<form id="verify-form" data-id="${id}" novalidate><p class="notice warning">Compare both recorded locations, original times, crew roster, breaks and evidence. Company approval does not replace this verification.</p><div class="mt">${roster(
      j,
    )
      .map((id) =>
        field(
          "accept-" + id,
          `${escape(person(id).name)} · recorded ${h(ownHours(j, id))} h / claimed ${h(j.claimedBy[id])} h`,
          "number",
          ownHours(j, id),
        ),
      )
      .join(
        "",
      )}${field("verify-note", "Verification note / adjustment reason", "textarea", "")}</div><div class="actions">${btn("Cancel", "close")}<button type="submit" class="btn primary">Accept verified hours</button></div></form>`,
  );
}
function workDialog() {
  if (role !== "npi") return;
  if (state.jobs.length >= 20) {
    notice(
      "This review sample is limited to 20 work records. Reset it to start again.",
    );
    return;
  }
  modal(
    "Create sample work order",
    `<form id="job-form" novalidate>${field("job-title", "Work description")}${field(
      "job-site",
      "Location",
      "select",
      "boney",
      state.sites.map((s) => [s.id, s.name]),
    )}${field(
      "job-company",
      "Subcontractor company",
      "select",
      "north",
      state.companies.map((c) => [c.id, c.name]),
    )}${field(
      "job-worker",
      "Assigned worker / crew lead",
      "select",
      "alex",
      state.people
        .filter((p) => p.active)
        .map((p) => [p.id, p.name + " — " + company(p.company).name]),
    )}${field(
      "job-service",
      "Service type",
      "select",
      "Snow clearing",
      [
        "Snow clearing",
        "Sidewalk clearing",
        "Sanding",
        "Deicing",
        "Hauling",
        "General site task",
      ].map((s) => [s, s]),
    )}${field("job-equipment", "Equipment", "text", "Hand tools")}${field("job-date", "Planned date", "date", "2026-11-13")}<p class="pill-note">This is an unpriced assignment. No contract, rate or actual commercial term is imported.</p><div class="actions">${btn("Cancel", "close")}<button type="submit" class="btn primary">Create work order</button></div></form>`,
  );
}
function quantityDoc(invoice, existing) {
  if ((invoice && role !== "npi") || (!invoice && role !== "sub")) return;
  const allocated = new Set(
    (invoice ? state.invoices : state.bills)
      .filter((d) => d.id !== existing?.id)
      .flatMap((d) => d.jobIds),
  );
  const list = visible().filter(
    (j) =>
      j.status === "approved" &&
      hasBothLocations(j) &&
      !allocated.has(j.id) &&
      (invoice || j.company === "north"),
  );
  if (!list.length) {
    notice("No unallocated NPI-approved work is available.");
    return;
  }
  modal(
    invoice ? "Customer invoice checklist" : "Subcontractor quantity claim",
    `<form id="document-form" data-kind="${invoice ? "invoice" : "bill"}" data-id="${existing?.id || ""}" novalidate><p class="notice">This records approved work quantities and a reference only. No prices, financial amounts or contract files are included.</p><div class="mt">${list.map((j) => `<label class="taskline"><input type="checkbox" name="bill-job" value="${j.id}" ${existing ? (existing.jobIds.includes(j.id) ? "checked" : "") : "checked"}><span>${j.id} · ${escape(site(j.site).name)}<br><small>${h(j.acceptedHours)} accepted worker-h · ${j.loads} loads</small></span></label>`).join("")}</div><div class="mt">${field("doc-reference", "Your document reference", "text", existing?.reference || "")}</div><div class="actions">${btn("Cancel", "close")}<button type="submit" class="btn primary">${invoice ? "Create unpriced draft" : "Submit quantity claim"}</button></div></form>`,
  );
}
const actions = {
  role: (el) => setRole(el.dataset.id),
  goto: (el) => go(el.dataset.id),
  close: () => close(),
  discard: () => close(true),
  reload: () => location.reload(),
  guide: () =>
    modal(
      "Try the three-view workflow",
      `<ol class="flow"><li><span class="step">1</span><div><b>Subcontractor Worker</b><p>Open an assignment, capture check-in, complete tasks, capture checkout, then send your hours to your company.</p></div></li><li><span class="step">2</span><div><b>Subcontractor Admin</b><p>Open Review hours, inspect the claim and forward it to NPI.</p></div></li><li><span class="step">3</span><div><b>NPI Admin</b><p>Open Verify hours, compare original evidence and accept hours with a reason for changes.</p></div></li></ol><p class="notice mt">Only fictional data is used. Preview roles do not create real access. Uploaded contracts and actual prices are not included.</p>`,
    ),
  "assign-worker": (el) => {
    const j = job(el.dataset.id);
    if (
      role !== "sub" ||
      j.company !== "north" ||
      j.sessions.length ||
      j.status !== "draft"
    )
      return;
    modal(
      "Assign your company’s worker",
      `<form id="assign-worker-form" data-id="${j.id}" novalidate><p class="notice">${j.id} · ${escape(site(j.site).name)}. Assignment stays within your company. Original attendance cannot be reassigned.</p><div class="mt">${field(
        "assign-person",
        "Worker / crew lead",
        "select",
        j.worker,
        state.people
          .filter((p) => p.company === j.company && p.active)
          .map((p) => [p.id, p.name]),
      )}</div><div class="actions">${btn("Cancel", "close")}<button type="submit" class="btn primary">Save assignment</button></div></form>`,
    );
  },
  "new-job": workDialog,
  "open-job": (el) => {
    selected = el.dataset.id;
    go("detail");
  },
  evidence: (el) => evidence(el.dataset.id),
  point: (el) => showPoint(el.dataset.id),
  site: (el) => siteDialog(el.dataset.id),
  filter: (el) => {
    filter = el.dataset.id;
    render();
  },
  clear: () => {
    filter = "All";
    query = "";
    dateFilter = "";
    siteFilter = "all";
    render();
  },
  "clear-search": () => {
    query = "";
    render();
    $("#search")?.focus();
  },
  "capture-in": (el) => captureDialog(el.dataset.id, false),
  "capture-out": (el) => captureDialog(el.dataset.id, true),
  gps: () => {
    if (!capture || busy) return;
    if (!navigator.geolocation) {
      fail(
        "Location is unavailable in this browser. Use a supported secure browser context.",
      );
      return;
    }
    const token = capture.token;
    busy = true;
    capture.point = null;
    $("[data-action=capture-confirm]", dlg).disabled = true;
    $("[data-action=example-gps]", dlg).disabled = true;
    $("[data-action=gps]", dlg).disabled = true;
    $("#capture-state").innerHTML =
      '<p role="status">Waiting for device location… Allow location if prompted.</p>';
    navigator.geolocation.getCurrentPosition(
      (p) => {
        busy = false;
        if (capture?.token !== token) return;
        $("[data-action=gps]", dlg).disabled = false;
        $("[data-action=example-gps]", dlg).disabled = false;
        setPoint({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
          time: new Date().toISOString(),
          positionTime: new Date(p.timestamp).toISOString(),
          source: "Browser GPS",
          address:
            "Address lookup unavailable. Open the captured coordinates on the map.",
        });
      },
      (e) => {
        busy = false;
        if (capture?.token !== token) return;
        capture.point = null;
        $("[data-action=gps]", dlg).disabled = false;
        $("[data-action=example-gps]", dlg).disabled = false;
        $("[data-action=capture-confirm]", dlg).disabled = true;
        $("#capture-state").innerHTML =
          `<p class="notice error" role="alert">${e.code === 1 ? "Location permission denied. Allow it in browser settings and retry." : e.code === 3 ? "Location timed out. Check location settings and retry." : "Location could not be obtained. Check your device and retry."} No attendance event was recorded.</p>`;
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  },
  "example-gps": () => {
    if (!capture || busy) return;
    const j = job(capture.id),
      open = j.sessions.find((s) => !s.out);
    const t = capture.out
      ? new Date(Date.parse(open.in.time) + 2 * 3600000).toISOString()
      : new Date().toISOString();
    setPoint(point(t));
  },
  "capture-confirm": () => {
    if (busy || !capture?.point) return;
    const { id, out, point: p } = capture,
      j = job(id);
    if (
      p.source === "Browser GPS" &&
      Date.now() - Date.parse(p.positionTime) > 120000
    ) {
      fail("This location is too old. Get a fresh device position.");
      return;
    }
    let members = ["alex"],
      breakMinutes = 0;
    if (out) {
      const open = j.sessions.find((s) => !s.out);
      breakMinutes = Number($("#break").value);
      const elapsed = (Date.parse(p.time) - Date.parse(open.in.time)) / 60000;
      if (
        !Number.isFinite(breakMinutes) ||
        breakMinutes < 0 ||
        breakMinutes > elapsed
      ) {
        validate({
          break:
            "Break minutes must be between zero and this interval’s elapsed minutes.",
        });
        return;
      }
    } else {
      if ($("#mode").value === "crew")
        members = [...dlg.querySelectorAll("input[name=crew]:checked")].map(
          (x) => x.value,
        );
      if (!members.length || !members.includes("alex")) {
        fail(
          "Include Alex, the device operator, and each crew member who is present.",
        );
        return;
      }
      if (
        state.jobs.some((x) =>
          x.sessions.some(
            (s) => !s.out && s.members.some((id) => members.includes(id)),
          ),
        )
      ) {
        fail(
          "One or more selected workers already have an open attendance interval. Check out of it first.",
        );
        return;
      }
    }
    if (
      save(
        (n) => {
          const x = n.jobs.find((j) => j.id === id);
          if (out) {
            const s = x.sessions.find((s) => !s.out);
            s.out = p;
            s.breakMinutes = breakMinutes;
          } else {
            x.sessions.push({
              in: p,
              out: null,
              members,
              operator: "alex",
              breakMinutes: 0,
            });
            x.status = "in-progress";
          }
          n.audit.unshift({
            text: `${id}: ${out ? "checkout" : "check-in"} recorded with ${p.source}.`,
            company: x.company,
            actor: roles[role].name,
            at: new Date().toISOString(),
          });
        },
        `${out ? "Checkout" : "Check-in"} saved locally with its own location.`,
      )
    ) {
      close(true);
      render();
    }
  },
  "example-photo": (el) => {
    if (
      save(
        (n) =>
          n.jobs
            .find((j) => j.id === el.dataset.id)
            .photos.push({
              name: "Example completion evidence",
              example: true,
            }),
        "Example evidence added locally.",
      )
    )
      render();
  },
  timecard: (el) => {
    if (
      save(
        (n) =>
          (n.jobs.find((j) => j.id === el.dataset.id).timecard = {
            example: true,
          }),
        "Example timecard added locally.",
      )
    )
      render();
  },
  loads: (el) =>
    modal(
      "Record load count",
      `<form id="loads-form" data-id="${el.dataset.id}" novalidate>${field("load-count", "Completed loads", "number", job(el.dataset.id).loads)}<div class="actions">${btn("Cancel", "close")}<button type="submit" class="btn primary">Save loads</button></div></form>`,
    ),
  claim: (el) => claimDialog(el.dataset.id),
  "company-approve": (el) => {
    const j = job(el.dataset.id);
    if (
      role !== "sub" ||
      j.company !== "north" ||
      j.status !== "contractor-review" ||
      !hasBothLocations(j)
    ) {
      notice("A complete company-scoped worker claim is required.");
      return;
    }
    if (
      save((n) => {
        const x = n.jobs.find((j) => j.id === el.dataset.id);
        x.status = "npi-review";
        n.audit.unshift({
          text: `${x.id}: company approved ${h(x.claimedHours)} claimed hours and forwarded to NPI.`,
          company: x.company,
          actor: roles[role].name,
          at: new Date().toISOString(),
        });
      }, "Company review complete. NPI verification is next.")
    )
      render();
  },
  "npi-approve": (el) => verification(el.dataset.id),
  return: (el) =>
    modal(
      "Request a correction",
      `<form id="return-form" data-id="${el.dataset.id}" novalidate>${field("correction", "What must be corrected?", "textarea", "")}<div class="actions">${btn("Cancel", "close")}<button type="submit" class="btn primary">Return to worker</button></div></form>`,
    ),
  "new-person": () =>
    modal(
      "Add a sample worker",
      `<form id="person-form" novalidate><p class="notice">Profile only. No real login or password is created.</p><div class="mt">${field("person-name", "Worker name")}${field("person-username", "Company username")}</div><div class="actions">${btn("Cancel", "close")}<button type="submit" class="btn primary">Save sample profile</button></div></form>`,
    ),
  "edit-site": (el) =>
    modal(
      "Edit sample site",
      `<form id="site-form" data-id="${el.dataset.id}" novalidate>${field("site-address", "Site address", "text", site(el.dataset.id).address, [], "Enter a verified address yourself; no contract address is imported.")}<div class="actions">${btn("Cancel", "close")}<button type="submit" class="btn primary">Save site address</button></div></form>`,
    ),
  companies: () =>
    modal(
      "Sample companies",
      table(
        ["Company", "Workers"],
        state.companies.map((c) => [
          escape(c.name),
          state.people
            .filter((p) => p.company === c.id)
            .map((p) => escape(p.name))
            .join(", "),
        ]),
        "Fictional companies and people only",
      ),
    ),
  "new-bill": () => quantityDoc(false),
  "new-invoice": () => quantityDoc(true),
  "revise-bill": (el) =>
    quantityDoc(
      false,
      state.bills.find((b) => b.id === el.dataset.id),
    ),
  "review-bill": (el) => {
    const d = state.bills.find((b) => b.id === el.dataset.id);
    modal(
      "Review submitted quantities",
      `<form id="bill-review-form" data-id="${d.id}" novalidate><h3>${escape(d.reference)}</h3><p class="small muted mt12">${d.jobIds.join(", ")} · ${h(d.hours)} accepted worker-hours · ${d.loads} loads</p><p class="notice mt12">Hours have passed both review stages. This is a separate quantity check, not price or payment approval.</p><div class="mt">${field("bill-note", "Review note / correction reason", "textarea", "")}</div><div class="actions">${btn("Cancel", "close")}<button type="submit" name="decision" value="return" class="btn">Request revision</button><button type="submit" name="decision" value="accept" class="btn primary">Accept quantities</button></div></form>`,
    );
  },
  export: () => {
    const rows = [
      [
        "Work ID",
        "Location",
        "Company",
        "Recorded worker-hours",
        "Claimed worker-hours",
        "NPI-accepted worker-hours",
        "Status",
      ],
      ...visible().map((j) => [
        j.id,
        site(j.site).name,
        company(j.company).name,
        recordedHours(j),
        j.claimedHours ?? "",
        j.acceptedHours ?? "",
        labels[j.status],
      ]),
    ];
    const cell = (v) =>
      '"' +
      String(v)
        .replace(/^[=+@-]/, "'" + "$&")
        .replaceAll('"', '""') +
      '"';
    const blob = new Blob(
        ["\ufeff" + rows.map((r) => r.map(cell).join(",")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      ),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "NPI-Three-View-Hours-Sample.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notice("Sample hours exported. No prices or contract content included.");
  },
  reset: () =>
    modal(
      "Reset this sample?",
      `<p>This removes only the three-view sample’s local changes and selected photos.</p><div class="actions">${btn("Keep sample", "close", "", "primary")}${btn("Reset sample", "reset-confirm", "", "danger")}</div>`,
    ),
  "reset-confirm": () => {
    try {
      localStorage.removeItem(KEY);
      state = seed();
      conflict = false;
      close(true);
      render();
      notice("Three-view sample reset.");
    } catch {
      fail("Could not reset browser storage.");
    }
  },
};
function submit(e) {
  e.preventDefault();
  const f = e.target,
    id = f.dataset.id,
    j = job(id),
    value = (k) => $("#" + k, f)?.value.trim() || "";
  try {
    if (f.id === "assign-worker-form") {
      const p = person(value("assign-person"));
      if (
        role !== "sub" ||
        j.company !== "north" ||
        j.status !== "draft" ||
        j.sessions.length ||
        !p?.active ||
        p.company !== j.company
      )
        throw Error(
          "Only an active worker in your company can be assigned before attendance begins.",
        );
      if (
        save((n) => {
          n.jobs.find((x) => x.id === id).worker = p.id;
          n.audit.unshift({
            text: `${id}: company assigned ${p.name}.`,
            company: j.company,
            actor: roles[role].name,
            at: new Date().toISOString(),
          });
        }, "Company assignment saved locally.")
      ) {
        close(true);
        render();
      }
    }
    if (f.id === "job-form") {
      if (role !== "npi") return;
      if (state.jobs.length >= 20)
        throw Error("The sample is limited to 20 work records.");
      const errors = {};
      if (!value("job-title")) errors["job-title"] = "Describe the work.";
      if (person(value("job-worker")).company !== value("job-company"))
        errors["job-worker"] = "Choose a worker from the selected company.";
      if (!value("job-date")) errors["job-date"] = "Choose a planned date.";
      const selectedSite = site(value("job-site"));
      if (
        (selectedSite.family === "hauling") !==
        (value("job-service") === "Hauling")
      )
        errors["job-service"] =
          "Choose hauling for the port, or a site service for a courthouse.";
      if (!validate(errors)) return;
      if (
        save((n) => {
          const id =
            "DEMO-" +
            (Math.max(...n.jobs.map((j) => Number(j.id.slice(5)))) + 1);
          n.jobs.unshift({
            id,
            site: selectedSite.id,
            family: selectedSite.family,
            service: value("job-service"),
            title: value("job-title"),
            company: value("job-company"),
            worker: value("job-worker"),
            equipment: value("job-equipment") || "To be confirmed",
            date: value("job-date"),
            status: "draft",
            sessions: [],
            tasks: [],
            photos: [],
            timecard: null,
            loads: 0,
            claimedBy: {},
            acceptedBy: {},
          });
          n.audit.unshift({
            text: `${id}: sample assignment created.`,
            company: value("job-company"),
            actor: roles[role].name,
            at: new Date().toISOString(),
          });
        }, "Sample assignment created.")
      ) {
        close(true);
        go("orders");
      }
    }
    if (f.id === "claim-form") {
      const by = {},
        errors = {};
      for (const id of roster(j)) {
        by[id] = Number(value("claim-" + id));
        if (!Number.isFinite(by[id]) || by[id] < 0 || by[id] > 10000)
          errors["claim-" + id] = "Enter valid nonnegative hours.";
      }
      const total = Object.values(by).reduce((a, b) => a + b, 0);
      if (Math.abs(total - recordedHours(j)) > 0.0001 && !value("claim-note"))
        errors["claim-note"] =
          "Explain why the claim differs from recorded attendance.";
      if (!validate(errors)) return;
      if (
        save((n) => {
          const x = n.jobs.find((j) => j.id === id);
          x.claimedBy = by;
          x.claimedHours = total;
          x.note = value("claim-note");
          x.status = "contractor-review";
          x.acceptedBy = {};
          delete x.acceptedHours;
          n.audit.unshift({
            text: `${id}: worker sent ${h(total)} claimed hours to company review.`,
            company: x.company,
            actor: roles[role].name,
            at: new Date().toISOString(),
          });
        }, "Claim sent to Subcontractor Admin.")
      ) {
        close(true);
        render();
      }
    }
    if (f.id === "verify-form") {
      if (role !== "npi") return;
      const by = {},
        errors = {};
      for (const id of roster(j)) {
        by[id] = Number(value("accept-" + id));
        if (!Number.isFinite(by[id]) || by[id] < 0 || by[id] > 10000)
          errors["accept-" + id] = "Enter valid nonnegative hours.";
      }
      if (
        Object.keys(by).some(
          (id) => Math.abs(by[id] - j.claimedBy[id]) > 0.0001,
        ) &&
        !value("verify-note")
      )
        errors["verify-note"] = "Explain the adjustment to claimed hours.";
      if (!validate(errors)) return;
      if (overlappingWorkers(j, state.jobs).length)
        throw Error(
          "Overlapping attendance must be resolved before acceptance.",
        );
      const total = Object.values(by).reduce((a, b) => a + b, 0),
        approved = approveHours(j, total, value("verify-note"));
      if (
        save((n) => {
          n.jobs[n.jobs.findIndex((j) => j.id === id)] = {
            ...approved,
            acceptedBy: by,
          };
          n.audit.unshift({
            text: `${id}: NPI accepted ${h(total)} hours. ${value("verify-note")}`,
            company: j.company,
            actor: roles[role].name,
            at: new Date().toISOString(),
          });
        }, "Verified hours accepted. Original attendance and claim retained.")
      ) {
        close(true);
        render();
      }
    }
    if (f.id === "return-form") {
      if (
        !validate(
          value("correction")
            ? {}
            : { correction: "Give the worker a clear correction reason." },
        )
      )
        return;
      if (
        save((n) => {
          const x = n.jobs.find((j) => j.id === id);
          x.status = "returned";
          x.returnReason = value("correction");
          n.audit.unshift({
            text: `${id}: correction requested: ${value("correction")}`,
            company: x.company,
            actor: roles[role].name,
            at: new Date().toISOString(),
          });
        }, "Returned to the worker. Resubmission passes through both review stages again.")
      ) {
        close(true);
        render();
      }
    }
    if (f.id === "loads-form") {
      const count = Number(value("load-count"));
      if (
        !validate(
          Number.isInteger(count) && count >= 0 && count <= 9999
            ? {}
            : { "load-count": "Enter a whole load count from 0 to 9,999." },
        )
      )
        return;
      if (
        save(
          (n) => (n.jobs.find((j) => j.id === id).loads = count),
          "Load count saved locally.",
        )
      ) {
        close(true);
        render();
      }
    }
    if (f.id === "person-form") {
      const name = value("person-name"),
        username = value("person-username"),
        errors = {};
      if (!name) errors["person-name"] = "Enter a worker name.";
      if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username))
        errors["person-username"] =
          "Use 3–32 letters, numbers, dots, underscores or hyphens.";
      if (
        state.people.some(
          (p) => p.username.toLowerCase() === username.toLowerCase(),
        )
      )
        errors["person-username"] = "That sample username is already used.";
      if (!validate(errors)) return;
      if (
        save(
          (n) =>
            n.people.push({
              id: "person-" + Date.now(),
              name,
              username,
              company: "north",
              active: true,
            }),
          "Sample profile saved. No login account was created.",
        )
      ) {
        close(true);
        render();
      }
    }
    if (f.id === "site-form") {
      if (
        save(
          (n) =>
            (n.sites.find((s) => s.id === id).address = value("site-address")),
          "Site address saved only in this sample.",
        )
      ) {
        close(true);
        render();
      }
    }
    if (f.id === "document-form") {
      const invoice = f.dataset.kind === "invoice",
        docs = invoice ? state.invoices : state.bills,
        existing = docs.find((d) => d.id === id),
        ids = [...f.querySelectorAll("input[name=bill-job]:checked")].map(
          (x) => x.value,
        ),
        ref = value("doc-reference"),
        errors = {};
      if (!ref) errors["doc-reference"] = "Enter a reference.";
      if (
        docs.some(
          (d) => d.id !== id && d.reference.toLowerCase() === ref.toLowerCase(),
        )
      )
        errors["doc-reference"] = "That reference is already used.";
      if (!validate(errors)) return;
      if (!ids.length) {
        fail("Select at least one approved work record.");
        return;
      }
      const allocated = new Set(
        docs.filter((d) => d.id !== id).flatMap((d) => d.jobIds),
      );
      if (
        ids.some(
          (id) =>
            allocated.has(id) ||
            job(id).status !== "approved" ||
            !hasBothLocations(job(id)) ||
            (!invoice && job(id).company !== "north"),
        )
      )
        throw Error(
          "Only unallocated, permitted, NPI-approved work can be included.",
        );
      if (
        save(
          (n) => {
            const doc = {
              id: existing?.id || (invoice ? "draft-" : "claim-") + Date.now(),
              reference: ref,
              company: "north",
              jobIds: ids,
              hours: ids.reduce((a, id) => a + job(id).acceptedHours, 0),
              loads: ids.reduce((a, id) => a + job(id).loads, 0),
              status: invoice ? "Unpriced draft" : "Submitted",
            };
            if (existing) n.bills[n.bills.findIndex((d) => d.id === id)] = doc;
            else (invoice ? n.invoices : n.bills).push(doc);
          },
          invoice
            ? "Unpriced invoice checklist created. Nothing sent."
            : "Quantity claim sent for NPI review in the sample.",
        )
      ) {
        close(true);
        render();
      }
    }
    if (f.id === "bill-review-form") {
      const accept = e.submitter.value === "accept";
      if (
        !accept &&
        !validate(
          value("bill-note")
            ? {}
            : { "bill-note": "Explain the revision needed." },
        )
      )
        return;
      if (
        save(
          (n) => {
            const d = n.bills.find((d) => d.id === id);
            d.status = accept ? "Accepted" : "Returned";
            d.note = value("bill-note");
          },
          accept
            ? "Quantities accepted. No price or payment approval occurred."
            : "Quantity claim returned for revision.",
        )
      ) {
        close(true);
        render();
      }
    }
  } catch (err) {
    fail(err.message || "Check the entered values and retry.");
  }
}
function clicks(e) {
  const button = e.target.closest("[data-action]");
  if (button && !button.disabled) {
    e.preventDefault();
    actions[button.dataset.action]?.(button);
  }
  const a = e.target.closest('a[href^="#"]');
  if (a && a.hash !== "#main") {
    e.preventDefault();
    go(a.hash.slice(1));
  }
}
app.addEventListener("click", clicks);
dlg.addEventListener("click", clicks);
dlg.addEventListener("submit", submit);
dlg.addEventListener("input", (e) => {
  if (e.target.closest("form")) dirty = true;
});
dlg.addEventListener("cancel", (e) => {
  e.preventDefault();
  close();
});
dlg.addEventListener("change", (e) => {
  if (e.target.id === "mode")
    $("#crew-list").hidden = e.target.value !== "crew";
});
app.addEventListener("input", (e) => {
  if (e.isComposing) return;
  if (e.target.id === "search") {
    query = e.target.value;
    const pos = e.target.selectionStart;
    render();
    $("#search").focus();
    $("#search").setSelectionRange(pos, pos);
  }
});
app.addEventListener("change", (e) => {
  if (e.target.id === "filter-date") {
    dateFilter = e.target.value;
    render();
  }
  if (e.target.id === "filter-site") {
    siteFilter = e.target.value;
    render();
  }
  if (e.target.matches("[data-task]")) {
    const i = Number(e.target.dataset.task);
    if (
      save((n) => {
        const x = n.jobs.find((j) => j.id === selected);
        x.tasks = e.target.checked
          ? [...new Set([...x.tasks, i])]
          : x.tasks.filter((k) => k !== i);
      }, "Checklist saved locally.")
    )
      render();
  }
  if (e.target.matches("[data-photo],[data-site-photo]")) {
    const file = e.target.files[0];
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 600000
    ) {
      notice("Choose a JPG, PNG or WebP photo up to 600 KB.");
      return;
    }
    const siteId = e.target.dataset.sitePhoto,
      jobId = e.target.dataset.photo;
    const reader = new FileReader();
    reader.onerror = () =>
      notice("Could not read that image. Please try another file.");
    reader.onload = () => {
      if (
        save((n) => {
          if (siteId)
            n.sites.find((s) => s.id === siteId).photo = reader.result;
          else {
            const j = n.jobs.find((j) => j.id === jobId);
            if (j.photos.length >= 3) throw Error("Photo limit");
            j.photos.push({
              name: file.name,
              data: reader.result,
              example: false,
            });
          }
        }, "Photo saved locally on this device.")
      )
        render();
    };
    reader.readAsDataURL(file);
  }
});
window.addEventListener("beforeunload", (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});
window.addEventListener("storage", (e) => {
  if (e.key === KEY) {
    conflict = true;
    if (!dlg.open) render();
    notice("Another tab changed the sample. Reload before saving.");
  }
});
window.addEventListener("hashchange", () => {
  const next = location.hash.slice(1);
  if (menu().some((x) => x[0] === next)) go(next);
});
window.addEventListener("offline", () => {
  if (!dlg.open) render();
});
window.addEventListener("online", () => {
  if (!dlg.open) render();
});
setInterval(() => {
  const timer = $("#live-timer");
  if (timer) {
    const s = job(selected).sessions.find((s) => !s.out);
    if (s) timer.textContent = elapsed(s.in.time);
  }
}, 1000);
const route = location.hash.slice(1);
if (menu().some((x) => x[0] === route)) page = route;
render();
if (
  "serviceWorker" in navigator &&
  ["http:", "https:"].includes(location.protocol) &&
  location.pathname.startsWith("/three-view/")
)
  navigator.serviceWorker
    .register("./sw.js", { scope: "./" })
    .catch(() =>
      notice(
        "Offline installation is unavailable here. The clickable sample still works.",
      ),
    );
