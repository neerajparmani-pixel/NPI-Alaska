// Passwords and raw invitation tokens stay in memory. A tab-scoped non-secret request ticket permits retry after reload.
export async function showEnrollment({
  token,
  api,
  root,
  prepareLogin,
  escape: esc,
}) {
  prepareLogin();
  document.title = "Create your company account · Alaska NPI";
  const area = root.querySelector(".login-form-wrap");
  area.innerHTML =
    '<h1>Checking your invitation</h1><p role="status">Please wait…</p>';
  history.replaceState(null, "", location.pathname + "#register");
  const ticketKey =
    "npi-signup:" +
    Array.from(
      new Uint8Array(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
      ),
    )
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
  let ticket = null;
  try {
    ticket = JSON.parse(sessionStorage.getItem(ticketKey) || "null");
  } catch {}
  let invitation;
  try {
    invitation = await api.invitation("invite_preview", {
      token,
      request_id: ticket?.requestId,
    });
  } catch (e) {
    area.innerHTML = `<h1>Invitation unavailable</h1><p role="alert">${esc(e.message)}</p><a class="btn primary" href="#signin">Go to sign in</a>`;
    return;
  }
  const admin = invitation.role !== "worker";
  area.innerHTML = `<p class="eyebrow">${esc(invitation.company)}</p><h1>${invitation.role === "npi" ? "Join NPI administration" : admin ? "Set up your company account" : "Join your work team"}</h1><p>Verify your email, then wait for administrator approval. Your role and company are fixed by this invitation.</p><form id="registration-form" class="live-form" novalidate><div class="field"><label for="join-email">Invited email</label><input id="join-email" name="email" type="email" autocomplete="email" readonly value="${esc(invitation.email || "")}"></div><p class="small">Access: ${esc({ npi: "NPI Admin", sub: "Subcontractor Admin", worker: "Worker" }[invitation.role])}</p><div class="field"><label for="join-name">Full name</label><input id="join-name" name="display_name" autocomplete="name" maxlength="150"><span id="join-name-error" class="err"></span></div><div class="field"><label for="join-username">Choose a username</label><input id="join-username" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="50" aria-describedby="join-username-hint"><small id="join-username-hint">3–50 lowercase letters, numbers, dots, hyphens or underscores.</small><span id="join-username-error" class="err"></span></div><div class="field"><label for="join-password">Password</label><input id="join-password" name="password" type="password" autocomplete="new-password" maxlength="72" aria-describedby="join-password-hint"><small id="join-password-hint">Use at least 12 characters.</small><span id="join-password-error" class="err"></span></div><div class="field"><label for="join-confirm">Confirm password</label><input id="join-confirm" name="confirm" type="password" autocomplete="new-password" maxlength="72"><span id="join-confirm-error" class="err"></span></div><button type="button" class="btn" data-signup-toggle aria-pressed="false">Show passwords</button><button type="submit" class="btn primary">Create account</button><p id="join-error" class="error" role="alert"></p></form><p class="small muted">Already registered? <a href="#signin">Sign in</a></p>`;
  const form = area.querySelector("form");
  let busy = false,
    signature = ticket?.signature || "",
    requestId = ticket?.requestId || "";
  if (ticket) {
    form.display_name.value = ticket.name || "";
    form.username.value = ticket.username || "";
  }
  form.querySelector("[data-signup-toggle]").addEventListener("click", (e) => {
    const hidden = form.password.type === "password";
    form.password.type = form.confirm.type = hidden ? "text" : "password";
    e.currentTarget.textContent = hidden ? "Hide passwords" : "Show passwords";
    e.currentTarget.setAttribute("aria-pressed", String(hidden));
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    const values = new FormData(form),
      name = String(values.get("display_name")).trim(),
      username = String(values.get("username")).trim().toLowerCase(),
      password = String(values.get("password"));
    const errors = {};
    if (!name) errors["join-name"] = "Enter your full name.";
    if (!/^[a-z0-9][a-z0-9._-]{2,49}$/.test(username))
      errors["join-username"] =
        "Choose a username using 3–50 lowercase letters, numbers, dots, hyphens or underscores.";
    if (password.length < 12 || new TextEncoder().encode(password).length > 72)
      errors["join-password"] =
        "Use a password with 12–72 characters (maximum 72 bytes).";
    if (password !== values.get("confirm"))
      errors["join-confirm"] = "The passwords must match.";
    form.querySelectorAll("[aria-invalid]").forEach((x) => {
      x.removeAttribute("aria-invalid");
      x.removeAttribute("aria-describedby");
    });
    form.querySelectorAll(".err").forEach((x) => (x.textContent = ""));
    for (const [id, msg] of Object.entries(errors)) {
      const input = form.querySelector("#" + id);
      input.setAttribute("aria-invalid", "true");
      input.setAttribute("aria-describedby", id + "-error");
      form.querySelector("#" + id + "-error").textContent = msg;
    }
    if (Object.keys(errors).length) {
      form.querySelector("#" + Object.keys(errors)[0]).focus();
      return;
    }
    if (signature !== JSON.stringify([name, username])) {
      requestId = crypto.randomUUID();
      signature = JSON.stringify([name, username]);
    }
    try {
      sessionStorage.setItem(
        ticketKey,
        JSON.stringify({ requestId, signature, name, username }),
      );
    } catch {}
    busy = true;
    form.setAttribute("aria-busy", "true");
    form.querySelectorAll("button").forEach((b) => (b.disabled = true));
    try {
      const result = await api.invitation("register_invitation", {
        token,
        request_id: requestId,
        display_name: name,
        username,
        password,
      });
      try {
        sessionStorage.removeItem(ticketKey);
      } catch {}
      form.reset();
      area.innerHTML = `<h1>Verify your email</h1><p>${result.email_sent === false ? "Your account was created, but the verification email could not be sent. Request another email below or contact your administrator." : "Check your email for a verification link. After verification, your administrator must approve access."}</p><p>Your username: <strong>${esc(username)}</strong></p><a class="btn primary" href="#resend-verification">Resend verification</a><a class="btn" href="#signin">Go to sign in</a>`;
      token = "";
    } catch (error) {
      form.querySelector("#join-error").textContent = error.message;
      form.password.value = "";
      form.confirm.value = "";
      form.password.type = form.confirm.type = "password";
      form.querySelector("[data-signup-toggle]").textContent = "Show passwords";
      form
        .querySelector("[data-signup-toggle]")
        .setAttribute("aria-pressed", "false");
    } finally {
      busy = false;
      form.removeAttribute("aria-busy");
      form.querySelectorAll("button").forEach((b) => (b.disabled = false));
    }
  });
}
