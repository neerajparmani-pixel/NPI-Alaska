import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
const db = new PGlite();
const npi = crypto.randomUUID(),
  sub = crypto.randomUUID(),
  worker = crypto.randomUUID(),
  foreign = crypto.randomUUID(),
  co = crypto.randomUUID(),
  other = crypto.randomUUID(),
  site = crypto.randomUUID(),
  task = crypto.randomUUID();
let work, issue;
async function as(id) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
}
async function rpc(fn, a, b, req = crypto.randomUUID()) {
  return (
    await db.query(`select ${fn}($1,$2::jsonb,$3)result`, [
      a,
      JSON.stringify(b),
      req,
    ])
  ).rows[0].result;
}
const field = (a, b, r) => rpc("npi_field_action", a, b, r);
const live = (a, b, r) => rpc("npi_live_action", a, b, r);
before(async () => {
  await db.exec(
    "create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}');create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,storage to anon,authenticated,service_role;grant select on auth.users to service_role;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb);alter table storage.objects enable row level security;grant select,insert on storage.objects to authenticated;",
  );
  for (const name of [
    "001-foundation",
    "002-live-access",
    "004-operations-invitations",
    "005-field-operations",
    "006-worker-led-visits",
    "007-v3-1-hardening",
  ])
    await db.exec(await readFile("setup/supabase/" + name + ".sql", "utf8"));
  await db.query("insert into auth.users(id)select unnest($1::uuid[])", [
    [npi, sub, worker, foreign],
  ]);
  await db.query(
    "insert into npi_companies(id,name)values($1,'North'),($2,'Other')",
    [co, other],
  );
  for (const [id, role, c] of [
    [npi, "npi", null],
    [sub, "sub", co],
    [worker, "worker", co],
    [foreign, "worker", other],
  ])
    await db.query(
      "insert into npi_profiles(id,username,display_name,role,company_id,account_status)values($1::uuid,$1::text,$2,$2,$3,'approved')",
      [id, role, c],
    );
  await db.query("insert into npi_sites(id,name)values($1,'Boney')", [site]);
  await db.query("insert into npi_tasks(id,name)values($1,'Snow clearing')", [
    task,
  ]);
  await as(npi);
  const contract = await rpc("npi_ops_action", "create_contract", {
    name: "Court services",
    client: "Customer",
  });
  await rpc("npi_ops_action", "assign_scope", {
    contract_id: contract.id,
    company_id: co,
    site_id: site,
  });
  await as(sub);
  work = await live("create_work", {
    contract_id: contract.id,
    company_id: co,
    site_id: site,
    task_id: task,
    planned_date: "2026-11-20",
    members: [worker],
    checklist: ["Clear path"],
    title: "Clear route",
  });
});
after(async () => db.close());
let v, parent, parent2, cameraA, cameraB;
const visit = (a, b, req) => rpc("npi_visit_action", a, b, req);
async function row() {
  return (await db.query("select *from npi_work_orders where id=$1", [v]))
    .rows[0];
}
async function photo(stage = "before", source = "app-camera") {
  const path = `${v}/${worker}/${crypto.randomUUID()}.jpg`;
  await db.exec("reset role");
  await db.query(
    "insert into storage.objects(bucket_id,name,owner_id,metadata)values('work-evidence',$1,$2,'{\"mimetype\":\"image/jpeg\"}')",
    [path, worker],
  );
  await as(worker);
  return (
    await field("evidence", {
      id: v,
      path,
      preview_path: path,
      stage,
      source,
      captured_at: source === "app-camera" ? new Date().toISOString() : null,
      filename: "ruler.jpg",
      original_mime: "image/jpeg",
      bytes: 100,
    })
  ).id;
}
async function measure(line, evidence, inches) {
  const w = await row();
  return visit("save_line", {
    id: line.id,
    work_id: v,
    version: w.version,
    line_version: line.version,
    quantity: 1,
    snow_inches: inches,
    ruler_evidence: evidence,
    measurement_confirmed: true,
    completed: true,
  });
}
test("007 loads, defaults email summaries off and guards complete snow coverage", async () => {
  await as(npi);
  await field("notification_settings", {
    emails: ["manager@example.test"],
    escalation_minutes: 60,
  });
  await db.exec("reset role");
  assert.equal(
    (
      await db.query(
        "select daily_summary from npi_notification_settings where scope='npi'",
      )
    ).rows[0].daily_summary,
    false,
  );
  await as(npi);
  const contract = (await db.query("select id from npi_contracts limit 1"))
    .rows[0].id;
  parent = await visit("save_item", {
    contract_id: contract,
    task_id: task,
    code: "A",
    name: "Clear snow",
    unit: "visit",
    snow_required: true,
  });
  let p = (
    await db.query("select *from npi_service_items where id=$1", [parent.id])
  ).rows[0];
  assert.equal(p.active, false);
  await assert.rejects(
    visit("save_item", { id: p.id, version: p.version, active: true }),
    /bands/,
  );
  for (const [code, min, max] of [
    ["A1", 2, 4],
    ["A2", 4, 8],
    ["A3", 8, null],
  ])
    await visit("save_item", {
      contract_id: contract,
      parent_id: p.id,
      task_id: task,
      code,
      name: code,
      unit: "visit",
      min_inches: min,
      max_inches: max,
    });
  await visit("save_item", { id: p.id, version: p.version, active: true });
  const band = (
    await db.query("select *from npi_service_items where code='A2'")
  ).rows[0];
  await assert.rejects(
    visit("save_item", { id: band.id, version: band.version, active: false }),
    /contiguous/,
  );
  parent2 = await visit("save_item", {
    contract_id: contract,
    task_id: task,
    code: "D",
    name: "Sidewalk snow",
    unit: "visit",
    snow_required: true,
  });
  await visit("save_item", {
    contract_id: contract,
    parent_id: parent2.id,
    task_id: task,
    code: "D1",
    name: "2 inches and above",
    unit: "visit",
    min_inches: 2,
  });
  const p2 = (
    await db.query("select *from npi_service_items where id=$1", [parent2.id])
  ).rows[0];
  await visit("save_item", { id: p2.id, version: p2.version, active: true });
  await as(worker);
  const scope = (await db.query("select id from npi_contract_scopes limit 1"))
    .rows[0].id;
  v = (
    await visit("create_visit", {
      scope_id: scope,
      line_id: parent.id,
      members: [worker],
    })
  ).id;
  assert.equal((await row()).planned_date, null);
});
test("partial outcome alone cannot bypass evidence; ruler files and shared ruler IDs are rejected", async () => {
  await as(worker);
  let w = await row();
  await field("outcome", {
    id: v,
    version: w.version,
    outcome: "partial",
    reason: "Weather interrupted the work",
    evidence_exception_reason: "",
  });
  w = await row();
  await assert.rejects(
    live("clock", {
      id: v,
      version: w.version,
      event_kind: "check-in",
      members: [worker],
      device_time: new Date().toISOString(),
      latitude: 61,
      longitude: -149,
      accuracy_metres: 10,
    }),
    /Before photos/,
  );
  const file = await photo("before", "file");
  let line = (
    await db.query("select *from npi_visit_lines where work_id=$1", [v])
  ).rows[0];
  await assert.rejects(measure(line, file, 1), /directly/);
  cameraA = await photo();
  await measure(line, cameraA, 1);
  assert.equal(
    (
      await db.query(
        "select review_required from npi_visit_lines where id=$1",
        [line.id],
      )
    ).rows[0].review_required,
    true,
  );
  w = await row();
  await visit("add_service", {
    work_id: v,
    version: w.version,
    line_id: parent2.id,
  });
  line = (
    await db.query(
      "select *from npi_visit_lines where work_id=$1 and line_id=$2",
      [v, parent2.id],
    )
  ).rows[0];
  await assert.rejects(
    measure(line, cameraA, 3),
    /already used|another service/,
  );
  cameraB = await photo();
  await measure(line, cameraB, 3);
  w = await row();
  await live("clock", {
    id: v,
    version: w.version,
    event_kind: "check-in",
    members: [worker],
    device_time: new Date().toISOString(),
    latitude: 61,
    longitude: -149,
    accuracy_metres: 10,
  });
  assert.ok((await row()).service_date);
  assert.ok((await row()).planned_date);
});
test("explicit missing-evidence reason is reported per worker and both admins acknowledge below-threshold work", async () => {
  await as(worker);
  let w = await row();
  await live("clock", {
    id: v,
    version: w.version,
    event_kind: "check-out",
    members: [worker],
    device_time: new Date().toISOString(),
    latitude: 61,
    longitude: -149,
    accuracy_metres: 10,
  });
  w = await row();
  await assert.rejects(
    live("submit_hours", { id: v, version: w.version, use_recorded: true }),
    /After photos/,
  );
  await field("outcome", {
    id: v,
    version: w.version,
    outcome: "partial",
    reason: "Interrupted by weather",
    evidence_exception_reason:
      "After-photo capture was unavailable; inspect before evidence",
  });
  w = await row();
  await live("submit_hours", { id: v, version: w.version, use_recorded: true });
  await as(sub);
  const context = (await db.query("select npi_visit_context()v")).rows[0].v;
  assert.equal(context.release, "3.1.0");
  assert.equal(context.exceptions[0].exception_visits, 1);
  assert.equal(context.exceptions[0].exception_percent, 100);
  w = await row();
  await assert.rejects(
    live("company_approve", {
      id: v,
      version: w.version,
      acknowledge_outcome: true,
    }),
    /below-threshold/,
  );
  await live("company_approve", {
    id: v,
    version: w.version,
    acknowledge_outcome: true,
    acknowledge_below_threshold: true,
  });
  await as(npi);
  w = await row();
  await live("npi_approve", {
    id: v,
    version: w.version,
    acknowledge_outcome: true,
    acknowledge_below_threshold: true,
    accept_claimed: true,
  });
  assert.equal((await row()).status, "approved");
});
test("failed snow reads refund successful quota while attempts and concurrent calls remain bounded", async () => {
  await as(worker);
  const a = (await db.query("select npi_snow_read_reserve($1)v", [cameraA]))
      .rows[0].v,
    b = (await db.query("select npi_snow_read_reserve($1)v", [cameraB])).rows[0]
      .v;
  await assert.rejects(
    db.query("select npi_snow_read_reserve($1)", [cameraA]),
    /limit/,
  );
  await db.exec("reset role;set role service_role");
  await db.query("select npi_snow_read_finish($1,false)", [a.attempt_id]);
  await db.query("select npi_snow_read_finish($1,false)", [b.attempt_id]);
  for (let i = 0; i < 10; i++) {
    await as(worker);
    const a = (await db.query("select npi_snow_read_reserve($1)v", [cameraA]))
      .rows[0].v;
    await db.exec("reset role;set role service_role");
    await db.query("select npi_snow_read_finish($1,true)", [a.attempt_id]);
  }
  await as(worker);
  await assert.rejects(
    db.query("select npi_snow_read_reserve($1)", [cameraA]),
    /limit/,
  );
});
test("stale prepared visits expire without deleting evidence and public invitation limits are service-only", async () => {
  await db.exec("reset role");
  const w = await row();
  const id = crypto.randomUUID();
  await db.query(
    "insert into npi_work_orders(id,company_id,site_id,task_id,contract_id,planned_date,title,kind,checklist,worker_led,last_activity_at)values($1,$2,$3,$4,$5,null,'Stale visit','site','[]',true,now()-interval '25 hours')",
    [id, co, site, task, w.contract_id],
  );
  await db.exec("set role service_role");
  await db.query("select npi_expire_prepared()");
  await db.exec("reset role");
  assert.equal(
    (await db.query("select status from npi_work_orders where id=$1", [id]))
      .rows[0].status,
    "cancelled",
  );
  assert.ok(
    (
      await db.query(
        "select count(*)::int n from npi_evidence where work_id=$1",
        [v],
      )
    ).rows[0].n > 0,
  );
  await as(worker);
  await assert.rejects(
    db.query("select npi_public_gate('test','preview')"),
    /permission/,
  );
  await db.exec("reset role;set role service_role");
  for (let i = 0; i < 11; i++) {
    const ok = (
      await db.query("select npi_public_gate('hashed-test','registration')v")
    ).rows[0].v;
    assert.equal(ok, i < 10);
  }
});
test("literal work search treats percent and underscore as text", async () => {
  await db.exec("reset role");
  await db.query("update npi_work_orders set title='Snow_50%'where id=$1", [v]);
  await as(npi);
  const d = (await db.query('select npi_work_search(\'{"q":"_50%"}\')v'))
    .rows[0].v;
  assert.equal(d.total, 1);
  assert.equal(d.rows[0].id, v);
});

