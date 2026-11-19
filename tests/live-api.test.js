import { test } from "node:test";
import assert from "node:assert/strict";
import { LiveAPI } from "../public/live/api.js";
import { handleAdmin } from "../supabase/functions/npi-admin/handler.js";
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status });
const user = "10000000-0000-0000-0000-000000000003";
test("live API authenticates through Supabase and never grants a preview role", async () => {
  const calls = [];
  const api = new LiveAPI(async (url, opts) => {
    calls.push({ url, opts });
    if (url.endsWith("/npi_account_status"))
      return json({ status: "approved" });
    return url.includes("/token?")
      ? json({
          access_token: "access",
          refresh_token: "refresh",
          expires_in: 3600,
        })
      : json({ profile: { id: user, role: "worker" }, work: [] });
  });
  const data = await api.login("alex.morgan", "private-pass");
  assert.equal(data.profile.role, "worker");
  assert.deepEqual(JSON.parse(calls[0].opts.body), {
    email: "alex.morgan@users.npi6030.com",
    password: "private-pass",
  });
  assert.equal(calls[2].opts.headers.Authorization, "Bearer access");
  await api.action(
    "tasks",
    { id: user, version: 1 },
    "90000000-0000-0000-0000-000000000001",
  );
  assert.equal(JSON.parse(calls[3].opts.body).p_action, "tasks");
  await api.logout();
  assert.equal(api.session, null);
});
test("live API fails closed and expires sessions on failed authentication", async () => {
  const api = new LiveAPI(async () => json({ error: "invalid login" }, 400));
  await assert.rejects(api.login("alex", "bad"), /Unable to sign in/);
  assert.equal(api.session, null);
  await assert.rejects(api.snapshot(), /Sign in/);
});
test("admin edge function rejects wrong origins and unauthenticated provisioning", async () => {
  const env = {
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "server-only",
  };
  let calls = 0;
  const fetcher = async () => {
    calls++;
    return json({}, 401);
  };
  let r = await handleAdmin(
    new Request("https://edge.test", {
      method: "POST",
      headers: { origin: "https://foreign.test" },
      body: "{}",
    }),
    env,
    fetcher,
  );
  assert.equal(r.status, 403);
  assert.equal(calls, 0);
  r = await handleAdmin(
    new Request("https://edge.test", {
      method: "POST",
      body: JSON.stringify({ operation: "create_user" }),
    }),
    env,
    fetcher,
  );
  assert.equal(r.status, 401);
  assert.equal(calls, 0);
});
test("sheet bridge rejects protected fields and wrong workbook before service mutation", async () => {
  const env = {
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "server-only",
    NPI_SHEETS_TOKEN: "a".repeat(48),
    NPI_SHEETS_ID: "our-sheet",
  };
  const request = (body) =>
    new Request("https://edge.test", {
      method: "POST",
      headers: { "x-npi-sheet-token": env.NPI_SHEETS_TOKEN },
      body: JSON.stringify(body),
    });
  let calls = 0;
  const fetcher = async () => {
    calls++;
    return json([]);
  };
  let r = await handleAdmin(
    request({
      operation: "sheet_export",
      spreadsheetId: "other",
      table: "npi_sites",
    }),
    env,
    fetcher,
  );
  assert.equal(r.status, 403);
  r = await handleAdmin(
    request({
      operation: "sheet_propose",
      spreadsheetId: "our-sheet",
      change: {
        id: user,
        record_id: user,
        record_table: "npi_profiles",
        expected_version: 1,
        proposal: { role: "npi" },
      },
    }),
    env,
    fetcher,
  );
  assert.equal(r.status, 400);
  assert.equal(calls, 0);
  r = await handleAdmin(
    request({
      operation: "sheet_export",
      spreadsheetId: "our-sheet",
      table: "auth.users",
    }),
    env,
    fetcher,
  );
  assert.equal(r.status, 400);
});
test("subcontractor admins cannot provision another company or another admin", async () => {
  const env = {
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "server-only",
  };
  let calls = 0;
  const fetcher = async (url) => {
    calls++;
    return url.includes("/auth/v1/user")
      ? json({ id: user })
      : json([{ role: "sub", company_id: user }]);
  };
  const request = new Request("https://edge.test", {
    method: "POST",
    headers: { Authorization: "Bearer verified-session" },
    body: JSON.stringify({
      operation: "create_user",
      username: "alex.morgan",
      display_name: "Alex",
      password: "long-private-password",
      company_id: user,
      role: "sub",
    }),
  });
  const r = await handleAdmin(request, env, fetcher);
  assert.equal(r.status, 403);
  assert.equal(calls, 3);
});
test("upload retry keeps one object and one evidence command identity after uncertain acknowledgement", async () => {
  const commands = [];
  let objects = 0;
  const api = new LiveAPI(async (url, opts) => {
    if (url.endsWith("/npi_live_snapshot"))
      return json({ profile: { id: user } });
    if (url.includes("/storage/v1/object/")) {
      objects++;
      return json({ Key: "stored" });
    }
    if (url.endsWith("/npi_live_action")) {
      commands.push(JSON.parse(opts.body));
      return commands.length === 1
        ? json({ message: "Temporary failure" }, 500)
        : json({ id: user });
    }
    return json({});
  });
  api.remember({
    access_token: "test",
    refresh_token: "test",
    expires_in: 3600,
  });
  const file = new File([new Uint8Array([137, 80, 78, 71])], "photo.png", {
    type: "image/png",
  });
  const work = { id: "50000000-0000-0000-0000-000000000001", version: 2 };
  await assert.rejects(api.upload(work, file, "photo"), /Temporary failure/);
  await api.upload(work, file, "photo");
  assert.equal(objects, 1);
  assert.equal(commands.length, 2);
  assert.equal(commands[0].p_request, commands[1].p_request);
});
test("account provisioning rolls back a new Auth identity if profile creation fails", async () => {
  const employee = "10000000-0000-0000-0000-000000000009";
  const company = "20000000-0000-0000-0000-000000000001";
  const calls = [];
  const env = {
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "private-server-value",
  };
  const fetcher = async (url, opts) => {
    calls.push({ url, opts });
    if (url.endsWith("/auth/v1/user")) return json({ id: user });
    if (url.includes("/npi_profiles?"))
      return json([{ role: "npi", company_id: null }]);
    if (url.includes("/npi_companies?")) return json([{ id: company }]);
    if (url.endsWith("/auth/v1/admin/users")) return json({ id: employee });
    if (url.endsWith("/rest/v1/npi_profiles"))
      return json({ message: "DB unavailable" }, 500);
    if (opts.method === "DELETE") return json({});
    return json({});
  };
  const res = await handleAdmin(
    new Request("https://edge.test", {
      method: "POST",
      headers: { Authorization: "Bearer verified" },
      body: JSON.stringify({
        operation: "create_user",
        username: "new.worker",
        display_name: "Test worker",
        password: "not-for-persistence",
        role: "worker",
        company_id: company,
      }),
    }),
    env,
    fetcher,
  );
  assert.equal(res.status, 400);
  assert.equal(
    calls.at(-1).url,
    env.SUPABASE_URL + "/auth/v1/admin/users/" + employee,
  );
  assert.equal(calls.at(-1).opts.method, "DELETE");
  assert.ok(!(await res.text()).includes("not-for-persistence"));
});

