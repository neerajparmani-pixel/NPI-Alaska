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
test("field migration, assignment attribution and notification recipient permissions", async () => {
  await as(npi);
  await field("notification_settings", {
    emails: ["npi@example.test"],
    escalation_minutes: 60,
  });
  await as(sub);
  await field("notification_settings", {
    emails: ["company@example.test"],
    escalation_minutes: 60,
  });
  const w = (await db.query("select * from npi_work_orders")).rows[0];
  assert.equal(w.created_by, sub);
  await as(worker);
  await assert.rejects(
    field("notification_settings", { emails: [], escalation_minutes: 60 }),
    /Administrator/,
  );
  await assert.rejects(
    db.query("select * from npi_email_outbox"),
    /permission/,
  );
});
test("issue reporting creates two-admin email outbox, idempotent retry and foreign isolation", async () => {
  await as(worker);
  const req = crypto.randomUUID(),
    body = {
      id: work.id,
      category: "safety",
      urgency: "urgent",
      description: "Blocked entrance",
    };
  issue = await field("report_issue", body, req);
  assert.deepEqual(await field("report_issue", body, req), issue);
  await as(foreign);
  await assert.rejects(field("report_issue", body), /access denied/);
  const snap = (await db.query("select npi_field_snapshot()result")).rows[0]
    .result;
  assert.equal(snap.issues.length, 0);
  await db.exec("reset role");
  assert.equal(
    (await db.query("select count(*)::int n from npi_email_outbox")).rows[0].n,
    2,
  );
});
test("issue workflow enforces resolution reason and preserves comments", async () => {
  await as(sub);
  await assert.rejects(
    field("issue_update", {
      id: issue.id,
      version: 1,
      status: "resolved",
      resolution: "",
    }),
    /resolution/,
  );
  await field("issue_comment", { id: issue.id, comment: "Team informed" });
  await field("issue_update", {
    id: issue.id,
    version: 1,
    status: "resolved",
    resolution: "Entrance made safe",
    owner_id: sub,
  });
  await as(worker);
  const s = (await db.query("select npi_field_snapshot()result")).rows[0]
    .result;
  assert.equal(s.issues[0].status, "resolved");
  assert.equal(s.comments.length, 1);
  assert.equal(s.settings.length, 0);
});
test("before/after evidence and partial-work safeguards are server side", async () => {
  await as(worker);
  await assert.rejects(
    live("submit_hours", { id: work.id, version: 1, use_recorded: true }),
    /before and after/,
  );
  await field("outcome", {
    id: work.id,
    outcome: "unable",
    reason: "Unsafe access",
    version: 1,
  }).catch((e) => assert.match(e.message, /active/));
  await as(sub);
  await assert.rejects(
    field("work_plan", { id: work.id, version: 1, reason: "", area: "Lot" }),
    /Explain/,
  );
});
test("scheduled copies, paginated work search and unchanged worker scope", async () => {
  await as(sub);
  const request = crypto.randomUUID(),
    body = {
      id: work.id,
      count: 2,
      interval_days: 7,
      first_date: "2026-12-01",
    };
  await field("repeat_work", body, request);
  await field("repeat_work", body, request);
  const result = (await db.query("select npi_work_search('{}',1) result"))
    .rows[0].result;
  assert.equal(result.total, 3);
  assert.equal(result.rows.filter((w) => w.repeat_group === request).length, 2);
  await as(foreign);
  assert.equal(
    (await db.query("select npi_work_search('{}',1) result")).rows[0].result
      .total,
    0,
  );
});
test("staged originals, checkout and both review stages preserve immutable evidence", async () => {
  await as(worker);
  const version = async () =>
    Number(
      (
        await db.query("select version from npi_work_orders where id=$1", [
          work.id,
        ])
      ).rows[0].version,
    );
  await live("clock", {
    id: work.id,
    version: await version(),
    event_kind: "check-in",
    members: [worker],
    device_time: new Date().toISOString(),
    latitude: 61.2,
    longitude: -149.9,
    accuracy_metres: 12,
  });
  for (const stage of ["before", "after"]) {
    const path = work.id + "/" + worker + "/" + crypto.randomUUID() + ".png",
      preview = path + ".jpg";
    await db.query(
      "insert into storage.objects(bucket_id,name,owner_id,metadata)values('work-evidence',$1,$2,'{\"mimetype\":\"image/png\"}'),('work-evidence',$3,$2,'{\"mimetype\":\"image/jpeg\"}')",
      [path, worker, preview],
    );
    await field("evidence", {
      id: work.id,
      path,
      preview_path: preview,
      stage,
      source: "file",
      filename: stage + ".png",
      original_mime: "image/png",
      bytes: 5,
    });
  }
  await live("tasks", {
    id: work.id,
    version: await version(),
    completed_tasks: [0],
    loads: 0,
  });
  await db.exec("reset role");
  await db.query(
    "update npi_attendance_events set received_at=now()-interval '1 hour',device_time=now()-interval '1 hour'where work_id=$1",
    [work.id],
  );
  await as(worker);
  await live("clock", {
    id: work.id,
    version: await version(),
    event_kind: "check-out",
    members: [worker],
    device_time: new Date().toISOString(),
    latitude: 61.21,
    longitude: -149.91,
    accuracy_metres: 12,
  });
  await live("submit_hours", {
    id: work.id,
    version: await version(),
    use_recorded: true,
  });
  await as(sub);
  await live("company_approve", { id: work.id, version: await version() });
  await as(npi);
  await live("npi_approve", {
    id: work.id,
    version: await version(),
    accept_claimed: true,
  });
  assert.equal(
    (
      await db.query("select status from npi_work_orders where id=$1", [
        work.id,
      ])
    ).rows[0].status,
    "approved",
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from npi_evidence where work_id=$1",
        [work.id],
      )
    ).rows[0].n,
    2,
  );
});
test("email jobs require service authority and claims do not race or duplicate", async () => {
  await as(worker);
  await assert.rejects(
    db.query("select * from npi_email_claim()"),
    /permission denied/,
  );
  await db.exec("reset role;set role service_role");
  const first = (await db.query("select * from npi_email_claim()")).rows;
  assert.ok(first.length >= 2);
  assert.equal(
    (await db.query("select * from npi_email_claim()")).rows.length,
    0,
  );
  await db.query("select npi_email_result($1,true,$2,null)", [
    first[0].id,
    "provider-example",
  ]);
  assert.equal(
    (
      await db.query("select status from npi_email_outbox where id=$1", [
        first[0].id,
      ])
    ).rows[0].status,
    "sent",
  );
});
test("partial work can be submitted without fabricated photos, but both approvals require acknowledgement", async () => {
  await as(worker);
  const row = (
    await db.query("select * from npi_work_orders where status='draft' limit 1")
  ).rows[0];
  const version = async () =>
    Number(
      (
        await db.query("select version from npi_work_orders where id=$1", [
          row.id,
        ])
      ).rows[0].version,
    );
  await live("clock", {
    id: row.id,
    version: await version(),
    event_kind: "check-in",
    members: [worker],
    device_time: new Date().toISOString(),
    latitude: 61.2,
    longitude: -149.9,
    accuracy_metres: 12,
  });
  await field("outcome", {
    id: row.id,
    version: await version(),
    outcome: "partial",
    reason: "Entrance inaccessible; remaining work must be rescheduled",
  });
  await live("clock", {
    id: row.id,
    version: await version(),
    event_kind: "check-out",
    members: [worker],
    device_time: new Date().toISOString(),
    latitude: 61.2,
    longitude: -149.9,
    accuracy_metres: 12,
  });
  await live("submit_hours", {
    id: row.id,
    version: await version(),
    use_recorded: true,
  });
  await as(sub);
  await assert.rejects(
    live("company_approve", { id: row.id, version: await version() }),
    /acknowledge/,
  );
  await live("company_approve", {
    id: row.id,
    version: await version(),
    acknowledge_outcome: true,
  });
  await as(npi);
  await assert.rejects(
    live("npi_approve", {
      id: row.id,
      version: await version(),
      accept_claimed: true,
    }),
    /acknowledge/,
  );
  await live("npi_approve", {
    id: row.id,
    version: await version(),
    accept_claimed: true,
    acknowledge_outcome: true,
  });
  assert.equal(
    (
      await db.query("select outcome from npi_work_orders where id=$1", [
        row.id,
      ])
    ).rows[0].outcome,
    "partial",
  );
});