test("first check-in fixes Alaska service date and overnight DST hours use elapsed instants", async () => {
  await as(worker);
  const scope = (await db.query("select id from npi_contract_scopes limit 1"))
    .rows[0].id;
  const id = (
    await visit("create_visit", {
      scope_id: scope,
      line_id: parent.id,
      members: [worker],
    })
  ).id;
  await db.exec("reset role");
  for (const [kind, instant] of [
    ["check-in", "2026-11-01T08:30:00Z"],
    ["check-out", "2026-11-01T12:30:00Z"],
  ])
    await db.query(
      "insert into npi_attendance_events(work_id,worker_id,captured_by,event_kind,device_time,received_at,latitude,longitude,accuracy_metres,idempotency_key)values($1,$2,$2,$3,$4,$4,61,-149,10,$5)",
      [id, worker, kind, instant, crypto.randomUUID()],
    );
  const w = (
    await db.query(
      "select service_date::text,planned_date::text from npi_work_orders where id=$1",
      [id],
    )
  ).rows[0];
  assert.equal(w.service_date, "2026-11-01");
  assert.equal(w.planned_date, "2026-11-01");
  assert.equal(
    Number(
      (
        await db.query("select npi_recorded_minutes($1,$2)minutes", [
          id,
          worker,
        ])
      ).rows[0].minutes,
    ),
    240,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from npi_open_attendance where worker_id=$1",
        [worker],
      )
    ).rows[0].n,
    0,
  );
});
test("digest runs once per opted-in scope and day, including repeated dispatcher runs", async () => {
  await db.exec("reset role");
  await db.query(
    "update npi_notification_settings set daily_summary=true,last_digest_date=null where scope='npi'",
  );
  // Pick an existing 07:00-or-later Alaska date through the DB clock where possible.
  const hour = (
    await db.query(
      "select extract(hour from now()at time zone 'America/Anchorage')::int h",
    )
  ).rows[0].h;
  await db.exec("set role service_role");
  await db.query("select *from npi_email_claim()");
  await db.query("select *from npi_email_claim()");
  await db.exec("reset role");
  const r = (
    await db.query(
      "select last_digest_date::text d from npi_notification_settings where scope='npi'",
    )
  ).rows[0];
  const count = (
    await db.query(
      "select count(*)::int n from npi_email_outbox where dedupe like 'daily:npi:%'",
    )
  ).rows[0].n;
  assert.equal(count, hour >= 7 ? 1 : 0);
  assert.equal(Boolean(r.d), hour >= 7);
});
