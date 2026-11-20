import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
const code = await readFile("public/live/sw.js", "utf8");
function worker(failCore = false) {
  const handlers = {},
    added = [],
    deleted = [];
  let skipped = false;
  const cache = {
    addAll: async (paths) => {
      added.push(...paths);
      if (failCore) throw Error("Core missing");
    },
    add: async (p) => {
      added.push(p);
      if (p.includes("boney")) throw Error("Optional missing");
    },
    put: async () => {},
  };
  vm.runInNewContext(code, {
    URL,
    Response,
    location: { origin: "https://app.test" },
    self: {
      registration: { scope: "https://app.test/live/" },
      addEventListener: (k, v) => (handlers[k] = v),
      skipWaiting: () => {
        skipped = true;
      },
      clients: { claim: async () => {} },
    },
    caches: {
      open: async () => cache,
      delete: async (k) => deleted.push(k),
      keys: async () => [],
      match: async () => null,
    },
    fetch: async () => new Response("ok"),
  });
  return {
    handlers,
    added,
    deleted,
    get skipped() {
      return skipped;
    },
  };
}
test("service worker tolerates an optional missing image and leaves decoders lazy", async () => {
  const w = worker();
  let install;
  w.handlers.install({ waitUntil: (p) => (install = p) });
  await install;
  assert.ok(w.added.includes("./app.js"));
  assert.ok(!w.added.includes("./vendor/image-decoders.js"));
  assert.equal(w.skipped, false);
  w.handlers.message({ data: { type: "APPLY_UPDATE" } });
  assert.equal(w.skipped, true);
});
test("essential cache failure rejects installation and removes the incomplete cache", async () => {
  const w = worker(true);
  let install;
  w.handlers.install({ waitUntil: (p) => (install = p) });
  await assert.rejects(install, /Core missing/);
  assert.deepEqual(w.deleted, ["npi-live-v3.1.0"]);
});
test("private evidence and API requests are never handled by the shell cache", () => {
  const w = worker();
  let handled = false;
  for (const url of [
    "https://supabase.test/storage/v1/private.jpg",
    "https://app.test/rest/v1/data",
  ])
    w.handlers.fetch({
      request: { url, method: "GET" },
      respondWith: () => {
        handled = true;
      },
    });
  assert.equal(handled, false);
});
