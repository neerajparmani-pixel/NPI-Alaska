import {
  recordedHours,
  hasBothLocations,
  quantity,
  charge,
  eligible,
  approveHours,
  overlappingWorkers,
} from "./domain.js";
const KEY = "npi-subcontracts-v1",
  app = document.querySelector("#app"),
  modal = document.querySelector("#modal");
const $ = (s, r = document) => r.querySelector(s),
  esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const money = (c) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(c / 100),
  h = (n) => Number(n || 0).toFixed(2),
  when = (t) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Anchorage",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(t)) + " AK";
const btn = (l, a, id = "", cls = "") =>
  `<button type="button" class="btn ${cls}" data-a="${a}" data-id="${id}">${l}</button>`;
const badge = (l, c = "") => `<span class="badge ${c}">${esc(l)}</span>`;
const statuses = {
  "worker-draft": "Worker draft",
  "contractor-review": "Contractor review",
  "npi-review": "NPI verification",
  approved: "NPI approved",
  returned: "Returned to worker",
};
const stateBadge = (w) =>
  badge(
    w.sessions.some((s) => !s.out)
      ? "Checked in · open interval"
      : statuses[w.status],
    w.status === "approved"
      ? "green"
      : w.status === "returned"
        ? "red"
        : "orange",
  );
const event = (time, lat = 61.2184, lng = -149.899) => ({
  time,
  lat,
  lng,
  accuracy: 12,
  source: "Example GPS",
  address: "Example point near the sample work site; not verified",
});
function seed() {
  const sites = [
    {
      id: "boney",
      name: "Boney Courthouse",
      address: "303 K Street, Anchorage, AK",
      lat: 61.219,
      lng: -149.9,
      verified: false,
    },
    {
      id: "youth",
      name: "Anchorage Youth Court",
      address: "838 W 4th Avenue, Anchorage, AK",
      lat: 61.2184,
      lng: -149.8985,
      verified: false,
    },
    {
      id: "snowden",
      name: "Snowden Courthouse",
      address: "820 W 4th Avenue, Anchorage, AK",
      lat: 61.2184,
      lng: -149.898,
      verified: false,
    },
    {
      id: "nesbit",
      name: "Nesbit Courthouse",
      address: "825 W 4th Avenue, Anchorage, AK",
      lat: 61.2188,
      lng: -149.898,
      verified: false,
    },
  ];
  const works = [
    {
      id: "WO-204",
      site: "boney",
      company: "aurora",
      worker: "alex",
      title: "Morning entry and walkway service",
      status: "worker-draft",
      sessions: [],
      tasks: [],
      photo: false,
      loads: 0,
      rates: {
        customer: { basis: "visit", cents: 35000 },
        contractor: { basis: "visit", cents: 22000 },
      },
    },
    {
      id: "WO-203",
      site: "youth",
      company: "aurora",
      worker: "ben",
      title: "Clear entrances and accessible route",
      status: "contractor-review",
      sessions: [
        {
          in: event("2026-11-13T15:00:00Z"),
          out: event("2026-11-13T17:30:00Z"),
          breakMinutes: 0,
          members: ["ben"],
        },
      ],
      tasks: [0, 1, 2],
      photo: true,
      claimedHours: 3,
      loads: 0,
      rates: {
        customer: { basis: "hourly", cents: 7500 },
        contractor: { basis: "hourly", cents: 4500 },
      },
    },
    {
      id: "WO-202",
      site: "nesbit",
      company: "aurora",
      worker: "alex",
      title: "Crew snow clearance — 3 people",
      status: "npi-review",
      sessions: [
        {
          in: event("2026-11-10T15:00:00Z"),
          out: event("2026-11-10T17:00:00Z"),
          breakMinutes: 0,
          members: ["alex", "ben", "lee"],
          operator: "alex",
        },
      ],
      tasks: [0, 1, 2],
      photo: true,
      claimedHours: 7,
      loads: 0,
      rates: {
        customer: { basis: "visit", cents: 50000 },
        contractor: { basis: "visit", cents: 32000 },
      },
      contractorNote:
        "Subcontractor requests 7 worker-hours; verify against 3-person crew × 2 hours.",
    },
    {
      id: "WO-201",
      site: "snowden",
      company: "aurora",
      worker: "alex",
      title: "Completed hourly service",
      status: "approved",
      sessions: [
        {
          in: event("2026-11-12T15:00:00Z"),
          out: event("2026-11-12T17:30:00Z"),
          breakMinutes: 0,
          members: ["alex"],
        },
      ],
      tasks: [0, 1, 2],
      photo: true,
      claimedHours: 2.5,
      acceptedHours: 2.5,
      loads: 0,
      rates: {
        customer: { basis: "hourly", cents: 7500 },
        contractor: { basis: "hourly", cents: 4500 },
      },
    },
    {
      id: "WO-200",
      site: "boney",
      company: "aurora",
      worker: "ben",
      title: "Completed per-load snow hauling",
      status: "approved",
      sessions: [
        {
          in: event("2026-11-12T18:00:00Z"),
          out: event("2026-11-12T20:00:00Z"),
          breakMinutes: 0,
          members: ["ben"],
        },
      ],
      tasks: [0, 1, 2],
      photo: true,
      claimedHours: 2,
      acceptedHours: 2,
      loads: 3,
      rates: {
        customer: { basis: "load", cents: 9500 },
        contractor: { basis: "load", cents: 6500 },
      },
    },
    {
      id: "WO-199",
      site: "nesbit",
      company: "north",
      worker: "nora",
      title: "Fixed scope — November sample milestone",
      status: "approved",
      sessions: [
        {
          in: event("2026-11-11T15:00:00Z"),
          out: event("2026-11-11T19:00:00Z"),
          breakMinutes: 0,
          members: ["nora"],
        },
      ],
      tasks: [0, 1, 2],
      photo: true,
      claimedHours: 4,
      acceptedHours: 4,
      loads: 0,
      rates: {
        customer: { basis: "fixed", cents: 120000 },
        contractor: { basis: "fixed", cents: 80000 },
      },
    },
  ];
  return {
    revision: 0,
    sites,
    works,
    people: [
      { id: "alex", name: "Alex Morgan", company: "aurora" },
      { id: "ben", name: "Ben Taylor", company: "aurora" },
      { id: "lee", name: "Lee Brooks", company: "aurora" },
      { id: "nora", name: "Nora Reed", company: "north" },
    ],
    companies: [
      { id: "aurora", name: "Aurora Field Services (sample)" },
      { id: "north", name: "Northern Site Crew (sample)" },
    ],
    bills: [],
    invoices: [],
    audit: [],
    payments: [],
  };
}
let state;
try {
  state = JSON.parse(localStorage.getItem(KEY)) || seed();
} catch {
  state = seed();
}
let role = "Management",
  view = "overview",
  chosen = "WO-204",
  dirty = false,
  busy = false,
  previousFocus,
  conflict = false,
  timer;
const site = (id) => state.sites.find((s) => s.id === id),
  person = (id) => state.people.find((p) => p.id === id),
  company = (id) => state.companies.find((c) => c.id === id),
  work = (id) => state.works.find((w) => w.id === id);
const roles = ["Worker", "Subcontractor", "NPI supervisor", "Management"];
const navs = {
  overview: "Overview",
  worker: "My work",
  hours: "Hours & locations",
  approvals: "Verify hours",
  sites: "Sites & maps",
  contracts: "Contracts & rates",
  billing: "Invoices & bills",
  settings: "Settings",
  spreadsheet: "Spreadsheet",
};
const allowed = () =>
  role === "Worker"
    ? ["worker", "hours", "sites"]
    : role === "Subcontractor"
      ? ["overview", "hours", "approvals", "sites", "billing"]
      : role === "NPI supervisor"
        ? ["overview", "hours", "approvals", "sites"]
        : Object.keys(navs).filter((k) => k !== "worker");
const scoped = () =>
  state.works.filter((w) =>
    role === "Worker"
      ? w.worker === "alex" ||
        w.sessions.some((s) => s.members.includes("alex"))
      : role === "Subcontractor"
        ? w.company === "aurora"
        : true,
  );
