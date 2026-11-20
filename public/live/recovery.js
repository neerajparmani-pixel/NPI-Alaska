// Account-scoped device recovery. No passwords are stored.
export class SessionBridge {
  constructor(onExternal, scope = "alaska") {
    this.key = "npi-auth-v1:" + scope;
    this.onExternal = onExternal;
    if (typeof window !== "undefined") {
      window.addEventListener("storage", (e) => {
        if (e.key === this.key) this.onExternal(this.read());
      });
      if (globalThis.BroadcastChannel) {
        this.channel = new BroadcastChannel(this.key);
        this.channel.onmessage = () => this.onExternal(this.read());
      }
    }
  }
  read() {
    try {
      const x = JSON.parse(
        globalThis.localStorage?.getItem(this.key) || "null",
      );
      return x &&
        typeof x.access_token === "string" &&
        typeof x.refresh_token === "string" &&
        typeof x.userId === "string" &&
        Number.isFinite(x.deadline) &&
        x.deviceUntil > Date.now()
        ? x
        : null;
    } catch {
      return null;
    }
  }
  write(session) {
    try {
      if (!globalThis.localStorage) return false;
      localStorage.setItem(this.key, JSON.stringify(session));
      this.channel?.postMessage("updated");
      return true;
    } catch {
      return false;
    }
  }
  clear() {
    try {
      globalThis.localStorage?.removeItem(this.key);
      this.channel?.postMessage("cleared");
    } catch {}
  }
  lock(fn) {
    return globalThis.navigator?.locks
      ? navigator.locks.request("npi-auth-refresh", fn)
      : fn();
  }
}
export class PhotoStore {
  constructor() {
    this.disabled = false;
  }
  async db() {
    if (!globalThis.indexedDB)
      throw Error(
        "Device recovery is unavailable in this browser. Keep this page open.",
      );
    if (!this.opening)
      this.opening = new Promise((resolve, reject) => {
        const req = indexedDB.open("npi-private-photos", 1);
        req.onupgradeneeded = () => {
          const s = req.result.createObjectStore("queue", { keyPath: "key" });
          s.createIndex("owner", "owner");
          s.createIndex("visit", "visit");
        };
        req.onsuccess = () => {
          req.result.onversionchange = () => {
            req.result.close();
            this.opening = null;
          };
          resolve(req.result);
        };
        req.onerror = () => reject(req.error);
        req.onblocked = () =>
          reject(Error("Close older app tabs to enable device recovery."));
      });
    return this.opening;
  }
  async run(mode, fn) {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const t = db.transaction("queue", mode);
      let result;
      fn(t.objectStore("queue"), (v) => (result = v));
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error || Error("Device storage failed"));
      t.onabort = () => reject(t.error || Error("Device storage failed"));
    });
  }
  async list(owner, work) {
    return this.run("readonly", (s, done) => {
      const q = s.index("owner").getAll(owner);
      q.onsuccess = () =>
        done(q.result.filter((r) => !work || r.workId === work));
    });
  }
  async put(owner, workId, item) {
    if (!this.requestedPersistence) {
      this.requestedPersistence = true;
      globalThis.navigator?.storage?.persist?.().catch(() => {});
    }
    const rows = await this.list(owner);
    const bytes =
      rows
        .filter((r) => r.id !== item.id)
        .reduce((n, r) => n + r.file.size + (r.preview?.size || 0), 0) +
      item.file.size +
      (item.preview?.size || 0);
    if (bytes > 150 * 1024 * 1024)
      throw Error(
        "Device photo recovery is full. Upload or remove saved drafts first.",
      );
    const { url, persisted, persist, ...record } = item;
    return this.run("readwrite", (s) =>
      s.put({
        ...record,
        key: owner + "|" + item.id,
        owner,
        workId,
        visit: owner + "|" + workId,
        filename: item.file.name,
      }),
    );
  }
  remove(owner, id) {
    return this.run("readwrite", (s) => s.delete(owner + "|" + id));
  }
  async clear(owner) {
    return this.run("readwrite", (s) => {
      const q = s.index("owner").openCursor(IDBKeyRange.only(owner));
      q.onsuccess = () => {
        const c = q.result;
        if (c) {
          c.delete();
          c.continue();
        }
      };
    });
  }
}
export const photoStore = new PhotoStore();