test("sheet bridge accepts permitted planning proposals and rejects finance in the operations release", async () => {
  const env = {
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "server-only",
    NPI_SHEETS_TOKEN: "a".repeat(48),
    NPI_SHEETS_ID: "our-sheet",
  };
  const change = {
    id: crypto.randomUUID(),
    record_id: crypto.randomUUID(),
    record_table: "npi_work_orders",
    expected_version: 1,
    proposal: { equipment: "Loader 02", planned_date: "2026-11-19" },
  };
  const req = (c) =>
    new Request("https://edge.test", {
      method: "POST",
      headers: { "x-npi-sheet-token": env.NPI_SHEETS_TOKEN },
      body: JSON.stringify({
        operation: "sheet_propose",
        spreadsheetId: "our-sheet",
        change: c,
      }),
    });
  let writes = 0;
  const fetcher = async (url, options) => {
    if (options.method === "POST") writes++;
    return json([]);
  };
  const accepted = await handleAdmin(req(change), env, fetcher);
  assert.equal(accepted.status, 200);
  assert.equal(writes, 1);
  const rejected = await handleAdmin(
    req({
      ...change,
      record_table: "npi_rates",
      proposal: { amount_cents: 2000 },
    }),
    env,
    fetcher,
  );
  assert.equal(rejected.status, 400);
  assert.equal(writes, 1);
});
