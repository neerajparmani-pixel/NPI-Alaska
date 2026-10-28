import { test } from "node:test";
import assert from "node:assert/strict";
import { handleAuth, seal, unseal } from "../server/auth.js";
const env = {
  FIREBASE_PROJECT_ID: "npi-test-project",
  FIREBASE_WEB_API_KEY: "test-key-not-real",
  AUTH_COOKIE_KEY: Buffer.alloc(32, 17).toString("base64url"),
};
const req = (action, body, headers = {}) =>
  new Request(`https://npi.example/api/auth/${action}`, {
    method: body ? "POST" : "GET",
    headers: {
      Origin: "https://npi.example",
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
const credentials = {
  username: "Worker.One",
  password: "test-password-not-real",
};
test("auth fails closed without config, rejects foreign origins and wrong methods", async () => {
  assert.equal(
    (await handleAuth(req("login", credentials), {}, "login")).status,
    503,
  );
  assert.equal(
    (
      await handleAuth(
        req("login", credentials, { Origin: "https://other.example" }),
        env,
        "login",
      )
    ).status,
    403,
  );
  assert.equal((await handleAuth(req("login"), env, "login")).status, 405);
});
test("managed verification creates encrypted secure session, no plaintext password or refresh token retained", async () => {
  const response = await handleAuth(
    req("login", credentials),
    env,
    "login",
    async (url, options) => {
      assert.match(url, /identitytoolkit.googleapis.com/);
      const body = JSON.parse(options.body);
      assert.equal(body.email, "worker.one@npi-test-project.invalid");
      assert.equal(body.password, credentials.password);
      return Response.json({
        localId: "uid-worker",
        idToken: "sample-token",
        expiresIn: "3600",
        refreshToken: "not-retained",
      });
    },
  );
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly; Secure; SameSite=Strict/);
  assert.ok(
    !cookie.includes(credentials.password) && !cookie.includes("sample-token"),
  );
  const session = await unseal(cookie.split(";")[0].split("=")[1], env);
  assert.equal(session.uid, "uid-worker");
  assert.equal(session.refreshToken, undefined);
  assert.deepEqual(await response.json(), { ok: true });
});
test("session rejects tampering, expiry and wrong encryption keys", async () => {
  const value = await seal(
    { uid: "a", idToken: "token", expiresAt: Date.now() + 60000 },
    env,
  );
  assert.equal(
    await unseal(value, {
      ...env,
      AUTH_COOKIE_KEY: Buffer.alloc(32, 18).toString("base64url"),
    }),
    null,
  );
  assert.equal(await unseal("x" + value, env), null);
  const expired = await seal(
    { uid: "a", idToken: "token", expiresAt: Date.now() - 1 },
    env,
  );
  assert.equal(await unseal(expired, env), null);
});
test("session checks provider account state without granting work access", async () => {
  const value = await seal(
    {
      uid: "uid-worker",
      username: "worker.one",
      idToken: "token",
      issuedAt: Date.now() - 10000,
      expiresAt: Date.now() + 60000,
    },
    env,
  );
  const request = () =>
    req("session", null, { Cookie: "__Host-npi-session=" + value });
  const lookup = (user) => async () =>
    Response.json({ users: [{ localId: "uid-worker", ...user }] });
  const result = await handleAuth(
    request(),
    env,
    "session",
    lookup({ displayName: "Worker One" }),
  );
  assert.equal(result.status, 200);
  assert.equal((await result.json()).workspaceReady, false);
  assert.equal(
    (await handleAuth(request(), env, "session", lookup({ disabled: true })))
      .status,
    401,
  );
  assert.equal(
    (
      await handleAuth(
        request(),
        env,
        "session",
        lookup({ validSince: String(Math.floor(Date.now() / 1000)) }),
      )
    ).status,
    401,
  );
});
test("generic login errors, network failures and logout", async () => {
  const response = await handleAuth(
    req("login", credentials),
    env,
    "login",
    async () =>
      Response.json({ error: { message: "EMAIL_NOT_FOUND" } }, { status: 400 }),
  );
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: "Username or password is incorrect.",
  });
  const failure = await handleAuth(
    req("login", credentials),
    env,
    "login",
    async () => {
      throw Error("private details");
    },
  );
  assert.equal(failure.status, 503);
  assert.ok(!(await failure.text()).includes("private details"));
  assert.match(
    (await handleAuth(req("logout", {}), env, "logout")).headers.get(
      "set-cookie",
    ),
    /Max-Age=0/,
  );
});
