import { SessionBridge } from "./recovery.js";
import { config } from "./config.js";
// Persistent sessions are opt-in, account-bound and coordinated across tabs.
export class LiveAPI {
  constructor(fetcher = (...args) => globalThis.fetch(...args)) {
    this.fetcher = fetcher;
    this.session = null;
    this.sessionEpoch = 0;
    this.refreshing = null;
    this.uploadTasks = new Map();
    this.bridge = new SessionBridge((next) => {
      if (!this.rememberOnDevice) return;
      if (next?.access_token === this.session?.access_token) return;
      const previous = this.session?.userId;
      this.session = next?.userId === previous ? next : null;
      this.sessionEpoch++;
      if (typeof window !== "undefined")
        window.dispatchEvent(
          new CustomEvent("npi-session-change", {
            detail: { signedOut: !this.session },
          }),
        );
    }, config.supabaseUrl);
    const restored = this.bridge.read();
    if (restored) {
      this.session = restored;
      this.rememberOnDevice = true;
    }
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
    const requestSession = this.session;
    if (authenticated && !requestSession) throw Error("Sign in to continue.");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await this.fetcher(config.supabaseUrl + path, {
        method,
        signal: controller.signal,
        headers: {
          apikey: config.publishableKey,
          ...(authenticated
            ? { Authorization: "Bearer " + requestSession.access_token }
            : {}),
          ...(body && !raw ? { "Content-Type": "application/json" } : {}),
          ...headers,
        },
        body: body ? (raw ? body : JSON.stringify(body)) : undefined,
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && authenticated && this.session !== requestSession)
        throw Error("Session changed. Refresh before retrying.");
      if (!response.ok) {
        if (
          response.status === 401 &&
          authenticated &&
          this.session === requestSession
        ) {
          this.session = null;
          this.sessionEpoch++;
          if (this.rememberOnDevice) this.bridge.clear();
        }
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
    this.sessionEpoch++;
    if (!data.access_token || !data.refresh_token)
      throw Error("Invalid authentication response.");
    const previous = this.session;
    this.session = {
      userId: previous?.userId,
      deviceUntil: previous?.deviceUntil || Date.now() + 7 * 86400000,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      deadline: Date.now() + data.expires_in * 1000,
    };
    this.persistSession();
  }
  persistSession() {
    if (
      this.rememberOnDevice &&
      this.session?.userId &&
      !this.bridge.write(this.session)
    )
      throw Error(
        "Unable to save this device session. Uncheck Keep me signed in and try again.",
      );
  }
  async login(username, password, rememberOnDevice = false) {
    this.rememberOnDevice = rememberOnDevice;
    if (!rememberOnDevice) this.bridge.clear();
    const email = username.includes("@")
      ? username
      : username.toLowerCase() + "@" + config.usernameDomain;
    try {
      this.remember(
        username.includes("@")
          ? await this.request("/auth/v1/token?grant_type=password", {
              method: "POST",
              body: { email, password },
              authenticated: false,
            })
          : await this.invitation("login", {
              username: username.toLowerCase(),
              password,
            }),
      );
      const status = await this.accountStatus();
      if (status.status !== "approved") return { accountStatus: status };
      const snapshot = await this.snapshot();
      this.session.userId = snapshot.profile.id;
      this.persistSession();
      return snapshot;
    } catch (e) {
      this.session = null;
      this.sessionEpoch++;
      if (this.rememberOnDevice) this.bridge.clear();
      if (e.message.includes("migration 008")) throw e;
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
    const epoch = this.sessionEpoch;
    this.refreshing = this.bridge.lock(async () => {
      try {
        const cached = this.rememberOnDevice ? this.bridge.read() : null;
        if (
          cached &&
          cached.userId === this.session?.userId &&
          cached.refresh_token !== token
        ) {
          this.session = cached;
          this.sessionEpoch++;
          return;
        }
        const refreshed = await this.request(
          "/auth/v1/token?grant_type=refresh_token",
          {
            method: "POST",
            body: { refresh_token: token },
            authenticated: false,
          },
        );
        if (this.sessionEpoch !== epoch) throw Error("Session changed.");
        this.remember(refreshed);
      } catch {
        if (this.sessionEpoch === epoch) {
          this.session = null;
          this.sessionEpoch++;
          if (this.rememberOnDevice) this.bridge.clear();
        }
        throw Error("Session expired or changed. Sign in again.");
      }
    });
    const pending = this.refreshing;
    try {
      return await pending;
    } finally {
      if (this.refreshing === pending) this.refreshing = null;
    }
  }
  async logout() {
    const session = this.session;
    this.session = null;
    this.sessionEpoch++;
    this.uploadTasks.clear();
    this.bridge.clear();
    this.rememberOnDevice = false;
    if (session)
      await this.request("/auth/v1/logout", {
        method: "POST",
        authenticated: false,
        headers: { Authorization: "Bearer " + session.access_token },
      });
  }
  accountStatus() {
    return this.request("/rest/v1/rpc/npi_account_status", {
      method: "POST",
      body: {},
    });
  }
  opsContext() {
    return this.request("/rest/v1/rpc/npi_ops_context", {
      method: "POST",
      body: {},
    });
  }
  opsAction(action, body, requestId = crypto.randomUUID()) {
    return this.request("/rest/v1/rpc/npi_ops_action", {
      method: "POST",
      body: { p_action: action, p_body: body, p_request: requestId },
    });
  }
  invitation(operation, body) {
    return this.request("/functions/v1/" + config.adminFunction, {
      method: "POST",
      authenticated: false,
      body: { operation, ...body },
    });
  }
  async snapshot(stage = "all", workId = null) {
    const snapshot = await this.request("/rest/v1/rpc/npi_live_snapshot", {
      method: "POST",
      body: { p_stage: stage, p_work_id: workId },
    });
    if (snapshot.profile.role !== "worker") {
      snapshot.accounts = await this.request(
        "/rest/v1/rpc/npi_people_context",
        { method: "POST", body: {} },
      );
      if (snapshot.accounts.release !== "3.2.0")
        throw Error(
          "Backend upgrade required: apply migration 008 before v3.2.0.",
        );
      snapshot.people = snapshot.accounts.people;
    }
    return snapshot;
  }
  action(action, body, requestId = crypto.randomUUID()) {
    return this.request("/rest/v1/rpc/npi_live_action", {
      method: "POST",
      body: { p_action: action, p_body: body, p_request: requestId },
    });
  }
  reportStart(filter, request) {
    return this.request("/rest/v1/rpc/npi_report_start", {
      method: "POST",
      body: { p_filter: filter, p_request: request },
    });
  }
  reportPage(id, page) {
    return this.request("/rest/v1/rpc/npi_report_page", {
      method: "POST",
      body: { p_run: id, p_page: page },
    });
  }
  reportEvidence(id, ids) {
    return this.request("/rest/v1/rpc/npi_report_evidence", {
      method: "POST",
      body: { p_run: id, p_ids: ids },
    });
  }
  async resetOwnPassword(token, password) {
    await this.request("/auth/v1/user", {
      method: "PUT",
      body: { password },
      authenticated: false,
      headers: { Authorization: "Bearer " + token },
    });
    await this.request("/auth/v1/logout?scope=global", {
      method: "POST",
      authenticated: false,
      headers: { Authorization: "Bearer " + token },
    }).catch(() => {});
  }
  resetPassword(id, password) {
    return this.request("/functions/v1/" + config.adminFunction, {
      method: "POST",
      body: { operation: "reset_password", id, password },
    });
  }
  staff(body) {
    return this.request("/functions/v1/" + config.adminFunction, {
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
  workSearch(filter = {}, page = 1) {
    return this.request("/rest/v1/rpc/npi_work_search", {
      method: "POST",
      body: { p_filter: filter, p_page: page },
    });
  }
  async fieldSnapshot(workId = null) {
    try {
      const field = await this.request("/rest/v1/rpc/npi_field_snapshot", {
        method: "POST",
        body: {},
      });
      field.visits = await this.request("/rest/v1/rpc/npi_visit_context", {
        method: "POST",
        body: { p_work: workId },
      });
      if (field.visits.release !== "3.2.0")
        throw Error(
          "Backend upgrade required: apply migration 008 before using v3.2.0.",
        );
      return field;
    } catch (e) {
      if (e.status === 404)
        throw Error(
          "v3.2.0 backend upgrade is required. Ask the NPI owner to apply migration 008 after 007.",
        );
      throw e;
    }
  }
  fieldAction(action, body, requestId = crypto.randomUUID()) {
    return this.request("/rest/v1/rpc/npi_field_action", {
      method: "POST",
      body: { p_action: action, p_body: body, p_request: requestId },
    });
  }
  visitAction(action, body, requestId = crypto.randomUUID()) {
    return this.request("/rest/v1/rpc/npi_visit_action", {
      method: "POST",
      body: { p_action: action, p_body: body, p_request: requestId },
    });
  }
  async uploadFieldEvidence(work, item, status = () => {}) {
    const user = (await this.snapshot()).profile.id;
    const base = work.id + "/" + user + "/" + item.id;
    item.originalPath ||=
      base +
      "-original." +
      ({
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/heic": "heic",
        "image/heif": "heif",
        "image/tiff": "tif",
        "image/gif": "gif",
        "image/bmp": "bmp",
        "image/avif": "avif",
        "application/pdf": "pdf",
      }[item.mime] || "bin");
    item.previewPath ||= item.preview ? base + "-stamped.jpg" : null;
    const put = async (path, file, mime) => {
      try {
        await this.request("/storage/v1/object/work-evidence/" + path, {
          method: "POST",
          raw: true,
          body: file,
          headers: { "Content-Type": mime, "x-upsert": "false" },
        });
      } catch (e) {
        if (e.status !== 409) throw e;
        const url = await this.fileUrl(path);
        const found = await this.fetcher(url, { method: "GET" });
        if (!found.ok)
          throw Error(
            "Existing upload could not be verified. Keep the local photo and retry.",
          );
        const hash = async (b) =>
          Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", b)))
            .map((n) => n.toString(16).padStart(2, "0"))
            .join("");
        if (
          (await hash(await found.arrayBuffer())) !==
          (await hash(await file.arrayBuffer()))
        )
          throw Error(
            "Existing upload differs from this photo. Contact your administrator; the local original is retained.",
          );
      }
    };
    if (!item.originalUploaded) {
      await put(item.originalPath, item.file, item.mime);
      item.originalUploaded = true;
    }
    if (item.preview && !item.previewUploaded) {
      status("Uploading viewing copy…");
      await put(item.previewPath, item.preview, "image/jpeg");
      item.previewUploaded = true;
    }
    status("Saving evidence record…");
    return this.fieldAction(
      "evidence",
      {
        id: work.id,
        path: item.originalPath,
        preview_path: item.previewPath,
        stage: item.stage,
        source: item.source,
        captured_at: item.source === "app-camera" ? item.time : null,
        filename: item.file.name,
        original_mime: item.mime,
        bytes: item.file.size,
        issue_id: item.issue_id,
        service_line_id: item.service_line_id || null,
      },
      item.id,
    );
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
