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
    return url.includes("/token?") ||
      JSON.parse(opts.body || "{}").operation === "login"
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
    operation: "login",
    username: "alex.morgan",
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
  assert.equal(r.status, 410);
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
  assert.equal(r.status, 410);
  assert.equal(calls, 0);
});
test("upload retry keeps one object and one evidence command identity after uncertain acknowledgement", async () => {
  const commands = [];
  let objects = 0;
  const api = new LiveAPI(async (url, opts) => {
    if (url.endsWith("/npi_live_snapshot"))
      return json({ profile: { id: user, role: "worker" } });
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
test("legacy provisioning cannot set passwords or mutate Auth even with an admin session", async () => {
  let calls = 0;
  const r = await handleAdmin(
    new Request("https://edge.test", {
      method: "POST",
      headers: { Authorization: "Bearer verified" },
      body: JSON.stringify({
        operation: "create_user",
        password: "private-password",
      }),
    }),
    {
      SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "server-test",
    },
    async () => {
      calls++;
      return json({});
    },
  );
  assert.equal(r.status, 410);
  assert.equal(calls, 0);
  assert.ok(!(await r.text()).includes("private-password"));
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
test("email dispatcher requires workbook authorization and server sender configuration", async () => {
  const env = {
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "server-only",
    NPI_SHEETS_TOKEN: "s".repeat(48),
    NPI_SHEETS_ID: "book",
  };
  const request = (token = "bad") =>
    new Request("https://edge.test", {
      method: "POST",
      headers: { "x-npi-sheet-token": token },
      body: JSON.stringify({
        operation: "email_dispatch",
        spreadsheetId: "book",
      }),
    });
  let calls = 0;
  const fetcher = async () => {
    calls++;
    return json({});
  };
  assert.equal((await handleAdmin(request(), env, fetcher)).status, 403);
  assert.equal(calls, 0);
  assert.equal(
    (await handleAdmin(request(env.NPI_SHEETS_TOKEN), env, fetcher)).status,
    503,
  );
  assert.equal(calls, 0);
});
test("email sends use durable provider idempotency and record accepted delivery separately", async () => {
  const env = {
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "server-only",
    NPI_SHEETS_TOKEN: "s".repeat(48),
    NPI_SHEETS_ID: "book",
    NPI_EMAIL_API_KEY: "test-provider-only",
    NPI_EMAIL_FROM: "NPI <alerts@example.test>",
  };
  const job = {
    id: crypto.randomUUID(),
    recipient: "manager@example.test",
    subject: "Issue reported",
    message: "Inspect the work",
    work_id: user,
  };
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/npi_email_claim")) return json([job]);
    if (url === "https://api.resend.com/emails")
      return json({ id: "provider-accepted" });
    return json(null);
  };
  const response = await handleAdmin(
    new Request("https://edge.test", {
      method: "POST",
      headers: { "x-npi-sheet-token": env.NPI_SHEETS_TOKEN },
      body: JSON.stringify({
        operation: "email_dispatch",
        spreadsheetId: "book",
      }),
    }),
    env,
    fetcher,
  );
  assert.equal(response.status, 200);
  const provider = calls.find((c) =>
    c.url.startsWith("https://api.resend.com"),
  );
  assert.equal(provider.options.headers["Idempotency-Key"], job.id);
  const result = JSON.parse(
    calls.find((c) => c.url.endsWith("/npi_email_result")).options.body,
  );
  assert.equal(result.p_sent, true);
  assert.equal(result.p_provider, "provider-accepted");
  assert.equal(
    JSON.parse(provider.options.body).text.includes(
      "Private evidence requires",
    ),
    true,
  );
});
test("a late refresh response never overwrites a newer signed-in account", async () => {
  let release;
  const pending = new Promise((r) => (release = r));
  const api = new LiveAPI(async () => pending);
  api.remember({
    access_token: "old",
    refresh_token: "old-refresh",
    expires_in: 3600,
  });
  const refresh = api.refresh().catch((e) => e);
  api.remember({
    access_token: "new",
    refresh_token: "new-refresh",
    expires_in: 3600,
  });
  release(
    json({
      access_token: "old-renewed",
      refresh_token: "old-renewed-refresh",
      expires_in: 3600,
    }),
  );
  await refresh;
  assert.equal(api.session.access_token, "new");
});
test("a stale authenticated failure cannot clear a newer account session", async () => {
  let release;
  const pending = new Promise((r) => (release = r));
  const api = new LiveAPI(async () => pending);
  api.remember({
    access_token: "old",
    refresh_token: "old-refresh",
    expires_in: 3600,
  });
  const request = api.snapshot().catch((e) => e);
  api.remember({
    access_token: "new",
    refresh_token: "new-refresh",
    expires_in: 3600,
  });
  release(json({ error: "Expired old request" }, 401));
  await request;
  assert.equal(api.session.access_token, "new");
});
test("sign-out clears local access before network completion and cannot clear a subsequent login", async () => {
  let release;
  const pending = new Promise((r) => (release = r));
  const api = new LiveAPI(async () => pending);
  api.remember({
    access_token: "old",
    refresh_token: "old-refresh",
    expires_in: 3600,
  });
  const logout = api.logout();
  assert.equal(api.session, null);
  api.remember({
    access_token: "new",
    refresh_token: "new-refresh",
    expires_in: 3600,
  });
  release(json({}));
  await logout;
  assert.equal(api.session.access_token, "new");
});
test("automatic snow reading fails safely without configuration and never invents inches", async () => {
  const req = new Request("https://example.test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operation: "snow_read", evidence_id: user }),
  });
  const r = await handleAdmin(
    req,
    {
      SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "server-only",
    },
    () => {
      throw Error("Must not call provider");
    },
  );
  assert.equal(r.status, 503);
  assert.match((await r.json()).error, /manually/);
});
test("automatic snow reading requires scoped reservation and explicit confirmation", async () => {
  let providerCalls = 0;
  const req = new Request("https://example.test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer worker",
    },
    body: JSON.stringify({ operation: "snow_read", evidence_id: user }),
  });
  const r = await handleAdmin(
    req,
    {
      SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "server-only",
      NPI_VISION_API_KEY: "vision-secret",
    },
    async (url, opts) => {
      if (url.endsWith("/npi_snow_read_reserve")) {
        assert.equal(opts.headers.Authorization, "Bearer worker");
        return json({ path: "work/worker/ruler-stamped.jpg" });
      }
      if (url.includes("/object/sign/"))
        return json({
          signedURL:
            "/object/sign/work-evidence/work/worker/ruler-stamped.jpg?token=test",
        });
      if (url === "https://api.openai.com/v1/chat/completions") {
        providerCalls++;
        return json({
          choices: [
            { message: { content: '{"inches":3.4,"confidence":0.9}' } },
          ],
        });
      }
      throw Error(url);
    },
  );
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), {
    inches: 3.4,
    requires_confirmation: true,
  });
  assert.equal(providerCalls, 1);
});
