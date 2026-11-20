const u = {
  npi: "10000000-0000-0000-0000-000000000001",
  sub: "10000000-0000-0000-0000-000000000002",
  worker: "10000000-0000-0000-0000-000000000003",
};
const company = "20000000-0000-0000-0000-000000000001",
  site = "30000000-0000-0000-0000-000000000001",
  task = "40000000-0000-0000-0000-000000000001",
  work = "50000000-0000-0000-0000-000000000001";
const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=";
async function backend(
  page,
  { denyProfile = false, sharedState = null, sharedFiles = null } = {},
) {
  let role = "worker";
  const writes = [];
  const storedFiles = sharedFiles || new Map();
  const state = sharedState || {
    companies: [{ id: company, name: "Test contractor", active: true }],
    people: Object.entries(u).map(([role, id]) => ({
      id,
      role,
      display_name: role,
      username: role,
      company_id: role === "npi" ? null : company,
      active: true,
    })),
    sites: [
      {
        id: site,
        name: "Boney Courthouse",
        address: "Verified test address",
        photo_path: "boney",
        version: 1,
      },
    ],
    tasks: [{ id: task, name: "Snow clearing" }],
    rates: [],
    work: [
      {
        id: work,
        company_id: company,
        site_id: site,
        task_id: task,
        planned_date: "2026-11-18",
        equipment: "Loader",
        title: "Clear access route",
        kind: "site",
        status: "draft",
        version: 1,
        checklist: ["Clear route", "Inspect area"],
        completed_tasks: [],
        loads: 0,
      },
    ],
    members: [{ work_id: work, worker_id: u.worker }],
    events: [],
    reviews: [
      {
        work_id: work,
        worker_id: u.worker,
        claimed_minutes: null,
        accepted_minutes: null,
        recorded_minutes: 0,
      },
    ],
    evidence: [],
    documents: [],
    lines: [],
    changes: [],
  };
  await page.route(
    "https://fyfjsqhnxcktjdihcaks.supabase.co/**",
    async (route) => {
      const req = route.request(),
        path = new URL(req.url()).pathname;
      const body = path.startsWith("/storage/") ? null : req.postDataJSON();
      const reply = (json, status = 200) =>
        route.fulfill({
          status,
          contentType: "application/json",
          headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify(json),
        });
      if (path.includes("/token")) {
        role = body.email.startsWith("owner")
          ? "npi"
          : body.email.startsWith("supervisor")
            ? "sub"
            : "worker";
        return reply({
          access_token: "test-" + role,
          refresh_token: "test-refresh",
          expires_in: 3600,
        });
      }
      if (path.endsWith("/logout")) return reply({});
      if (path.endsWith("/npi_account_status"))
        return reply({
          status: state.accountStatus || "approved",
          company: "Test contractor",
          display_name: role,
        });
      if (path.endsWith("/npi_ops_context"))
        return reply({
          contracts: state.contracts || [],
          scopes: state.scopes || [],
          invitations: state.invitations || [],
        });
      if (
        path.endsWith("/functions/v1/npi-admin") &&
        ["invite_preview", "register_invitation"].includes(body.operation)
      ) {
        if (state.invitationInvalid)
          return reply(
            { error: "This invitation is expired or disabled." },
            400,
          );
        if (body.operation === "invite_preview")
          return reply({
            company: "Test contractor",
            role: state.invitationRole || "worker",
            expires_at: new Date(Date.now() + 86400000).toISOString(),
          });
        if (state.registrationFails)
          return reply(
            { error: "Registration could not complete. Try again." },
            400,
          );
        writes.push(body);
        state.accountStatus =
          state.invitationRole === "sub" ? "approved" : "pending";
        return reply({ status: state.accountStatus });
      }
      if (path.endsWith("/npi_ops_action")) {
        if (state.expireNext) {
          state.expireNext = false;
          return reply({ message: "Session expired" }, 401);
        }
        if (body.p_action === "create_contract" && !body.p_body.name)
          return reply({ message: "Check contract details" }, 400);
        if (body.p_action === "approve_worker") {
          state.accountStatus = "approved";
          const p = state.people.find((p) => p.id === body.p_body.id);
          if (p) {
            p.account_status = "approved";
            p.active = true;
          }
        }
        writes.push(body);
        return reply({ id: crypto.randomUUID() });
      }
      if (path.endsWith("/npi_visit_context"))
        return reply(
          state.visits || {
            items: [],
            scopes: [],
            crew: [],
            lines: [],
            duplicates: [],
          },
        );
      if (path.endsWith("/npi_visit_action")) {
        writes.push(body);
        state.visits ||= {
          items: [],
          scopes: [],
          crew: [],
          lines: [],
          duplicates: [],
        };
        const b = body.p_body,
          v = state.visits;
        let id = b.id || b.work_id || crypto.randomUUID();
        if (body.p_action === "create_visit") {
          const s = v.scopes.find((s) => s.id === b.scope_id),
            i = v.items.find((i) => i.id === b.line_id);
          id = crypto.randomUUID();
          state.work.unshift({
            id,
            company_id: company,
            contract_id: s.contract_id,
            site_id: s.site_id,
            task_id: i.task_id,
            planned_date: new Date().toISOString().slice(0, 10),
            title: i.name,
            equipment: b.equipment || "",
            kind: "site",
            status: "draft",
            version: 1,
            checklist: [],
            completed_tasks: [],
            loads: 0,
            worker_led: true,
            created_by: u.worker,
            created_at: new Date().toISOString(),
            callout_location: b.callout_location || "",
          });
          state.members.push(
            ...b.members.map((worker_id) => ({ work_id: id, worker_id })),
          );
          state.reviews.push(
            ...b.members.map((worker_id) => ({
              work_id: id,
              worker_id,
              recorded_minutes: 0,
              claimed_minutes: null,
              accepted_minutes: null,
            })),
          );
          v.lines.push({
            id: crypto.randomUUID(),
            work_id: id,
            line_id: i.id,
            line_label: i.code + " · " + i.name,
            unit: i.unit,
            snow_required: i.snow_required,
            quantity: 1,
            version: 1,
            completed: false,
          });
        } else if (body.p_action === "add_service") {
          const i = v.items.find((i) => i.id === b.line_id);
          v.lines.push({
            id: crypto.randomUUID(),
            work_id: b.work_id,
            line_id: i.id,
            line_label: i.code + " · " + i.name,
            unit: i.unit,
            snow_required: i.snow_required,
            quantity: 1,
            version: 1,
            completed: false,
          });
        } else if (body.p_action === "save_line") {
          const l = v.lines.find((l) => l.id === b.id);
          Object.assign(l, b);
          const sub = v.items.find(
            (i) =>
              i.parent_id === l.line_id &&
              Number(b.snow_inches) >= i.min_inches &&
              (i.max_inches == null || Number(b.snow_inches) < i.max_inches),
          );
          if (sub) {
            l.sub_id = sub.id;
            l.sub_label = sub.code + " · " + sub.name;
          }
          l.version++;
        } else if (body.p_action === "save_item") {
          if (b.id)
            Object.assign(
              v.items.find((i) => i.id === b.id),
              b,
            );
          else
            v.items.push({
              ...b,
              id,
              active: true,
              version: 1,
              parent_id: b.parent_id || null,
            });
        } else if (body.p_action === "cancel_prepared")
          state.work.find((w) => w.id === b.work_id).status = "cancelled";
        return reply({ id });
      }
      if (path.endsWith("/npi_field_snapshot")) {
        const f = state.field || {
          issues: [],
          comments: [],
          history: [],
          notifications: [],
          email_status: [],
          settings: [],
          storage: { files: state.evidence.length, bytes: 0 },
        };
        return reply({
          ...f,
          settings:
            role === "worker"
              ? []
              : f.settings.filter(
                  (s) =>
                    !s.scope || s.scope === (role === "npi" ? "npi" : company),
                ),
          notifications: f.notifications.filter(
            (n) => !n.recipient_id || n.recipient_id === u[role],
          ),
          email_status:
            role === "worker"
              ? []
              : f.email_status.filter(
                  (e) => role === "npi" || !e.scope || e.scope === company,
                ),
        });
      }
      if (path.endsWith("/npi_work_search"))
        return reply({ rows: state.work, total: state.work.length });
      if (path.endsWith("/npi_field_action")) {
        if (state.expireFieldNext) {
          state.expireFieldNext = false;
          return reply({ error: "Session expired" }, 401);
        }
        writes.push(body);
        const b = body.p_body;
        state.field ||= {
          issues: [],
          comments: [],
          history: [],
          notifications: [],
          email_status: [],
          settings: [],
        };
        if (body.p_action === "evidence") {
          state.evidence.push({
            ...b,
            id: crypto.randomUUID(),
            work_id: b.id,
            kind: b.stage === "timecard" ? "timecard" : "photo",
            uploaded_by: u.worker,
            created_at: new Date().toISOString(),
          });
          state.work[0].version++;
        }
        if (body.p_action === "report_issue") {
          const issue = {
            ...b,
            id: crypto.randomUUID(),
            work_id: b.id,
            reporter_id: u[role],
            status: "open",
            version: 1,
            created_at: new Date().toISOString(),
          };
          state.field.issues.push(issue);
          for (const recipient_id of [u.npi, u.sub])
            state.field.notifications.push({
              id: crypto.randomUUID(),
              recipient_id,
              work_id: b.id,
              issue_id: issue.id,
              title: "Issue reported: " + b.category,
              message: b.description,
              created_at: issue.created_at,
            });
          for (const setting of state.field.settings)
            for (const recipient of setting.emails || [])
              state.field.email_status.push({
                id: crypto.randomUUID(),
                scope: setting.scope,
                recipient,
                work_id: b.id,
                issue_id: issue.id,
                status: "queued",
                attempts: 0,
                created_at: issue.created_at,
              });
        }
        if (body.p_action === "notification_settings") {
          const scope = role === "npi" ? "npi" : company;
          state.field.settings = state.field.settings.filter(
            (s) => s.scope !== scope,
          );
          state.field.settings.push({ ...b, scope });
        }
        if (body.p_action === "read_notifications")
          state.field.notifications
            .filter((n) => n.recipient_id === u[role])
            .forEach((n) => (n.read_at = new Date().toISOString()));
        if (body.p_action === "issue_update")
          Object.assign(
            state.field.issues.find((i) => i.id === b.id),
            b,
          );
        if (body.p_action === "outcome")
          Object.assign(state.work[0], {
            outcome: b.outcome,
            outcome_reason: b.reason,
          });
        return reply({ id: b.id || crypto.randomUUID() });
      }
      if (path.endsWith("/npi_live_snapshot"))
        return denyProfile
          ? reply(
              {
                message: "Your authenticated account has no active NPI profile",
              },
              403,
            )
          : reply({
              ...state,
              accountStatus: undefined,
              people:
                role === "sub"
                  ? state.people.filter((p) => p.company_id === company)
                  : role === "worker"
                    ? state.people.filter((p) => p.role === "worker")
                    : state.people,
              profile: state.people.find((p) => p.role === role),
            });
      if (path.endsWith("/functions/v1/npi-admin") && state.expireAdminNext) {
        state.expireAdminNext = false;
        return reply({ error: "Session expired" }, 401);
      }
      if (path.startsWith("/storage/v1/object/sign/work-evidence/")) {
        if (req.method() === "POST")
          return reply({
            signedURL: path.replace("/storage/v1", "") + "?token=fixture",
          });
        return route.fulfill({
          status: 200,
          contentType:
            storedFiles.get(path.split("/work-evidence/")[1])?.type ||
            "image/png",
          body:
            storedFiles.get(path.split("/work-evidence/")[1])?.bytes ||
            Buffer.from(png, "base64"),
        });
      }
      if (path.startsWith("/storage/v1/object/")) {
        if (req.method() === "POST")
          storedFiles.set(path.split("/work-evidence/")[1], {
            bytes: req.postDataBuffer(),
            type: req.headers()["content-type"],
          });
        return reply({ Key: "stored" });
      }
      if (path.endsWith("/npi_live_action")) {
        if (state.expireNext) {
          state.expireNext = false;
          return reply({ message: "Session expired" }, 401);
        }
        writes.push(body);
        const action = body.p_action,
          b = body.p_body,
          w = state.work.find((w) => w.id === b.id) || state.work[0];
        if (b.version && b.version !== w.version)
          return reply(
            { message: "Assignment changed: refresh before saving" },
            400,
          );
        if (action === "clock") {
          state.events.push({
            id: crypto.randomUUID(),
            work_id: w.id,
            worker_id: u.worker,
            captured_by: u.worker,
            event_kind: b.event_kind,
            device_time: b.device_time,
            received_at: new Date().toISOString(),
            latitude: b.latitude,
            longitude: b.longitude,
            accuracy_metres: b.accuracy_metres,
            break_minutes: 0,
          });
          w.status = "in-progress";
          if (b.event_kind === "check-out")
            state.reviews[0].recorded_minutes = 105;
        }
        if (action === "tasks") w.completed_tasks = b.completed_tasks;
        if (action === "evidence")
          state.evidence.push({
            id: crypto.randomUUID(),
            work_id: w.id,
            path: b.path,
            kind: b.kind,
          });
        if (action === "submit_hours") {
          state.reviews[0].claimed_minutes = b.claimed_minutes;
          w.status = "contractor-review";
        }
        if (action === "company_approve") w.status = "npi-review";
        if (action === "npi_approve") {
          state.reviews[0].accepted_minutes = b.accepted_minutes[u.worker];
          w.status = "approved";
        }
        if (
          [
            "clock",
            "tasks",
            "evidence",
            "submit_hours",
            "company_approve",
            "npi_approve",
          ].includes(action)
        )
          w.version++;
        return reply({ id: b.id || crypto.randomUUID(), action });
      }
      return reply({ error: "Unexpected API request" }, 400);
    },
  );
  return { state, writes, storedFiles };
}

export { u, company, site, task, work, png, backend };
