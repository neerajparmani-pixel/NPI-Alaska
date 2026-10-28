import "./styles.css";
import { brandMark } from "./branding.js";
import { sites, seed, hours, transition } from "./domain.js";
import { readState, writeState } from "./storage.js";
const icons = {
  work: '<rect x="4" y="7" width="16" height="14" rx="2"/><path d="M9 7V3h6v4M4 12h16"/>',
  review: '<path d="M9 4H5v17h14V4h-4M9 3h6v4H9zM8 14l3 3 5-6"/>',
  overview:
    '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5M12 17v1"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  camera: '<path d="M3 7h4l2-3h6l2 3h4v14H3z"/><circle cx="12" cy="13" r="4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  building: '<path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6M8 10h1m6 0h1"/>',
  truck:
    '<path d="M2 6h12v12H2zM14 11h4l4 4v3h-8"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/>',
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.work}</svg>`;
const escape = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const fmt = (v) =>
  v
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/Anchorage",
      }).format(new Date(v))
    : "Not recorded";
let jobs = [],
  role = "worker",
  page = "work",
  filter = "All work",
  selected = null,
  error = "",
  busy = false,
  saveTimer,
  toastTimer;
const root = document.querySelector("#app");
const workerName = "Alex Morgan";
const mine = () => jobs.filter((j) => j.worker === workerName);
const visibleJobs = () => (role === "worker" ? mine() : jobs);
const badge = (status) =>
  `<span class="badge ${{ "In progress": "progress", Submitted: "submitted", Approved: "approved", "Correction requested": "correction" }[status] || ""}">${escape(status === "Submitted" ? "Awaiting review" : status)}</span>`;
function toast(message) {
  document.querySelector("#notification")?.remove();
  const el = document.createElement("div");
  el.id = "notification";
  el.className = "toast";
  el.setAttribute("role", "status");
  el.textContent = message;
  document.body.append(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 4500);
}
async function persist() {
  await writeState(jobs);
}
function header() {
  const navs =
    role === "worker"
      ? [
          ["work", "My work", "work"],
          ["history", "My history", "clock"],
          ["help", "Help", "help"],
        ]
      : role === "supervisor"
        ? [
            ["overview", "Overview", "overview"],
            ["review", "Review work", "review"],
            ["assign", "Assign work", "work"],
            ["help", "Help", "help"],
          ]
        : [
            ["overview", "Overview", "overview"],
            ["records", "Work records", "work"],
            ["help", "Help", "help"],
          ];
  const name =
    role === "worker"
      ? workerName
      : role === "supervisor"
        ? "Taylor Brooks"
        : "Casey Adams";
  return `<div class="shell"><aside class="sidebar"><div class="brand">${brandMark()}<div><strong>NPI ALASKA</strong><small>FIELD OPERATIONS</small></div></div><p class="workspace">YOUR WORKSPACE</p><nav class="nav" aria-label="Main navigation">${navs.map(([id, label, i]) => `<button data-page="${id}" class="${page === id ? "active" : ""}" ${page === id ? 'aria-current="page"' : ""}>${icon(i)}${label}</button>`).join("")}</nav><div class="sidefoot"><b>Built for the work ahead.</b>Alaska field operations<br>Phase 1 · Work tracking</div></aside><main class="main"><header class="topbar"><div class="mobilebrand">${brandMark()}NPI ALASKA</div><div class="breadcrumb">Field operations <span aria-hidden="true">/</span><b>${escape(navs.find((n) => n[0] === page)?.[1] || "Work details")}</b></div><div class="identity"><span class="online"><span class="dot"></span>${navigator.onLine ? "Device online" : "Device offline"}</span><div class="avatar">${name
    .split(" ")
    .map((s) => s[0])
    .join(
      "",
    )}</div><div><b>${name}</b><small>${role === "worker" ? "Field worker" : role === "supervisor" ? "Site supervisor" : "Management"}</small></div></div></header>${!navigator.onLine ? '<div class="connection" role="status">Offline · Demo changes stay on this device. Nothing is sent to NPI.</div>' : ""}<div class="content"><div class="demo"><span><b>Interactive demo</b> · Sample records only. Changes stay on this device; no company data is sent.</span><label><span class="sr-only">Demo view</span><select id="role" aria-label="Demo view"><option value="worker" ${role === "worker" ? "selected" : ""}>Worker view</option><option value="supervisor" ${role === "supervisor" ? "selected" : ""}>Supervisor view</option><option value="management" ${role === "management" ? "selected" : ""}>Management view</option></select></label></div>`;
}
function pagehead(eyebrow, title, sub) {
  return `<div class="pagehead"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="subtitle">${sub}</p></div><div class="date">${new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "America/Anchorage" }).format(new Date())}<br><small>Alaska time</small></div></div>`;
}
function stats(list) {
  const counts = [
    [
      "Assigned",
      list.filter((j) => j.status === "Assigned").length,
      "Ready to get started",
    ],
    [
      "In progress",
      list.filter((j) => j.status === "In progress").length,
      "Work underway",
    ],
    [
      "Awaiting review",
      list.filter((j) => j.status === "Submitted").length,
      "With your supervisor",
    ],
    [
      "Approved",
      list.filter((j) => j.status === "Approved").length,
      "Work verified",
    ],
  ];
  return `<div class="stats">${counts.map(([label, n, desc]) => `<div class="stat"><span>${label}</span><strong>${n.toString().padStart(2, "0")}</strong><small>${desc}</small></div>`).join("")}</div>`;
}
function card(j) {
  return `<article class="jobcard"><div class="siteart ${j.site}"><span class="sitecode">${j.site === "tote" ? "PORT OPERATIONS" : "SNOW OPERATIONS"}</span>${icon(j.site === "tote" ? "truck" : "building")}</div><div class="jobbody"><div class="jobtop">${badge(j.status)}<span class="ref">${escape(j.id)}</span></div><h3>${sites[j.site].name}</h3><p class="jobsub">${escape(j.assignment)}</p><div class="meta"><div><span>${role === "worker" ? "Equipment" : "Worker"}</span><b>${escape(role === "worker" ? j.equipment : j.worker)}</b></div><div><span>${j.start ? "Recorded hours" : "Work type"}</span><b>${j.start ? hours(j) + " hrs" : sites[j.site].area}</b></div></div></div><div class="jobfooter"><button class="button full ${j.status === "Assigned" && role === "worker" ? "primary" : "secondary"}" data-open="${escape(j.id)}">${j.status === "Assigned" && role === "worker" ? "View assignment" : j.status === "In progress" && role === "worker" ? "Continue work" : j.status === "Correction requested" && role === "worker" ? "Fix & resubmit" : role === "supervisor" && j.status === "Submitted" ? "Review work" : "View work"}${icon("arrow")}</button></div></article>`;
}
function workPage() {
  const all = visibleJobs();
  let list =
    page === "history"
      ? all.filter((j) => ["Approved", "Submitted"].includes(j.status))
      : all.filter((j) => !["Approved", "Submitted"].includes(j.status));
  if (filter !== "All work")
    list = list.filter((j) => sites[j.site].name === filter);
  return (
    pagehead(
      "Your workday",
      page === "history" ? "Your work history" : "Let’s get to work.",
      page === "history"
        ? "Check the status of your submitted work."
        : "Your assignments, in one place. Choose a job to get started.",
    ) +
    `<details class="work-summary" ${window.innerWidth > 760 ? "open" : ""}><summary>View my work summary</summary>${stats(all)}</details>` +
    `<div class="sectionhead"><div><h2>${page === "history" ? "Submitted work" : "Your assignments"}</h2><p>${page === "history" ? "Keep track of reviews and approvals." : "Check the details before you start."}</p></div><span class="count">${list.length} ${list.length === 1 ? "job" : "jobs"}</span></div><div class="filters" aria-label="Filter by site">${["All work", ...Object.values(sites).map((s) => s.name)].map((s) => `<button class="chip ${filter === s ? "active" : ""}" data-filter="${s}" aria-pressed="${filter === s}">${s}</button>`).join("")}</div><div class="workgrid">${list.length ? list.map(card).join("") : '<div class="empty"><h3>No work here yet</h3><p>Try another site filter or check back for your next assignment.</p></div>'}</div><div class="callout">${icon("camera")}<div><strong>A clear photo makes review easier.</strong><p>Show the completed work and surrounding area. Check your photos before submitting.</p></div></div>`
  );
}
function overview() {
  return (
    pagehead(
      "Operations overview",
      "A clear view of the field.",
      "Follow assignments from the first task to final approval.",
    ) +
    stats(jobs) +
    `<div class="sectionhead"><h2>Site activity</h2><span class="count">3 active sites</span></div><div class="helpgrid">${Object.entries(
      sites,
    )
      .map(([key, s]) => {
        const rows = jobs.filter((j) => j.site === key);
        return `<article class="panel"><p class="eyebrow">${s.area}</p><h3>${s.name}</h3><p>${rows.length} work records · ${rows.filter((j) => j.status === "Submitted").length} awaiting review</p><button class="button secondary full" data-site="${key}">View site work ${icon("arrow")}</button></article>`;
      })
      .join(
        "",
      )}</div><section class="panel"><div class="sectionhead"><h2>Latest work records</h2><span class="count">Sample activity</span></div><div class="activity">${jobs
      .slice(-5)
      .reverse()
      .map(
        (j) =>
          `<div class="activityrow"><div><strong>${sites[j.site].name}</strong><small>${escape(j.worker)} · ${escape(j.id)}</small></div>${badge(j.status)}<button class="button secondary" data-open="${j.id}">View</button></div>`,
      )
      .join("")}</div></section>`
  );
}
function records() {
  let list =
    page === "review" ? jobs.filter((j) => j.status === "Submitted") : jobs;
  if (filter !== "All work")
    list = list.filter((j) => sites[j.site].name === filter);
  return (
    pagehead(
      "Work verification",
      page === "review" ? "Ready for your review." : "Work records",
      page === "review"
        ? "Check the details and evidence before approving."
        : "Follow the progress of work across all sites.",
    ) +
    `<div class="filters">${["All work", ...Object.values(sites).map((s) => s.name)].map((s) => `<button class="chip ${filter === s ? "active" : ""}" data-filter="${s}" aria-pressed="${filter === s}">${s}</button>`).join("")}</div><p class="count">${list.length} records</p><div class="workgrid">${list.length ? list.map(card).join("") : '<div class="empty"><h3>All caught up</h3><p>No records match this view.</p></div>'}</div>`
  );
}
function detail() {
  const j = jobs.find((j) => j.id === selected);
  if (!j) return "<p>Record unavailable.</p>";
  const editable =
    role === "worker" &&
    j.worker === workerName &&
    ["In progress", "Correction requested"].includes(j.status);
  return (
    `<button class="back" id="back">← Back to ${role === "worker" ? "my work" : "work records"}</button>` +
    pagehead(escape(j.id), sites[j.site].name, escape(j.assignment)) +
    `<div>${badge(j.status)}</div><div class="detailgrid"><div>${j.correction && j.status === "Correction requested" ? `<div class="notice"><b>Your supervisor requested a correction</b><br>${escape(j.correction)}</div>` : ""}${error ? `<div class="error" role="alert" tabindex="-1" id="form-error">${escape(error)}</div>` : ""}${j.status === "Assigned" && role === "worker" ? `<section class="panel"><h2>Before you start</h2><p>${escape(j.notes)}</p><p class="hint">Start time is recorded when you tap the button. Location is optional if permission is unavailable.</p><button id="start" class="button primary full">${icon("clock")}Start work</button></section>` : `<section class="panel"><h2><span class="step">1</span>Work details</h2><p class="hint">${editable ? "Select the tasks you completed." : "Recorded tasks and site details."}</p>${sites[j.site].tasks.map((t) => `<label class="task"><input type="checkbox" data-task="${escape(t)}" ${j.tasks.includes(t) ? "checked" : ""} ${!editable ? "disabled" : ""}>${t}</label>`).join("")}${j.site === "tote" ? `<div class="field"><label for="loads">Completed loads</label><input id="loads" type="number" min="0" step="1" inputmode="numeric" value="${escape(j.loads ?? "")}" ${!editable ? "disabled" : ""}></div>` : ""}<div class="field"><label for="notes">Work notes ${editable ? "(optional)" : ""}</label><textarea style="resize:none" id="notes" ${!editable ? "readonly" : ""}>${escape(j.workNotes || "")}</textarea></div></section><section class="panel"><h2><span class="step">2</span>Work photos</h2><p class="hint">${editable ? "Add clear photos of the completed work. JPEG, PNG or WebP · up to 5 MB each · maximum 6." : "Supporting evidence attached to this record."}</p>${editable ? `<div class="upload"><button class="button secondary" id="add-photo">${icon("camera")}Take or add photos</button><input id="photo-input" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple hidden><p>Photos stay on this device in the demo.</p></div>` : ""}<div class="photos">${j.photos.map((p, i) => `<div class="photo"><img src="${p.data}" alt="Work evidence ${i + 1}">${editable ? `<button data-remove="${i}" aria-label="Remove work photo ${i + 1}">Remove photo</button>` : ""}</div>`).join("")}</div>${!j.photos.length ? '<p class="hint">No photos attached.</p>' : ""}</section>${j.site === "tote" ? `<section class="panel"><h2><span class="step">3</span>Signed timecard</h2><p class="hint">JPEG, PNG or PDF · up to 5 MB.</p>${j.timecard ? `<p class="fileline">${escape(j.timecard.name)} · Saved on this device</p>` : ""}${editable ? '<button class="button secondary" id="add-timecard">Attach signed timecard</button><input id="timecard-input" type="file" accept="image/jpeg,image/png,application/pdf" hidden>' : ""}${!j.timecard && !editable ? "<p>No timecard attached.</p>" : ""}</section>` : ""}${editable ? `<section class="panel"><h2>Ready to send?</h2><p class="hint">Check your tasks and photos. Submitting records your finish time and sends this demo record for review.</p><p class="saved">Draft saved on this device</p><button class="button primary full" id="submit">${icon("check")}Submit work for review</button></section>` : ""}`}${role === "supervisor" && j.status === "Submitted" ? `<section class="panel"><h2>Review decision</h2><p class="hint">Verify the work details and supporting evidence.</p><div class="field"><label for="correction">Correction instructions (required when returning)</label><textarea style="resize:none" id="correction" placeholder="Explain what the worker needs to fix."></textarea></div><div class="reviewactions"><button id="approve" class="button success">${icon("check")}Approve work</button><button id="return" class="button secondary">Request correction</button></div></section>` : ""}</div><aside><section class="panel"><h2>Assignment summary</h2>${[
      ["Worker", j.worker],
      ["Contractor", j.contractor],
      ["Equipment", j.equipment],
      ["Started", fmt(j.start)],
      ["Finished", fmt(j.end)],
      ["Hours", hours(j)],
      [
        "Location",
        j.location
          ? `${j.location.latitude.toFixed(4)}, ${j.location.longitude.toFixed(4)} (±${Math.round(j.location.accuracy)} m)`
          : "Not captured",
      ],
    ]
      .map(
        ([l, v]) =>
          `<div class="summaryrow"><span>${l}</span><strong>${escape(v)}</strong></div>`,
      )
      .join(
        "",
      )}${editable ? '<button id="location" class="button secondary full" style="margin-top:18px">Capture location</button><p class="hint" style="margin-top:12px">Your browser will ask for permission.</p>' : ""}</section><section class="panel"><h2>Record history</h2><div class="timeline">${j.history?.length ? j.history.map((h) => `<p><b>${escape({ start: "Work started", submit: "Submitted for review", approve: "Approved", return: "Correction requested" }[h.action])}</b><small>${fmt(h.at)} · ${escape(h.actor)}</small>${escape(h.reason || "")}</p>`).join("") : "<p>No recorded changes yet.</p>"}</div></section></aside></div>`
  );
}
function assignment() {
  return (
    pagehead(
      "Plan the work",
      "Create an assignment.",
      "Give your worker a clear site, equipment and task description.",
    ) +
    `<section class="panel" style="max-width:720px"><form id="assignment-form" novalidate>${error ? `<div class="error" role="alert" id="form-error" tabindex="-1">${escape(error)}</div>` : ""}<div class="field"><label for="site">Site</label><select id="site">${Object.entries(
      sites,
    )
      .map(([k, s]) => `<option value="${k}">${s.name}</option>`)
      .join(
        "",
      )}</select></div><div class="field"><label for="worker">Worker</label><select id="worker"><option>Alex Morgan</option><option>Sam Rivera</option><option>Jordan Lee</option></select></div><div class="field"><label for="area">Work area or assignment</label><input id="area" name="area" maxlength="120" placeholder="For example, main lot and sidewalks" required></div><div class="field"><label for="equipment">Equipment</label><input id="equipment" name="equipment" maxlength="80" placeholder="For example, plow truck" required></div><div class="field"><label for="instructions">Instructions (optional)</label><textarea style="resize:none" id="instructions" name="instructions"></textarea></div><button class="button primary full" style="margin-top:24px" type="submit">Create assignment</button></form></section>`
  );
}
function help() {
  return (
    pagehead(
      "A little guidance",
      "Simple steps. Clear records.",
      "Everything you need to complete your first work record.",
    ) +
    `<div class="helpgrid">${[
      [
        "Start your assignment",
        "Open My work, choose your assignment and tap Start work when you begin.",
      ],
      [
        "Record what you did",
        "Select completed tasks, add clear photos and attach a signed timecard for port work.",
      ],
      [
        "Send it for review",
        "Tap Submit work for review. Check My history for approval or My work for correction requests.",
      ],
    ]
      .map(
        ([t, d], i) =>
          `<section class="panel"><p class="eyebrow">STEP ${i + 1}</p><h3>${t}</h3><p>${d}</p></section>`,
      )
      .join(
        "",
      )}</div><section class="panel"><h2>About this demo</h2><p>Use the demo view selector to try worker, supervisor and management screens. It changes the sample experience; it is not a login or a security control.</p><p>Drafts and photos are stored in this browser. They are not uploaded or shared between devices. Do not enter real personal or company information.</p><p>For a missing assignment or incorrect work record, contact your supervisor. Real sign-in and company storage must be configured before field use.</p></section>`
  );
}
function render() {
  root.innerHTML =
    header() +
    (selected
      ? detail()
      : page === "overview"
        ? overview()
        : ["review", "records"].includes(page)
          ? records()
          : page === "assign"
            ? assignment()
            : page === "help"
              ? help()
              : workPage()) +
    '<p class="footertext">NPI Alaska · Field operations<br>Demo workspace · Work tracking & approval · <a href="/login">Company sign-in</a></p></div></main></div>';
  bind();
}
function navigate(p) {
  clearTimeout(saveTimer);
  selected = null;
  error = "";
  filter = "All work";
  page = p;
  render();
  window.scrollTo(0, 0);
}
async function mutate(action, reason = "") {
  if (busy) return;
  busy = true;
  document
    .querySelectorAll("#start,#submit,#approve,#return,#role")
    .forEach((b) => (b.disabled = true));
  try {
    const i = jobs.findIndex((j) => j.id === selected);
    const old = jobs[i];
    jobs[i] = transition(old, action, role, reason);
    try {
      await persist();
    } catch (e) {
      jobs[i] = old;
      throw e;
    }
    error = "";
    if (action === "submit") {
      selected = null;
      page = "history";
    }
    render();
    toast(
      {
        start: "Work started. Your draft is saved on this device.",
        submit: "Demo work submitted for supervisor review.",
        approve: "Demo work approved.",
        return: "Correction request saved.",
      }[action],
    );
  } catch (e) {
    error = e.message;
    render();
    document.querySelector("#form-error")?.focus();
  } finally {
    busy = false;
  }
}
async function patch(fields) {
  const j = jobs.find((j) => j.id === selected);
  Object.assign(j, fields);
  try {
    await persist();
  } catch {
    error =
      "Your device could not save this change. Free some browser storage and try again.";
    render();
  }
}
function bind() {
  document
    .querySelectorAll("[data-page]")
    .forEach((b) => (b.onclick = () => navigate(b.dataset.page)));
  document.querySelector("#role").onchange = (e) => {
    role = e.target.value;
    navigate(role === "worker" ? "work" : "overview");
  };
  document.querySelectorAll("[data-filter]").forEach(
    (b) =>
      (b.onclick = () => {
        filter = b.dataset.filter;
        render();
      }),
  );
  document.querySelectorAll("[data-open]").forEach(
    (b) =>
      (b.onclick = () => {
        selected = b.dataset.open;
        error = "";
        render();
        window.scrollTo(0, 0);
      }),
  );
  document.querySelectorAll("[data-site]").forEach(
    (b) =>
      (b.onclick = () => {
        page = "records";
        filter = sites[b.dataset.site].name;
        render();
      }),
  );
  document.querySelector("#back")?.addEventListener("click", () => {
    selected = null;
    error = "";
    render();
  });
  for (const [id, action] of [
    ["start", "start"],
    ["submit", "submit"],
    ["approve", "approve"],
    ["return", "return"],
  ])
    document
      .querySelector("#" + id)
      ?.addEventListener("click", () =>
        mutate(action, document.querySelector("#correction")?.value || ""),
      );
  document.querySelectorAll("[data-task]").forEach(
    (b) =>
      (b.onchange = () => {
        const tasks = [...document.querySelectorAll("[data-task]:checked")].map(
          (b) => b.dataset.task,
        );
        patch({ tasks });
      }),
  );
  document
    .querySelector("#notes")
    ?.addEventListener("input", (e) => patch({ workNotes: e.target.value }));
  document
    .querySelector("#loads")
    ?.addEventListener("input", (e) => patch({ loads: e.target.value }));
  document
    .querySelector("#add-photo")
    ?.addEventListener("click", () =>
      document.querySelector("#photo-input").click(),
    );
  document
    .querySelector("#add-timecard")
    ?.addEventListener("click", () =>
      document.querySelector("#timecard-input").click(),
    );
  document
    .querySelector("#photo-input")
    ?.addEventListener("change", (e) => attach(e.target.files, false));
  document
    .querySelector("#timecard-input")
    ?.addEventListener("change", (e) => attach(e.target.files, true));
  document.querySelectorAll("[data-remove]").forEach(
    (b) =>
      (b.onclick = async () => {
        const j = jobs.find((j) => j.id === selected);
        await patch({
          photos: j.photos.filter((_, i) => i !== Number(b.dataset.remove)),
        });
        render();
      }),
  );
  document.querySelector("#location")?.addEventListener("click", (e) => {
    const b = e.currentTarget;
    if (!navigator.geolocation) {
      toast(
        "Location is unavailable on this device. You can still record work.",
      );
      return;
    }
    b.disabled = true;
    b.textContent = "Getting location…";
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await patch({
          location: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            capturedAt: new Date().toISOString(),
          },
        });
        render();
        toast("Location saved on this device.");
      },
      () => {
        render();
        toast(
          "Location could not be captured. Check browser permissions and try again.",
        );
      },
      { timeout: 12000, enableHighAccuracy: true },
    );
  });
  document
    .querySelector("#assignment-form")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      const area = f.querySelector("#area"),
        equipment = f.querySelector("#equipment");
      if (!area.value.trim() || !equipment.value.trim()) {
        error = "Enter the work area and equipment.";
        let el = document.querySelector("#assignment-error");
        if (!el) {
          el = document.createElement("p");
          el.id = "assignment-error";
          el.className = "error";
          el.setAttribute("role", "alert");
          f.prepend(el);
        }
        el.textContent = error;
        const invalid = !area.value.trim() ? area : equipment;
        invalid.setAttribute("aria-invalid", "true");
        invalid.setAttribute("aria-describedby", "assignment-error");
        invalid.focus();
        return;
      }
      const b = f.querySelector("button[type=submit]");
      b.disabled = true;
      const j = {
        id: "AK-" + crypto.randomUUID().slice(0, 8).toUpperCase(),
        site: f.querySelector("#site").value,
        worker: f.querySelector("#worker").value,
        contractor: "Sample contractor",
        equipment: equipment.value.trim(),
        assignment: area.value.trim(),
        notes: f.querySelector("#instructions").value.trim(),
        status: "Assigned",
        tasks: [],
        photos: [],
      };
      jobs.push(j);
      try {
        await persist();
        navigate("records");
        toast("Demo assignment created.");
      } catch {
        jobs.pop();
        b.disabled = false;
        toast("Assignment could not be saved. Try again.");
      }
    });
}
async function attach(files, timecard) {
  const jobId = selected;
  const j = jobs.find((j) => j.id === jobId);
  if (!j) return;
  error = "";
  const max = timecard ? 1 : 6 - j.photos.length;
  if (files.length > max) {
    error = timecard ? "Choose one timecard." : "Maximum 6 photos per record.";
    render();
    return;
  }
  try {
    const added = [];
    for (const file of files) {
      const types = timecard
        ? ["image/jpeg", "image/png", "application/pdf"]
        : ["image/jpeg", "image/png", "image/webp"];
      if (
        !types.includes(file.type) ||
        file.size > 5 * 1024 * 1024 ||
        !file.size
      )
        throw Error("Choose a supported file, no larger than 5 MB.");
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () =>
          reject(Error("File could not be read. Try again."));
        reader.readAsDataURL(file);
      });
      added.push({ name: file.name, data, type: file.type });
    }
    const updated = timecard
      ? { ...j, timecard: added[0] }
      : { ...j, photos: [...j.photos, ...added] };
    const next = jobs.map((x) => (x.id === jobId ? updated : x));
    await writeState(next);
    jobs = next;
    render();
    toast(
      timecard
        ? "Timecard saved on this device."
        : "Photos saved on this device.",
    );
  } catch (e) {
    error = e.message;
    render();
    document.querySelector("#form-error")?.focus();
  }
}
window.addEventListener("online", render);
window.addEventListener("offline", render);
try {
  jobs = (await readState()) || seed();
  await persist();
  render();
} catch {
  root.innerHTML =
    '<main class="content"><section class="panel"><h1>Browser storage unavailable</h1><p>This demo needs browser storage to keep your work. Allow site storage or open it in a regular browser window, then reload.</p><button class="button" id="reload">Reload</button></section></main>';
  document.querySelector("#reload").onclick = () => location.reload();
}
if ("serviceWorker" in navigator && import.meta.env.PROD)
  navigator.serviceWorker.register("/sw.js").catch(() => {});
