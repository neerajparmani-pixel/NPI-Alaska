// Cloudflare Pages runtime. Passwords are verified by Firebase Authentication,
// never stored in Sheets or persisted by this app.
const COOKIE = "__Host-npi-session";
const LIMIT = 8192;
const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
const clearCookie = () =>
  `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
function configured(env) {
  return Boolean(
    env.FIREBASE_WEB_API_KEY &&
    /^[a-z][a-z0-9-]{4,29}$/.test(env.FIREBASE_PROJECT_ID || "") &&
    env.AUTH_COOKIE_KEY,
  );
}
function encode(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}
function decode(value) {
  const s = value.replaceAll("-", "+").replaceAll("_", "/");
  return Uint8Array.from(atob(s + "=".repeat((4 - (s.length % 4)) % 4)), (c) =>
    c.charCodeAt(0),
  );
}
async function encryptionKey(env) {
  const raw = decode(env.AUTH_COOKIE_KEY);
  if (raw.length !== 32) throw Error("Invalid session configuration");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}
export async function seal(session, env) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(COOKIE) },
    await encryptionKey(env),
    new TextEncoder().encode(JSON.stringify(session)),
  );
  return `${encode(iv)}.${encode(new Uint8Array(encrypted))}`;
}
export async function unseal(value, env) {
  try {
    if (!value || value.length > 7500) return null;
    const pieces = value.split(".");
    if (pieces.length !== 2) return null;
    const raw = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: decode(pieces[0]),
        additionalData: new TextEncoder().encode(COOKIE),
      },
      await encryptionKey(env),
      decode(pieces[1]),
    );
    const s = JSON.parse(new TextDecoder().decode(raw));
    return typeof s.uid === "string" &&
      typeof s.idToken === "string" &&
      Number.isFinite(s.expiresAt) &&
      s.expiresAt > Date.now()
      ? s
      : null;
  } catch {
    return null;
  }
}
async function provider(path, body, env, fetcher) {
  const response = await fetcher(
    `https://identitytoolkit.googleapis.com/v1/accounts:${path}?key=${encodeURIComponent(env.FIREBASE_WEB_API_KEY)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    },
  );
  if (!response.ok) return null;
  return response.json();
}
export async function handleAuth(request, env, action, fetcher = fetch) {
  const url = new URL(request.url);
  if (!["login", "session", "logout"].includes(action))
    return json({ error: "Not found." }, 404);
  const required = action === "session" ? "GET" : "POST";
  if (request.method !== required)
    return json({ error: "Method not allowed." }, 405, { Allow: required });
  if (
    required === "POST" &&
    (request.headers.get("Origin") !== url.origin ||
      request.headers.get("Sec-Fetch-Site") === "cross-site")
  )
    return json({ error: "Request not allowed." }, 403);
  if (action === "logout")
    return json({ ok: true }, 200, { "Set-Cookie": clearCookie() });
  if (!configured(env))
    return json(
      {
        error:
          "Company sign-in is not configured yet. Contact your administrator.",
      },
      503,
    );
  try {
    if (action === "login") {
      if (!request.headers.get("Content-Type")?.startsWith("application/json"))
        return json({ error: "Use a JSON request." }, 415);
      const text = await request.text();
      if (text.length > LIMIT)
        return json({ error: "Request too large." }, 413);
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        return json({ error: "Invalid request." }, 400);
      }
      const username =
        typeof body.username === "string"
          ? body.username.trim().toLowerCase()
          : "";
      if (
        !/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username) ||
        typeof body.password !== "string" ||
        !body.password ||
        body.password.length > 256
      )
        return json({ error: "Username or password is incorrect." }, 401);
      const email = `${username}@${env.FIREBASE_PROJECT_ID}.invalid`;
      const result = await provider(
        "signInWithPassword",
        { email, password: body.password, returnSecureToken: true },
        env,
        fetcher,
      );
      if (!result?.localId || !result.idToken)
        return json({ error: "Username or password is incorrect." }, 401);
      const ttl = Math.min(3600, Number(result.expiresIn));
      if (!Number.isFinite(ttl) || ttl < 1)
        return json(
          { error: "Sign-in is temporarily unavailable. Try again." },
          503,
        );
      const session = {
        uid: result.localId,
        username,
        idToken: result.idToken,
        issuedAt: Date.now(),
        expiresAt: Date.now() + ttl * 1000,
      };
      const value = await seal(session, env);
      // Browsers commonly limit a cookie to ~4KB; never silently create an unusable session.
      if (value.length > 3800)
        return json(
          {
            error:
              "Sign-in is temporarily unavailable. Contact your administrator.",
          },
          503,
        );
      return json({ ok: true }, 200, {
        "Set-Cookie": `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.floor(ttl)}`,
      });
    }
    const cookie = request.headers
      .get("Cookie")
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(COOKIE + "="))
      ?.slice(COOKIE.length + 1);
    const session = await unseal(cookie, env);
    if (!session)
      return json({ error: "Sign in to continue." }, 401, {
        "Set-Cookie": clearCookie(),
      });
    const account = await provider(
      "lookup",
      { idToken: session.idToken },
      env,
      fetcher,
    );
    const user = account?.users?.find((u) => u.localId === session.uid);
    if (
      !user ||
      user.disabled ||
      (user.validSince && session.issuedAt < Number(user.validSince) * 1000)
    )
      return json({ error: "Your session has ended. Sign in again." }, 401, {
        "Set-Cookie": clearCookie(),
      });
    // Identity only: no role or work-data access is granted by authentication alone.
    return json({
      user: {
        id: session.uid,
        username: session.username,
        displayName: user.displayName || session.username,
      },
      workspaceReady: false,
    });
  } catch {
    return json(
      { error: "Sign-in is temporarily unavailable. Try again." },
      503,
    );
  }
}
