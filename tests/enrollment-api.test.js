import { test } from "node:test";
import assert from "node:assert/strict";
import { handleAdmin } from "../supabase/functions/npi-admin/handler.js";
const env = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "private-server-value",
};
const request = (body) =>
  new Request("https://edge.test", {
    method: "POST",
    headers: { origin: "https://alaska.npi6030.com" },
    body: JSON.stringify(body),
  });
const response = (value, status = 200) =>
  new Response(JSON.stringify(value), { status });
test("invitation registration hashes the link, creates managed identity and never accepts client role/company", async () => {
  const calls = [];
  let newId = crypto.randomUUID();
  const result = await handleAdmin(
    request({
      operation: "register_invitation",
      token: "a".repeat(64),
      request_id: crypto.randomUUID(),
      username: "alex.test",
      display_name: "Alex",
      password: "safe-password-123",
      role: "npi",
      company_id: crypto.randomUUID(),
    }),
    env,
    async (url, opts) => {
      if (url.endsWith("/npi_public_gate")) return response(true);
      const body = JSON.parse(opts.body);
      calls.push({ url, body });
      if (url.endsWith("/admin/users")) return response({ id: newId });
      if (body.p_mode === "begin")
        return response({ role: "worker", complete: false });
      if (body.p_mode === "finish") return response({ status: "pending" });
      throw Error("Unexpected call");
    },
  );
  assert.equal(result.status, 200);
  assert.equal((await result.json()).status, "pending");
  const auth = calls.find((c) => c.url.endsWith("/admin/users")).body;
  assert.equal(auth.email, "alex.test@users.npi6030.com");
  assert.equal(auth.email_confirm, true);
  assert.equal(auth.app_metadata.npi_enrollment_id, calls[0].body.p_request);
  assert.equal(calls[0].body.p_hash.length, 64);
  assert.notEqual(calls[0].body.p_hash, "a".repeat(64));
  assert.ok(!("p_role" in calls[0].body));
  assert.ok(!("p_company" in calls[0].body));
  assert.ok(
    calls
      .filter((c) => c.url.includes("/rest/"))
      .every((c) => !JSON.stringify(c.body).includes("safe-password-123")),
  );
});
test("unavailable invitation blocks account creation and malformed registration never calls a service", async () => {
  let creates = 0;
  const result = await handleAdmin(
    request({
      operation: "register_invitation",
      token: "a".repeat(64),
      request_id: crypto.randomUUID(),
      username: "alex.test",
      display_name: "Alex",
      password: "safe-password-123",
    }),
    env,
    async (url) => {
      if (url.endsWith("/npi_public_gate")) return response(true);
      if (url.includes("/admin/users")) creates++;
      return response({ message: "Invitation unavailable" }, 400);
    },
  );
  assert.equal(result.status, 400);
  assert.equal(creates, 0);
  const invalid = await handleAdmin(
    request({ operation: "register_invitation", token: "bad" }),
    env,
    async (url) => {
      if (url.endsWith("/npi_public_gate")) return response(true);
      throw Error("Must not create accounts");
    },
  );
  assert.equal(invalid.status, 400);
});
test("resume after uncertain Auth response reuses the reserved identity without resetting its password", async () => {
  let creates = 0;
  const existing = crypto.randomUUID();
  const result = await handleAdmin(
    request({
      operation: "register_invitation",
      token: "b".repeat(64),
      request_id: crypto.randomUUID(),
      username: "alex.test",
      display_name: "Alex",
      password: "safe-password-123",
    }),
    env,
    async (url, opts) => {
      if (url.endsWith("/npi_public_gate")) return response(true);
      if (url.includes("/admin/users")) creates++;
      const b = JSON.parse(opts.body);
      return response(
        b.p_mode === "begin"
          ? { user_id: existing, role: "worker" }
          : { status: "pending" },
      );
    },
  );
  assert.equal(result.status, 200);
  assert.equal(creates, 0);
});

test("public invite throttling returns 429 and malformed canonical UUID never reaches provisioning", async () => {
  let provision = 0;
  const throttled = await handleAdmin(
    request({ operation: "invite_preview", token: "a".repeat(64) }),
    env,
    async (url) => {
      if (url.endsWith("npi_public_gate")) return response(false);
      provision++;
      return response({});
    },
  );
  assert.equal(throttled.status, 429);
  assert.equal(provision, 0);
  const malformed = await handleAdmin(
    request({
      operation: "register_invitation",
      token: "a".repeat(64),
      request_id: "12345678-1234-1234-1234-12345678901-",
      username: "alex.test",
      display_name: "Alex",
      password: "safe-password-123",
    }),
    env,
    async (url) => {
      if (url.endsWith("npi_public_gate")) return response(true);
      provision++;
      return response({});
    },
  );
  assert.equal(malformed.status, 400);
  assert.equal(provision, 0);
});