const tasks = [
  "Complete the assigned site service",
  "Check entrances, steps and accessible routes",
  "Record completion evidence and safety check",
];
function tell(msg) {
  clearTimeout(timer);
  $("#toast").textContent = msg;
  timer = setTimeout(() => ($("#toast").textContent = ""), 7000);
}
function save(fn, msg = "Saved on this device.") {
  if (conflict) {
    tell("Another tab changed these records. Reload before saving.");
    return false;
  }
  try {
    const disk = JSON.parse(localStorage.getItem(KEY) || "null");
    if (disk && disk.revision !== state.revision) {
      conflict = true;
      render();
      tell("Conflicting sample version. Reload before saving.");
      return false;
    }
    const n = structuredClone(state);
    fn(n);
    n.revision++;
    localStorage.setItem(KEY, JSON.stringify(n));
    state = n;
    dirty = false;
    tell(msg);
    return true;
  } catch (e) {
    tell("Could not save on this device. Check storage and retry.");
    return false;
  }
}
function log(n, msg) {
  n.audit.unshift({ at: new Date().toISOString(), actor: role, text: msg });
}
function head(title, desc, action = "") {
  return `<header class="pagehead"><div><p class="eyebrow">NPI / SUBCONTRACT OPERATIONS</p><h1 id="page-title" tabindex="-1">${title}</h1><p>${desc}</p></div>${action}</header>`;
}
function box(title, html) {
  return `<section class="panel"><h2>${title}</h2><div class="mt">${html}</div></section>`;
}
function mapLink(e, label = "Open recorded location") {
  return e
    ? `<a class="btn" href="https://www.google.com/maps/search/?api=1&query=${e.lat}%2C${e.lng}" target="_blank" rel="noopener noreferrer">${label} (map)</a>`
    : '<span class="muted">No recorded location</span>';
}
function siteMap(s) {
  return `<a class="btn" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address)}" target="_blank" rel="noopener noreferrer">Site map & address (map)</a>`;
}
function metric(label, value, detail) {
  return `<div class="metric"><div><label>${label}</label><strong>${value}</strong><small>${detail}</small></div></div>`;
}
function dialog(title, html) {
  previousFocus = document.activeElement;
  modal.innerHTML = `<div class="dialog-head"><h2 id="dialog-title">${title}</h2>${btn("×", "close", "", "quiet")}</div><div class="dialog-body">${html}<p id="form-error" role="alert" class="small mt12"></p></div>`;
  dirty = false;
  modal.showModal();
}
function close() {
  if (dirty) {
    $("#form-error").textContent =
      "Unsaved changes. Save the form, or choose Discard below.";
    if (!$("[data-a=discard]", modal))
      $(".dialog-body", modal).insertAdjacentHTML(
        "beforeend",
        btn("Discard changes", "discard", "", "danger mt12"),
      );
    return;
  }
  modal.close();
  previousFocus?.focus();
}
function field(id, label, type = "text", value = "", options = []) {
  return `<div class="field"><label for="${id}">${label}</label>${type === "select" ? `<select id="${id}">${options.map(([v, l]) => `<option value="${v}" ${value === v ? "selected" : ""}>${l}</option>`).join("")}</select>` : type === "textarea" ? `<textarea id="${id}" style="resize:none" maxlength="1000">${esc(value)}</textarea>` : `<input id="${id}" type="${type}" value="${esc(value)}" ${type === "number" ? 'min="0" max="10000" step="0.01"' : 'maxlength="120"'}>`}</div>`;
}
function table(headers, rows, caption) {
  return `<div class="table-wrap" tabindex="0" role="region" aria-label="${esc(caption)}"><table><caption>${caption}</caption><thead><tr>${headers.map((x) => `<th scope="col">${x}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}"><p class="muted">No records in this view yet.</p></td></tr>`}</tbody></table></div>`;
}
function render() {
  document.title = `NPI · ${navs[view]}`;
  document.body.dataset.view = view;
  const items = allowed();
  app.innerHTML = `<aside class="sidebar"><div class="brand"><span class="brandmark">NPI</span><div><b>NPI ALASKA</b><p class="small">SUBCONTRACT OPERATIONS</p></div></div><p class="navlabel eyebrow">Workspace</p><nav class="navlinks" aria-label="Main navigation">${items.map((k) => `<a class="navlink" href="#${k}" ${view === k ? 'aria-current="page"' : ""}>${navs[k]}</a>`).join("")}</nav><div class="sidebar-foot"><b class="small">Customer → NPI → Subcontractor</b><p class="mt12">Recorded evidence stays intact.<br>Alaska time · USD sample rates.</p></div></aside><div class="shell"><header class="topbar"><div class="crumb">NPI / <strong>${navs[view]}</strong></div><div class="row"><label for="preview-role" class="small">Preview as</label><select id="preview-role" class="role-switch">${roles.map((r) => `<option ${role === r ? "selected" : ""}>${r}</option>`).join("")}</select></div></header><div class="previewbar"><span><b>WORKING SAMPLE</b> · Synthetic companies, rates and GPS examples. Saved only on this device. No connected services.</span></div>${conflict ? '<p class="notice error" role="alert">Another tab changed the sample. Reload before saving.</p>' : ""}${!navigator.onLine ? '<p class="notice warning">Offline. Local sample only; live GPS maps and server validation need a connection.</p>' : ""}<main id="main" class="main">${{ overview, worker, hours, approvals, sites, contracts, billing, settings, spreadsheet }[view]()}<footer class="footer"><span>Original events → contractor claim → NPI accepted hours</span><span>All rates illustrative · no invoices sent or payments transferred</span></footer></main></div><nav class="bottomnav" aria-label="Mobile navigation">${items.map((k) => `<a href="#${k}" ${view === k ? 'aria-current="page"' : ""}>${navs[k]}</a>`).join("")}</nav>`;
}
function overview() {
  const ws = scoped(),
    recorded = ws.reduce((a, w) => a + recordedHours(w), 0),
    accepted = ws
      .filter((w) => w.status === "approved")
      .reduce((a, w) => a + w.acceptedHours, 0),
    claimed = ws.reduce((a, w) => a + (w.claimedHours || 0), 0);
  return (
    head(
      "Contracts to completed work.",
      "Monitor site work, contractor claims, and NPI acceptance in one place.",
      role === "Management"
        ? btn("Create work order", "new-work", "", "primary")
        : "",
    ) +
    `<div class="metrics">${metric("Recorded worker-hours", h(recorded), "Completed intervals less breaks")}${metric("Contractor-claimed hours", h(claimed), "Submitted hours; not NPI approval")}${metric("NPI-approved hours", h(accepted), "Eligible work, subject to pricing")}${metric("Awaiting NPI review", ws.filter((w) => w.status === "npi-review").length, "Contractor has reviewed first")}</div><div class="twocol"><div class="stack">${box(
      "Work by location",
      table(
        ["Location", "Recorded h", "Claimed h", "NPI h", "Work"],
        state.sites
          .filter((s) => ws.some((w) => w.site === s.id))
          .map((s) => {
            const list = ws.filter((w) => w.site === s.id);
            return [
              esc(s.name),
              h(list.reduce((a, w) => a + recordedHours(w), 0)),
              h(list.reduce((a, w) => a + (w.claimedHours || 0), 0)),
              h(list.reduce((a, w) => a + (w.acceptedHours || 0), 0)),
              btn("Open site", "site", s.id),
            ];
          }),
        "All dates in sample · totals across ended intervals",
      ),
    )}${box("Work register", workTable(ws))}</div><aside class="stack" style="align-content:start">${box("Approval chain", `<ol style="line-height:2;padding-left:20px"><li>Worker checks in and out with location.</li><li>Subcontractor approves its workers’ claim.</li><li>NPI cross-checks original app records.</li><li>NPI accepts hours or returns the claim.</li><li>Approved units support invoices and bills.</li></ol>`)}${box("Evidence and exceptions", `<p class="notice warning">WO-202: subcontractor claims 7 hours. Three recorded workers × 2 hours = 6 worker-hours.</p><p class="small muted mt12">Elapsed time, person-hours, and billable quantities are different values. GPS examples are not proof of real attendance.</p>${btn("Open review queue", "goto", "approvals", "primary mt")}`)}${box(
      "Recent decisions",
      state.audit.length
        ? state.audit
            .slice(0, 5)
            .map(
              (a) =>
                `<p class="small">${esc(a.actor)} · ${esc(a.text)}<br><span class="muted">${when(a.at)}</span></p>`,
            )
            .join('<div class="rule"></div>')
        : '<p class="small muted">Decisions made in this sample will appear here.</p>',
    )}</aside></div>`
  );
}
function workTable(ws) {
  return table(
    [
      "Work / location",
      "Subcontractor",
      role === "Worker"
        ? "Your recorded / claimed / NPI h"
        : "Recorded / claimed / NPI h",
      "Status",
      "Action",
    ],
    ws.map((w) => [
      `<b>${esc(w.id)}</b><p class="small muted">${esc(site(w.site).name)}</p><p class="small">${esc(w.title)}</p>`,
      esc(company(w.company).name),
      `${h(role === "Worker" ? individualHours(w, "alex") : recordedHours(w))} / ${(role === "Worker" ? w.claimedBy?.alex : w.claimedHours) === undefined ? "—" : h(role === "Worker" ? w.claimedBy.alex : w.claimedHours)} / ${(role === "Worker" ? w.acceptedBy?.alex : w.acceptedHours) === undefined ? "—" : h(role === "Worker" ? w.acceptedBy.alex : w.acceptedHours)}`,
      stateBadge(w),
      btn("Evidence", "evidence", w.id),
    ]),
    "Each record retains its original attendance evidence",
  );
}
let dateFilter = "",
  siteFilter = "all";
