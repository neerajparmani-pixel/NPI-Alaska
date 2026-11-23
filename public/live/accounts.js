export class AccountFeatures {
  constructor(context) {
    this.ctx = context;
  }
  get c() {
    return this.ctx();
  }
  view() {
    const c = this.c,
      accounts = c.data.accounts || { people: [], invitations: [] },
      npi = c.data.profile.role === "npi",
      tab =
        new URLSearchParams(location.hash.split("?")[1] || "").get("tab") ||
        "people";
    const role = {
      npi: "NPI Admin",
      sub: "Subcontractor Admin",
      worker: "Worker",
    };
    const canApprove = (p) =>
      p.id !== c.data.profile.id &&
      (npi
        ? p.role === "sub" ||
          (p.role === "npi" && p.invited_by === c.data.profile.id)
        : p.role === "worker" && p.company_id === c.data.profile.company_id);
    const controls = (p) => {
      if (p.id === c.data.profile.id) return "Your account";
      if (p.account_status === "pending")
        return !p.email_verified
          ? "Email verification pending"
          : canApprove(p)
            ? c.button("Approve", "account-approve", p.id, "primary") +
              c.button("Reject", "account-reject", p.id)
            : "Awaiting responsible administrator";
      if (!npi && p.role !== "worker") return "—";
      if (p.account_status === "approved")
        return c.button("Pause access", "access-suspend_account", p.id);
      if (p.account_status === "suspended")
        return c.button("Restore access", "access-restore_account", p.id);
      return canApprove(p)
        ? c.button("Reopen review", "account-reopen", p.id)
        : "Declined";
    };
    let body =
      c.head(
        npi ? "People & access" : "My team",
        "Each person chooses a private password. Email verification and approval are required.",
        c.button(
          npi ? "Invite person" : "Invite worker",
          "new-invitation",
          "",
          "primary",
        ),
      ) +
      `<nav class="account-tabs" aria-label="Account management"><a class="btn ${tab === "people" ? "primary" : ""}" href="#people?tab=people">People</a><a class="btn ${tab === "pending" ? "primary" : ""}" href="#people?tab=pending">Pending approvals (${accounts.people.filter((p) => p.account_status === "pending").length})</a><a class="btn ${tab === "invitations" ? "primary" : ""}" href="#people?tab=invitations">Invitations</a></nav>`;
    if (tab === "invitations")
      return (
        body +
        c.panel(
          "Invitations",
          c.table(
            ["Email", "Company", "Role", "Expires", "Status", "Actions"],
            accounts.invitations.map((i) => {
              const used = Number(i.uses) > 0;
              return [
                c.esc(i.invited_email || "Legacy link — replace"),
                c.esc(c.company(i.company_id)?.name || "NPI"),
                role[i.role],
                c.esc(c.timestamp(i.expires_at)),
                i.revoked
                  ? "Revoked"
                  : used
                    ? "Used"
                    : Date.parse(i.expires_at) < Date.now()
                      ? "Expired"
                      : "Active",
                !used
                  ? c.button(
                      "Create replacement link",
                      "account-reissue",
                      i.id,
                    ) +
                    (!i.revoked
                      ? c.button("Revoke", "revoke-invitation", i.id)
                      : "")
                  : "Registration created",
              ];
            }),
          ),
        ) +
        '<p class="small">Links are single-use, bound to the invited email and expire after 72 hours. A replacement invalidates the old link. Registration and access changes are recorded in history.</p>'
      );
    const people = accounts.people.filter((p) =>
      tab === "pending"
        ? p.account_status === "pending"
        : p.account_status !== "pending",
    );
    return (
      body +
      c.panel(
        tab === "pending" ? "Pending approvals" : "People",
        people.length
          ? c.table(
              [
                "Person",
                "Email / username",
                "Company",
                "Role",
                "Status",
                "Actions",
              ],
              people.map((p) => [
                c.esc(p.display_name),
                c.esc(p.email || p.username),
                c.esc(c.company(p.company_id)?.name || "NPI"),
                role[p.role],
                c.esc(p.account_status) +
                  (p.requires_email_verification && !p.email_verified
                    ? " · email unverified"
                    : ""),
                controls(p),
              ]),
            )
          : "<p>No accounts in this view.</p>",
      ) +
      (accounts.history?.length
        ? c.panel(
            "Recent account history",
            c.table(
              ["When", "Action", "By", "Person"],
              accounts.history.map((h) => [
                c.esc(c.timestamp(h.event_time)),
                c.esc(h.action.replaceAll("_", " ")),
                c.esc(h.actor),
                c.esc(h.target),
              ]),
            ),
          )
        : "") +
      '<p class="small">Multiple administrators are supported. Password recovery is private; administrators cannot view or set another person’s password.</p>'
    );
  }
  inviteForm() {
    const c = this.c,
      npi = c.data.profile.role === "npi";
    c.form(
      "Invite person",
      "invitation",
      c.field("email", "Person’s email", "email") +
        c.field(
          "role",
          "Access role",
          "select",
          npi ? "npi" : "worker",
          npi
            ? [
                ["npi", "NPI Admin"],
                ["sub", "Subcontractor Admin"],
              ]
            : [["worker", "Worker"]],
        ) +
        `<div data-invite-company ${npi ? "hidden" : ""}>` +
        c.field(
          "company_id",
          "Subcontractor",
          "select",
          npi ? "" : c.data.profile.company_id,
          [
            ["", "Select company"],
            ...c.data.companies
              .filter((x) => x.active)
              .map((x) => [x.id, x.name]),
          ],
        ) +
        "</div><p>A single-use link will be created for this email. The person chooses their own password, verifies their email and awaits approval. Expires in 72 hours.</p>",
    );
  }
  approve(el, reject = false) {
    const c = this.c,
      p = c.data.accounts.people.find((p) => p.id === el.dataset.id);
    if (!p) return;
    c.form(
      reject ? "Decline registration" : "Approve registration",
      reject ? "ops:reject_account" : "ops:approve_account",
      `<input type="hidden" name="version" value="${p.access_version}"><p>${c.esc(p.display_name)} · ${c.esc(p.email)} · ${c.esc(p.role === "npi" ? "Full NPI administration" : p.role === "sub" ? "Company administration" : "Worker access")}</p><p>${reject ? "Decline access for this registration?" : "Activate this person’s access?"}</p>`,
      p.id,
    );
  }
  async reissue(el) {
    const c = this.c,
      token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("");
    const hash = Array.from(
      new Uint8Array(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
      ),
    )
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
    await c.api.opsAction("reissue_invite", {
      id: el.dataset.id,
      token_hash: hash,
    });
    await c.load();
    c.modal(
      "Share replacement invitation",
      `<p>The previous invitation is revoked. Share this link privately with the same person.</p><label for="invitation-url">Invitation link</label><input id="invitation-url" readonly value="${c.esc(location.origin + location.pathname + "#join=" + token)}">${c.button("Copy link", "copy-invitation", "", "primary")}`,
    );
  }
  actions() {
    return {
      "account-approve": (el) => this.approve(el),
      "account-reject": (el) => this.approve(el, true),
      "account-reissue": (el) => this.reissue(el),
      "account-reopen": (el) => {
        const c = this.c,
          p = c.data.accounts.people.find((p) => p.id === el.dataset.id);
        c.form(
          "Reopen registration review",
          "ops:reopen_registration",
          `<input type="hidden" name="version" value="${p.access_version}"><p>Return ${c.esc(p.display_name)} to pending approval? Access remains inactive until approved.</p>`,
          p.id,
        );
      },
    };
  }
}
export async function showAccountFlow({
  mode,
  token,
  api,
  root,
  prepareLogin,
  escape: esc,
  recovery,
}) {
  prepareLogin();
  const area = root.querySelector(".login-form-wrap");
  history.replaceState(null, "", location.pathname + "#account");
  const finish = (title, message) => {
    area.innerHTML = `<h1>${esc(title)}</h1><p role="status">${esc(message)}</p><a class="btn primary" href="#signin">Go to sign in</a>`;
  };
  if (mode === "verify") {
    finish("Verifying your email", "Please wait…");
    try {
      const result = await api.invitation("verify_email", { token });
      finish(
        "Email verified",
        result.status === "approved"
          ? "Your account is approved. You can sign in now."
          : "Your account is awaiting administrator approval. You will be notified when access is activated.",
      );
    } catch (e) {
      area.innerHTML = `<h1>Verification unavailable</h1><p role="alert">${esc(e.message)}</p><a class="btn primary" href="#resend-verification">Request a new email</a>`;
    }
    return;
  }
  const reset = mode === "reset";
  area.innerHTML = `<h1>${reset ? "Choose a new password" : mode === "recover" ? "Forgot password" : "Resend verification"}</h1><p>${reset ? "Choose a private password for your own account." : "Enter the email used for your account."}</p><form id="identity-form" class="live-form" novalidate>${reset ? '<label for="identity-password">New password</label><input id="identity-password" name="password" type="password" autocomplete="new-password"><label for="identity-confirm">Confirm password</label><input id="identity-confirm" name="confirm" type="password" autocomplete="new-password"><button class="btn" type="button" id="identity-show">Show passwords</button>' : '<label for="identity-email">Email</label><input id="identity-email" name="email" type="email" autocomplete="email">'}<p id="identity-error" role="alert" class="error"></p><button class="btn primary" type="submit">${reset ? "Save new password" : "Send instructions"}</button></form><a href="#signin">Back to sign in</a>`;
  const f = area.querySelector("form");
  let busy = false;
  f.querySelector("#identity-show")?.addEventListener("click", (e) => {
    const show = f.password.type === "password";
    f.password.type = f.confirm.type = show ? "text" : "password";
    e.currentTarget.textContent = show ? "Hide passwords" : "Show passwords";
  });
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    const error = f.querySelector("#identity-error");
    const v = new FormData(f);
    let invalid;
    if (
      reset &&
      (String(v.get("password")).length < 12 ||
        new TextEncoder().encode(String(v.get("password"))).length > 72 ||
        v.get("password") !== v.get("confirm"))
    )
      invalid = "Use 12–72 characters and matching passwords.";
    if (!reset && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v.get("email"))))
      invalid = "Enter your account email.";
    if (invalid) {
      error.textContent = invalid;
      const input = f.querySelector("input");
      input.setAttribute("aria-invalid", "true");
      input.setAttribute("aria-describedby", "identity-error");
      input.focus();
      return;
    }
    busy = true;
    f.setAttribute("aria-busy", "true");
    f.querySelectorAll("button").forEach((x) => (x.disabled = true));
    try {
      if (reset) {
        await api.resetOwnPassword(
          recovery.access_token,
          String(v.get("password")),
        );
        api.bridge.clear();
        api.session = null;
        finish("Password updated", "Sign in with your new password.");
      } else {
        const r = await api.invitation(
          mode === "recover" ? "recover_password" : "resend_verification",
          { email: String(v.get("email")).trim() },
        );
        finish("Request received", r.message);
      }
    } catch (err) {
      error.textContent = err.message;
      if (reset) {
        f.password.value = "";
        f.confirm.value = "";
      }
    } finally {
      busy = false;
      f.removeAttribute("aria-busy");
      f.querySelectorAll("button").forEach((x) => (x.disabled = false));
    }
  });
}
