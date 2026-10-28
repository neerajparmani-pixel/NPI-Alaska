import "./styles.css";
import { brandMark } from "./branding.js";
const root = document.querySelector("#app");
const escape = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
async function request(action, body) {
  const response = await fetch(`/api/auth/${action}`, {
    method: body ? "POST" : "GET",
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw Error(
      "Company sign-in is not connected yet. Contact your administrator.",
    );
  }
  if (!response.ok)
    throw Object.assign(
      Error(result.error || "Sign-in could not be completed. Try again."),
      { status: response.status },
    );
  return result;
}
function shell(content) {
  root.innerHTML = `<main class="login-shell"><section class="login-intro"><a class="login-brand" href="/" aria-label="NPI Alaska demo home">${brandMark()}<span>NPI ALASKA<small>FIELD OPERATIONS</small></span></a><div class="login-brand-story">${brandMark(true)}<p class="eyebrow">READY FOR THE WORK AHEAD</p><h1>Your workday.<br>One place.</h1><p>Assignments, work records and approvals.<br>Sign in with your company account.</p></div><p class="login-foot">Work tracking · Phase 1</p></section><section class="login-form-panel">${content}</section></main>`;
}
function form() {
  document.title = "Sign in · NPI Alaska";
  shell(
    `<div class="login-box"><p class="eyebrow">COMPANY ACCESS</p><h2>Welcome back.</h2><p class="subtitle">Use the username and password given to you by NPI.</p><form id="login-form" novalidate><div id="auth-error" role="alert" class="error" hidden></div><div class="field"><label for="username">Username</label><input id="username" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required placeholder="Your company username" maxlength="40" aria-describedby="username-help"><small id="username-help">Enter your username, not a Google account.</small></div><div class="field"><label for="password">Password</label><div class="password-wrap"><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="256"><button id="toggle-password" type="button" aria-label="Show password" aria-pressed="false">Show</button></div></div><button id="sign-in" class="button primary full" type="submit">Sign in</button></form><p class="login-help">Forgot your password or need an account?<br>Contact your supervisor or administrator.</p><a class="demo-link" href="/">Explore the sample workspace →</a><p class="login-disclaimer">Company sign-in requires administrator setup. The sample workspace uses demo records only.</p></div>`,
  );
  const f = document.querySelector("#login-form"),
    u = f.elements.namedItem("username"),
    p = f.elements.namedItem("password"),
    b = document.querySelector("#sign-in"),
    err = document.querySelector("#auth-error");
  const fail = (message, field) => {
    err.textContent = message;
    err.hidden = false;
    if (field) {
      field.setAttribute("aria-invalid", "true");
      field.setAttribute("aria-describedby", "auth-error");
      field.focus();
    } else {
      err.tabIndex = -1;
      err.focus();
    }
  };
  document.querySelector("#toggle-password").onclick = (e) => {
    const shown = p.type === "password";
    p.type = shown ? "text" : "password";
    e.currentTarget.textContent = shown ? "Hide" : "Show";
    e.currentTarget.setAttribute(
      "aria-label",
      shown ? "Hide password" : "Show password",
    );
    e.currentTarget.setAttribute("aria-pressed", String(shown));
  };
  f.onsubmit = async (e) => {
    e.preventDefault();
    if (b.disabled) return;
    err.hidden = true;
    [u, p].forEach((el) => {
      el.removeAttribute("aria-invalid");
      el.removeAttribute("aria-describedby");
    });
    u.setAttribute("aria-describedby", "username-help");
    if (!u.value.trim()) {
      fail("Enter your company username.", u);
      return;
    }
    if (!p.value) {
      fail("Enter your password.", p);
      return;
    }
    b.disabled = true;
    b.textContent = "Signing in…";
    f.setAttribute("aria-busy", "true");
    try {
      await request("login", { username: u.value.trim(), password: p.value });
      p.value = "";
      const result = await request("session");
      signedIn(result.user);
    } catch (e) {
      p.value = "";
      fail(e.message);
    } finally {
      b.disabled = false;
      b.textContent = "Sign in";
      f.removeAttribute("aria-busy");
    }
  };
}
function signedIn(user) {
  document.title = "Account verified · NPI Alaska";
  shell(
    `<div class="login-box"><p class="eyebrow">ACCOUNT VERIFIED</p><h2>Hello, ${escape(user.displayName)}.</h2><div class="notice"><b>Your company account is verified.</b><br>Work records are not connected yet. Your administrator must finish the spreadsheet connection and assign your access before live work can begin.</div><p class="subtitle">You are signed in as ${escape(user.username)}. No work or financial access has been granted by this screen.</p><button id="sign-out" class="button secondary full" style="margin-top:24px">Sign out</button><p id="logout-error" role="alert" class="error" hidden></p></div>`,
  );
  document.querySelector("#sign-out").onclick = async (e) => {
    const button = e.currentTarget;
    button.disabled = true;
    try {
      await request("logout", {});
      form();
    } catch (e) {
      const err = document.querySelector("#logout-error");
      err.textContent =
        "Sign-out could not be completed. Check your connection and try again.";
      err.hidden = false;
      button.disabled = false;
    }
  };
}
form();
