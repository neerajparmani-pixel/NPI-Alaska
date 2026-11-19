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
    if (!res.ok) throw Error("Server data operation failed");
    return data;
  };
  try {
    if (
      body.operation === "sheet_export" ||
      body.operation === "sheet_propose"
    ) {
      if (
        !(await sameSecret(
          request.headers.get("x-npi-sheet-token"),
          env.NPI_SHEETS_TOKEN,
        )) ||
        body.spreadsheetId !== env.NPI_SHEETS_ID
      )
        return json({ error: "Workbook authorization failed" }, 403, allowed);
      const fields = {
        npi_audit: "id,actor_id,action,record_id,event_time",
        npi_profiles: "id,company_id,username,display_name,role,active",
        npi_sites: "id,name,address,timezone,photo_path,version",
        npi_tasks: "id,name,description,active,version",
        npi_companies: "id,name,active,version",
        npi_rates:
          "id,side,company_id,site_id,task_id,basis,amount_cents,currency,effective_from,effective_through,version",
        npi_work_orders:
          "id,company_id,site_id,task_id,planned_date,equipment,title,status,version",
        npi_attendance_events:
          "id,work_id,worker_id,event_kind,device_time,received_at,latitude,longitude,accuracy_metres,break_minutes",
        npi_hour_reviews:
          "id,work_id,worker_id,claimed_minutes,accepted_minutes,company_reviewer,npi_reviewer,reason,version",
        npi_documents:
          "id,kind,company_id,reference,status,subtotal_cents,tax_cents,total_cents,currency,version",
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
                  "&order=id&limit=1000&offset=" +
                  offset,
              );
        return json({ rows, more: rows.length === 1000 }, 200, allowed);
      }
      const change = body.change;
      const permitted = {
        npi_sites: ["name", "address"],
        npi_work_orders: ["planned_date", "equipment"],
        npi_rates: [
          "side",
          "company_id",
          "site_id",
          "task_id",
          "basis",
          "amount_cents",
          "effective_from",
          "effective_through",
        ],
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
          (k) => !Object.hasOwn(permitted, change.record_table).includes(k),
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
