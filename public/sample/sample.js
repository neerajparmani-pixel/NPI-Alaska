/* NPI clickable proposal. Every record and account action is local demonstration data. */
(() => {
  "use strict";
  const KEY = "npi-alaska-clickable-v1";
  const $ = (s, r = document) => r.querySelector(s);
  const app = $("#app"),
    modal = $("#modal");
  const icons = {
    board:
      '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    work: '<rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 5V3h6v2M9 10h6M9 14h6M9 18h4"/>',
    check: '<path d="m5 12 4 4L20 5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    users:
      '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 5a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-4-5"/>',
    settings:
      '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    camera:
      '<path d="M4 6h4l2-3h4l2 3h4v14H4Z"/><circle cx="12" cy="12" r="4"/>',
    file: '<path d="M14 3H5v18h14V8Z M14 3v6h5M8 13h8M8 17h6"/>',
    sync: '<path d="M20 7a9 9 0 0 0-15-2L2 8m0-5v5h5M4 17a9 9 0 0 0 15 2l3-3m0 5v-5h-5"/>',
    logout: '<path d="M10 3H4v18h6M9 12h12m-5-5 5 5-5 5"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    shield:
      '<path d="m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6Z"/><path d="m8 12 3 3 5-6"/>',
  };
  const icon = (n) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[n] || icons.work}</svg>`;
  const esc = (v) =>
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
  const button = (label, action, cls = "", extra = "") =>
    `<button type="button" class="btn ${cls}" data-action="${action}" ${extra}>${label}</button>`;
  const status = (s) =>
    `<span class="badge ${{ Assigned: "", "In progress": "blue", "Awaiting review": "orange", Approved: "green", "Needs correction": "red" }[s] || ""}"><span class="dot"></span>${esc(s)}</span>`;
  const brand = () =>
    '<div class="brand"><span class="brandmark">NPI</span><div><div class="brandname">NPI ALASKA</div><small>FIELD OPERATIONS</small></div></div>';
  const seed = () => ({
    version: 1,
    revision: 0,
    workspace: "NPI Alaska",
    contact: "Operations office",
    sites: [
      {
        id: "boney",
        name: "Boney Courthouse",
        town: "Anchorage",
        service: "Snow removal",
        category: "Courthouse",
        tasks: [
          "Clear assigned walkways",
          "Clear entry steps and ramps",
          "Apply ice melt",
          "Check entrances are safe",
        ],
      },
      {
        id: "youth",
        name: "Anchorage Youth Court",
        town: "Anchorage",
        service: "Snow removal",
        category: "Courthouse",
        tasks: [
          "Clear access route",
          "Clear building entrance",
          "Apply ice melt",
          "Complete safety check",
        ],
      },
      {
        id: "snowden",
        name: "Snowden Courthouse",
        town: "Anchorage",
        service: "Snow removal",
        category: "Courthouse",
        tasks: [
          "Clear assigned sidewalks",
          "Clear entrances and ramps",
          "Apply ice melt",
          "Complete safety check",
        ],
      },
      {
        id: "nesbit",
        name: "Nesbit Courthouse",
        town: "Anchorage",
        service: "Snow removal",
        category: "Courthouse",
        tasks: [
          "Clear assigned sidewalks",
          "Clear entrances and ramps",
          "Apply ice melt",
          "Complete safety check",
        ],
      },
      {
        id: "dowd",
        name: "David Dowd",
        town: "Location to confirm",
        service: "Site work",
        category: "Other",
        tasks: [
          "Complete assigned site work",
          "Check work area",
          "Record completion photo",
        ],
      },
      {
        id: "tote",
        name: "Tote Port",
        town: "Location to confirm",
        service: "Hauling",
        category: "Port",
        tasks: [
          "Complete assigned hauling",
          "Record load count",
          "Attach signed timecard",
          "Complete safety check",
        ],
      },
    ],
    people: [
      {
        id: "alex",
        name: "Alex Morgan",
        username: "alex.m",
        role: "Worker",
        site: "boney",
        active: true,
      },
      {
        id: "ben",
        name: "Ben Taylor",
        username: "ben.t",
        role: "Worker",
        site: "youth",
        active: true,
      },
      {
        id: "nora",
        name: "Nora Reed",
        username: "nora.r",
        role: "Worker",
        site: "nesbit",
        active: true,
      },
      {
        id: "sam",
        name: "Sam Parker",
        username: "sam.p",
        role: "Supervisor",
        site: "all",
        active: true,
      },
      {
        id: "office",
        name: "Office preview",
        username: "office.preview",
        role: "Management",
        site: "all",
        active: true,
      },
    ],
    jobs: [
      {
        id: "AK-1042",
        site: "boney",
        worker: "alex",
        title: "Morning walkway clearance",
        status: "Assigned",
        date: "2026-11-13",
        shift: "6:00 AM – 9:00 AM",
        checks: [],
        notes: "",
        photo: false,
        timecard: false,
        loads: 0,
        version: 1,
        started: null,
        ended: null,
      },
      {
        id: "AK-1041",
        site: "youth",
        worker: "ben",
        title: "Entrance and access route",
        status: "Awaiting review",
        date: "2026-11-13",
        shift: "5:30 AM – 7:30 AM",
        checks: [0, 1, 2, 3],
        notes: "Entrances cleared and ice melt applied. Sample record.",
        photo: true,
        timecard: false,
        loads: 0,
        version: 1,
        started: "2026-11-13T14:30:00Z",
        ended: "2026-11-13T16:30:00Z",
      },
      {
        id: "AK-1040",
        site: "nesbit",
        worker: "nora",
        title: "Morning snow service",
        status: "In progress",
        date: "2026-11-13",
        shift: "6:00 AM – 10:00 AM",
        checks: [0, 1],
        notes: "",
        photo: false,
        timecard: false,
        loads: 0,
        version: 1,
        started: "2026-11-13T15:00:00Z",
        ended: null,
      },
      {
        id: "AK-1039",
        site: "snowden",
        worker: "alex",
        title: "Evening site safety check",
        status: "Approved",
        date: "2026-11-12",
        shift: "4:00 PM – 6:00 PM",
        checks: [0, 1, 2, 3],
        notes: "Sample approved work record.",
        photo: true,
        timecard: false,
        loads: 0,
        version: 1,
        started: "2026-11-13T01:00:00Z",
        ended: "2026-11-13T03:00:00Z",
      },
    ],
    activity: [
      {
        text: "Ben Taylor submitted AK-1041 for review.",
        at: "2026-11-13T16:30:00Z",
      },
      {
        text: "Nora Reed started AK-1040 at Nesbit Courthouse.",
        at: "2026-11-13T15:00:00Z",
      },
      { text: "Sam Parker approved AK-1039.", at: "2026-11-13T03:15:00Z" },
    ],
    sheetChanges: [],
    sync: [],
  });
  let state,
    storageError = "",
    conflict = false,
    role = "Management",
    view = "overview",
    settingsTab = "people",
    filter = "All",
    query = "",
    selected = "AK-1042",
    dirty = false,
    dialogDirty = false,
    returnFocus = null,
    pending = null,
    toastTimer,
    installPrompt;
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? JSON.parse(raw) : seed();
    if (
      state.version !== 1 ||
      !Array.isArray(state.jobs) ||
      !Array.isArray(state.sites) ||
      !Array.isArray(state.people)
    )
      throw Error("Invalid sample");
  } catch {
    state = seed();
    storageError =
      "Saved sample data could not be opened. This session is read-only. Use a regular browser window or reset sample data in Settings.";
  }
  const site = (id) =>
    state.sites.find((s) => s.id === id) || {
      name: "Unknown site",
      tasks: [],
      town: "",
    };
  const person = (id) =>
    state.people.find((p) => p.id === id) || {
      name: "Unassigned",
      username: "",
    };
  const job = () =>
    state.jobs.find((j) => j.id === selected) ||
    state.jobs.find((j) => j.worker === "alex");
  const allowed = () =>
    role === "Worker"
      ? ["worker", "history"]
      : role === "Supervisor"
        ? ["overview", "assignments", "reviews", "sites"]
        : [
            "overview",
            "assignments",
            "reviews",
            "sites",
            "reports",
            "settings",
          ];
  const navs = {
    overview: ["board", "Overview"],
    worker: ["work", "My work"],
    history: ["clock", "My history"],
    assignments: ["work", "Assignments"],
    reviews: ["check", "Reviews"],
    sites: ["pin", "Locations"],
    reports: ["sync", "Spreadsheet"],
    settings: ["settings", "Settings"],
  };
  const now = () => new Date().toISOString();
  const when = (at) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Anchorage",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(at)) + " AK";
  const dateLabel = (d) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(d + "T12:00:00Z"));
  const hours = (j) =>
    j.started && j.ended
      ? ((new Date(j.ended) - new Date(j.started)) / 3600000).toFixed(1)
      : "—";
  function notify(text) {
    clearTimeout(toastTimer);
    $("#toast").textContent = text;
    toastTimer = setTimeout(() => ($("#toast").textContent = ""), 6500);
  }
  function commit(mutate, message) {
    if (conflict) {
      notify("Another sample tab changed these records. Reload before saving.");
      return false;
    }
    const next = structuredClone(state);
    try {
      const disk = localStorage.getItem(KEY);
      if (disk && JSON.parse(disk).revision !== state.revision) {
        conflict = true;
        render();
        notify("Sample conflict: reload to use the latest saved version.");
        return false;
      }
      mutate(next);
      next.revision = state.revision + 1;
      localStorage.setItem(KEY, JSON.stringify(next));
      state = next;
      storageError = "";
      if (message) notify(message);
      return true;
    } catch {
      notify(
        "Could not save on this device. Your changes are still on screen. Free browser storage and retry.",
      );
      return false;
    }
  }
  function record(next, text) {
    next.activity.unshift({ text, at: now() });
    next.activity = next.activity.slice(0, 60);
  }
  function queue(next, id) {
    const j = next.jobs.find((j) => j.id === id);
    next.sync = next.sync.filter((s) => s.id !== id);
    next.sync.unshift({
      id,
      version: j.version,
      status: "Waiting for demo sync",
      at: now(),
    });
  }
  function updateJob(id, fn, msg) {
    return commit((next) => {
      const j = next.jobs.find((j) => j.id === id);
      fn(j);
      j.version++;
      queue(next, id);
    }, msg);
  }
  function getDraft() {
    const notes = $("#work-notes"),
      loads = $("#work-loads");
    return {
      notes: notes?.value ?? job()?.notes ?? "",
      loads: Number(loads?.value ?? job()?.loads ?? 0),
    };
  }
  function showDialog(title, html) {
    returnFocus = document.activeElement;
    modal.innerHTML = `<div class="dialog-head"><h2 id="dialog-title">${esc(title)}</h2>${button(icon("close"), "close", "quiet", 'aria-label="Close dialog"')}</div><div class="dialog-body">${html}</div>`;
    dialogDirty = false;
    modal.showModal();
  }
  function closeDialog(force = false) {
    if (dialogDirty && !force) {
      const content = modal.innerHTML;
      const values = Array.from(
        modal.querySelectorAll("input,select,textarea"),
      ).map((e) => [e.id, e.value]);
      const title = $("#dialog-title").textContent;
      modal.close();
      showDialog(
        "Discard unsaved changes?",
        `<p>Your sample changes have not been saved.</p><div class="dialog-actions">${button("Keep editing", "keep-dialog", "primary")}${button("Discard changes", "discard-dialog", "danger")}</div>`,
      );
      pending = { type: "dialog", content, values, title };
      return;
    }
    modal.close();
    dialogDirty = false;
    returnFocus?.focus?.();
  }
  function guard(fn) {
    if (!dirty) {
      fn();
      return;
    }
    showDialog(
      "Save your work first?",
      `<p>Your notes have not been saved on this device. Keep editing or discard these notes before leaving.</p><div class="dialog-actions">${button("Keep editing", "close", "primary")}${button("Discard notes", "discard-nav", "danger")}</div>`,
    );
    pending = { type: "nav", fn };
  }
  function go(next) {
    guard(() => {
      if (!allowed().includes(next)) next = allowed()[0];
      view = next;
      filter = "All";
      query = "";
      history.replaceState(null, "", `#${next}`);
      render();
      window.scrollTo(0, 0);
      $("#page-title")?.focus();
    });
  }
  function setRole(next) {
    guard(() => {
      role = next;
      view = next === "Worker" ? "worker" : "overview";
      selected = "AK-1042";
      filter = "All";
      query = "";
      history.replaceState(null, "", `#${view}`);
      render();
      window.scrollTo(0, 0);
    });
  }
  function field(
    id,
    label,
    type = "text",
    value = "",
    options = [],
    help = "",
  ) {
    const el =
      type === "select"
        ? `<select id="${id}" name="${id}">${options.map(([v, l]) => `<option value="${esc(v)}" ${String(value) === String(v) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`
        : type === "textarea"
          ? `<textarea id="${id}" name="${id}" style="resize:none" maxlength="1000">${esc(value)}</textarea>`
          : `<input id="${id}" name="${id}" type="${type}" value="${esc(value)}" ${type === "number" ? 'min="0" max="9999" step="1"' : ""} ${type === "date" ? "" : 'maxlength="100"'}>`;
    return `<div class="field"><label for="${id}">${esc(label)}</label>${el}${help ? `<small id="${id}-help">${esc(help)}</small>` : ""}<small class="error-text" id="${id}-error"></small></div>`;
  }
  function validate(errors, form = modal) {
    form
      .querySelectorAll("[aria-invalid]")
      .forEach((e) => e.removeAttribute("aria-invalid"));
    form.querySelectorAll(".error-text").forEach((e) => (e.textContent = ""));
    for (const [id, msg] of Object.entries(errors)) {
      const el = $("#" + id, form);
      el?.setAttribute("aria-invalid", "true");
      el?.setAttribute("aria-describedby", id + "-error");
      const out = $("#" + id + "-error", form);
      if (out) out.textContent = msg;
    }
    const first = Object.keys(errors)[0];
    if (first) $("#" + first, form)?.focus();
    return !first;
  }
  function header(title, desc, action = "") {
    return `<header class="pagehead"><div><p class="eyebrow">ALASKA OPERATIONS / SAMPLE WORKSPACE</p><h1 id="page-title" tabindex="-1">${title}</h1><p>${desc}</p></div>${action}</header>`;
  }
  function shell() {
    const reviewCount = state.jobs.filter(
      (j) => j.status === "Awaiting review",
    ).length;
    return `<aside class="sidebar">${brand()}<p class="navlabel eyebrow">Workspace</p><nav class="navlinks" aria-label="Main navigation">${allowed()
      .map(
        (k) =>
          `<a class="navlink" href="#${k}" ${view === k ? 'aria-current="page"' : ""}>${icon(navs[k][0])}${navs[k][1]}${k === "reviews" && reviewCount ? `<span class="navcount">${reviewCount}</span>` : ""}</a>`,
      )
      .join(
        "",
      )}</nav><div class="sidebar-foot"><div class="row gap8 small">${icon("shield")}<b>Built for the field.</b></div><p class="mt12">${esc(state.workspace)}<br>Alaska work times · AKST / AKDT</p>${button(icon("logout") + " Preview sign-in", "login", "quiet")}</div></aside><div class="shell"><div class="topbar"><div class="crumb">NPI Alaska <span aria-hidden="true"> / </span> <strong>${navs[view]?.[1] || "Workspace"}</strong></div><div class="top-actions"><label class="small muted" for="role-switch">Preview</label><select id="role-switch" class="role-switch" aria-label="Preview role"><option ${role === "Worker" ? "selected" : ""}>Worker</option><option ${role === "Supervisor" ? "selected" : ""}>Supervisor</option><option ${role === "Management" ? "selected" : ""}>Management</option></select><div class="profile"><span class="avatar gold">${role === "Worker" ? "AM" : role === "Supervisor" ? "SP" : "NP"}</span><div class="profile-text"><b>${role === "Worker" ? "Alex Morgan" : role === "Supervisor" ? "Sam Parker" : "Office preview"}</b><small>${role}</small></div></div></div></div><div class="previewbar"><span><b>CLICKABLE SAMPLE</b> · Demo data saved on this device. Accounts and sync are simulated.</span>${button("How to try it", "help", "quiet")}</div>${!navigator.onLine ? '<div class="notice warning" role="status">Offline. This sample works on this device; no records are being sent to Supabase or Sheets.</div>' : ""}${conflict ? `<div class="notice error" role="alert">Another tab changed the sample. Reload before saving. ${button("Reload sample", "reload", "danger")}</div>` : ""}${storageError ? `<div class="notice error" role="alert">${esc(storageError)}</div>` : ""}<main id="main" class="main">${content()}<footer class="footer"><span>NPI · Performance. Power. Precision.</span><span>Sample shift: Nov 13, 2026 · Photos marked illustrative · No live backend</span></footer></main></div><nav class="bottomnav" aria-label="Mobile navigation">${allowed()
      .filter((k) =>
        role === "Management"
          ? ["overview", "assignments", "reports", "settings"].includes(k)
          : true,
      )
      .map(
        (k) =>
          `<a href="#${k}" ${view === k ? 'aria-current="page"' : ""}>${icon(navs[k][0])}<span>${navs[k][1]}</span></a>`,
      )
      .join("")}</nav>`;
  }
  function content() {
    return (
      {
        overview,
        assignments,
        reviews,
        sites,
        reports,
        settings,
        worker,
        history: workerHistory,
      }[view]?.() || overview()
    );
  }
  function overview() {
    const count = (s) => state.jobs.filter((j) => j.status === s).length;
    return (
      header(
        "Operations overview",
        "A clear picture of the day, from the field to the office.",
        button(icon("plus") + " Assign work", "new-job", "primary"),
      ) +
      `<section class="landscape" aria-label="Alaska operations"><div><p class="eyebrow">NPI FIELD OPERATIONS</p><h2>Ready for an Alaska workday.</h2><p>See what is underway, review completed work, and keep your crews moving.</p><div class="row mt12 gap8"><span class="badge">${state.sites.length} locations</span><span class="badge">${state.people.filter((p) => p.active && p.role === "Worker").length} sample workers</span></div></div><span class="photo-note">Illustrative Alaska landscape<br>Not a site photograph</span></section><section class="metrics" aria-label="Work summary">${[
        ["Total assignments", state.jobs.length, "All sample records", "work"],
        ["In progress", count("In progress"), "Work underway", "clock"],
        [
          "Awaiting review",
          count("Awaiting review"),
          "Ready for supervisor",
          "file",
        ],
        ["Approved", count("Approved"), "Reviewed and accepted", "check"],
      ]
        .map(
          ([l, n, d, i]) =>
            `<div class="metric"><div><label>${l}</label><strong>${n}</strong><small>${d}</small></div><span class="metric-icon">${icon(i)}</span></div>`,
        )
        .join(
          "",
        )}</section><div class="twocol"><section class="stack"><div><div class="panel-title"><h2>At your locations</h2><a href="#sites" class="small bold">All locations ${icon("arrow")}</a></div><div class="site-strip">${state.sites.slice(0, 3).map(siteCard).join("")}</div></div><section class="panel"><div class="panel-title"><h2>Work board</h2><a href="#assignments" class="small bold">All work</a></div>${workTable(state.jobs.slice(0, 4))}</section></section><aside class="stack"><section class="panel"><div class="panel-title"><h2>Needs your attention</h2><span class="badge orange">${count("Awaiting review")}</span></div><p class="muted small">Submitted work is waiting for a supervisor to check the evidence.</p>${button("Open review queue " + icon("arrow"), "open-reviews", "wide navy mt12")}<div class="rule"></div><div class="row gap8">${icon("sync")}<b class="small">Office & field, connected</b></div><p class="muted small mt12">Managers can use the app or Google Sheets. The sample shows how changes are checked in both directions.</p>${role === "Management" ? '<a href="#reports" class="small bold">Preview spreadsheet workflow →</a>' : ""}</section><section class="panel"><div class="panel-title"><h2>Recent activity</h2><span class="small muted">Alaska time</span></div>${activityList()}</section></aside></div>`
    );
  }
  function siteCard(s, i = 0) {
    const active = state.jobs.filter(
      (j) => j.site === s.id && !["Approved"].includes(j.status),
    ).length;
    return `<article class="sitecard"><div class="sitephoto p${(i % 3) + 1}" role="img" aria-label="Illustrative Alaska landscape, not ${esc(s.name)}"><span class="badge">${esc(s.category)}</span></div><div class="sitebody"><h3>${esc(s.name)}</h3><p>${esc(s.town)} · ${esc(s.service)}</p><div class="row between"><small>${active} open assignment${active === 1 ? "" : "s"}</small>${button("View site", "site-detail", "", 'data-id="' + esc(s.id) + '"')}</div><p style="font-size:9px;margin-bottom:0">Illustration · actual site photo pending</p></div></article>`;
  }
  function activityList() {
    return `<ol class="activity">${state.activity
      .slice(0, 5)
      .map(
        (a) =>
          `<li><span class="timeline-dot" aria-hidden="true"></span><div><p>${esc(a.text)}</p><small>${when(a.at)}</small></div></li>`,
      )
      .join("")}</ol>`;
  }
  function workTable(jobs) {
    if (!jobs.length)
      return `<div class="empty"><h3>No matching work</h3><p>Choose another status or clear the search to see your sample assignments.</p>${button("Clear filters", "clear-filters")}</div>`;
    return `<div class="table-wrap"><table><caption class="sr-label">${jobs.length} sample assignment${jobs.length === 1 ? "" : "s"}</caption><thead><tr><th scope="col">Assignment / site</th><th scope="col" class="hide-mobile">Crew member</th><th scope="col">Status</th><th scope="col"><span class="muted">Action</span></th></tr></thead><tbody>${jobs
      .map(
        (j) =>
          `<tr><td class="jobcell"><strong>${esc(site(j.site).name)}</strong><small>${esc(j.id)} · ${esc(j.title)}</small></td><td class="hide-mobile"><div class="row gap8"><span class="avatar">${esc(
            person(j.worker)
              .name.split(" ")
              .map((x) => x[0])
              .slice(0, 2)
              .join(""),
          )}</span><span>${esc(person(j.worker).name)}</span></div></td><td>${status(j.status)}</td><td>${button("Open", "job-detail", "", 'data-id="' + esc(j.id) + '" aria-label="Open ' + esc(j.id) + '"')}</td></tr>`,
      )
      .join("")}</tbody></table></div>`;
  }
  function assignments() {
    const jobs = state.jobs.filter(
      (j) =>
        (filter === "All" || j.status === filter) &&
        [j.title, j.id, site(j.site).name, person(j.worker).name]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
    return (
      header(
        "Assignments",
        "Set the work. Give every crew member a clear next step.",
        button(icon("plus") + " Assign work", "new-job", "primary"),
      ) +
      `<section class="panel"><div class="toolbar"><div class="chips" aria-label="Filter assignments">${["All", "Assigned", "In progress", "Awaiting review", "Approved", "Needs correction"].map((s) => `<button type="button" class="chip" data-action="filter" data-value="${s}" aria-pressed="${filter === s}">${s}</button>`).join("")}</div></div><div class="toolbar"><p class="small muted">${jobs.length} of ${state.jobs.length} assignments</p><div class="search"><input id="search" aria-label="Search assignments" placeholder="Search work, site, or person" value="${esc(query)}">${query ? button(icon("close"), "clear-search", "quiet", 'aria-label="Clear search"') : ""}</div></div><div id="work-results">${workTable(jobs)}</div></section>`
    );
  }
  function worker() {
    let j = job();
    if (!j || j.worker !== "alex")
      j = state.jobs.find((x) => x.worker === "alex");
    if (!j)
      return (
        header("My work", "Your supervisor will assign your next job.") +
        '<div class="panel empty"><h2>No work assigned</h2><p>There are no sample assignments for Alex.</p></div>'
      );
    selected = j.id;
    const s = site(j.site),
      editable = ["In progress", "Needs correction"].includes(j.status),
      finished = ["Awaiting review", "Approved"].includes(j.status),
      tasks = s.tasks;
    return (
      header(
        "My work",
        "Alex Morgan · one step at a time.",
        `<span class="badge blue">${j.id}</span>`,
      ) +
      `<div class="worker-grid"><article class="job-main"><div class="jobhero"><span class="badge">${esc(s.service)}</span><div><h2>${esc(s.name)}</h2><p class="small">${esc(s.town)} · Illustrative image</p></div></div><div class="job-inner"><div class="row between wrap"><h3>${esc(j.title)}</h3>${status(j.status)}</div><div class="job-meta mt12"><span>${icon("clock")} Sample shift<b>${esc(j.shift)}</b></span><span>${icon("pin")} Work date<b>${dateLabel(j.date)}</b></span></div>${j.correction ? `<div class="notice warning"><b>Supervisor requested a correction</b><p>${esc(j.correction)}</p></div>` : ""}${j.status === "Assigned" ? `<div class="notice">Check your site and assignment, then start when you are ready. The clock records your actual start time.</div>${button(icon("clock") + " Start work", "start", "wide primary mt")}` : ""}<div class="row between mt"><h3>Your checklist</h3><span class="small muted">${j.checks.length} / ${tasks.length}</span></div><div class="progress mt12" role="progressbar" aria-label="Completed tasks" aria-valuenow="${j.checks.length}" aria-valuemax="${tasks.length}"><span style="width:${(j.checks.length / tasks.length) * 100}%"></span></div>${tasks.map((t, i) => `<label class="task"><input type="checkbox" data-task="${i}" ${j.checks.includes(i) ? "checked" : ""} ${editable ? "" : "disabled"}><span>${esc(t)}</span></label>`).join("")}<div class="mt"><h3>Work evidence</h3><p class="small muted mt12">Sample rule: complete the checklist and add a completion photo.${s.id === "tote" ? " Hauling also needs a load count and timecard." : ""}</p><div class="evidence"><div class="evidence-card">${icon("camera")}<b>Completion photo</b>${j.photo ? `<span class="badge green">${icon("check")} Sample photo added</span>` : button("Add sample photo", "photo", "", "" + (editable ? "" : "disabled"))}</div><div class="evidence-card">${icon("file")}<b>${s.id === "tote" ? "Signed timecard" : "Supervisor review"}</b>${s.id === "tote" ? (j.timecard ? '<span class="badge green">Sample timecard added</span>' : button("Add sample timecard", "timecard", "", editable ? "" : "disabled")) : '<span class="small muted">Your supervisor checks your work after submission.</span>'}</div></div>${editable ? `${s.id === "tote" ? field("work-loads", "Loads completed", "number", j.loads) : ""}${field("work-notes", "Anything to tell your supervisor?", "textarea", j.notes, [], "Use sample notes only. Do not enter private company data.")}<p class="small muted" id="draft-state">${dirty ? "Unsaved notes" : "Checklist saved on this device"}</p><div class="row mt12">${button("Save draft", "save-draft", "grow")}${button("Finish & submit " + icon("arrow"), "finish", "primary grow")}</div><div id="work-error" class="mt12" role="alert"></div>` : finished ? `<div class="notice ${j.status === "Approved" ? "" : "warning"}"><b>${j.status === "Approved" ? "Work approved. Thank you." : "Your work is awaiting review."}</b><p class="small">${j.status === "Approved" ? "Your supervisor accepted this sample record." : "You can track the outcome in My history."}</p></div>` : '<p class="small muted">Start work to unlock your checklist and evidence.</p>'}</div></div></article><aside class="stack" style="align-content:start"><section class="panel"><h2>Your next steps</h2>${[
        ["Start work", "Record when your work begins."],
        ["Complete & record", "Follow the checklist. Add your evidence."],
        ["Send for review", "Your supervisor checks and approves."],
      ]
        .map(
          ([t, d], i) =>
            `<div class="step ${(j.status === "Assigned" ? 0 : editable ? 1 : 2) === i ? "active" : ""}"><span class="stepnum">${i + 1}</span><div><p>${t}</p><small>${d}</small></div></div>`,
        )
        .join(
          "",
        )}</section><section class="panel"><h3>Need a hand?</h3><p class="small muted mt12">For a site issue, speak to your supervisor. For a login issue, contact the office.</p><div class="rule"></div><div class="row gap8"><span class="avatar">SP</span><div><b class="small">Sam Parker</b><p class="small muted">Sample supervisor</p></div></div></section><div class="notice">This preview uses sample evidence. It does not upload photos, track your location, or send work to a server.</div></aside></div>`
    );
  }
  function workerHistory() {
    const jobs = state.jobs.filter((j) => j.worker === "alex");
    return (
      header("My history", "See where your work stands.") +
      `<section class="panel">${workTable(jobs)}</section>`
    );
  }
  function reviews() {
    const jobs = state.jobs.filter((j) => j.status === "Awaiting review");
    return (
      header(
        "Review completed work",
        "Check the details. Approve the work or request a clear correction.",
        `<span class="badge orange">${jobs.length} awaiting review</span>`,
      ) +
      `<section class="panel">${jobs.length ? workTable(jobs) : `<div class="empty">${icon("check")}<h2 class="mt12">You’re up to date.</h2><p>No sample work is awaiting review. Switch to Worker to complete and submit an assignment.</p>${button("Try the worker view", "preview-worker", "primary")}</div>`}</section>`
    );
  }
  function sites() {
    return (
      header(
        "Know the place. Know the work.",
        "Confirmed site names from Chris’s photos. Sample task lists need NPI approval.",
        role === "Management"
          ? button(icon("plus") + " Add location", "new-site", "primary")
          : "",
      ) +
      `<div class="notice mt12">The four courthouse names are confirmed by you. Actual photo files are not available in this workspace; the landscape shown is illustrative. Locations and photo matching must be verified before field use.</div><section class="site-strip mt">${state.sites.map(siteCard).join("")}</section>`
    );
  }
  function settings() {
    return (
      header(
        "Settings",
        "Manage the people, locations, and office tools behind the work.",
      ) +
      `<div class="settings-tabs" aria-label="Settings sections">${[
        ["people", "People & access"],
        ["workspace", "Workspace"],
        ["connections", "Connections"],
        ["sample", "Sample controls"],
      ]
        .map(
          ([k, l]) =>
            `<button type="button" class="chip" data-action="settings-tab" data-value="${k}" aria-pressed="${settingsTab === k}">${l}</button>`,
        )
        .join(
          "",
        )}</div>${{ people: peopleSettings, workspace: workspaceSettings, connections: connectionSettings, sample: sampleSettings }[settingsTab]()}`
    );
  }
  function peopleSettings() {
    return `<section class="panel"><div class="panel-title"><div><h2>People & access</h2><p class="small muted mt12">Company-issued usernames. Roles and location scope in one place.</p></div>${button(icon("plus") + " Add person", "new-person", "primary")}</div><div class="notice">Account setup preview. Adding or editing a person here updates this sample only. Supabase Auth will handle real passwords; no passwords belong in a spreadsheet.</div><div class="table-wrap mt"><table><caption>${state.people.length} sample profiles · no live login accounts</caption><thead><tr><th scope="col">Name / username</th><th scope="col">Role</th><th scope="col" class="hide-mobile">Location scope</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead><tbody>${state.people.map((p) => `<tr><td class="jobcell"><strong>${esc(p.name)}</strong><small>${esc(p.username)}</small></td><td>${esc(p.role)}</td><td class="hide-mobile">${p.site === "all" ? "All locations" : esc(site(p.site).name)}</td><td><span class="badge ${p.active ? "green" : ""}">${p.active ? "Active profile" : "Inactive"}</span></td><td>${button("Edit", "edit-person", "", 'data-id="' + p.id + '" aria-label="Edit ' + esc(p.name) + '"')}</td></tr>`).join("")}</tbody></table></div></section><section class="panel mt"><h2>Simple roles. Clear responsibility.</h2><div class="metrics" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr));margin-bottom:0">${[
      ["Worker", "Own assigned work and history."],
      ["Supervisor", "Assign work and review within approved sites."],
      ["Management", "Reports, people, settings, and spreadsheet workflow."],
    ]
      .map(
        ([t, d]) =>
          `<div><h3>${t}</h3><p class="small muted mt12">${d}</p></div>`,
      )
      .join("")}</div></section>`;
  }
  function workspaceSettings() {
    return `<section class="panel" style="max-width:760px"><h2>Workspace details</h2><p class="small muted mt12">These values are saved only on this device.</p><form id="workspace-form" novalidate class="mt">${field("workspace-name", "Company / workspace name", "text", state.workspace)}${field("workspace-contact", "Office contact label", "text", state.contact)}<div class="summary-line"><span>Work timezone</span><b>Alaska · America/Anchorage</b></div><div class="summary-line"><span>App language</span><b>English</b></div><div class="summary-line"><span>Finance</span><b>Planned for a later phase</b></div><button type="submit" class="btn primary mt">Save workspace</button></form></section>`;
  }
  function connectionSettings() {
    return `<div class="stack"><section class="panel"><div class="panel-title"><h2>App & spreadsheet, working together</h2><span class="badge orange">Design preview</span></div><p class="muted small">Both are workspaces. Supabase holds the authoritative records; a secure bridge validates changes in either direction.</p><div class="flow"><div class="flowbox"><h3>NPI PWA</h3><p>Field work, photos, reviews</p></div><span>${icon("sync")}</span><div class="flowbox"><h3>Supabase</h3><p>Identity, records, private files</p></div><span>${icon("sync")}</span><div class="flowbox"><h3>Google Sheets</h3><p>Management reports & controlled edits</p></div></div><div class="notice">Two-way sync will use record IDs, versions, field permissions, retries, and a conflict queue. Spreadsheet edits cannot grant roles, reset passwords, or bypass approval rules.</div><div class="setting-row"><div class="connection"><span class="connection-mark">ϟ</span><div><h3>Supabase</h3><p>Accounts · database · private photo storage</p></div></div><span class="badge">Not connected</span></div><div class="setting-row"><div class="connection"><span class="connection-mark sheets">▤</span><div><h3>Google Sheets</h3><p>Private management workbook · two-way bridge</p></div></div><span class="badge">Not connected</span></div><div class="setting-row"><div><h3>Cloudflare</h3><p>Host the installable PWA and server-side endpoints.</p></div><span class="badge">Preview only</span></div>${button("Try two-way sync preview " + icon("arrow"), "open-reports", "primary mt")}</section><section class="panel"><h2>What the office can edit in Sheets</h2><p class="muted small mt12">Proposed initial scope: assignment title, planned date, and authorized worker/site references. Completed work and evidence stay protected. Approvals require authorized reviewers and server-side checks. Exact fields and management roles will be confirmed before connection.</p></section></div>`;
  }
  function sampleSettings() {
    return `<section class="panel"><h2>Review the sample</h2><div class="setting-row"><div><h3>Install on your device</h3><p>Available when served over HTTPS in a supported browser. A downloaded HTML file is a clickable preview.</p></div>${button("Install instructions", "install")}</div><div class="setting-row"><div><h3>Start with fresh sample records</h3><p>Removes this sample’s local changes. Existing NPI app and spreadsheet records are untouched.</p></div>${button("Reset sample data", "reset", "danger")}</div><div class="setting-row"><div><h3>What is connected?</h3><p>Nothing external. This preview creates no accounts and sends no work records or credentials.</p></div><span class="badge orange">Demo only</span></div></section>`;
  }
  function reports() {
    const pendingCount = state.sync.filter(
      (x) => x.status === "Waiting for demo sync",
    ).length;
    return (
      header(
        "The office can stay in Sheets.",
        "Preview changes flowing between the app and your management workbook.",
        button(icon("sync") + " Run demo sync", "sync-demo", "primary"),
      ) +
      `<div class="notice">SIMULATED TWO-WAY SYNC · These tables preview the workbook, not a live Google spreadsheet. No Google or Supabase connection is configured.</div><div class="metrics">${[
        ["App changes waiting", pendingCount, "Pending demo export", "work"],
        [
          "Sheet changes waiting",
          state.sheetChanges.filter((x) => x.status === "Pending").length,
          "Pending validation",
          "file",
        ],
        [
          "Conflicts",
          state.sheetChanges.filter((x) => x.status === "Conflict").length,
          "Require a decision",
          "shield",
        ],
        ["Destinations", "2", "App + management Sheets", "sync"],
      ]
        .map(
          ([l, n, d, i]) =>
            `<div class="metric"><div><label>${l}</label><strong>${n}</strong><small>${d}</small></div><span class="metric-icon">${icon(i)}</span></div>`,
        )
        .join(
          "",
        )}</div><section class="panel"><div class="panel-title"><div><h2>Management workbook preview</h2><p class="small muted mt12">Assignments · Work logs · Evidence · Approvals · Changes · Sync log</p></div>${button(icon("download") + " Export CSV", "export")}</div><div class="table-wrap"><table><caption>Proposed Assignments sheet · edits use stable record IDs and versions</caption><thead><tr><th scope="col">Record ID</th><th scope="col">Assignment title</th><th scope="col" class="hide-mobile">Location</th><th scope="col">Version</th><th scope="col">Action</th></tr></thead><tbody>${state.jobs.map((j) => `<tr><td>${esc(j.id)}</td><td>${esc(j.title)}</td><td class="hide-mobile">${esc(site(j.site).name)}</td><td>v${j.version}</td><td>${button("Simulate sheet edit", "sheet-edit", "", 'data-id="' + j.id + '"')}</td></tr>`).join("")}</tbody></table></div></section><section class="panel mt"><div class="panel-title"><h2>Incoming spreadsheet changes</h2><span class="badge">${state.sheetChanges.length}</span></div>${state.sheetChanges.length ? `<div class="table-wrap"><table><caption>Each change is validated before applying to the app</caption><thead><tr><th scope="col">Record / new title</th><th scope="col">Result</th><th scope="col">Action</th></tr></thead><tbody>${state.sheetChanges.map((c) => `<tr><td class="jobcell"><strong>${esc(c.job)}</strong><small>${esc(c.title)}</small></td><td><span class="badge ${c.status === "Conflict" ? "red" : c.status === "Applied" ? "green" : "orange"}">${c.status}</span></td><td>${c.status === "Conflict" ? button("Resolve", "resolve", "", 'data-id="' + c.id + '"') : '<span class="small muted">' + (c.status === "Pending" ? "Run demo sync" : "Recorded") + "</span>"}</td></tr>`).join("")}</tbody></table></div>` : '<p class="small muted">No sheet edits yet. Use “Simulate sheet edit” above, then run demo sync to try the workflow.</p>'}</section><section class="panel mt"><h2>Outgoing app changes</h2>${
        state.sync.length
          ? `<ul class="activity">${state.sync
              .slice(0, 8)
              .map(
                (s) =>
                  `<li>${icon("sync")}<div><p>${esc(s.id)} · v${s.version}</p><small>${esc(s.status)} · ${when(s.at)}</small></div></li>`,
              )
              .join("")}</ul>`
          : '<p class="small muted mt12">New assignments and saved work changes will appear here. A successful simulation is not a real sync confirmation.</p>'
      }</section>`
    );
  }
  function login() {
    return `<div class="login-shell"><section class="login-art">${brand()}<div><p class="eyebrow">PERFORMANCE · POWER · PRECISION</p><h1>Good work starts with a clear plan.</h1><p>One place for your crews, your locations, and your workday.</p></div><span class="small">Illustrative Alaska landscape · original NPI emblem pending</span></section><main id="main" class="login-panel"><div class="login-content"><span class="badge orange">Interactive sample</span><h2 class="mt">Choose a view to explore.</h2><p>Try the experience your team will use. No username or password is needed for this preview.</p>${[
      ["Worker", "work", "A simple checklist and one next step."],
      ["Supervisor", "check", "Assignments, evidence, and approvals."],
      ["Management", "board", "People, settings, and spreadsheet sync."],
    ]
      .map(
        ([r, i, d]) =>
          `<button type="button" class="role-card" data-action="choose-role" data-value="${r}"><span class="metric-icon">${icon(i)}</span><span class="grow"><strong>${r}</strong><small>${d}</small></span>${icon("arrow")}</button>`,
      )
      .join(
        "",
      )}<div class="notice mt">Real company logins will use managed authentication with server-enforced roles. These preview buttons grant no access to a real system.</div></div></main></div>`;
  }
  function render() {
    document.body.dataset.view = view;
    document.title = `NPI Alaska · ${view === "login" ? "Preview sign-in" : navs[view]?.[1] || "Sample"}`;
    app.innerHTML = view === "login" ? login() : shell();
  }
  function personDialog(id) {
    const p = state.people.find((p) => p.id === id),
      val = p || {
        name: "",
        username: "",
        role: "Worker",
        site: "boney",
        active: true,
      };
    showDialog(
      p ? "Edit sample person" : "Add sample person",
      `<p class="notice">Profile preview only. No login account or password will be created.</p><form id="person-form" data-id="${p?.id || ""}" novalidate class="mt">${field("person-name", "Full name", "text", val.name)}${field("person-username", "Company username", "text", val.username, [], "Letters, numbers, dots, underscores, or hyphens. No private details.")}<div class="row wrap"><div class="grow">${field(
        "person-role",
        "Role",
        "select",
        val.role,
        [
          ["Worker", "Worker"],
          ["Supervisor", "Supervisor"],
          ["Management", "Management"],
        ],
      )}</div><div class="grow">${field("person-site", "Location scope", "select", val.site, [["all", "All locations"], ...state.sites.map((s) => [s.id, s.name])])}</div></div>${
        p
          ? field(
              "person-active",
              "Profile status",
              "select",
              p.active ? "active" : "inactive",
              [
                ["active", "Active profile"],
                ["inactive", "Inactive profile"],
              ],
            )
          : ""
      }<p class="small muted">Password setup and reset will be sent through a secure account service after the backend is connected.</p><div class="dialog-actions">${button("Cancel", "close")}<button type="submit" class="btn primary">Save sample person</button></div></form>`,
    );
  }
  function assignmentDialog() {
    showDialog(
      "Assign work",
      `<form id="job-form" novalidate>${field("job-title", "What needs to be done?", "text", "")}${field(
        "job-site",
        "Location",
        "select",
        "boney",
        state.sites.map((s) => [s.id, s.name]),
      )}${field(
        "job-worker",
        "Assign to",
        "select",
        "alex",
        state.people
          .filter((p) => p.role === "Worker" && p.active)
          .map((p) => [p.id, p.name]),
      )}${field("job-date", "Work date", "date", "2026-11-13")}${field("job-shift", "Planned shift", "text", "6:00 AM – 9:00 AM")}<p class="small muted">The location’s sample checklist is attached automatically. A site-scoped worker can only be assigned to their location; all-location profiles can cover any site.</p><div class="dialog-actions">${button("Cancel", "close")}<button type="submit" class="btn primary">Create assignment</button></div></form>`,
    );
  }
  function siteDialog(id) {
    const s = site(id);
    showDialog(
      s.name,
      `<div class="sitephoto" style="border-radius:10px;height:160px" role="img" aria-label="Illustrative landscape, not a site photo"></div><p class="small muted mt12">Illustrative image · actual photo pending</p><div class="summary-line"><span>Location</span><b>${esc(s.town)}</b></div><div class="summary-line"><span>Service</span><b>${esc(s.service)}</b></div><h3 class="mt">Sample checklist</h3><ol class="small muted" style="line-height:2">${s.tasks.map((t) => `<li>${esc(t)}</li>`).join("")}</ol><p class="notice">Site names were provided by you. Addresses, areas, evidence rules, and access instructions need NPI confirmation.</p><div class="dialog-actions">${button("Close", "close")}</div>`,
    );
  }
  function detailDialog(id) {
    const j = state.jobs.find((j) => j.id === id);
    if (role === "Worker") {
      selected = id;
      go("worker");
      return;
    }
    const s = site(j.site);
    showDialog(
      `Review ${j.id}`,
      `<div class="row between wrap"><h3>${esc(s.name)}</h3>${status(j.status)}</div><p class="small muted mt12">${esc(j.title)} · ${esc(person(j.worker).name)}</p><div class="summary-line"><span>Work date</span><b>${dateLabel(j.date)}</b></div><div class="summary-line"><span>Recorded hours</span><b>${hours(j) === "—" ? "Not completed" : hours(j) + " hours"}</b></div><div class="summary-line"><span>Checklist</span><b>${j.checks.length} / ${s.tasks.length}</b></div><div class="summary-line"><span>Photo evidence</span><b>${j.photo ? "Sample photo attached" : "No photo yet"}</b></div>${j.photo ? '<div class="proof-thumb mt" role="img" aria-label="Illustrative sample evidence photo"></div><p class="small muted">Sample evidence only · not a real completion photo</p>' : ""}<div class="summary-line"><span>Notes</span><b style="max-width:65%;font-weight:500">${esc(j.notes || "No notes")}</b></div>${j.correction ? `<p class="notice warning mt12">${esc(j.correction)}</p>` : ""}${j.status === "Awaiting review" ? `<p class="small muted mt12">Demo evidence requirements are provisional and need NPI confirmation.</p><div class="dialog-actions">${button("Request correction", "return-work", "", `data-id="${id}"`)}${button(icon("check") + " Approve work", "approve", "success", `data-id="${id}"`)}</div>` : `<div class="dialog-actions">${button("Close", "close")}</div>`}`,
    );
  }
  function help() {
    showDialog(
      "Try a complete workday",
      `<ol style="line-height:1.8;padding-left:20px"><li><b>Worker:</b> start Alex’s assignment, check each task, add a sample photo, then finish and submit.</li><li><b>Supervisor:</b> open Reviews. Approve the work or request a correction.</li><li><b>Management:</b> open Settings to add sample people, or Spreadsheet to try a two-way change.</li></ol><p class="notice mt">All data stays on this device. No accounts, photos, assignments, or sync requests are sent to external services. Do not enter real passwords.</p><div class="dialog-actions">${button("Start with worker", "help-worker", "primary")}</div>`,
    );
  }
  function saveDraft() {
    const d = getDraft();
    if (!validateDraft(d)) return false;
    if (
      updateJob(
        selected,
        (j) => {
          j.notes = d.notes;
          j.loads = d.loads;
        },
        "Draft saved on this device.",
      )
    ) {
      dirty = false;
      render();
      return true;
    }
    return false;
  }
  function validateDraft(d) {
    const e = $("#work-error");
    if (!Number.isInteger(d.loads) || d.loads < 0 || d.loads > 9999) {
      if (e)
        e.innerHTML =
          '<p class="notice error">Enter a whole load count between 0 and 9,999.</p>';
      $("#work-loads")?.focus();
      return false;
    }
    return true;
  }
  const actions = {
    help: help,
    login: () =>
      guard(() => {
        view = "login";
        render();
      }),
    "choose-role": (el) => setRole(el.dataset.value),
    "preview-worker": () => setRole("Worker"),
    "help-worker": () => {
      closeDialog(true);
      setRole("Worker");
    },
    "open-reviews": () => go("reviews"),
    "open-reports": () => go("reports"),
    close: () => closeDialog(),
    "keep-dialog": () => {
      const p = pending;
      modal.close();
      modal.innerHTML = p.content;
      for (const [id, v] of p.values) {
        const e = $("#" + id, modal);
        if (e) e.value = v;
      }
      dialogDirty = true;
      modal.showModal();
      pending = null;
    },
    "discard-dialog": () => {
      pending = null;
      closeDialog(true);
    },
    "discard-nav": () => {
      const fn = pending?.fn;
      dirty = false;
      pending = null;
      closeDialog(true);
      fn?.();
    },
    "new-job": assignmentDialog,
    "job-detail": (el) => detailDialog(el.dataset.id),
    "site-detail": (el) => siteDialog(el.dataset.id),
    "new-person": () => personDialog(),
    "edit-person": (el) => personDialog(el.dataset.id),
    "new-site": () =>
      showDialog(
        "Add sample location",
        `<form id="site-form" novalidate>${field("site-name", "Location name")}${field("site-town", "Town / area")}${field(
          "site-service",
          "Service",
          "select",
          "Snow removal",
          [
            ["Snow removal", "Snow removal"],
            ["Hauling", "Hauling"],
            ["Site work", "Site work"],
          ],
        )}<p class="small muted">A provisional checklist will be added. Confirm real scope and evidence rules before use.</p><div class="dialog-actions">${button("Cancel", "close")}<button type="submit" class="btn primary">Save sample location</button></div></form>`,
      ),
    filter: (el) => {
      filter = el.dataset.value;
      render();
    },
    "clear-filters": () => {
      filter = "All";
      query = "";
      render();
    },
    "clear-search": () => {
      query = "";
      render();
      $("#search")?.focus();
    },
    "settings-tab": (el) =>
      guard(() => {
        settingsTab = el.dataset.value;
        render();
      }),
    start: () => {
      const id = selected;
      if (
        updateJob(
          id,
          (j) => {
            if (j.status !== "Assigned") return;
            j.status = "In progress";
            j.started = now();
          },
          "Work started on this device.",
        )
      ) {
        commit((n) => record(n, `Alex Morgan started ${id}.`));
        render();
      }
    },
    photo: () => {
      if (
        updateJob(
          selected,
          (j) => (j.photo = true),
          "Sample photo added on this device.",
        )
      ) {
        const d = getDraft();
        render();
        if (dirty && $("#work-notes")) $("#work-notes").value = d.notes;
      }
    },
    timecard: () => {
      if (
        updateJob(
          selected,
          (j) => (j.timecard = true),
          "Sample timecard added on this device.",
        )
      ) {
        const d = getDraft();
        render();
        if (dirty && $("#work-notes")) $("#work-notes").value = d.notes;
      }
    },
    "save-draft": saveDraft,
    finish: () => {
      const j = job(),
        d = getDraft();
      if (!validateDraft(d)) return;
      const missing = [];
      if (j.checks.length !== site(j.site).tasks.length)
        missing.push("Complete every checklist task.");
      if (!j.photo) missing.push("Add a sample completion photo.");
      if (j.site === "tote" && !j.timecard)
        missing.push("Add a sample signed timecard.");
      if (missing.length) {
        $("#work-error").innerHTML =
          `<div class="notice error"><b>Before sending for review</b><ul>${missing.map((m) => "<li>" + m + "</li>").join("")}</ul></div>`;
        $("#work-error").setAttribute("tabindex", "-1");
        $("#work-error").focus();
        return;
      }
      showDialog(
        "Finish & submit this work?",
        `<p><b>${esc(site(j.site).name)}</b> · ${esc(j.id)}</p><p class="muted small mt12">Your checklist, sample evidence, and notes will be marked ready for supervisor review in this preview.</p><p class="notice mt">This records your end time. Saved locally only; no real supervisor is notified.</p><div class="dialog-actions">${button("Keep working", "close")}${button("Submit for review", "submit-work", "primary")}</div>`,
      );
      pending = { type: "submit", id: j.id, draft: d };
    },
    "submit-work": () => {
      const { id, draft } = pending || {};
      if (!id) return;
      if (
        updateJob(
          id,
          (j) => {
            j.notes = draft.notes;
            j.loads = draft.loads;
            j.status = "Awaiting review";
            j.ended = j.ended || now();
          },
          "Work submitted in the sample. Saved on this device.",
        )
      ) {
        commit((n) => record(n, `Alex Morgan submitted ${id} for review.`));
        dirty = false;
        pending = null;
        closeDialog(true);
        render();
      }
    },
    approve: (el) => {
      const id = el.dataset.id;
      if (
        updateJob(
          id,
          (j) => {
            j.status = "Approved";
            delete j.correction;
          },
          "Sample work approved.",
        )
      ) {
        commit((n) => record(n, `Sam Parker approved ${id}.`));
        closeDialog(true);
        render();
      }
    },
    "return-work": (el) => {
      const id = el.dataset.id;
      closeDialog(true);
      showDialog(
        "Request a correction",
        `<form id="correction-form" data-id="${id}" novalidate>${field("correction-reason", "What needs to change?", "textarea", "", [], "Give the worker a clear next step.")}<div class="dialog-actions">${button("Cancel", "close")}<button type="submit" class="btn primary">Return to worker</button></div></form>`,
      );
    },
    "sheet-edit": (el) => {
      const j = state.jobs.find((j) => j.id === el.dataset.id);
      showDialog(
        `Spreadsheet edit · ${j.id}`,
        `<form id="sheet-form" data-id="${j.id}" data-version="${j.version}" novalidate><p class="notice">Simulates a manager editing a permitted title column in Sheets. Completed records are protected.</p><div class="mt">${field("sheet-title", "Assignment title", "text", j.title)}${field(
          "sheet-scenario",
          "Sync scenario",
          "select",
          "current",
          [
            ["current", "Matching version — validate and apply"],
            ["stale", "Older version — flag a conflict"],
          ],
        )}</div><div class="dialog-actions">${button("Cancel", "close")}<button type="submit" class="btn primary">Queue sample sheet edit</button></div></form>`,
      );
    },
    "sync-demo": () => {
      if (
        commit((n) => {
          for (const c of n.sheetChanges.filter(
            (c) => c.status === "Pending",
          )) {
            const j = n.jobs.find((j) => j.id === c.job);
            if (!j || ["Approved", "Awaiting review"].includes(j.status)) {
              c.status = "Rejected — protected";
              continue;
            }
            if (j.version !== c.version) {
              c.status = "Conflict";
              continue;
            }
            j.title = c.title;
            j.version++;
            c.status = "Applied";
            queue(n, j.id);
            record(n, `Spreadsheet title change applied to ${j.id} in demo.`);
          }
          for (const s of n.sync) {
            s.status = "Demo export recorded";
            s.at = now();
          }
        }, "Demo sync complete. No external services were contacted.")
      )
        render();
    },
    resolve: (el) => {
      const c = state.sheetChanges.find((c) => c.id === el.dataset.id),
        j = state.jobs.find((j) => j.id === c.job);
      showDialog(
        "Review a sync conflict",
        `<p class="notice warning">Both sources changed. Nothing was overwritten.</p><div class="summary-line"><span>App title · v${j.version}</span><b>${esc(j.title)}</b></div><div class="summary-line"><span>Sheet title · based on v${c.version}</span><b>${esc(c.title)}</b></div><p class="small muted mt12">Re-queueing will validate against the latest record. Protected work stays protected.</p><div class="dialog-actions">${button("Keep app title", "resolve-keep", "", `data-id="${c.id}"`)}${button("Re-queue sheet title", "resolve-sheet", "primary", `data-id="${c.id}"`)}</div>`,
      );
    },
    "resolve-keep": (el) => resolve(el.dataset.id, false),
    "resolve-sheet": (el) => resolve(el.dataset.id, true),
    export: () => {
      const cell = (v) =>
        '"' +
        String(v ?? "")
          .replace(/^[=+@-]/, "'" + "$&")
          .replaceAll('"', '""') +
        '"';
      const rows = [
        [
          "Record ID",
          "Location",
          "Title",
          "Worker",
          "Work date",
          "Status",
          "Hours",
          "Version",
        ],
        ...state.jobs.map((j) => [
          j.id,
          site(j.site).name,
          j.title,
          person(j.worker).name,
          j.date,
          j.status,
          hours(j),
          j.version,
        ]),
      ];
      const blob = new Blob(
        ["\ufeff" + rows.map((r) => r.map(cell).join(",")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      );
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = "NPI-Sample-Assignments.csv";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify("Sample CSV exported. Open it in Google Sheets or Excel.");
    },
    reset: () =>
      showDialog(
        "Reset sample data?",
        `<p>This removes the people, work, settings, and sync changes you made in this clickable sample on this device.</p><p class="small muted mt12">It does not change the original app, Google Sheets, or Supabase.</p><div class="dialog-actions">${button("Keep sample", "close", "primary")}${button("Reset sample data", "confirm-reset", "danger")}</div>`,
      ),
    "confirm-reset": () => {
      try {
        localStorage.removeItem(KEY);
        state = seed();
        conflict = false;
        storageError = "";
        dirty = false;
        closeDialog(true);
        render();
        notify("Sample data reset.");
      } catch {
        notify(
          "Could not reset browser storage. Try a regular browser window.",
        );
      }
    },
    reload: () => location.reload(),
    install: () => {
      if (installPrompt) {
        installPrompt.prompt();
        installPrompt = null;
        return;
      }
      showDialog(
        "Open NPI as an app",
        `<p><b>When hosted over HTTPS:</b> use your browser’s install option.</p><ol style="line-height:1.8;padding-left:20px"><li>Android / Chrome: menu → Install app or Add to Home screen.</li><li>iPhone / Safari: Share → Add to Home Screen.</li><li>Desktop Chrome / Edge: use the install icon in the address bar.</li></ol><p class="notice mt">A downloaded HTML file is a clickable preview. Installation requires the hosted sample and its service worker. Offline sample records remain on the device.</p><div class="dialog-actions">${button("Close", "close")}</div>`,
      );
    },
  };
  function resolve(id, requeue) {
    if (
      commit(
        (n) => {
          const c = n.sheetChanges.find((c) => c.id === id),
            j = n.jobs.find((j) => j.id === c.job);
          c.status = requeue ? "Pending" : "Kept app version";
          if (requeue) c.version = j.version;
        },
        requeue ? "Sheet edit re-queued for validation." : "App title kept.",
      )
    ) {
      closeDialog(true);
      render();
    }
  }
  function dispatch(e) {
    const a = e.target.closest("[data-action]");
    if (a && !a.disabled) {
      e.preventDefault();
      actions[a.dataset.action]?.(a);
    }
    const link = e.target.closest('a[href^="#"]');
    if (link && link.getAttribute("href") !== "#main") {
      e.preventDefault();
      go(link.hash.slice(1));
    }
  }
  app.addEventListener("click", dispatch);
  modal.addEventListener("click", dispatch);
  modal.addEventListener("cancel", (e) => {
    e.preventDefault();
    closeDialog();
  });
  modal.addEventListener("input", () => (dialogDirty = true));
  modal.addEventListener("change", () => (dialogDirty = true));
  app.addEventListener("change", (e) => {
    if (e.target.id === "role-switch") {
      const next = e.target.value;
      e.target.value = role;
      setRole(next);
    }
    if (e.target.matches("[data-task]")) {
      const i = Number(e.target.dataset.task),
        d = getDraft(),
        j = job();
      if (!["In progress", "Needs correction"].includes(j.status)) return;
      if (
        updateJob(
          j.id,
          (x) =>
            (x.checks = e.target.checked
              ? [...new Set([...x.checks, i])]
              : x.checks.filter((k) => k !== i)),
        )
      ) {
        render();
        if (dirty) {
          $("#work-notes").value = d.notes;
          if ($("#work-loads")) $("#work-loads").value = d.loads;
        }
      } else e.target.checked = !e.target.checked;
    }
  });
  app.addEventListener("input", (e) => {
    if (e.isComposing) return;
    if (["work-notes", "work-loads"].includes(e.target.id)) {
      dirty = true;
      $("#draft-state").textContent =
        "Unsaved notes · save your draft before leaving";
    }
    if (["workspace-name", "workspace-contact"].includes(e.target.id))
      dirty = true;
    if (e.target.id === "search") {
      query = e.target.value;
      const pos = e.target.selectionStart;
      render();
      const input = $("#search");
      input.focus();
      input.setSelectionRange(pos, pos);
    }
  });
  function submit(e) {
    e.preventDefault();
    const form = e.target,
      v = (id) => $("#" + id, form)?.value.trim() || "";
    if (form.id === "person-form") {
      const id = form.dataset.id,
        username = v("person-username"),
        name = v("person-name"),
        r = v("person-role"),
        scope = v("person-site");
      const errors = {};
      if (!name) errors["person-name"] = "Enter a name.";
      if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username))
        errors["person-username"] =
          "Use 3–32 letters, numbers, dots, underscores, or hyphens.";
      if (
        state.people.some(
          (p) =>
            p.id !== id && p.username.toLowerCase() === username.toLowerCase(),
        )
      )
        errors["person-username"] = "That sample username is already in use.";
      if (r === "Worker" && scope === "all")
        errors["person-site"] = "Choose a location for this sample worker.";
      if (!validate(errors, form)) return;
      if (
        commit((n) => {
          const p = {
            id: id || "person-" + Date.now(),
            name,
            username,
            role: r,
            site: scope,
            active: id ? v("person-active") === "active" : true,
          };
          if (id) n.people[n.people.findIndex((x) => x.id === id)] = p;
          else n.people.push(p);
          record(
            n,
            `Management saved sample profile ${username}. No account provisioned.`,
          );
        }, "Sample profile saved. No login account was created.")
      ) {
        closeDialog(true);
        render();
      }
    }
    if (form.id === "job-form") {
      const title = v("job-title"),
        s = v("job-site"),
        w = v("job-worker"),
        date = v("job-date"),
        shift = v("job-shift"),
        errors = {};
      if (!title) errors["job-title"] = "Describe the work.";
      const p = person(w);
      if (!p.active || p.role !== "Worker")
        errors["job-worker"] = "Choose an active worker.";
      else if (p.site !== "all" && p.site !== s)
        errors["job-worker"] =
          "This worker is assigned to a different location. Choose a matching worker or update their sample scope.";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
        errors["job-date"] = "Choose a work date.";
      if (!shift) errors["job-shift"] = "Enter the planned shift.";
      if (!validate(errors, form)) return;
      if (
        commit((n) => {
          const id =
            "AK-" +
            (Math.max(...n.jobs.map((j) => Number(j.id.replace("AK-", "")))) +
              1);
          n.jobs.unshift({
            id,
            site: s,
            worker: w,
            title,
            status: "Assigned",
            date,
            shift,
            checks: [],
            notes: "",
            photo: false,
            timecard: false,
            loads: 0,
            version: 1,
            started: null,
            ended: null,
          });
          queue(n, id);
          record(n, `Sam Parker assigned ${id} to ${p.name}.`);
        }, "Assignment created on this device.")
      ) {
        closeDialog(true);
        view = "assignments";
        render();
      }
    }
    if (form.id === "site-form") {
      const name = v("site-name"),
        town = v("site-town"),
        service = v("site-service"),
        errors = {};
      if (!name) errors["site-name"] = "Enter the location name.";
      if (!town) errors["site-town"] = "Enter the town or area.";
      if (state.sites.some((s) => s.name.toLowerCase() === name.toLowerCase()))
        errors["site-name"] = "That sample location already exists.";
      if (!validate(errors, form)) return;
      if (
        commit(
          (n) =>
            n.sites.push({
              id: "site-" + Date.now(),
              name,
              town,
              service,
              category: service === "Hauling" ? "Port" : "Other",
              tasks: [
                "Complete assigned work",
                "Record completion evidence",
                "Complete safety check",
              ],
            }),
          "Sample location saved.",
        )
      ) {
        closeDialog(true);
        render();
      }
    }
    if (form.id === "correction-form") {
      const reason = v("correction-reason");
      if (
        !validate(
          reason
            ? {}
            : {
                "correction-reason":
                  "Describe what the worker needs to correct.",
              },
          form,
        )
      )
        return;
      const id = form.dataset.id;
      if (
        updateJob(
          id,
          (j) => {
            j.status = "Needs correction";
            j.correction = reason;
          },
          "Correction requested in the sample.",
        )
      ) {
        commit((n) => record(n, `Sam Parker returned ${id} for correction.`));
        closeDialog(true);
        render();
      }
    }
    if (form.id === "sheet-form") {
      const title = v("sheet-title");
      if (
        !validate(
          title ? {} : { "sheet-title": "Enter an assignment title." },
          form,
        )
      )
        return;
      if (
        commit(
          (n) =>
            n.sheetChanges.unshift({
              id: "change-" + Date.now(),
              job: form.dataset.id,
              title,
              version:
                Number(form.dataset.version) -
                (v("sheet-scenario") === "stale" ? 1 : 0),
              status: "Pending",
            }),
          "Sample spreadsheet edit queued. Run demo sync to validate it.",
        )
      ) {
        closeDialog(true);
        render();
      }
    }
    if (form.id === "workspace-form") {
      const name = v("workspace-name"),
        contact = v("workspace-contact");
      if (
        !validate(
          name ? {} : { "workspace-name": "Enter a workspace name." },
          form,
        )
      )
        return;
      if (
        commit((n) => {
          n.workspace = name;
          n.contact = contact;
        }, "Workspace saved on this device.")
      ) {
        dirty = false;
        render();
      }
    }
  }
  app.addEventListener("submit", submit);
  modal.addEventListener("submit", submit);
  window.addEventListener("beforeunload", (e) => {
    if (dirty || dialogDirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      conflict = true;
      const d = getDraft();
      render();
      if (dirty && $("#work-notes")) $("#work-notes").value = d.notes;
      notify("Another tab changed this sample. Reload before saving.");
    }
  });
  window.addEventListener("offline", () => {
    const d = getDraft();
    render();
    if (dirty && $("#work-notes")) $("#work-notes").value = d.notes;
  });
  window.addEventListener("online", () => {
    const d = getDraft();
    render();
    if (dirty && $("#work-notes")) $("#work-notes").value = d.notes;
  });
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    installPrompt = e;
  });
  window.addEventListener("hashchange", () => {
    const next = location.hash.slice(1);
    if (next === view || next === "main") return;
    history.replaceState(null, "", `#${view}`);
    if (allowed().includes(next)) go(next);
  });
  const initial = location.hash.slice(1);
  if (allowed().includes(initial)) view = initial;
  render();
  if (
    "serviceWorker" in navigator &&
    ["http:", "https:"].includes(location.protocol) &&
    location.pathname.includes("/sample/")
  )
    navigator.serviceWorker
      .register("./sw.js", { scope: "./" })
      .catch(() =>
        notify(
          "Offline installation is unavailable here. The clickable sample still works.",
        ),
      );
})();
