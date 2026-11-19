import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
const ids = {
  npi: "10000000-0000-0000-0000-000000000001",
  sub: "10000000-0000-0000-0000-000000000002",
  worker: "10000000-0000-0000-0000-000000000003",
  foreign: "10000000-0000-0000-0000-000000000004",
  company: "20000000-0000-0000-0000-000000000001",
  other: "20000000-0000-0000-0000-000000000002",
  site: "30000000-0000-0000-0000-000000000001",
  task: "40000000-0000-0000-0000-000000000001",
};
let work;
async function as(id) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
}
async function act(action, body, request = crypto.randomUUID()) {
  return (
    await db.query(
      "select public.npi_live_action($1,$2::jsonb,$3::uuid) result",
      [action, JSON.stringify(body), request],
    )
  ).rows[0].result;
}
async function snap() {
  return (await db.query("select public.npi_live_snapshot() result")).rows[0]
    .result;
}
before(async () => {
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth,storage to authenticated,anon,service_role;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb);alter table storage.objects enable row level security;grant select,insert on storage.objects to authenticated;`,
  );
  await db.exec(await fs.readFile("setup/supabase/001-foundation.sql", "utf8"));
  await db.exec(
    await fs.readFile("setup/supabase/002-live-access.sql", "utf8"),
  );
  await db.query("insert into auth.users(id) select unnest($1::uuid[])", [
    Object.values(ids).slice(0, 4),
  ]);
  await db.query(
    "insert into npi_companies(id,name) values($1,'North'),($2,'Other')",
    [ids.company, ids.other],
  );
  for (const [who, role, company] of [
    ["npi", "npi", null],
    ["sub", "sub", ids.company],
    ["worker", "worker", ids.company],
    ["foreign", "worker", ids.other],
  ])
    await db.query(
      "insert into npi_profiles(id,username,display_name,role,company_id) values($1,$2,$2,$3,$4)",
      [ids[who], who, role, company],
    );
  await db.query("insert into npi_sites(id,name) values($1,'Boney')", [
    ids.site,
  ]);
  await db.query("insert into npi_tasks(id,name) values($1,'Snow clearing')", [
    ids.task,
  ]);
});
after(async () => db.close());
test("database migration installs and RLS denies unauthenticated/foreign mutations", async () => {
  await db.exec("set role anon");
  await assert.rejects(
    db.query("select * from npi_work_orders"),
    /permission denied/,
  );
  await as(ids.worker);
  await assert.rejects(
    act("save_company", { name: "Bad" }),
    /administrator required/,
  );
  await assert.rejects(
    db.query("update npi_profiles set role='npi'"),
    /permission denied/,
  );
  await as(ids.npi);
  const req = crypto.randomUUID();
  const input = {
    company_id: ids.company,
    site_id: ids.site,
    task_id: ids.task,
    planned_date: "2026-11-18",
    members: [ids.worker],
    checklist: ["Clear route"],
    kind: "site",
    title: "Assigned work",
  };
  work = (await act("create_work", input, req)).id;
  assert.equal((await act("create_work", input, req)).id, work);
  await assert.rejects(
    act("create_work", { ...input, title: "changed" }, req),
    /different content/,
  );
  await as(ids.foreign);
  assert.equal((await snap()).work.length, 0);
  await assert.rejects(act("clock", { id: work, version: 1 }), /access denied/);
});
test("database preserves original GPS, stages company before NPI and rejects stale/reused mutations", async () => {
  await as(ids.worker);
  await assert.rejects(
    act("clock", {
      id: work,
      version: 1,
      members: [ids.worker],
      event_kind: "check-in",
    }),
    /location required/,
  );
  const input = {
    id: work,
    version: 1,
    members: [ids.worker],
    event_kind: "check-in",
    device_time: new Date().toISOString(),
    latitude: 61.2,
    longitude: -149.9,
    accuracy_metres: 10,
  };
  const nonce = crypto.randomUUID();
  await act("clock", input, nonce);
  await act("clock", input, nonce);
  assert.equal((await snap()).events.length, 1);
  await assert.rejects(act("clock", input), /changed/);
  await act("clock", {
    ...input,
    version: 2,
    event_kind: "check-out",
    device_time: new Date().toISOString(),
    latitude: 61.21,
    break_minutes: 0,
  });
  await act("tasks", { id: work, version: 3, completed_tasks: [0], loads: 0 });
  const path = work + "/" + ids.worker + "/photo.jpg";
  await db.exec("reset role");
  await db.query(
    "insert into storage.objects(bucket_id,name,owner_id,metadata) values('work-evidence',$1,$2,'{\"mimetype\":\"image/jpeg\"}')",
    [path, ids.worker],
  );
  await as(ids.worker);
  await act("evidence", { id: work, version: 4, path, kind: "photo" });
  await act("submit_hours", {
    id: work,
    version: 5,
    claimed_minutes: 105,
    reason: "Corrected claim for review",
  });
  await as(ids.npi);
  await assert.rejects(
    act("npi_approve", {
      id: work,
      version: 6,
      accepted_minutes: { [ids.worker]: 105 },
    }),
    /precede/,
  );
  await as(ids.sub);
  await act("company_approve", { id: work, version: 6 });
  await as(ids.npi);
  await assert.rejects(
    act("npi_approve", {
      id: work,
      version: 7,
      accepted_minutes: { [ids.worker]: 90 },
    }),
    /reason/,
  );
  await act("npi_approve", {
    id: work,
    version: 7,
    accepted_minutes: { [ids.worker]: 105 },
  });
  const data = await snap();
  assert.equal(data.work[0].status, "approved");
  assert.equal(data.events[0].latitude, 61.21);
  assert.equal(Number(data.reviews[0].accepted_minutes), 105);
  await assert.rejects(
    db.query("update npi_attendance_events set latitude=0"),
    /permission denied/,
  );
});
test("separate effective rates, private customer prices and locked draft snapshots", async () => {
  await as(ids.npi);
  const r = {
    site_id: ids.site,
    task_id: ids.task,
    side: "customer",
    basis: "hourly",
    amount_cents: 2500,
    effective_from: "2026-01-01",
  };
  const rate = (await act("save_rate", r)).id;
  await assert.rejects(act("save_rate", r), /Overlapping/);
  await act("draft_document", {
    kind: "customer-invoice",
    reference: "TEST-1",
    work_id: work,
    rate_id: rate,
    quantity: "1.75",
  });
  const d = await snap();
  assert.equal(Number(d.documents[0].subtotal_cents), 4375);
  assert.equal(d.documents[0].status, "draft");
  assert.equal(d.documents[0].tax_cents, null);
  await assert.rejects(
    act("draft_document", {
      kind: "customer-invoice",
      reference: "TEST-2",
      work_id: work,
      rate_id: rate,
      quantity: "1.75",
    }),
    /duplicate key/,
  );
  await as(ids.sub);
  assert.equal((await snap()).rates.length, 0);
  assert.equal((await snap()).documents.length, 0);
  await assert.rejects(
    act("draft_document", { kind: "customer-invoice" }),
    /permission denied/,
  );
});
test("recorded/claimed acceptance preserves exact server minutes without display-rounding changes", async () => {
  const w = "50000000-0000-0000-0000-000000000099";
  await db.exec("reset role");
  await db.query(
    "insert into npi_work_orders(id,company_id,site_id,task_id,planned_date,status,completed_tasks) values($1,$2,$3,$4,'2026-11-18','in-progress','[0,1]')",
    [w, ids.company, ids.site, ids.task],
  );
  await db.query("insert into npi_work_members values($1,$2)", [w, ids.worker]);
  await db.query(
    "insert into npi_hour_reviews(work_id,worker_id) values($1,$2)",
    [w, ids.worker],
  );
  for (const [kind, when] of [
    ["check-in", "now()-interval '105 minutes 5 seconds'"],
    ["check-out", "now()"],
  ])
    await db.query(
      `insert into npi_attendance_events(work_id,worker_id,captured_by,event_kind,device_time,received_at,latitude,longitude,accuracy_metres,idempotency_key) values($1,$2,$2,$3,${when},${when},61.2,-149.9,10,gen_random_uuid())`,
      [w, ids.worker, kind],
    );
  await db.query(
    "insert into npi_evidence(work_id,uploaded_by,path,kind) values($1,$2,$3,'photo')",
    [w, ids.worker, w + "/" + ids.worker + "/test.jpg"],
  );
  await as(ids.worker);
  await act("submit_hours", {
    id: w,
    version: 1,
    use_recorded: true,
    claimed_minutes: 99999,
  });
  let data = await snap();
  let r = data.reviews.find((r) => r.work_id === w);
  assert.ok(Number(r.claimed_minutes) > 105 && Number(r.claimed_minutes) < 106);
  await as(ids.sub);
  await act("company_approve", { id: w, version: 2 });
  await as(ids.npi);
  await act("npi_approve", {
    id: w,
    version: 3,
    accept_claimed: true,
    accepted_minutes: { [ids.worker]: 0 },
  });
  data = await snap();
  r = data.reviews.find((r) => r.work_id === w);
  assert.equal(r.accepted_minutes, r.claimed_minutes);
  await as(ids.foreign);
  await assert.rejects(
    db.query("select npi_visible_recorded_minutes($1,$2)", [w, ids.worker]),
    /access denied/,
  );
  await assert.rejects(
    db.query("select npi_sheet_hour_reviews(0)"),
    /permission denied/,
  );
});
test("NULL document kinds cannot bypass worker financial permissions", async () => {
  await as(ids.worker);
  await assert.rejects(
    act("draft_document", {
      kind: null,
      work_id: work,
      quantity: 1,
      reference: "FORBIDDEN",
    }),
    /permission denied/,
  );
  await assert.rejects(
    act("clock", { id: work, version: 8, garbage: "x".repeat(70000) }),
    /too large/,
  );
});