function running(time) {
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(time)) / 1000),
  );
  return [
    Math.floor(seconds / 3600),
    Math.floor(seconds / 60) % 60,
    seconds % 60,
  ]
    .map((v) => String(v).padStart(2, "0"))
    .join(":");
}
function hours() {
  const ws = scoped().filter(
    (w) =>
      (siteFilter === "all" || w.site === siteFilter) &&
      (!dateFilter ||
        w.sessions.some(
          (s) =>
            new Intl.DateTimeFormat("en-CA", {
              timeZone: "America/Anchorage",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }).format(new Date(s.in.time)) === dateFilter,
        )),
  );
  return (
    head(
      role === "Worker" ? "My hours & locations" : "Hours & location register",
      "Recorded attendance and claimed hours stay separate. Open either event to inspect its map.",
    ) +
    `<div class="metrics">${metric(role === "Worker" ? "Your recorded hours" : "Recorded worker-hours", h(ws.reduce((a, w) => a + (role === "Worker" ? individualHours(w, "alex") : recordedHours(w)), 0)), "Ended intervals less breaks")}${metric(role === "Worker" ? "Your claimed hours" : "Claimed hours", h(ws.reduce((a, w) => a + (role === "Worker" ? w.claimedBy?.alex || 0 : w.claimedHours || 0), 0)), "Subcontractor reviews first")}${metric(role === "Worker" ? "Your NPI-approved hours" : "NPI-approved hours", h(ws.reduce((a, w) => a + (role === "Worker" ? w.acceptedBy?.alex || 0 : w.acceptedHours || 0), 0)), "Accepted after cross-verification")}</div>` +
    box(
      "Filter the register",
      `<div class="row wrap"><div class="grow">${field("hours-date", "Work-order date (blank = all dates)", "date", dateFilter)}</div><div class="grow">${field("hours-site", "Site", "select", siteFilter, [["all", "All permitted sites"], ...state.sites.map((s) => [s.id, s.name])])}</div></div><p class="small muted">Filter by attendance start date in Alaska time. Claims and approval values belong to the whole work order.</p>`,
    ) +
    box("Timesheets", workTable(ws)) +
    `<section class="panel mt"><h2>Recorded event details</h2>${ws.map((w) => `<div class="mt"><h3>${esc(w.id)} · ${esc(site(w.site).name)}</h3>${sessionTable(w)}</div>`).join("")}</section>`
  );
}
function sessionTable(w) {
  return table(
    [
      "Roster / capture",
      "Check in",
      "Check out",
      "Break",
      "Elapsed / worker-hours",
    ],
    w.sessions.map((s) => {
      const elapsed = s.out
        ? (Date.parse(s.out.time) - Date.parse(s.in.time)) / 3600000
        : null;
      return [
        `${s.members.map((id) => esc(person(id)?.name || id)).join("<br>")}<p class="small muted">${s.members.length > 1 ? "Crew capture by " + esc(person(s.operator)?.name || "crew lead") + "; not individual GPS proof" : "Individual entry"}</p>`,
        eventCell(s.in),
        eventCell(s.out),
        `${s.breakMinutes || 0} min`,
        elapsed === null
          ? "Still open"
          : `${h(elapsed)} elapsed<br>${h(Math.max(0, elapsed - (s.breakMinutes || 0) / 60) * s.members.length)} worker-h`,
      ];
    }),
    "GPS source and accuracy are retained independently at each event",
  );
}
function eventCell(e) {
  return e
    ? `<b class="small">${when(e.time)}</b><p class="small muted">${e.lat.toFixed(5)}, ${e.lng.toFixed(5)}<br>Accuracy ±${Math.round(e.accuracy)} m · ${esc(e.source)}</p>${btn("Map & address", "point", encodeURIComponent(JSON.stringify(e)))}`
    : '<span class="badge orange">Not captured</span>';
}
function worker() {
  const w = work(chosen),
    open = w.sessions.find((s) => !s.out),
    ended = !!w.sessions.length && !open,
    editable = ["worker-draft", "returned"].includes(w.status);
  return (
    head(
      "My work",
      "Alex Morgan · Aurora Field Services · individual or crew attendance",
      field(
        "worker-work",
        "Choose your work",
        "select",
        chosen,
        scoped().map((w) => [w.id, w.id + " · " + site(w.site).name]),
      ),
    ) +
    `<div class="worker-grid"><section class="panel"><div class="row between wrap"><h2>${esc(site(w.site).name)}</h2>${stateBadge(w)}</div><p class="muted small mt12">${esc(w.title)} · ${w.id}</p><p class="small mt12">${esc(site(w.site).address)} <b>(address verification pending)</b></p><div class="mt12">${editable ? (!w.sessions.length ? btn("Check in · location required", "capture-in", w.id, "primary wide") : open ? btn("Check out · location required", "capture-out", w.id, "primary wide") : badge("Check-in and checkout captured", "green")) : ""}</div><div class="row wrap mt12">${siteMap(site(w.site))}${btn("Site photo", "site", w.site)}</div><div class="metrics" style="grid-template-columns:1fr 1fr">${metric("Your recorded hours", h(individualHours(w, "alex")), "Your completed intervals; excludes other crew members")}${metric("NPI-approved hours", w.acceptedBy?.alex === undefined ? "—" : h(w.acceptedBy.alex), "Your hours after both review stages")}</div>${open ? `<p class="notice mt12"><b>Running elapsed time: <span id="live-timer">${running(open.in.time)}</span></b><br><span class="small">Provisional until checkout and break entry. Recorded worker-hours above include completed intervals only.</span></p>` : ""}<div class="mt"><h3>Checklist</h3>${tasks.map((t, i) => `<label class="task"><input type="checkbox" data-task="${i}" ${w.tasks.includes(i) ? "checked" : ""} ${editable && w.sessions.length ? "" : "disabled"}>${t}</label>`).join("")}</div><div class="row wrap mt">${w.photo ? badge("Sample evidence added", "green") : btn("Add sample work evidence", "photo", w.id, "")}${ended && editable ? btn("Submit hours to subcontractor", "claim", w.id, "primary") : ""}</div>${w.returnReason ? `<p class="notice warning mt">${esc(w.returnReason)}</p>` : ""}<p class="small muted mt12">GPS is requested only when you press check in or check out. No continuous tracking. Example GPS is offered only for this review sample.</p></section><aside class="stack" style="align-content:start">${box("Your recorded attendance", sessionTable(w))}${box("Approval progress", `<div class="summary-line"><span>Your claimed hours</span><b>${w.claimedBy?.alex === undefined ? "Not submitted" : h(w.claimedBy.alex) + " h"}</b></div><div class="summary-line"><span>Subcontractor</span><b>${["npi-review", "approved"].includes(w.status) ? "Reviewed" : "Pending"}</b></div><div class="summary-line"><span>NPI cross-verification</span><b>${w.acceptedBy?.alex === undefined ? "Pending" : h(w.acceptedBy.alex) + " h accepted"}</b></div>`)}</aside></div>`
  );
}
function approvals() {
  const ws = scoped().filter((w) =>
    role === "Subcontractor"
      ? w.status === "contractor-review"
      : w.status === "npi-review",
  );
  return (
    head(
      role === "Subcontractor"
        ? "Approve your workers’ hours"
        : "Cross-verify contractor hours",
      role === "Subcontractor"
        ? "Compare worker claims with original app attendance before forwarding to NPI."
        : "Only subcontractor-reviewed claims appear here. Original GPS events and times remain unchanged.",
    ) +
    box(
      "Review queue",
      ws.length
        ? ws
            .map(
              (w) =>
                `<article class="panel mt"><div class="row between wrap"><div><h3>${w.id} · ${esc(site(w.site).name)}</h3><p class="small muted">${esc(company(w.company).name)}</p></div>${stateBadge(w)}</div><div class="metrics" style="grid-template-columns:repeat(3,1fr)">${metric("Recorded worker-h", h(recordedHours(w)), "From original app events")}${metric("Claimed hours", h(w.claimedHours), "Worker / contractor claim")}${metric("Difference", h(w.claimedHours - recordedHours(w)), "Claimed minus recorded")}</div>${sessionTable(w)}<p class="small muted mt12">${esc(w.contractorNote || "Check the roster, breaks, site, evidence and both GPS events.")}</p><div class="row wrap mt">${btn("Inspect evidence", "evidence", w.id)}${btn("Return with reason", "return", w.id)}${btn(role === "Subcontractor" ? "Approve & forward to NPI" : "Verify & approve hours", role === "Subcontractor" ? "contractor-approve" : "npi-approve", w.id, "primary")}</div></article>`,
            )
            .join("")
        : '<p class="notice">No claims are waiting at this review stage. Try submitting worker hours first.</p>',
    )
  );
}
function sites() {
  const ids = new Set(scoped().map((w) => w.site));
  return (
    head(
      "Actual sites, distinct records.",
      "Each site has its own address, photo slot, tasks, and attendance history.",
    ) +
    `<p class="notice warning">Candidate addresses and map points need verification before field use. The original photos pasted in chat are not available as downloadable files here. Add a different actual photo to each site using the local picker.</p><div class="site-strip mt">${state.sites
      .filter((s) => ids.has(s.id))
      .map(
        (s) =>
          `<article class="sitecard"><div class="real-site-photo">${s.photo ? `<img src="${s.photo}" alt="User-selected photo of ${esc(s.name)}">` : `<div class="site-placeholder"><b>${esc(s.name)}</b><span>Actual site photo pending</span></div>`}</div><div class="sitebody"><h3>${esc(s.name)}</h3><p>${esc(s.address)}</p>${badge("Address verification pending", "orange")}<div class="row wrap mt12">${siteMap(s)}${btn("Work & hours", "site", s.id)}</div><label class="photo-picker mt12">Choose actual site photo<input type="file" accept="image/jpeg,image/png,image/webp" data-site-photo="${s.id}"></label><p class="small muted">Stored only on this device. Use an image you have permission to use, up to 600 KB.</p></div></article>`,
      )
      .join("")}</div>`
  );
}
function contracts() {
  return (
    head(
      "Customer and subcontract agreements",
      "One scope of work, two independent pricing agreements. All prices below are illustrative.",
    ) +
    box(
      "Sample contract: Alaska site services · November 2026",
      `<p class="notice">Customer: Example Facilities Client → NPI → Aurora / Northern Site Crew. These are sample agreements, not your actual contracts. Amounts exclude tax and overhead.</p>${table(
        [
          "Work / scope",
          "Customer pricing",
          "Contractor pricing",
          "NPI accepted h / units",
        ],
        state.works.map((w) => [
          `${w.id}<br>${esc(w.title)}`,
          `${money(w.rates.customer.cents)} / ${w.rates.customer.basis}`,
          `${money(w.rates.contractor.cents)} / ${w.rates.contractor.basis}`,
          w.status === "approved"
            ? `${h(w.acceptedHours)} h<br>Customer: ${quantity(w, w.rates.customer.basis)} ${w.rates.customer.basis}<br>Contractor: ${quantity(w, w.rates.contractor.basis)} ${w.rates.contractor.basis}`
            : "Not billable until NPI approval",
        ]),
        "Mixed hourly, per-visit, per-load and fixed-scope examples",
      )}<p class="small muted mt12">A fixed scope is allocated once. It is not multiplied by worker-hours. Real rate changes must use effective versions and approved contract amendments.</p>`,
    )
  );
}
function billing() {
  const ws = scoped(),
    bills = state.bills.filter((b) =>
      role === "Subcontractor" ? b.company === "aurora" : true,
    ),
    inv = state.invoices;
  const approved = ws.filter((w) => w.status === "approved"),
    revenue = approved.reduce((a, w) => a + charge(w, "customer"), 0),
    cost = approved.reduce((a, w) => a + charge(w, "contractor"), 0);
  return (
    head(
      role === "Subcontractor"
        ? "Your subcontractor bills"
        : "Customer invoices & subcontractor bills",
      "Billing uses NPI-approved work and each side’s agreed units. No documents are sent and no money is transferred.",
    ) +
    (role === "Management"
      ? `<div class="metrics">${metric("Approved service value", money(revenue), "Before tax · sample rates")}${metric("Expected subcontract cost", money(cost), "Before tax · approved work")}${metric("Estimated gross margin", money(revenue - cost), "Excludes overhead, tax and other costs")}${metric("Awaiting bill review", bills.filter((b) => b.status === "Submitted").length, "NPI must verify separately")}</div>`
      : "") +
    `<div class="row wrap mt">${role === "Management" ? btn("Create customer invoice draft", "new-invoice", "", "primary") : ""}${role === "Subcontractor" ? btn("Submit subcontractor bill", "new-bill", "", "primary") : ""}</div>` +
    (role === "Management"
      ? box(
          "Customer invoice drafts",
          table(
            ["Invoice", "Work lines", "Total", "Recorded received", "Action"],
            inv.map((i) => [
              i.id,
              i.workIds.join(", "),
              money(i.expected),
              money(i.paid || 0),
              btn("Record receipt", "payment", "invoice:" + i.id),
            ]),
            "Drafts only · rates snapshotted from approved sample work",
          ),
        )
      : "") +
    `<section class="panel mt"><h2>Subcontractor bills</h2><div class="mt">${table(
      [
        "Bill / company",
        "Work lines",
        "Expected / claimed",
        "Status",
        "Action",
      ],
      bills.map((b) => [
        `${esc(b.reference)}<p class="small muted">${esc(company(b.company).name)}</p>`,
        b.workIds.join(", "),
        `${money(b.expected)} / ${money(b.claimed)}<p class="small ${b.expected === b.claimed ? "muted" : "error-text"}">Difference: ${money(b.claimed - b.expected)}</p>`,
        badge(b.status, b.status === "Approved" ? "green" : "orange"),
        role === "Management"
          ? b.status === "Submitted"
            ? btn("Cross-check bill", "review-bill", b.id)
            : b.status === "Approved"
              ? btn("Record payment", "payment", "bill:" + b.id)
              : "—"
          : b.status === "Disputed"
            ? btn("Revise bill", "revise-bill", b.id)
            : "NPI reviews your bill",
      ]),
      "A contractor bill is a claim, not an automatic payment approval",
    )}</div></section><section class="panel mt"><h2>Recorded payments & receipts</h2><p class="small muted mt12">Manual bookkeeping entries only. No banking integration.</p>${table(
      ["Type / document", "Amount", "Reference", "Recorded"],
      state.payments
        .filter((p) =>
          role === "Subcontractor" ? bills.some((b) => b.id === p.doc) : true,
        )
        .map((p) => [
          esc(p.type) + " · " + esc(p.doc),
          money(p.cents),
          esc(p.reference),
          when(p.at),
        ]),
      "Partial receipts and payments retain the outstanding balance",
    )}</section>`
  );
}
function settings() {
  return (
    head(
      "Operations settings",
      "Roles, site rules and spreadsheet responsibilities.",
    ) +
    box(
      "Confirmed workflow",
      `<div class="summary-line"><span>Attendance mode</span><b>Individual and explicit crew roster</b></div><div class="summary-line"><span>Check-in location</span><b>Required</b></div><div class="summary-line"><span>Checkout location</span><b>Required independently</b></div><div class="summary-line"><span>Review order</span><b>Subcontractor → NPI verification</b></div><div class="summary-line"><span>Pricing</span><b>Hourly / fixed / visit / load</b></div><p class="notice mt">Supabase and Google Sheets are unconnected in this sample. The production bridge must preserve immutable events and separate claims, decisions and invoice allocations. Role previews are not authentication.</p>`,
    ) +
    `<section class="panel mt"><h2>Company boundaries</h2>${table(
      ["Company", "Workers", "Scope"],
      state.companies.map((c) => [
        esc(c.name),
        state.people
          .filter((p) => p.company === c.id)
          .map((p) => esc(p.name))
          .join(", "),
        "Own workers, work and bills only",
      ]),
      "Management can inspect all; contractors cannot see NPI client prices",
    )}</section><section class="panel mt"><h2>Sample data</h2><p class="small muted">The earlier app and sample are separate. Reset removes only this revised sample’s local edits.</p>${btn("Reset revised sample", "reset", "", "danger mt12")}</section>`
  );
}
let capture = null,
  token = 0;
