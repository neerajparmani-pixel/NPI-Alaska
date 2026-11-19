// Invitation tokens and credentials stay in memory, never in storage or analytics.
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
  let invitation;
  try {
    invitation = await api.invitation("invite_preview", { token });
  } catch (e) {
    area.innerHTML = `<h1>Invitation unavailable</h1><p role="alert">${esc(e.message)}</p><a class="btn primary" href="#signin">Go to sign in</a>`;
    return;
  }
  const admin = invitation.role === "sub";
  area.innerHTML = `<p class="eyebrow">${esc(invitation.company)}</p><h1>${admin ? "Set up your company account" : "Join your work team"}</h1><p>${admin ? "You will manage your company’s workers and assignments." : "Your company administrator will approve your account before you can start work."}</p><form id="registration-form" class="live-form" novalidate><div class="field"><label for="join-name">Full name</label><input id="join-name" name="display_name" autocomplete="name" maxlength="150"><span id="join-name-error" class="err"></span></div><div class="field"><label for="join-username">Choose a username</label><input id="join-username" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="50" aria-describedby="join-username-hint"><small id="join-username-hint">3–50 lowercase letters, numbers, dots, hyphens or underscores.</small><span id="join-username-error" class="err"></span></div><div class="field"><label for="join-password">Password</label><input id="join-password" name="password" type="password" autocomplete="new-password" maxlength="72" aria-describedby="join-password-hint"><small id="join-password-hint">Use at least 12 characters.</small><span id="join-password-error" class="err"></span></div><div class="field"><label for="join-confirm">Confirm password</label><input id="join-confirm" name="confirm" type="password" autocomplete="new-password" maxlength="72"><span id="join-confirm-error" class="err"></span></div><button type="button" class="btn" data-signup-toggle aria-pressed="false">Show passwords</button><button type="submit" class="btn primary">Create account</button><p id="join-error" class="error" role="alert"></p></form><p class="small muted">Already registered? <a href="#signin">Sign in</a></p>`;
  const form = area.querySelector("form");
  let busy = false,
    signature = "",
    requestId = "";
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
      form.reset();
      area.innerHTML = `<h1>${result.status === "pending" ? "Your account is awaiting approval" : "Your company account is ready"}</h1><p>${result.status === "pending" ? "Contact your company administrator. Once approved, sign in to see your assignments." : "Sign in to invite your workers and assign work at your company’s sites."}</p><p>Your username: <strong>${esc(username)}</strong></p><a class="btn primary" href="#signin">Go to sign in</a>`;
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
