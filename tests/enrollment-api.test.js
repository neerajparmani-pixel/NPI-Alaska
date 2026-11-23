import { test } from "node:test";
import assert from "node:assert/strict";
import { handleAdmin } from "../supabase/functions/npi-admin/handler.js";
const env = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "private-server-value",
  NPI_EMAIL_API_KEY: "email-test-only",
  NPI_EMAIL_FROM: "NPI <npi@example.test>",
};
const request = (body) =>
  new Request("https://edge.test", {
    method: "POST",
    headers: { origin: "https://alaska.npi6030.com" },
    body: JSON.stringify(body),
  });
const response = (v, status = 200) => Response.json(v, { status });
const form = () => ({
  operation: "register_invitation",
  token: "a".repeat(64),
  request_id: crypto.randomUUID(),
  username: "alex.test",
  display_name: "Alex",
  password: "safe-password-123",
});
function fixture(options = {}) {
  const calls = [],
    user = crypto.randomUUID();
  return {
    calls,
    user,
    fetch: async (url, opts) => {
      const b = JSON.parse(opts.body || "{}");
      calls.push({ url, body: b });
      if (url.endsWith("/npi_public_gate"))
        return response(options.throttled ? false : true);
      if (url.endsWith("/npi_enroll")) {
        if (options.unavailable)
          return response({ message: "Invitation unavailable" }, 400);
        if (b.p_mode === "begin")
          return response({
            complete: false,
            role: "worker",
            email: "alex@example.test",
            ...(options.resume ? { user_id: user } : {}),
          });
        if (b.p_mode === "finish")
          return response({ status: "verify-email", user_id: user });
        return response({});
      }
      if (url.endsWith("/admin/users")) return response({ id: user });
      if (url.endsWith("/npi_identity")) {
        if (b.p_mode === "resolve")
          return response({
            id: user,
            email: "alex@example.test",
            confirmed: true,
          });
        if (b.p_mode === "issue")
          return response({ email: "alex@example.test" });
        if (b.p_mode === "verify")
          return response({ user_id: user, complete: false });
        return response({ status: "pending" });
      }
      if (url.endsWith("/admin/users/" + user)) return response({ id: user });
      if (url === "https://api.resend.com/emails")
        return response(
          options.emailFailure ? {} : { id: "email-id" },
          options.emailFailure ? 503 : 200,
        );
      throw Error("Unexpected call " + url);
    },
  };
}
test("signup uses the invitation email, leaves Auth unconfirmed and never accepts a client role/company", async () => {
  const f = fixture();
  const r = await handleAdmin(
    request({
      ...form(),
      role: "npi",
      company_id: crypto.randomUUID(),
      email: "attacker@example.test",
    }),
    env,
    f.fetch,
  );
  assert.equal(r.status, 200);
  assert.equal((await r.json()).status, "verify-email");
  const auth = f.calls.find((c) => c.url.endsWith("/admin/users")).body;
  assert.equal(auth.email, "alex@example.test");
  assert.equal(auth.email_confirm, false);
  assert.equal(auth.password, "safe-password-123");
  assert.ok(
    f.calls
      .filter((c) => c.url.includes("/rest/"))
      .every((c) => !JSON.stringify(c.body).includes("safe-password-123")),
  );
  const begin = f.calls.find((c) => c.body.p_mode === "begin").body;
  assert.equal(begin.p_role, undefined);
  assert.equal(begin.p_company, undefined);
});
test("a recoverable Auth response reuses the reserved identity without changing its password", async () => {
  const f = fixture({ resume: true });
  const r = await handleAdmin(request(form()), env, f.fetch);
  assert.equal(r.status, 200);
  assert.equal(f.calls.filter((c) => c.url.includes("/admin/users")).length, 0);
  assert.equal(
    f.calls.find((c) => c.body.p_mode === "finish").body.p_user,
    f.user,
  );
});
test("invalid and unavailable invitations do not create Auth users", async () => {
  const f = fixture({ unavailable: true });
  assert.equal((await handleAdmin(request(form()), env, f.fetch)).status, 409);
  assert.ok(!f.calls.some((c) => c.url.endsWith("/admin/users")));
  assert.equal(
    (await handleAdmin(request({ ...form(), token: "bad" }), env, f.fetch))
      .status,
    400,
  );
});
test("email delivery failure keeps a pending account and offers resend rather than creating duplicate identities", async () => {
  const f = fixture({ emailFailure: true });
  const r = await handleAdmin(request(form()), env, f.fetch);
  assert.equal(r.status, 200);
  const v = await r.json();
  assert.equal(v.status, "verify-email");
  assert.equal(v.email_sent, false);
  assert.equal(f.calls.filter((c) => c.url.endsWith("/admin/users")).length, 1);
});
test("unconfigured email blocks account creation with actionable 503", async () => {
  const f = fixture();
  const r = await handleAdmin(
    request(form()),
    { ...env, NPI_EMAIL_API_KEY: "" },
    f.fetch,
  );
  assert.equal(r.status, 503);
  assert.ok(!f.calls.some((c) => c.url.endsWith("/admin/users")));
});
test("verification confirms only the server-resolved identity and then enters pending approval", async () => {
  const f = fixture();
  const r = await handleAdmin(
    request({
      operation: "verify_email",
      token: "a".repeat(64),
      user_id: crypto.randomUUID(),
    }),
    env,
    f.fetch,
  );
  assert.equal(r.status, 200);
  assert.equal((await r.json()).status, "pending");
  assert.equal(
    f.calls.find((c) => c.url.endsWith("/admin/users/" + f.user)).body
      .email_confirm,
    true,
  );
});
test("public invitation throttling returns 429 before provisioning", async () => {
  const f = fixture({ throttled: true });
  const r = await handleAdmin(
    request({ operation: "invite_preview", token: "a".repeat(64) }),
    env,
    f.fetch,
  );
  assert.equal(r.status, 429);
  assert.equal(r.headers.get("Retry-After"), "60");
  assert.ok(!f.calls.some((c) => c.url.endsWith("/admin/users")));
});
test("invalid canonical UUID registration never provisions a user", async () => {
  const f = fixture();
  const r = await handleAdmin(
    request({ ...form(), request_id: "12345678-1234-1234-1234-12345678901-" }),
    env,
    f.fetch,
  );
  assert.equal(r.status, 400);
  assert.ok(!f.calls.some((c) => c.url.endsWith("/admin/users")));
});
test("administrators cannot use legacy endpoints to choose another person’s password", async () => {
  for (const operation of ["create_user", "reset_password"]) {
    const f = fixture();
    const r = await handleAdmin(request({ operation }), env, f.fetch);
    assert.equal(r.status, 410);
    assert.equal(f.calls.length, 0);
  }
});