function error(msg, id) {
  const e = $("#form-error");
  if (e) {
    e.textContent = msg;
    e.className = "notice error mt12";
  }
  if (id) {
    $("#" + id)?.setAttribute("aria-invalid", "true");
    $("#" + id)?.setAttribute("aria-describedby", "form-error");
    $("#" + id)?.focus();
  }
}
function members(w) {
  return [...new Set(w.sessions.flatMap((s) => s.members))];
}
function individualHours(w, id) {
  return w.sessions.reduce(
    (sum, s) =>
      sum +
      (s.out && s.members.includes(id)
        ? Math.max(
            0,
            (Date.parse(s.out.time) - Date.parse(s.in.time)) / 3600000 -
              (s.breakMinutes || 0) / 60,
          )
        : 0),
    0,
  );
}
function pointDialog(e) {
  dialog(
    "Recorded location & address",
    `<p class="notice ${e.source === "Example GPS" ? "warning" : ""}">${e.source === "Example GPS" ? "Example GPS for reviewing the sample; not real attendance." : "Captured from this device when you requested the attendance event."}</p><div class="summary-line"><span>Event time</span><b>${when(e.time)}</b></div><div class="summary-line"><span>Coordinates</span><b>${e.lat.toFixed(6)}, ${e.lng.toFixed(6)}</b></div><div class="summary-line"><span>Accuracy</span><b>±${Math.round(e.accuracy)} metres</b></div><div class="summary-line"><span>Recorded address</span><b>${esc(e.address || "Address lookup unavailable; use the coordinate map")}</b></div><p class="small muted mt12">The map opens this event’s actual coordinates. It is separate from the expected site address. Google Maps can show the point’s surrounding street address; this sample does not invent a reverse-geocoded address.</p><div class="dialog-actions">${mapLink(e)}${btn("Close", "close")}</div>`,
  );
}
function evidence(id) {
  const w = work(id);
  dialog(
    `${w.id} · original work evidence`,
    `<h3>${esc(site(w.site).name)}</h3><p class="small muted mt12">${esc(w.title)} · ${esc(company(w.company).name)}</p>${stateBadge(w)}<div class="mt">${sessionTable(w)}</div><h3 class="mt">Hours by worker</h3>${table(
      ["Worker", "Recorded h", "Claimed h", "NPI accepted h"],
      members(w).map((id) => [
        esc(person(id).name),
        h(individualHours(w, id)),
        w.claimedBy?.[id] === undefined ? "—" : h(w.claimedBy[id]),
        w.acceptedBy?.[id] === undefined ? "—" : h(w.acceptedBy[id]),
      ]),
      "Individual hours stay distinct from crew totals",
    )}<div class="summary-line"><span>Tasks completed</span><b>${w.tasks.length} / ${tasks.length}</b></div><div class="summary-line"><span>Completion evidence</span><b>${w.photo ? "Sample evidence recorded" : "Missing"}</b></div><p class="notice mt">Original events are not overwritten by a claim or decision. Evidence in this sample is synthetic. ${esc(w.npiReason || w.contractorNote || "")}</p>`,
  );
}
function captureDialog(id, out) {
  const w = work(id);
  capture = { id, out, point: null, seq: ++token };
  dialog(
    out ? "Check out · location required" : "Check in · location required",
    `<p class="notice">A new location is required for this ${out ? "checkout" : "check-in"}. No position is silently copied from your site or previous event.</p>${
      !out
        ? `<div class="mt">${field(
            "entry-mode",
            "Attendance mode",
            "select",
            "individual",
            [
              ["individual", "Individual — Alex Morgan"],
              ["crew", "Crew — select everyone present"],
            ],
          )}<fieldset id="roster" hidden><legend>Crew members present</legend>${state.people
            .filter((p) => p.company === w.company)
            .map(
              (p) =>
                `<label class="task"><input type="checkbox" name="crew" value="${p.id}" ${p.id === "alex" ? "checked" : ""}>${esc(p.name)}</label>`,
            )
            .join(
              "",
            )}<p class="small muted">Alex’s device captures this crew location. It is not independent GPS evidence for every member.</p></fieldset></div>`
        : field("break-minutes", "Break minutes for this interval", "number", 0)
    }<div class="row wrap mt">${btn("Get my device location", "gps", "", "primary")}${btn("Use example GPS · sample only", "example-gps")}</div><div id="capture-result" class="mt" aria-live="polite"><p class="small muted">No location captured yet.</p></div><div class="dialog-actions">${btn("Cancel", "close")}<button type="button" class="btn primary" data-a="confirm-capture" disabled>Confirm ${out ? "checkout" : "check-in"}</button></div>`,
  );
}
function captured(point) {
  if (!capture || !modal.open) return;
  capture.point = point;
  $("#capture-result").innerHTML =
    `<p class="notice ${point.source === "Example GPS" ? "warning" : ""}"><b>${esc(point.source)}</b> · ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}<br>Accuracy ±${Math.round(point.accuracy)} m${point.accuracy > 100 ? " · Poor accuracy: flag for reviewer" : ""}<br>${point.source === "Example GPS" ? "Simulated event time and position." : "Address lookup not configured; the map opens the captured point."}</p>`;
  $("[data-a=confirm-capture]", modal).disabled = false;
}
function claimDialog(id) {
  const w = work(id);
  if (!hasBothLocations(w)) {
    tell("Both check-in and checkout must have location before submission.");
    return;
  }
  if (w.tasks.length !== 3 || !w.photo) {
    tell("Complete all tasks and add sample evidence before submitting hours.");
    return;
  }
  dialog(
    "Submit hours to subcontractor",
    `<form id="claim-form" data-id="${id}" novalidate><p class="notice">Original attendance stays unchanged. Enter the claimed hours per worker for your subcontractor to review.</p><div class="mt">${members(
      w,
    )
      .map((id) =>
        field(
          "claim-" + id,
          `${esc(person(id).name)} · recorded ${h(individualHours(w, id))} h`,
          "number",
          w.claimedBy?.[id] ?? individualHours(w, id),
        ),
      )
      .join(
        "",
      )}${field("claim-reason", "Claim note / reason for a difference", "textarea", w.contractorNote || "")}</div><div class="dialog-actions">${btn("Cancel", "close")}<button type="submit" class="btn primary">Submit to subcontractor</button></div></form>`,
  );
}
function npiDialog(id) {
  const w = work(id);
  const overlaps = overlappingWorkers(w, state.works);
  if (overlaps.length) {
    tell(
      "Overlapping attendance: " +
        overlaps.map((id) => person(id).name).join(", ") +
        ". Resolve before approval.",
    );
    return;
  }
  dialog(
    "NPI cross-verification",
    `<form id="npi-form" data-id="${id}" novalidate><p class="notice warning">Verify the original check-in/out times, both locations, breaks, roster and task evidence. Contractor approval is not final NPI approval.</p><div class="mt">${members(
      w,
    )
      .map((id) =>
        field(
          "accept-" + id,
          `${esc(person(id).name)} · recorded ${h(individualHours(w, id))} h / claimed ${h(w.claimedBy?.[id] ?? w.claimedHours)} h`,
          "number",
          individualHours(w, id),
        ),
      )
      .join(
        "",
      )}${field("accept-reason", "Verification note / reason for adjustments", "textarea", "")}</div><div class="dialog-actions">${btn("Cancel", "close")}<button type="submit" class="btn primary">Approve accepted hours</button></div></form>`,
  );
}
function billingForm(isInvoice, existing) {
  const comp = existing?.company || "aurora",
    list = existing
      ? state.works.filter((w) => existing.workIds.includes(w.id))
      : eligible(
          state.works.filter((w) => isInvoice || w.company === comp),
          isInvoice ? state.invoices : state.bills,
        );
  if (!list.length) {
    tell("No unallocated NPI-approved work is available for this document.");
    return;
  }
  dialog(
    existing
      ? "Revise subcontractor bill"
      : isInvoice
        ? "Create customer invoice draft"
        : "Submit subcontractor bill",
    `<form id="document-form" data-side="${isInvoice ? "customer" : "contractor"}" data-id="${existing?.id || ""}" novalidate><p class="notice">${isInvoice ? "Customer" : "Subcontractor"} rates below are illustrative. Only NPI-approved work with both recorded locations can be allocated.</p><div class="mt">${list.map((w) => `<label class="task"><input type="checkbox" name="work-lines" value="${w.id}" ${existing ? "checked disabled" : "checked"}><span>${w.id} · ${esc(site(w.site).name)}<br><span class="small">${quantity(w, w.rates[isInvoice ? "customer" : "contractor"].basis)} ${w.rates[isInvoice ? "customer" : "contractor"].basis} × ${money(w.rates[isInvoice ? "customer" : "contractor"].cents)} = ${money(charge(w, isInvoice ? "customer" : "contractor"))}</span></span></label>`).join("")}</div>${field("doc-reference", isInvoice ? "Invoice draft reference" : "Your subcontractor invoice number", "text", existing?.reference || "")}${!isInvoice ? field("doc-claimed", "Claimed total (USD)", "number", existing ? existing.claimed / 100 : list.reduce((a, w) => a + charge(w, "contractor"), 0) / 100) : ""}<p class="small muted">Rates and approved quantities are snapshotted in the document. A claimed total that differs from expected cost is flagged for NPI review.</p><div class="dialog-actions">${btn("Cancel", "close")}<button type="submit" class="btn primary">${isInvoice ? "Create draft" : "Submit bill to NPI"}</button></div></form>`,
  );
}
function spreadsheet() {
  return (
    head(
      "Management workbook preview",
      "The app and Sheets share records; original time and location evidence stays protected.",
    ) +
    box(
      "Proposed workbook tabs",
      `<p class="notice">Supabase and Google Sheets are not connected. This view reads the same local sample records. Real two-way sync requires verified editor identity, version checks, audit and retry handling.</p><p class="small muted mt12">Contracts · Subcontracts · Sites · TimeEvents · WorkerClaims · ContractorApprovals · NPIApprovals · CustomerInvoices · ContractorBills · Payments · Changes · SyncLog</p><div class="mt">${btn("Export hours CSV", "export-hours", "", "primary")}</div>`,
    ) +
    `<section class="panel mt"><h2>Hours and approval projection</h2>${workTable(state.works)}<p class="small muted mt12">Raw event coordinates, timestamps and original claims are protected. Authorized corrections must retain the original values and both approval stages.</p></section>`
  );
}
function workOrderDialog() {
  dialog(
    "Assign a subcontract work order",
    `<form id="work-order-form" novalidate>${field("new-title", "Work description")}${field(
      "new-site",
      "Location",
      "select",
      "boney",
      state.sites.map((s) => [s.id, s.name]),
    )}${field(
      "new-company",
      "Subcontractor company",
      "select",
      "aurora",
      state.companies.map((c) => [c.id, c.name]),
    )}${field(
      "new-worker",
      "Assigned worker / crew lead",
      "select",
      "alex",
      state.people.map((p) => [p.id, p.name + " — " + company(p.company).name]),
    )}${field("new-date", "Planned work date", "date", "2026-11-13")}<p class="notice">Illustrative pricing only. Customer and subcontractor agreements can use different units.</p><div class="row wrap mt"><div class="grow">${field(
      "customer-basis",
      "Customer basis",
      "select",
      "visit",
      ["hourly", "visit", "load", "fixed"].map((x) => [x, x]),
    )}${field("customer-rate", "Customer rate (USD)", "number", 350)}</div><div class="grow">${field(
      "contractor-basis",
      "Subcontractor basis",
      "select",
      "visit",
      ["hourly", "visit", "load", "fixed"].map((x) => [x, x]),
    )}${field("contractor-rate", "Subcontractor rate (USD)", "number", 220)}</div></div><p class="small muted">The sample checklist attaches automatically. The crew lead selects the actual roster at check-in.</p><div class="dialog-actions">${btn("Cancel", "close")}<button type="submit" class="btn primary">Create subcontract assignment</button></div></form>`,
  );
}
const actions = {
  "new-work": workOrderDialog,
  "export-hours": () => {
    const rows = [
      [
        "Work ID",
        "Site",
        "Company",
        "Recorded worker-hours",
        "Claimed hours",
        "NPI accepted hours",
        "Status",
      ],
      ...state.works.map((w) => [
        w.id,
        site(w.site).name,
        company(w.company).name,
        recordedHours(w),
        w.claimedHours ?? "",
        w.acceptedHours ?? "",
        statuses[w.status],
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
    a.download = "NPI-Subcontract-Hours-Sample.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    tell("Sample hours exported for Sheets or Excel.");
  },
  close: () => {
    if (busy) {
      tell("Wait for location capture or its timeout.");
      return;
    }
    token++;
    capture = null;
    close();
  },
  discard: () => {
    dirty = false;
    capture = null;
    token++;
    modal.close();
  },
  goto: (el) => {
    view = el.dataset.id;
    render();
  },
  evidence: (el) => evidence(el.dataset.id),
  point: (el) => pointDialog(JSON.parse(decodeURIComponent(el.dataset.id))),
  site: (el) => {
    const s = site(el.dataset.id);
    dialog(
      esc(s.name),
      `<p class="small">${esc(s.address)}</p><p class="notice warning mt12">Address and example coordinates need verification. They are not recorded employee locations.</p><div class="mt">${siteMap(s)}</div><div class="mt">${workTable(scoped().filter((w) => w.site === s.id))}</div>`,
    );
  },
  "capture-in": (el) => captureDialog(el.dataset.id, false),
  "capture-out": (el) => captureDialog(el.dataset.id, true),
  gps: () => {
    if (!capture || busy) return;
    if (!navigator.geolocation) {
      error(
        "This browser does not offer location. Open the hosted app in a supported browser.",
      );
      return;
    }
    const seq = capture.seq;
    busy = true;
    const trigger = $("[data-a=gps]", modal);
    trigger.disabled = true;
    $("#capture-result").innerHTML =
      '<p role="status">Waiting for device location… You may need to allow location in your browser.</p>';
    navigator.geolocation.getCurrentPosition(
      (p) => {
        busy = false;
        if (capture?.seq !== seq) return;
        trigger.disabled = false;
        captured({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
          positionTime: new Date(p.timestamp).toISOString(),
          time: new Date().toISOString(),
          source: "Browser GPS",
          address: "Address lookup unavailable; open the coordinate map",
        });
      },
      (err) => {
        busy = false;
        if (capture?.seq !== seq) return;
        trigger.disabled = false;
        capture.point = null;
        $("[data-a=confirm-capture]", modal).disabled = true;
        $("#capture-result").innerHTML =
          `<p class="notice error" role="alert">${err.code === 1 ? "Location permission was denied. Allow it in your browser settings and retry." : err.code === 3 ? "Location timed out. Move to a clearer area and retry." : "Location is unavailable. Check device location settings and retry."} No event was recorded.</p>`;
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  },
  "example-gps": () => {
    if (!capture || busy) return;
    const w = work(capture.id),
      s = site(w.site);
    const t = capture.out
      ? new Date(
          Date.parse(w.sessions.find((s) => !s.out).in.time) + 2 * 3600000,
        ).toISOString()
      : new Date().toISOString();
    captured({
      ...event(t, s.lat, s.lng),
      positionTime: t,
      address: `Example point near ${s.name}; candidate site address: ${s.address}`,
    });
  },
  "confirm-capture": () => {
    if (!capture?.point) {
      error("Capture a new location first.");
      return;
    }
    const { id, out, point } = capture,
      w = work(id);
    let roster = ["alex"],
      breakMinutes = 0;
    if (out) {
      breakMinutes = Number($("#break-minutes").value);
      const current = w.sessions.find((s) => !s.out),
        minutes =
          (Date.parse(point.time) - Date.parse(current.in.time)) / 60000;
      if (
        !Number.isFinite(breakMinutes) ||
        breakMinutes < 0 ||
        breakMinutes > minutes
      ) {
        error(
          "Break minutes must be between zero and this interval’s elapsed minutes.",
          "break-minutes",
        );
        return;
      }
    } else if ($("#entry-mode").value === "crew") {
      roster = [...modal.querySelectorAll("input[name=crew]:checked")].map(
        (e) => e.value,
      );
      if (!roster.length || !roster.includes("alex")) {
        error("Include Alex, the device operator, and everyone present.");
        return;
      }
    }
    if (
      save(
        (n) => {
          const w = n.works.find((w) => w.id === id);
          if (out) {
            const session = w.sessions.find((s) => !s.out);
            session.out = point;
            session.breakMinutes = breakMinutes;
          } else
            w.sessions.push({
              in: point,
              out: null,
              breakMinutes: 0,
              members: roster,
              operator: "alex",
            });
          log(
            n,
            `${id}: ${out ? "checkout" : "check-in"} with ${point.source}; ${roster.length} roster member(s).`,
          );
        },
        `${out ? "Checkout" : "Check-in"} recorded locally with its own location.`,
      )
    ) {
      capture = null;
      dirty = false;
      modal.close();
      render();
    }
  },
  photo: (el) => {
    if (
      save((n) => {
        n.works.find((w) => w.id === el.dataset.id).photo = true;
      }, "Sample evidence added locally.")
    )
      render();
  },
  claim: (el) => claimDialog(el.dataset.id),
  "contractor-approve": (el) => {
    const w = work(el.dataset.id);
    if (w.status !== "contractor-review" || !hasBothLocations(w)) {
      tell("A complete worker claim and both event locations are required.");
      return;
    }
    if (
      save((n) => {
        const x = n.works.find((x) => x.id === w.id);
        x.status = "npi-review";
        log(
          n,
          `${w.id}: subcontractor reviewed ${h(w.claimedHours)} h and forwarded to NPI.`,
        );
      }, "Claim forwarded to NPI. It is not yet NPI-approved.")
    )
      render();
  },
  "npi-approve": (el) => npiDialog(el.dataset.id),
  return: (el) =>
    dialog(
      "Return hours with a reason",
      `<form id="return-form" data-id="${el.dataset.id}" novalidate>${field("return-note", "What must be corrected?", "textarea", "")}<div class="dialog-actions">${btn("Cancel", "close")}<button type="submit" class="btn primary">Return claim</button></div></form>`,
    ),
  "new-invoice": () => billingForm(true),
  "new-bill": () => billingForm(false),
  "revise-bill": (el) =>
    billingForm(
      false,
      state.bills.find((b) => b.id === el.dataset.id),
    ),
  "review-bill": (el) => {
    const b = state.bills.find((b) => b.id === el.dataset.id);
    dialog(
      "Verify subcontractor bill",
      `<h3>${esc(b.reference)}</h3><p class="small muted mt12">${esc(company(b.company).name)} · ${b.workIds.join(", ")}</p><div class="summary-line"><span>Expected from approved quantities</span><b>${money(b.expected)}</b></div><div class="summary-line"><span>Subcontractor claimed</span><b>${money(b.claimed)}</b></div><div class="summary-line"><span>Difference</span><b>${money(b.claimed - b.expected)}</b></div><p class="notice ${b.claimed !== b.expected ? "warning" : ""} mt">${b.claimed !== b.expected ? "The bill does not match the agreed sample rates. Dispute it or have the contractor revise it. Approval is blocked." : "Amounts match. Confirm approved work and document details before recording approval."}</p><form id="bill-review-form" data-id="${b.id}" novalidate class="mt">${field("bill-note", "Review / dispute note", "textarea", "")}<div class="dialog-actions">${btn("Cancel", "close")}<button type="submit" name="decision" value="dispute" class="btn danger">Dispute bill</button><button type="submit" name="decision" value="approve" class="btn primary" ${b.claimed !== b.expected ? "disabled" : ""}>Approve matched bill</button></div></form>`,
    );
  },
  payment: (el) => {
    const [type, id] = el.dataset.id.split(":"),
      d = (type === "invoice" ? state.invoices : state.bills).find(
        (d) => d.id === id,
      ),
      total = type === "invoice" ? d.expected : d.claimed;
    if (type === "bill" && d.status !== "Approved") {
      tell("Only approved bills can have a payment recorded.");
      return;
    }
    if ((d.paid || 0) >= total) {
      tell("This document has no outstanding balance.");
      return;
    }
    dialog(
      type === "invoice"
        ? "Record customer receipt"
        : "Record subcontractor payment",
      `<form id="payment-form" data-type="${type}" data-id="${id}" novalidate><p class="notice">Manual record only. This does not transfer money or contact anyone.</p><p class="small mt12">Outstanding: ${money(total - (d.paid || 0))}</p><div class="mt">${field("payment-amount", "Amount (USD)", "number", (total - (d.paid || 0)) / 100)}${field("payment-reference", "Payment / receipt reference", "text", "")}</div><div class="dialog-actions">${btn("Cancel", "close")}<button type="submit" class="btn primary">Save bookkeeping entry</button></div></form>`,
    );
  },
  reset: () =>
    dialog(
      "Reset revised sample?",
      `<p>Removes only this subcontract sample’s local edits and chosen photos. Other NPI apps and spreadsheets are untouched.</p><div class="dialog-actions">${btn("Keep sample", "close", "", "primary")}${btn("Reset revised sample", "reset-confirm", "", "danger")}</div>`,
    ),
  "reset-confirm": () => {
    try {
      localStorage.removeItem(KEY);
      state = seed();
      normalize();
      conflict = false;
      dirty = false;
      modal.close();
      render();
      tell("Revised sample reset.");
    } catch {
      error("Could not reset storage.");
    }
  },
};
function submit(e) {
  e.preventDefault();
  const f = e.target,
    id = f.dataset.id,
    w = work(id),
    value = (k) => $("#" + k, f)?.value.trim() || "";
  try {
    if (f.id === "work-order-form") {
      const title = value("new-title"),
        comp = value("new-company"),
        workerId = value("new-worker"),
        customer = Math.round(Number(value("customer-rate")) * 100),
        contractor = Math.round(Number(value("contractor-rate")) * 100);
      if (!title) {
        error("Describe the work.", "new-title");
        return;
      }
      if (person(workerId).company !== comp) {
        error(
          "The assigned worker must belong to the selected subcontractor.",
          "new-worker",
        );
        return;
      }
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(value("new-date")) ||
        ![customer, contractor].every((c) => Number.isSafeInteger(c) && c >= 0)
      ) {
        error("Choose a planned date and valid nonnegative rates.");
        return;
      }
      if (
        save((n) => {
          const id =
            "WO-" +
            (Math.max(...n.works.map((w) => Number(w.id.slice(3)))) + 1);
          n.works.unshift({
            id,
            site: value("new-site"),
            company: comp,
            worker: workerId,
            title,
            date: value("new-date"),
            status: "worker-draft",
            sessions: [],
            tasks: [],
            photo: false,
            loads: 0,
            rates: {
              customer: { basis: value("customer-basis"), cents: customer },
              contractor: {
                basis: value("contractor-basis"),
                cents: contractor,
              },
            },
          });
          log(
            n,
            `${id}: assigned to ${company(comp).name} / ${person(workerId).name}.`,
          );
        }, "Subcontract assignment created locally.")
      ) {
        dirty = false;
        modal.close();
        render();
      }
    }
    if (f.id === "claim-form") {
      const by = {};
      for (const m of members(w)) {
        by[m] = Number(value("claim-" + m));
        if (!Number.isFinite(by[m]) || by[m] < 0 || by[m] > 10000) {
          error("Enter valid nonnegative hours for each worker.", "claim-" + m);
          return;
        }
      }
      const total = Object.values(by).reduce((a, b) => a + b, 0),
        reason = value("claim-reason");
      if (Math.abs(total - recordedHours(w)) > 0.0001 && !reason) {
        error(
          "Explain why claimed hours differ from recorded attendance.",
          "claim-reason",
        );
        return;
      }
      if (
        save((n) => {
          const x = n.works.find((x) => x.id === id);
          x.claimedBy = by;
          x.claimedHours = total;
          x.contractorNote = reason;
          x.status = "contractor-review";
          log(n, `${id}: worker submitted ${h(total)} claimed h.`);
        }, "Worker hours submitted to subcontractor.")
      ) {
        dirty = false;
        modal.close();
        render();
      }
    }
    if (f.id === "npi-form") {
      const by = {};
      for (const m of members(w)) {
        by[m] = Number(value("accept-" + m));
        if (!Number.isFinite(by[m]) || by[m] < 0 || by[m] > 10000) {
          error("Enter valid hours for each worker.", "accept-" + m);
          return;
        }
      }
      const total = Object.values(by).reduce((a, b) => a + b, 0),
        reason = value("accept-reason");
      if (
        Object.keys(by).some(
          (m) =>
            Math.abs(by[m] - (w.claimedBy?.[m] ?? w.claimedHours)) > 0.0001,
        ) &&
        !reason
      ) {
        error("Explain each adjustment to claimed hours.", "accept-reason");
        return;
      }
      if (overlappingWorkers(w, state.works).length)
        throw Error(
          "Overlapping attendance must be resolved before NPI approval.",
        );
      const approved = approveHours(w, total, reason);
      if (
        save((n) => {
          n.works[n.works.findIndex((x) => x.id === id)] = {
            ...approved,
            acceptedBy: by,
          };
          log(
            n,
            `${id}: NPI accepted ${h(total)} h; contractor claimed ${h(w.claimedHours)} h. ${reason}`,
          );
        }, "NPI accepted hours saved. Original events remain unchanged.")
      ) {
        dirty = false;
        modal.close();
        render();
      }
    }
    if (f.id === "return-form") {
      const note = value("return-note");
      if (!note) {
        error("Enter a clear correction reason.", "return-note");
        return;
      }
      if (
        save((n) => {
          const x = n.works.find((x) => x.id === id);
          x.status = "returned";
          x.returnReason = note;
          log(n, `${id}: returned to worker: ${note}`);
        }, "Claim returned. Resubmission must pass both review stages again.")
      ) {
        dirty = false;
        modal.close();
        render();
      }
    }
    if (f.id === "document-form") {
      const side = f.dataset.side,
        existing = state.bills.find((b) => b.id === id),
        ids = [...f.querySelectorAll("input[name=work-lines]:checked")].map(
          (x) => x.value,
        ),
        ref = value("doc-reference");
      if (!ids.length || !ref) {
        error("Select work and enter a document reference.", "doc-reference");
        return;
      }
      const all = side === "customer" ? state.invoices : state.bills;
      if (
        all.some(
          (d) => d.id !== id && d.reference.toLowerCase() === ref.toLowerCase(),
        )
      ) {
        error("That document reference already exists.", "doc-reference");
        return;
      }
      const available = existing
        ? existing.workIds
        : eligible(
            state.works.filter(
              (w) => side === "customer" || w.company === "aurora",
            ),
            all,
          ).map((w) => w.id);
      if (ids.some((x) => !available.includes(x)))
        throw Error("Work has already been allocated or is not eligible");
      const lines = ids.map((id) => ({
          id,
          cents: charge(work(id), side),
          units: quantity(work(id), work(id).rates[side].basis),
          rate: structuredClone(work(id).rates[side]),
        })),
        expected = lines.reduce((a, l) => a + l.cents, 0),
        claimed =
          side === "customer"
            ? expected
            : Math.round(Number(value("doc-claimed")) * 100);
      if (!Number.isSafeInteger(claimed) || claimed < 0) {
        error("Enter a valid claimed amount.", "doc-claimed");
        return;
      }
      if (
        save(
          (n) => {
            const doc = {
              id:
                existing?.id ||
                (side === "customer" ? "INV-" : "BILL-") + Date.now(),
              reference: ref,
              company: existing?.company || "aurora",
              workIds: ids,
              lines,
              expected,
              claimed,
              status: side === "customer" ? "Draft" : "Submitted",
              paid: 0,
            };
            if (existing) n.bills[n.bills.findIndex((b) => b.id === id)] = doc;
            else (side === "customer" ? n.invoices : n.bills).push(doc);
            log(
              n,
              `${doc.id}: ${side === "customer" ? "customer invoice draft created" : "subcontractor bill submitted"}; ${money(claimed)}.`,
            );
          },
          side === "customer"
            ? "Customer invoice draft saved; nothing sent."
            : "Subcontractor bill submitted for NPI review.",
        )
      ) {
        dirty = false;
        modal.close();
        render();
      }
    }
    if (f.id === "bill-review-form") {
      const b = state.bills.find((b) => b.id === id),
        decision = e.submitter.value,
        note = value("bill-note");
      if (decision === "approve" && b.claimed !== b.expected)
        throw Error("Mismatched bills cannot be approved");
      if (decision === "dispute" && !note) {
        error(
          "Explain the discrepancy before disputing the bill.",
          "bill-note",
        );
        return;
      }
      if (
        save(
          (n) => {
            const x = n.bills.find((b) => b.id === id);
            x.status = decision === "approve" ? "Approved" : "Disputed";
            x.reviewNote = note;
            log(n, `${id}: NPI ${x.status.toLowerCase()}. ${note}`);
          },
          decision === "approve"
            ? "Bill approved; no payment made."
            : "Bill disputed; contractor can revise it.",
        )
      ) {
        dirty = false;
        modal.close();
        render();
      }
    }
    if (f.id === "payment-form") {
      const type = f.dataset.type,
        doc = (type === "invoice" ? state.invoices : state.bills).find(
          (x) => x.id === id,
        ),
        cents = Math.round(Number(value("payment-amount")) * 100),
        reference = value("payment-reference"),
        outstanding =
          (type === "invoice" ? doc.expected : doc.claimed) - (doc.paid || 0);
      if (
        !Number.isFinite(cents) ||
        cents <= 0 ||
        cents > outstanding ||
        !reference
      ) {
        error(
          "Enter a reference and an amount above zero, no greater than the outstanding balance.",
          "payment-amount",
        );
        return;
      }
      if (
        state.payments.some(
          (p) =>
            p.type === type &&
            p.doc === id &&
            p.reference.toLowerCase() === reference.toLowerCase(),
        )
      ) {
        error(
          "That payment reference is already recorded for this document.",
          "payment-reference",
        );
        return;
      }
      if (
        save((n) => {
          const d = (type === "invoice" ? n.invoices : n.bills).find(
            (d) => d.id === id,
          );
          d.paid = (d.paid || 0) + cents;
          n.payments.push({
            type,
            doc: id,
            cents,
            reference,
            at: new Date().toISOString(),
          });
          log(
            n,
            `${id}: recorded ${money(cents)} ${type === "invoice" ? "receipt" : "payment"}, reference ${reference}.`,
          );
        }, "Bookkeeping entry saved. No money was transferred.")
      ) {
        dirty = false;
        modal.close();
        render();
      }
    }
  } catch (err) {
    error(err.message || "Check the entered values and retry.");
  }
}
function normalize() {
  for (const w of state.works) {
    if (w.claimedHours !== undefined && !w.claimedBy) {
      w.claimedBy =
        w.id === "WO-202"
          ? { alex: 3, ben: 2, lee: 2 }
          : { [w.worker]: w.claimedHours };
    }
    if (w.acceptedHours !== undefined && !w.acceptedBy)
      w.acceptedBy = { [w.worker]: w.acceptedHours };
  }
}
function onClick(e) {
  const el = e.target.closest("[data-a]");
  if (el && !el.disabled) {
    e.preventDefault();
    actions[el.dataset.a]?.(el);
  }
  const link = e.target.closest('a[href^="#"]');
  if (link && link.hash !== "#main") {
    e.preventDefault();
    const next = link.hash.slice(1);
    if (allowed().includes(next)) {
      view = next;
      history.replaceState(null, "", "#" + next);
      render();
      window.scrollTo(0, 0);
      $("#page-title")?.focus();
    }
  }
}
app.addEventListener("click", onClick);
modal.addEventListener("click", onClick);
modal.addEventListener("submit", submit);
modal.addEventListener("input", (e) => {
  if (e.target.closest("form")) dirty = true;
});
modal.addEventListener("cancel", (e) => {
  e.preventDefault();
  actions.close();
});
modal.addEventListener("change", (e) => {
  if (e.target.id === "entry-mode")
    $("#roster").hidden = e.target.value !== "crew";
});
app.addEventListener("change", async (e) => {
  if (e.target.id === "hours-date") {
    dateFilter = e.target.value;
    render();
  }
  if (e.target.id === "hours-site") {
    siteFilter = e.target.value;
    render();
  }
  if (e.target.id === "worker-work") {
    chosen = e.target.value;
    render();
  }
  if (e.target.id === "preview-role") {
    role = e.target.value;
    view =
      role === "Worker"
        ? "worker"
        : role === "NPI supervisor"
          ? "approvals"
          : "overview";
    history.replaceState(null, "", "#" + view);
    render();
    window.scrollTo(0, 0);
  }
  if (e.target.matches("[data-task]")) {
    const w = work(chosen),
      i = Number(e.target.dataset.task);
    if (
      save((n) => {
        const x = n.works.find((x) => x.id === w.id);
        x.tasks = e.target.checked
          ? [...new Set([...x.tasks, i])]
          : x.tasks.filter((k) => k !== i);
      }, "Checklist saved locally.")
    )
      render();
  }
  if (e.target.matches("[data-site-photo]")) {
    const file = e.target.files[0];
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 600000
    ) {
      tell("Choose a JPG, PNG or WebP image up to 600 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => tell("Could not read the photo. Try another file.");
    reader.onload = () => {
      if (
        save((n) => {
          n.sites.find((s) => s.id === e.target.dataset.sitePhoto).photo =
            reader.result;
        }, "Actual site photo saved only on this device.")
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
    if (!modal.open) render();
    tell("Another tab changed this sample. Reload before saving.");
  }
});
window.addEventListener("hashchange", () => {
  const next = location.hash.slice(1);
  if (allowed().includes(next)) {
    view = next;
    render();
  }
});
setInterval(() => {
  const timer = $("#live-timer");
  if (timer) {
    const open = work(chosen).sessions.find((s) => !s.out);
    if (open) timer.textContent = running(open.in.time);
  }
}, 1000);
normalize();
const initial = location.hash.slice(1);
if (allowed().includes(initial)) view = initial;
render();
if (
  "serviceWorker" in navigator &&
  ["http:", "https:"].includes(location.protocol) &&
  location.pathname.startsWith("/operations/")
)
  navigator.serviceWorker
    .register("./sw.js", { scope: "./" })
    .catch(() =>
      tell("Offline install is unavailable here; the sample remains usable."),
    );
