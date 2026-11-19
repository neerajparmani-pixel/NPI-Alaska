const json = (body, status = 200, origin = "https://alaska.npi6030.com") =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": origin,
      Vary: "Origin",
      "Access-Control-Allow-Headers":
        "authorization,apikey,content-type,x-npi-sheet-token",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
    },
  });
const uuid = (x) =>
  typeof x === "string" && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(x);
async function sameSecret(a, b) {
  if (!a || !b || b.length < 32) return false;
  const enc = new TextEncoder();
  const [x, y] = await Promise.all(
    [a, b].map((v) => crypto.subtle.digest("SHA-256", enc.encode(v))),
  );
  const u = new Uint8Array(x),
    v = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < u.length; i++) diff |= u[i] ^ v[i];
  return diff === 0;
}
export async function handleAdmin(request, env, fetcher = fetch) {
  const origin = request.headers.get("origin");
  const allowed = env.NPI_ORIGIN || "https://alaska.npi6030.com";
  if (origin && origin !== allowed)
    return json({ error: "Origin denied" }, 403, allowed);
  if (request.method === "OPTIONS") return json({}, 200, allowed);
  if (request.method !== "POST")
    return json({ error: "POST required" }, 405, allowed);
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)
    return json({ error: "Server configuration missing" }, 503, allowed);
  let text;
  try {
    text = await request.text();
    if (text.length > 200000) throw Error();
  } catch {
    return json({ error: "Invalid request" }, 400, allowed);
  }
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: "Invalid JSON" }, 400, allowed);
  }
  const service = async (path, { method = "GET", body: payload } = {}) => {
    const res = await fetcher(env.SUPABASE_URL + path, {
      method,
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: payload ? JSON.stringify(payload) : undefined,
      signal: AbortSignal.timeout(25000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = Error("Server data operation failed");
      error.detail = data.message || "";
      throw error;
    }
    return data;
  };
  try {
    if (!body || typeof body !== "object" || Array.isArray(body))
      return json({ error: "Invalid request" }, 400, allowed);

    if (["invite_preview", "register_invitation"].includes(body.operation)) {
      if (typeof body.token !== "string" || !/^[0-9a-f]{64}$/.test(body.token))
        return json(
          {
            error:
              "This invitation is invalid or unavailable. Ask your company administrator for a new link.",
          },
          400,
          allowed,
        );
      const hash = Array.from(
        new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(body.token),
          ),
        ),
      )
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const rpc = (payload) =>
        service("/rest/v1/rpc/npi_enroll", { method: "POST", body: payload });
      if (body.operation === "invite_preview") {
        try {
          return json(
            await rpc({ p_mode: "preview", p_hash: hash }),
            200,
            allowed,
          );
        } catch {
          return json(
            {
              error:
                "This invitation is expired, disabled or full. Ask your company administrator for a new link.",
            },
            400,
            allowed,
          );
        }
      }
      if (
        !uuid(body.request_id) ||
        typeof body.username !== "string" ||
        !/^[a-z0-9][a-z0-9._-]{2,49}$/.test(body.username) ||
        typeof body.display_name !== "string" ||
        !body.display_name.trim() ||
        body.display_name.length > 150 ||
        typeof body.password !== "string" ||
        body.password.length < 12 ||
        new TextEncoder().encode(body.password).length > 72
      )
        return json(
          {
            error:
              "Enter your full name, a username (3–50 lowercase letters/numbers) and a password of 12–72 characters.",
          },
          400,
          allowed,
        );
      const attempt = crypto.randomUUID();
      const common = {
        p_hash: hash,
        p_request: body.request_id,
        p_attempt: attempt,
      };
      try {
        const registration = await rpc({
          ...common,
          p_mode: "begin",
          p_username: body.username,
          p_name: body.display_name.trim(),
        });
        if (registration.complete)
          return json({ status: registration.status }, 200, allowed);
        let userId = registration.user_id;
        if (!userId) {
          const created = await service("/auth/v1/admin/users", {
            method: "POST",
            body: {
              email: body.username + "@users.npi6030.com",
              password: body.password,
              email_confirm: true,
              app_metadata: { npi_enrollment_id: body.request_id },
            },
          });
          userId = created.id;
          if (!uuid(userId)) throw Error("Identity could not be created");
        }
        return json(
          await rpc({ ...common, p_mode: "finish", p_user: userId }),
          200,
          allowed,
        );
      } catch (error) {
        // Release only this attempt. An uncertain Auth result remains recoverable by its server-owned metadata.
        await rpc({ ...common, p_mode: "release" }).catch(() => {});
        const messages = {
          "Username unavailable":
            "That username is unavailable. If you already registered, sign in instead.",
          "Registration busy":
            "Registration is still processing. Wait 90 seconds and retry this form, or try signing in.",
          "Invitation unavailable":
            "This invitation is expired, disabled or full. Ask your company administrator for a new link.",
          "Registration changed":
            "Registration details changed. Reopen the invitation link to start again.",
        };
        return json(
          {
            error:
              messages[error.detail] ||
              "Registration could not complete. Try signing in if already submitted, or contact your company administrator.",
          },
          400,
          allowed,
        );
      }
    }
    if (
      body.operation === "sheet_export" ||
      body.operation === "sheet_propose" ||
      body.operation === "email_dispatch"
    ) {
      if (
        !(await sameSecret(
          request.headers.get("x-npi-sheet-token"),
          env.NPI_SHEETS_TOKEN,
        )) ||
        body.spreadsheetId !== env.NPI_SHEETS_ID
      )
        return json({ error: "Workbook authorization failed" }, 403, allowed);
      if (body.operation === "email_dispatch") {
        if (!env.NPI_EMAIL_API_KEY || !env.NPI_EMAIL_FROM)
          return json(
            {
              error:
                "Email sender is not configured. Set NPI_EMAIL_API_KEY and NPI_EMAIL_FROM on the server.",
            },
            503,
            allowed,
          );
        const jobs = await service("/rest/v1/rpc/npi_email_claim", {
          method: "POST",
          body: {},
        });
        let sent = 0;
        for (const job of jobs) {
          let provider = null,
            error = null;
          try {
            const response = await fetcher("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: "Bearer " + env.NPI_EMAIL_API_KEY,
                "Content-Type": "application/json",
                "Idempotency-Key": job.id,
              },
              body: JSON.stringify({
                from: env.NPI_EMAIL_FROM,
                to: [job.recipient],
                subject: job.subject,
                text:
                  job.message +
                  "\n\nSign in to review: " +
                  allowed +
                  "/live/" +
                  (job.work_id ? "#work=" + job.work_id : "#notifications") +
                  "\nPrivate evidence requires an authorised account.",
              }),
              signal: AbortSignal.timeout(20000),
            });
            const result = await response.json();
            if (!response.ok || !result.id)
              throw Error(
                "Email provider rejected the request (" +
                  response.status +
                  ").",
              );
            provider = result.id;
            sent++;
          } catch (e) {
            error = e.message || "Email send failed";
          }
          await service("/rest/v1/rpc/npi_email_result", {
            method: "POST",
            body: {
              p_id: job.id,
              p_sent: !!provider,
              p_provider: provider,
              p_error: error,
            },
          });
        }
        return json({ processed: jobs.length, sent }, 200, allowed);
      }
      const fields = {
        npi_evidence:
          "id,work_id,uploaded_by,path,kind,stage,preview_path,source,captured_at,filename,original_mime,bytes,issue_id,created_at",
        npi_work_members: "work_id,worker_id",
        npi_invitations:
          "id,company_id,role,created_by,created_at,expires_at,revoked,max_uses",
        npi_issues:
          "id,work_id,reporter_id,category,urgency,description,status,owner_id,resolution,created_at,updated_at,version,escalated_at",
        npi_issue_comments: "id,issue_id,actor_id,body,created_at",
        npi_work_history: "id,work_id,actor_id,event_time,action,detail",
        npi_notifications:
          "id,recipient_id,work_id,issue_id,title,message,event_key,created_at,read_at",
        npi_email_outbox:
          "id,work_id,issue_id,scope,recipient,subject,message,status,attempts,created_at,next_attempt,provider_id,error",
        npi_notification_settings:
          "scope,emails,escalation_minutes,updated_by,updated_at",
        npi_contracts: "id,name,client,reference,active",
        npi_contract_scopes: "id,contract_id,company_id,site_id,active",
        npi_audit: "id,actor_id,action,record_id,event_time",
        npi_profiles:
          "id,company_id,username,display_name,role,active,account_status,access_version",
        npi_sites:
          "id,name,address,timezone,photo_path,instructions,latitude,longitude,radius_metres,version",
        npi_tasks: "id,name,description,active,evidence_policy,version",
        npi_companies: "id,name,active,version",
        npi_work_orders:
          "id,contract_id,company_id,site_id,task_id,planned_date,equipment,title,kind,status,review_note,version,created_by,created_at,area,instructions,evidence_policy,outcome,outcome_reason,evidence_exception_reason,checklist,completed_tasks,loads,repeat_group",
        npi_attendance_events:
          "id,work_id,worker_id,captured_by,event_kind,device_time,received_at,latitude,longitude,accuracy_metres,break_minutes,idempotency_key",
        npi_hour_reviews:
          "id,work_id,worker_id,claimed_minutes,accepted_minutes,company_reviewer,npi_reviewer,reason,version",
        npi_sync_changes:
          "id,record_table,record_id,expected_version,proposal,status,message,received_at",
      };
      if (body.operation === "sheet_export") {
        const table = body.table;
        if (!Object.hasOwn(fields, table))
          return json({ error: "Unsupported table" }, 400, allowed);
        const offset = Number(body.offset || 0);
        if (!Number.isInteger(offset) || offset < 0 || offset > 100000)
          return json({ error: "Invalid page" }, 400, allowed);
        const rows =
          table === "npi_hour_reviews"
            ? await service("/rest/v1/rpc/npi_sheet_hour_reviews", {
                method: "POST",
                body: { p_offset: offset },
              })
            : await service(
                "/rest/v1/" +
                  table +
                  "?select=" +
                  fields[table] +
                  "&order=" +
                  (table === "npi_work_members"
                    ? "work_id,worker_id"
                    : table === "npi_notification_settings"
                      ? "scope"
                      : "id") +
                  "&limit=1000&offset=" +
                  offset,
              );
        return json({ rows, more: rows.length === 1000 }, 200, allowed);
      }
      const change = body.change;
      const permitted = {
        npi_sites: ["name", "address"],
        npi_work_orders: ["planned_date", "equipment"],
      };
      if (
        !change ||
        !Object.hasOwn(permitted, change.record_table) ||
        !uuid(change.id) ||
        !uuid(change.record_id) ||
        !Number.isInteger(change.expected_version) ||
        change.expected_version < 1 ||
        !change.proposal ||
        typeof change.proposal !== "object" ||
        Array.isArray(change.proposal) ||
        Object.keys(change.proposal).some(
          (k) => !permitted[change.record_table].includes(k),
        )
      )
        return json(
          { error: "Invalid proposal; protected fields cannot be edited" },
          400,
          allowed,
        );
      const record = {
        id: change.id,
        record_table: change.record_table,
        record_id: change.record_id,
        expected_version: change.expected_version,
        proposal: change.proposal,
      };
      const existing = await service(
        "/rest/v1/npi_sync_changes?id=eq." +
          change.id +
          "&select=id,record_table,record_id,expected_version,proposal",
      );
      if (existing.length) {
        const before = existing[0];
        if (
          before.record_table !== record.record_table ||
          before.record_id !== record.record_id ||
          before.expected_version !== record.expected_version ||
          JSON.stringify(Object.entries(before.proposal).sort()) !==
            JSON.stringify(Object.entries(record.proposal).sort())
        )
          return json(
            { error: "Change identifier already used" },
            409,
            allowed,
          );
        return json({ id: record.id, duplicate: true }, 200, allowed);
      }
      await service("/rest/v1/npi_sync_changes", {
        method: "POST",
        body: record,
      });
      return json({ id: record.id, status: "pending" }, 200, allowed);
    }
    if (!["create_user", "reset_password"].includes(body.operation))
      return json({ error: "Unknown operation" }, 400, allowed);
    const bearer = request.headers.get("authorization");
    if (!bearer?.startsWith("Bearer "))
      return json({ error: "Sign in required" }, 401, allowed);
    const verified = await fetcher(env.SUPABASE_URL + "/auth/v1/user", {
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: bearer },
      signal: AbortSignal.timeout(25000),
    });
    if (!verified.ok) return json({ error: "Invalid session" }, 401, allowed);
    const account = await verified.json();
    if (!uuid(account.id))
      return json({ error: "Invalid identity" }, 401, allowed);
    const [profile] = await service(
      "/rest/v1/npi_profiles?id=eq." +
        account.id +
        "&active=eq.true&select=role,company_id",
    );
    if (!profile || !["npi", "sub"].includes(profile.role))
      return json({ error: "Administrator required" }, 403, allowed);
    if (profile.role === "sub") {
      const activeCompany = await service(
        "/rest/v1/npi_companies?id=eq." +
          profile.company_id +
          "&active=eq.true&select=id",
      );
      if (!activeCompany.length)
        return json({ error: "Active company required" }, 403, allowed);
    }
    if (body.operation === "reset_password") {
      if (
        !uuid(body.id) ||
        typeof body.password !== "string" ||
        body.password.length < 12 ||
        new TextEncoder().encode(body.password).length > 72
      )
        return json(
          { error: "Choose an account and a 12–72 character password" },
          400,
          allowed,
        );
      const [target] = await service(
        "/rest/v1/npi_profiles?id=eq." + body.id + "&select=id,role,company_id",
      );
      if (
        !target ||
        target.role === "npi" ||
        (profile.role === "sub" &&
          (target.role !== "worker" ||
            target.company_id !== profile.company_id))
      )
        return json({ error: "Account access denied" }, 403, allowed);
      await service("/auth/v1/admin/users/" + target.id, {
        method: "PUT",
        body: { password: body.password },
      });
      await service("/rest/v1/npi_audit", {
        method: "POST",
        body: {
          actor_id: account.id,
          action: "reset_password",
          record_id: target.id,
        },
      });
      return json({ id: target.id }, 200, allowed);
    }
    if (
      !/^[a-z0-9][a-z0-9._-]{2,49}$/.test(body.username || "") ||
      typeof body.password !== "string" ||
      body.password.length < 12 ||
      new TextEncoder().encode(body.password).length > 72 ||
      typeof body.display_name !== "string" ||
      body.display_name.trim().length < 1 ||
      body.display_name.length > 150 ||
      !["sub", "worker"].includes(body.role) ||
      !uuid(body.company_id)
    )
      return json(
        {
          error:
            "Check username, name, company, role and password (12–72 characters)",
        },
        400,
        allowed,
      );
    if (
      profile.role === "sub" &&
      (body.role !== "worker" || body.company_id !== profile.company_id)
    )
      return json(
        { error: "Company administrators can create only their own workers" },
        403,
        allowed,
      );
    const companies = await service(
      "/rest/v1/npi_companies?id=eq." +
        body.company_id +
        "&active=eq.true&select=id",
    );
    if (!companies.length)
      return json({ error: "Choose an active company" }, 400, allowed);
    const created = await service("/auth/v1/admin/users", {
      method: "POST",
      body: {
        email: body.username + "@users.npi6030.com",
        password: body.password,
        email_confirm: true,
        user_metadata: { display_name: body.display_name },
      },
    });
    try {
      await service("/rest/v1/npi_profiles", {
        method: "POST",
        body: {
          id: created.id,
          username: body.username,
          display_name: body.display_name.trim(),
          role: body.role,
          company_id: body.company_id,
          active: true,
        },
      });
    } catch {
      await service("/auth/v1/admin/users/" + created.id, { method: "DELETE" });
      throw Error("Account profile could not be created");
    }
    return json({ id: created.id, username: body.username }, 200, allowed);
  } catch {
    return json(
      {
        error:
          "The operation could not be completed. Check setup and existing records before retrying.",
      },
      400,
      allowed,
    );
  }
}