test("password recovery sends a managed link privately and uses the same response for unknown accounts", async () => {
  const f = fixture();
  const send = async (url, opts) =>
    url.endsWith("/admin/generate_link")
      ? response({
          action_link:
            env.SUPABASE_URL +
            "/auth/v1/verify?token=private-test&type=recovery",
        })
      : f.fetch(url, opts);
  const known = await handleAdmin(
    request({ operation: "recover_password", email: "alex@example.test" }),
    env,
    send,
  );
  assert.equal(known.status, 200);
  const a = await known.json();
  assert.ok(!JSON.stringify(a).includes("private-test"));
  assert.ok(
    f.calls
      .find((c) => c.url === "https://api.resend.com/emails")
      .body.text.includes("private-test"),
  );
  const g = fixture();
  const unknown = await handleAdmin(
    request({ operation: "recover_password", email: "nobody@example.test" }),
    env,
    async (url, opts) =>
      url.endsWith("/npi_identity") ? response({}) : g.fetch(url, opts),
  );
  assert.deepEqual(await unknown.json(), a);
  assert.ok(!g.calls.some((c) => c.url.includes("resend.com")));
});
test("expired verification cannot confirm an arbitrary Auth identity", async () => {
  const f = fixture();
  const r = await handleAdmin(
    request({ operation: "verify_email", token: "a".repeat(64) }),
    env,
    async (url, opts) =>
      url.endsWith("/npi_identity")
        ? response({ message: "Verification expired" }, 400)
        : f.fetch(url, opts),
  );
  assert.equal(r.status, 400);
  assert.ok(!f.calls.some((c) => c.url.includes("/admin/users/")));
});
test("database schema faults return 503 with a request identifier rather than a misleading client 400", async () => {
  const token = "s".repeat(48);
  const r = await handleAdmin(
    new Request("https://edge.test", {
      method: "POST",
      headers: { "x-npi-sheet-token": token },
      body: JSON.stringify({
        operation: "sheet_export",
        spreadsheetId: "test-book",
        table: "npi_work_orders",
      }),
    }),
    { ...env, NPI_SHEETS_TOKEN: token, NPI_SHEETS_ID: "test-book" },
    async () =>
      response({ code: "42703", message: "private internal SQL detail" }, 400),
  );
  assert.equal(r.status, 503);
  const result = await r.json();
  assert.match(result.request_id, /^[0-9a-f-]{36}$/);
  assert.ok(!JSON.stringify(result).includes("private internal"));
});
