import { distanceMetres } from "./field-domain.js";
// Worker-led visits reuse the canonical forms, feedback and attendance owners.
export class VisitFeatures {
  constructor(context) {
    this.ctx = context;
    this.requests = new Map();
  }
  get c() {
    return this.ctx();
  }
  get state() {
    return (
      this.c.data.field?.visits || {
        items: [],
        scopes: [],
        crew: [],
        lines: [],
        duplicates: [],
      }
    );
  }
  async save(action, body) {
    const k = action + JSON.stringify(body);
    if (!this.requests.has(k)) this.requests.set(k, crypto.randomUUID());
    const r = await this.c.api.visitAction(action, body, this.requests.get(k));
    this.requests.delete(k);
    return r;
  }
  workerHeader() {
    return this.c.data.profile.role === "worker"
      ? `<div class="visit-start">${this.c.button("Start work", "visit-new", "", "primary")}<p class="small">Select a site and service. No assignment required.</p></div>`
      : "";
  }
  catalogue() {
    const { data, panel, table, button, esc } = this.c;
    if (data.profile.role !== "npi") return "";
    return panel(
      "Contract line items & sub-line items",
      "<p>Configure services once. Workers see service names; records retain contract codes. Snow bands use an inclusive minimum and exclusive maximum.</p>" +
        table(
          ["Contract", "Line / sub-line", "Unit", "Status", "Action"],
          this.state.items.map((i) => [
            esc(this.c.contracts.find((c) => c.id === i.contract_id)?.name),
            esc((i.parent_id ? "Sub-line " : "") + i.code + " · " + i.name),
            esc(i.unit),
            i.active ? "Active" : "Retired",
            button(i.active ? "Retire" : "Activate", "visit-toggle", i.id),
          ]),
        ) +
        button("Add line item", "visit-item", "", "primary") +
        button("Add sub-line item", "visit-subitem"),
    );
  }
  detail(w) {
    if (!w.worker_led) return "";
    const { esc, panel, table, button, data } = this.c;
    const editable =
      data.profile.role === "worker" &&
      ["draft", "in-progress", "returned"].includes(w.status);
    return panel(
      "Services recorded",
      `${w.callout_location ? "<p>Call-out location: " + esc(w.callout_location) + "</p>" : ""}<p class="small">Attendance hours are counted once per worker for this visit.</p>` +
        (data.profile.role === "worker"
          ? this.state.lines
              .filter((l) => l.work_id === w.id)
              .map(
                (l) =>
                  `<article class="visit-service-card"><b>${esc(l.line_label.split(" · ").slice(1).join(" · ") || l.line_label)}</b><p>${esc(l.sub_label || "")}${l.snow_inches == null ? "" : " · " + esc(l.snow_inches) + " inches"}</p><p>${esc(l.quantity)} ${esc(l.unit)} · ${l.completed ? "Complete" : "In progress"}</p>${editable ? button(l.snow_required && l.snow_inches == null ? "Record snow depth" : "Update service", "visit-line", l.id) : ""}</article>`,
              )
              .join("")
          : table(
              [
                "Line item",
                "Sub-line item",
                "Quantity",
                "Snow depth",
                "Status",
              ],
              this.state.lines
                .filter((l) => l.work_id === w.id)
                .map((l) => [
                  esc(l.line_label),
                  esc(l.sub_label || "—"),
                  esc(l.quantity) + " " + esc(l.unit),
                  l.snow_inches == null ? "—" : esc(l.snow_inches) + " inches",
                  l.completed ? "Complete" : "In progress",
                ]),
            )) +
        (editable
          ? `<div class="actions">${button("Add service", "visit-add", w.id)}${w.status === "draft" ? button("Cancel prepared visit", "visit-cancel", w.id) : ""}</div>`
          : ""),
    );
  }
  newForm() {
    const c = this.c;
    if (
      !this.state.scopes.length ||
      !this.state.items.some(
        (i) =>
          i.active &&
          !i.parent_id &&
          this.state.scopes.some((s) => s.contract_id === i.contract_id),
      )
    ) {
      c.modal(
        "Work access not ready",
        "<p>Your company needs an authorised site and service. Contact your company administrator.</p>" +
          c.button("Close", "close"),
      );
      return;
    }
    this.scopeForm("create_visit", "Start work");
  }
  scopeForm(kind, title) {
    const c = this.c;
    const scopes = this.state.scopes;
    const first = scopes[0];
    c.form(
      title,
      "visit:" + kind,
      c.button("Suggest nearest site", "visit-nearest") +
        c.field("scope_id", "Site", "select", first?.id || "", [
          ["", "Select site"],
          ...scopes.map((s) => [s.id, s.site_name + " · " + s.contract_name]),
        ]) +
        c.field("line_id", "Service", "select", "", [["", "Select service"]]) +
        `<p id="visit-site-note" class="small"></p><div id="callout-field" hidden>${c.field("callout_location", "Call-out location / address (optional)")}</div><details><summary>Crew & equipment</summary>${c.field("equipment", "Equipment (optional)")}<div class="live-checks">${this.state.crew
          .filter((p) => p.id !== c.data.profile.id)
          .map(
            (p) =>
              `<label><input name="visit_crew" type="checkbox" value="${c.esc(p.id)}">${c.esc(p.display_name)}</label>`,
          )
          .join(
            "",
          )}</div></details><p class="small">Prepare this visit, upload before photos, then check in with GPS.</p>`,
    );
    const root = document.querySelector("#action-form");
    const update = () => {
      const s = this.state.scopes.find(
        (s) => s.id === root.elements.scope_id.value,
      );
      root.elements.line_id.innerHTML =
        '<option value="">Select service</option>' +
        this.state.items
          .filter(
            (i) => i.active && !i.parent_id && i.contract_id === s?.contract_id,
          )
          .map(
            (i) => `<option value="${c.esc(i.id)}">${c.esc(i.name)}</option>`,
          )
          .join("");
      root.querySelector("#visit-site-note").textContent = s
        ? this.state.duplicates.some(
            (d) => d.site_id === s.site_id && d.contract_id === s.contract_id,
          )
          ? "Another visit exists at this site today. Check your crew before continuing."
          : s.address || ""
        : "";
      this.callout(root);
    };
    root.elements.scope_id.onchange = update;
    root.elements.line_id.onchange = () => this.callout(root);
    update();
  }
  callout(root) {
    root.querySelector("#callout-field").hidden = !this.state.items.find(
      (i) => i.id === root.elements.line_id.value,
    )?.callout;
  }
  lineForm(id) {
    const c = this.c,
      l = this.state.lines.find((l) => l.id === id),
      w = c.data.work.find((w) => w.id === l.work_id);
    const subs = this.state.items.filter(
      (i) => i.parent_id === l.line_id && i.active,
    );
    const photos = c.data.evidence.filter(
      (e) => e.work_id === w.id && e.stage === "before" && e.kind === "photo",
    );
    c.form(
      l.snow_required ? "Record snow depth" : "Update service",
      "visit:save_line",
      `<p>${c.esc(l.line_label)}</p><input name="work_id" type="hidden" value="${w.id}"><input name="version" type="hidden" value="${w.version}"><input name="line_version" type="hidden" value="${l.version}">${l.snow_required ? c.field("ruler_evidence", "Ruler photo", "select", l.ruler_evidence || "", [["", "Select uploaded before photo"], ...photos.map((e, i) => [e.id, e.filename || "Before photo " + (i + 1)])]) + c.field("snow_inches", "Snow depth (inches)", "number", l.snow_inches ?? "") + `<div class="actions">${c.button("Read photo automatically", "visit-read", l.id)}</div><p id="snow-reading" role="status" class="small">Optional: sends the selected viewing photo to the configured reading service. Confirm the result or enter inches manually.</p><input name="measurement_source" type="hidden" value="manual"><label class="taskline"><input name="measurement_confirmed" type="checkbox"> Measurement confirmed against ruler photo</label>` : subs.length ? c.field("sub_id", "Service detail", "select", l.sub_id || "", [["", "Select detail"], ...subs.map((i) => [i.id, i.name])]) : ""}${(l.snow_required && l.snow_inches != null ? c.field("reason", "Reason for changed measurement (if applicable)", "textarea") : "") + c.field("quantity", "Quantity (" + l.unit + ")", "number", l.quantity)}<label class="taskline"><input name="completed" type="checkbox" ${l.completed ? "checked" : ""}> Service completed</label>`,
      l.id,
    );
    const f = document.querySelector("#action-form");
    if (f.elements.snow_inches)
      f.elements.snow_inches.oninput = () => {
        f.elements.measurement_source.value = "manual";
        f.elements.measurement_confirmed.checked = false;
      };
  }
  itemForm(sub = false) {
    const c = this.c;
    const parents = this.state.items.filter((i) => !i.parent_id && i.active);
    c.form(
      sub ? "Add sub-line item" : "Add line item",
      "visit:save_item",
      `<input name="item_level" type="hidden" value="${sub ? "sub" : "line"}">` +
        c.field("contract_id", "Contract", "select", "", [
          ["", "Select contract"],
          ...c.contracts.filter((x) => x.active).map((x) => [x.id, x.name]),
        ]) +
        c.field("parent_id", "Parent line item", "select", "", [
          ["", sub ? "Select parent line" : "No parent (line item)"],
          ...(sub ? parents.map((i) => [i.id, i.code + " · " + i.name]) : []),
        ]) +
        c.field("task_id", "Service category", "select", "", [
          ["", "Select service"],
          ...c.data.tasks.filter((t) => t.active).map((t) => [t.id, t.name]),
        ]) +
        c.field("code", sub ? "Sub-line code" : "Line code") +
        c.field("name", "Service name") +
        c.field("unit", "Unit", "select", "visit", [
          ["visit", "Visit"],
          ["hour", "Hour"],
          ["load", "Load"],
          ["yard", "Yard"],
        ]) +
        `<label class="taskline"><input name="snow_required" type="checkbox"> Require snow depth and ruler photo</label><label class="taskline"><input name="callout" type="checkbox"> Allow call-out location entry</label>` +
        (sub
          ? c.field(
              "min_inches",
              "Minimum inches (inclusive, optional)",
              "number",
            ) +
            c.field(
              "max_inches",
              "Maximum inches (exclusive, optional)",
              "number",
            )
          : ""),
    );
    const f = document.querySelector("#action-form");
    if (sub)
      f.elements.parent_id.onchange = () => {
        const p = parents.find((p) => p.id === f.elements.parent_id.value);
        if (p) {
          f.elements.contract_id.value = p.contract_id;
          f.elements.task_id.value = p.task_id;
          f.elements.unit.value = p.unit;
        }
      };
  }
  actions() {
    return {
      "visit-nearest": async () => {
        const f = document.querySelector("#action-form"),
          note = f.querySelector("#visit-site-note");
        note.textContent = "Finding nearest authorised site…";
        try {
          const position = await new Promise((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 15000,
              maximumAge: 0,
            }),
          );
          const candidates = this.state.scopes
            .filter((s) => s.latitude != null && s.longitude != null)
            .map((s) => ({
              s,
              distance: distanceMetres(
                {
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                },
                s,
              ),
            }))
            .sort((a, b) => a.distance - b.distance);
          if (!candidates.length || candidates[0].distance > 1000)
            throw Error();
          f.elements.scope_id.value = candidates[0].s.id;
          f.elements.scope_id.dispatchEvent(new Event("change"));
          note.textContent =
            "Nearest site suggested. Confirm the site before preparing work.";
        } catch {
          note.textContent =
            "Automatic site detection unavailable. Select your site manually.";
        }
      },
      "visit-new": () => this.newForm(),
      "visit-item": () => this.itemForm(),
      "visit-subitem": () => this.itemForm(true),
      "visit-line": (el) => this.lineForm(el.dataset.id),
      "visit-add": (el) => {
        const c = this.c,
          w = c.data.work.find((w) => w.id === el.dataset.id);
        c.form(
          "Add service",
          "visit:add_service",
          `<input name="work_id" type="hidden" value="${w.id}"><input name="version" type="hidden" value="${w.version}">` +
            c.field("line_id", "Service", "select", "", [
              ["", "Select service"],
              ...this.state.items
                .filter(
                  (i) =>
                    i.active &&
                    !i.parent_id &&
                    i.contract_id === w.contract_id &&
                    !this.state.lines.some(
                      (l) => l.work_id === w.id && l.line_id === i.id,
                    ),
                )
                .map((i) => [i.id, i.name]),
            ]),
          w.id,
        );
      },
      "visit-toggle": (el) => {
        const c = this.c,
          i = this.state.items.find((i) => i.id === el.dataset.id);
        c.form(
          i.active ? "Retire item" : "Activate item",
          "visit:save_item",
          `<input name="id" type="hidden" value="${i.id}"><input name="version" type="hidden" value="${i.version}"><input name="active" type="hidden" value="${!i.active}"><p>${c.esc(i.code + " · " + i.name)}. Existing work records keep their original descriptions.</p>`,
        );
      },
      "visit-cancel": (el) => {
        const c = this.c,
          w = c.data.work.find((w) => w.id === el.dataset.id);
        c.form(
          "Cancel prepared visit",
          "visit:cancel_prepared",
          `<input name="work_id" type="hidden" value="${w.id}"><input name="version" type="hidden" value="${w.version}"><p>Cancel this unstarted visit? Uploaded evidence remains in its history.</p>`,
        );
      },
      "visit-read": async (el) => {
        const f = document.querySelector("#action-form");
        const id = f.elements.ruler_evidence.value;
        if (!id) throw Error("Select an uploaded ruler photo first.");
        const status = document.querySelector("#snow-reading");
        status.textContent = "Reading photo…";
        try {
          const r = await this.c.api.request("/functions/v1/npi-admin", {
            method: "POST",
            body: { operation: "snow_read", evidence_id: id },
          });
          f.elements.snow_inches.value = r.inches;
          f.elements.measurement_source.value = "automatic-confirmed";
          f.elements.measurement_confirmed.checked = false;
          status.textContent =
            "Suggested " +
            r.inches +
            " inches. Verify the ruler photo and confirm.";
        } catch (e) {
          status.textContent =
            "Automatic reading unavailable. Enter inches manually and confirm the ruler photo.";
        }
      },
    };
  }
  async submit(action, body, values) {
    const c = this.c;
    const kind = action.slice(6);
    if (kind === "create_visit") {
      body.members = [
        ...new Set([c.data.profile.id, ...values.getAll("visit_crew")]),
      ];
      if (!body.scope_id || !body.line_id)
        throw Error("Select a site and service.");
    }
    if (kind === "save_line") {
      const l = this.state.lines.find((l) => l.id === body.id);
      const q = Number(body.quantity);
      if (
        !String(body.quantity || "").trim() ||
        !Number.isFinite(q) ||
        q <= 0 ||
        q > 100000 ||
        (["load", "visit"].includes(l?.unit) && !Number.isInteger(q))
      )
        throw Error(
          "Enter a valid service quantity. Visits and loads use whole numbers.",
        );
      if (
        l?.snow_required &&
        (!body.ruler_evidence ||
          !String(body.snow_inches ?? "").trim() ||
          !Number.isFinite(Number(body.snow_inches)) ||
          Number(body.snow_inches) < 0 ||
          Number(body.snow_inches) > 120 ||
          values.get("measurement_confirmed") !== "on")
      )
        throw Error(
          "Select the ruler photo, enter inches and confirm the measurement.",
        );
      body.measurement_confirmed = values.get("measurement_confirmed") === "on";
      body.completed = values.get("completed") === "on";
    }
    if (kind === "save_item" && !body.id) {
      if (body.item_level === "sub" && !body.parent_id)
        throw Error("Select a parent line item.");
      body.snow_required = values.get("snow_required") === "on";
      body.callout = values.get("callout") === "on";
      if (
        !body.contract_id ||
        !body.task_id ||
        !body.code?.trim() ||
        !body.name?.trim()
      )
        throw Error("Complete contract, service, code and name.");
    }
    const r = await this.save(kind, body);
    c.close(true);
    if (kind === "create_visit") await c.openVisit(r.id);
    else await c.load();
    c.success(
      kind === "create_visit"
        ? "Visit prepared. Add before photos, then start work."
        : "Changes saved successfully.",
    );
  }
}
