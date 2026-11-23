// Managed passwords stay only in Supabase Auth. Verification tokens are stored hashed.
export async function handleAccounts({
  body,
  env,
  fetcher,
  service,
  json,
  allowed,
  logFault,
  requestId,
}) {
  const operations = [
    "invite_preview",
    "register_invitation",
    "verify_email",
    "resend_verification",
    "recover_password",
    "login",
  ];
  if (!operations.includes(body.operation)) return null;
  const hash = async (value) =>
    Array.from(
      new Uint8Array(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
      ),
    )
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  const random = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  const identity = (payload) =>
    service("/rest/v1/rpc/npi_identity", { method: "POST", body: payload });
  const gate = async (kind, value) => {
    const global = await service("/rest/v1/rpc/npi_public_gate", {
      method: "POST",
      body: { p_bucket: "installation", p_kind: "global" },
    });
    const local =
      global === true &&
      (await service("/rest/v1/rpc/npi_public_gate", {
        method: "POST",
        body: { p_bucket: await hash(value), p_kind: kind },
      }));
    return local === true;
  };
  const limited = () => {
    const r = json(
      { error: "Too many requests. Try again in a minute." },
      429,
      allowed,
    );
    r.headers.set("Retry-After", "60");
    return r;
  };
  const send = async (email, subject, message) => {
    if (!env.NPI_EMAIL_API_KEY || !env.NPI_EMAIL_FROM)
      throw Error("Email sender not configured");
    const response = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + env.NPI_EMAIL_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.NPI_EMAIL_FROM,
        to: [email],
        subject,
        text: message,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw Error("Email delivery unavailable");
  };
  const verification = async (userId) => {
    const token = random();
    const issued = await identity({
      p_mode: "issue",
      p_user: userId,
      p_hash: await hash(token),
    });
    if (issued.email)
      await send(
        issued.email,
        "Verify your Alaska NPI email",
        "Verify your email to continue your account registration:\n\n" +
          allowed +
          "/live/#verify=" +
          token +
          "\n\nThis link expires in 24 hours. After verification, your administrator must approve access. If you did not register, ignore this message.",
      );
  };
  if (body.operation === "login") {
    if (
      typeof body.username !== "string" ||
      body.username.length > 254 ||
      typeof body.password !== "string" ||
      body.password.length > 256
    )
      return json({ error: "Check your sign-in details." }, 400, allowed);
    if (!(await gate("login", body.username.toLowerCase()))) return limited();
    const resolved = await identity({
      p_mode: "resolve",
      p_username: body.username.toLowerCase(),
    });
    const email =
      resolved.email || body.username.toLowerCase() + "@users.npi6030.com";
    const response = await fetcher(
      env.SUPABASE_URL + "/auth/v1/token?grant_type=password",
      {
        method: "POST",
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password: body.password }),
        signal: AbortSignal.timeout(20000),
      },
    );
    const auth = await response.json().catch(() => ({}));
    if (!response.ok)
      return json(
        {
          error:
            response.status >= 500
              ? "Sign-in service unavailable. Retry shortly."
              : "Unable to sign in. Check your credentials and verify your email.",
        },
        response.status >= 500 ? 503 : 401,
        allowed,
      );
    return json(
      {
        access_token: auth.access_token,
        refresh_token: auth.refresh_token,
        expires_in: auth.expires_in,
      },
      200,
      allowed,
    );
  }
  if (["recover_password", "resend_verification"].includes(body.operation)) {
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
      return json({ error: "Enter your account email." }, 400, allowed);
    if (
      !(await gate(
        body.operation === "recover_password" ? "recovery" : "resend",
        email,
      ))
    )
      return limited();
    const generic = {
      accepted: true,
      message:
        "If an eligible account exists, instructions will be sent. Contact your administrator if no message arrives.",
    };
    try {
      const user = await identity({ p_mode: "resolve", p_username: email });
      if (user.id) {
        if (body.operation === "resend_verification")
          await verification(user.id);
        else if (user.confirmed) {
          const link = await service("/auth/v1/admin/generate_link", {
            method: "POST",
            body: {
              type: "recovery",
              email,
              options: { redirectTo: allowed + "/live/" },
            },
          });
          const url = link.properties?.action_link || link.action_link;
          if (
            typeof url !== "string" ||
            !url.startsWith(env.SUPABASE_URL + "/auth/v1/verify")
          )
            throw Error("Invalid recovery link");
          await send(
            email,
            "Reset your Alaska NPI password",
            "Use this private link to choose a new password:\n\n" +
              url +
              "\n\nIf you did not request a reset, ignore this message.",
          );
        }
      }
    } catch {
      logFault(body.operation, 503);
    }
    return json(generic, 200, allowed);
  }
  if (typeof body.token !== "string" || !/^[0-9a-f]{64}$/.test(body.token))
    return json(
      { error: "This link is invalid or unavailable. Request a new link." },
      400,
      allowed,
    );
  if (
    !(await gate(
      body.operation === "invite_preview"
        ? "preview"
        : body.operation === "verify_email"
          ? "verify"
          : "registration",
      body.token,
    ))
  )
    return limited();
  const tokenHash = await hash(body.token);
  if (body.operation === "verify_email") {
    try {
      const state = await identity({ p_mode: "verify", p_hash: tokenHash });
      if (!state.complete)
        await service("/auth/v1/admin/users/" + state.user_id, {
          method: "PUT",
          body: { email_confirm: true },
        });
      return json(
        await identity({ p_mode: "finish", p_hash: tokenHash }),
        200,
        allowed,
      );
    } catch (error) {
      if (!error.status || error.status >= 500) throw error;
      return json(
        {
          error:
            "Verification link expired or unavailable. Request another email.",
        },
        400,
        allowed,
      );
    }
  }
  const enroll = (payload) =>
    service("/rest/v1/rpc/npi_enroll", { method: "POST", body: payload });
  if (body.operation === "invite_preview") {
    try {
      return json(
        await enroll({
          p_mode: "preview",
          p_hash: tokenHash,
          p_request: body.request_id || null,
        }),
        200,
        allowed,
      );
    } catch (error) {
      if (!error.status || error.status >= 500) throw error;
      return json(
        {
          error:
            "This invitation is expired, disabled or already used. Ask your administrator for a new link.",
        },
        400,
        allowed,
      );
    }
  }
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      body.request_id || "",
    ) ||
    !/^[a-z0-9][a-z0-9._-]{2,49}$/.test(body.username || "") ||
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
          "Enter your name, a valid username and a password of 12–72 characters.",
      },
      400,
      allowed,
    );
  if (!env.NPI_EMAIL_API_KEY || !env.NPI_EMAIL_FROM)
    return json(
      {
        error:
          "Email verification is not configured. Ask the NPI administrator to configure the email sender before registration.",
      },
      503,
      allowed,
    );
  const common = {
    p_hash: tokenHash,
    p_request: body.request_id,
    p_attempt: crypto.randomUUID(),
  };
  let userId;
  try {
    const reg = await enroll({
      ...common,
      p_mode: "begin",
      p_username: body.username,
      p_name: body.display_name.trim(),
    });
    userId = reg.user_id;
    if (!reg.complete) {
      if (!userId) {
        const created = await service("/auth/v1/admin/users", {
          method: "POST",
          body: {
            email: reg.email,
            password: body.password,
            email_confirm: false,
            app_metadata: { npi_enrollment_id: body.request_id },
          },
        });
        userId = created.id;
      }
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          userId || "",
        )
      )
        throw Error("Invalid Auth identity");
      await enroll({ ...common, p_mode: "finish", p_user: userId });
    }
  } catch (error) {
    await enroll({ ...common, p_mode: "release" }).catch(() => {});
    if (!error.status || error.status >= 500)
      logFault("register_invitation", 503);
    return json(
      {
        error:
          error.detail === "Registration busy"
            ? "Registration is still processing. Wait 90 seconds and retry this form."
            : "Registration could not be completed with these details. Sign in if already registered, or contact your administrator.",
        request_id: requestId,
      },
      !error.status || error.status >= 500 ? 503 : 409,
      allowed,
    );
  }
  let emailSent = true;
  try {
    await verification(userId);
  } catch {
    emailSent = false;
    logFault("verification_delivery", 503);
  }
  return json({ status: "verify-email", email_sent: emailSent }, 200, allowed);
}
