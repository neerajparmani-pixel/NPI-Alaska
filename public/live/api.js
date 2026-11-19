import { config } from "./config.js";
// Sessions stay in memory. Reloading requires sign-in; no browser-persisted credentials.
export class LiveAPI {
  constructor(fetcher = (...args) => globalThis.fetch(...args)) {
    this.fetcher = fetcher;
    this.session = null;
    this.refreshing = null;
    this.uploadTasks = new Map();
  }
  async request(
    path,
    {
      method = "GET",
      body,
      headers = {},
      authenticated = true,
      raw = false,
    } = {},
  ) {
    if (authenticated) {
      if (!this.session) throw Error("Sign in to continue.");
      if (Date.now() > this.session.deadline - 30000) await this.refresh();
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await this.fetcher(config.supabaseUrl + path, {
        method,
        signal: controller.signal,
        headers: {
          apikey: config.publishableKey,
          ...(authenticated
            ? { Authorization: "Bearer " + this.session.access_token }
            : {}),
          ...(body && !raw ? { "Content-Type": "application/json" } : {}),
          ...headers,
        },
        body: body ? (raw ? body : JSON.stringify(body)) : undefined,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401 && authenticated) this.session = null;
        const error = Error(
          data.message ||
            data.error_description ||
            data.error ||
            "The server could not complete this request.",
        );
        error.status = response.status;
        throw error;
      }
      return data;
    } catch (e) {
      if (e.name === "AbortError")
        throw Error(
          "Request timed out. The result may be uncertain. Refresh before retrying; keep the same request identifier.",
        );
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }
  remember(data) {
    if (!data.access_token || !data.refresh_token)
      throw Error("Invalid authentication response.");
    this.session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      deadline: Date.now() + data.expires_in * 1000,
    };
  }
  async login(username, password) {
    const email = username.includes("@")
      ? username
      : username.toLowerCase() + "@" + config.usernameDomain;
    try {
      this.remember(
        await this.request("/auth/v1/token?grant_type=password", {
          method: "POST",
          body: { email, password },
          authenticated: false,
        }),
      );
      return await this.snapshot();
    } catch (e) {
      this.session = null;
      throw Error(
        e.message.includes("profile")
          ? "Your login is valid, but an active NPI profile has not been assigned."
          : "Unable to sign in. Check your username/password, network access and project setup.",
      );
    }
  }
  async refresh() {
    if (this.refreshing) return this.refreshing;
    if (!this.session) throw Error("Sign in again.");
    const token = this.session.refresh_token;
    this.refreshing = (async () => {
      try {
        this.remember(
          await this.request("/auth/v1/token?grant_type=refresh_token", {
            method: "POST",
            body: { refresh_token: token },
            authenticated: false,
          }),
        );
      } catch {
        this.session = null;
        throw Error("Session expired. Sign in again.");
      } finally {
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  }
  async logout() {
    try {
      if (this.session)
        await this.request("/auth/v1/logout", { method: "POST" });
    } finally {
      this.session = null;
      this.uploadTasks.clear();
    }
  }
  snapshot(stage = "all", workId = null) {
    return this.request("/rest/v1/rpc/npi_live_snapshot", {
      method: "POST",
      body: { p_stage: stage, p_work_id: workId },
    });
  }
  action(action, body, requestId = crypto.randomUUID()) {
    return this.request("/rest/v1/rpc/npi_live_action", {
      method: "POST",
      body: { p_action: action, p_body: body, p_request: requestId },
    });
  }
  resetPassword(id, password) {
    return this.request("/functions/v1/npi-admin", {
      method: "POST",
      body: { operation: "reset_password", id, password },
    });
  }
  staff(body) {
    return this.request("/functions/v1/npi-admin", {
      method: "POST",
      body: { operation: "create_user", ...body },
    });
  }
  async upload(work, file, kind) {
    const permitted =
      kind === "photo"
        ? ["image/jpeg", "image/png", "image/webp"]
        : ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!permitted.includes(file.type) || file.size > 8388608 || file.size < 1)
      throw Error(
        "Choose an allowed image or PDF up to 8 MB. Photo evidence must be an image.",
      );
    const user = (await this.snapshot()).profile.id;
    const ext = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "application/pdf": "pdf",
    }[file.type];
    const hash = [
      ...new Uint8Array(
        await crypto.subtle.digest("SHA-256", await file.arrayBuffer()),
      ),
    ]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("");
    const key = JSON.stringify([user, work.id, work.version, kind, hash]);
    let task = this.uploadTasks.get(key);
    if (!task) {
      task = {
        path: work.id + "/" + user + "/" + crypto.randomUUID() + "." + ext,
        requestId: crypto.randomUUID(),
        uploaded: false,
        completed: false,
      };
      this.uploadTasks.set(key, task);
    }
    if (task.completed) return task.path;
    if (!task.uploaded) {
      try {
        await this.request("/storage/v1/object/work-evidence/" + task.path, {
          method: "POST",
          body: file,
          raw: true,
          headers: { "Content-Type": file.type, "x-upsert": "false" },
        });
      } catch (e) {
        if (e.status !== 409) throw e;
      }
      task.uploaded = true;
    }
    await this.action(
      "evidence",
      { id: work.id, version: work.version, path: task.path, kind },
      task.requestId,
    );
    task.completed = true;
    if (this.uploadTasks.size > 50)
      for (const [k, v] of this.uploadTasks) {
        if (k !== key && v.completed) this.uploadTasks.delete(k);
        if (this.uploadTasks.size <= 50) break;
      }
    return task.path;
  }
  async fileUrl(path) {
    const result = await this.request(
      "/storage/v1/object/sign/work-evidence/" + path,
      { method: "POST", body: { expiresIn: 60 } },
    );
    const url = result.signedURL || result.signedUrl;
    if (!url || !url.startsWith("/object/sign/work-evidence/"))
      throw Error("Invalid private file link.");
    return config.supabaseUrl + "/storage/v1" + url;
  }
}
export const api = new LiveAPI();
