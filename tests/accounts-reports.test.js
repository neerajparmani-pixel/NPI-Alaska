import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
const db = new PGlite();
const ids = Object.fromEntries(
  [
    "owner",
    "second",
    "sub",
    "worker",
    "other",
    "co",
    "co2",
    "site",
    "task",
  ].map((k) => [k, crypto.randomUUID()]),
);
async function as(id, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    id || "",
  ]);
  await db.exec("set role " + role);
}
async function ops(action, body) {
  return (
    await db.query("select npi_ops_action($1,$2::jsonb,$3)r", [
      action,
      JSON.stringify(body),
      crypto.randomUUID(),
    ])
  ).rows[0].r;
}
async function ident(mode, extra = {}) {
  await as(null, "service_role");
  return (
    await db.query("select npi_identity($1,$2,$3,$4)r", [
      mode,
      extra.username || "",
      extra.user || null,
      extra.hash || "",
    ])
  ).rows[0].r;
}
async function enroll(
  mode,
  hash,
  req,
  attempt,
  username = "new.admin",
  name = "New Admin",
  user = null,
) {
  await as(null, "service_role");
  return (
    await db.query("select npi_enroll($1,$2,$3,$4,$5,$6,$7)r", [
      mode,
      hash,
      req,
      attempt,
      username,
      name,
      user,
    ])
  ).rows[0].r;
}
async function invited(inviter, role, email, company = null) {
  await as(inviter);
  const hash = crypto.randomUUID().replaceAll("-", "").repeat(2);
  const i = await ops("create_invite", {
    role,
    email,
    company_id: company,
    token_hash: hash,
  });
  return { ...i, hash };
}
async function register(inv, username) {
  const req = crypto.randomUUID(),
    attempt = crypto.randomUUID();
  const begin = await enroll(
    "begin",
    inv.hash,
    req,
    attempt,
    username,
    username,
  );
  await db.exec("reset role");
  const user = crypto.randomUUID();
  await db.query(
    "insert into auth.users(id,email,raw_app_meta_data)values($1,$2,$3)",
    [user, begin.email, JSON.stringify({ npi_enrollment_id: req })],
  );
  await enroll("finish", inv.hash, req, attempt, username, username, user);
  return user;
}
async function verify(user) {
  const hash = crypto.randomUUID().replaceAll("-", "").repeat(2);
  await ident("issue", { user, hash });
  await db.exec("reset role");
  await db.query("update auth.users set email_confirmed_at=now()where id=$1", [
    user,
  ]);
  await ident("finish", { hash });
}
async function approve(actor, user) {
  await as(actor);
  return ops("approve_account", { id: user, version: 1 });
}
before(async () => {
  await db.exec(
    "create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_app_meta_data jsonb default '{}');create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,storage to anon,authenticated,service_role;grant select on auth.users to service_role;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb);alter table storage.objects enable row level security;grant select,insert on storage.objects to authenticated;",
  );
  for (const name of [
    "001-foundation",
    "002-live-access",
    "004-operations-invitations",
    "005-field-operations",
    "006-worker-led-visits",
    "007-v3-1-hardening",
    "008-v3-2-accounts-reports",
  ])
    await db.exec(await readFile("setup/supabase/" + name + ".sql", "utf8"));
  await db.query(
    "insert into npi_companies(id,name)values($1,'Company One'),($2,'Company Two')",
    [ids.co, ids.co2],
  );
  for (const [k, role, co] of [
    ["owner", "npi", null],
    ["second", "npi", null],
    ["sub", "sub", ids.co],
    ["worker", "worker", ids.co],
    ["other", "sub", ids.co2],
  ]) {
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at)values($1,$2,now())",
      [ids[k], k + "@example.test"],
    );
    await db.query(
      "insert into npi_profiles(id,company_id,username,display_name,role)values($1,$2,$3,$3,$4)",
      [ids[k], co, k, role],
    );
  }
  await db.query("insert into npi_sites(id,name)values($1,'Boney')", [
    ids.site,
  ]);
  await db.query("insert into npi_tasks(id,name)values($1,'Snow')", [ids.task]);
});
after(() => db.close());
let newNpi;
test("NPI invitations bind email/role, are single-use and expire in 72 hours", async () => {
  const inv = await invited(ids.owner, "npi", "new.npi@example.test");
  await as(null, "service_role");
  const preview = (
    await db.query("select npi_enroll('preview',$1)r", [inv.hash])
  ).rows[0].r;
  assert.equal(preview.role, "npi");
  assert.equal(preview.email, "new.npi@example.test");
  assert.equal(preview.company, "NPI Administration");
  newNpi = await register(inv, "new.npi");
  await assert.rejects(
    enroll(
      "begin",
      inv.hash,
      crypto.randomUUID(),
      crypto.randomUUID(),
      "intruder",
      "Intruder",
    ),
    /Invitation unavailable/,
  );
  await as(ids.owner);
  const context = (await db.query("select npi_people_context()r")).rows[0].r;
  const p = context.people.find((p) => p.id === newNpi);
  assert.equal(p.active, false);
  assert.equal(p.account_status, "pending");
  assert.equal(p.email_verified, false);
  await assert.rejects(approve(ids.owner, newNpi), /verification/);
  await as(newNpi);
  assert.equal((await db.query("select npi_role()r")).rows[0].r, null);
});
test("verified NPI registration needs the inviting NPI approval; cannot approve itself", async () => {
  await verify(newNpi);
  await assert.rejects(approve(ids.second, newNpi), /responsible/);
  await assert.rejects(approve(newNpi, newNpi), /administrator/);
  await approve(ids.owner, newNpi);
  await as(newNpi);
  assert.equal((await db.query("select npi_role()r")).rows[0].r, "npi");
});
test("subcontractor administrators remain pending until NPI approves; workers need their own company approval", async () => {
  const sub = await register(
    await invited(ids.owner, "sub", "new.sub@example.test", ids.co),
    "new.sub",
  );
  await verify(sub);
  await assert.rejects(approve(ids.sub, sub), /access denied/);
  await approve(ids.owner, sub);
  const worker = await register(
    await invited(sub, "worker", "new.worker@example.test", ids.co),
    "new.worker",
  );
  await verify(worker);
  await assert.rejects(approve(ids.owner, worker), /responsible/);
  await assert.rejects(approve(ids.other, worker), /access denied/);
  await approve(ids.sub, worker);
  await as(worker);
  assert.equal((await db.query("select npi_role()r")).rows[0].r, "worker");
  await assert.rejects(
    invited(ids.sub, "npi", "bad@example.test"),
    /permitted/,
  );
  await assert.rejects(
    invited(ids.sub, "worker", "bad@example.test", ids.co2),
    /permitted/,
  );
});
test("revoked invitations fail and replacements revoke their originals", async () => {
  const inv = await invited(ids.owner, "sub", "replace@example.test", ids.co);
  await as(ids.owner);
  const replacement = await ops("reissue_invite", {
    id: inv.id,
    token_hash: "a".repeat(64),
  });
  assert.notEqual(replacement.id, inv.id);
  await assert.rejects(enroll("preview", inv.hash, null, null), /unavailable/);
});
test("last active NPI administrator cannot be deleted or demoted even through direct privileged changes", async () => {
  await db.exec("reset role");
  await db.query(
    "update npi_profiles set active=false,account_status='suspended'where role='npi'and id<>$1",
    [ids.owner],
  );
  await assert.rejects(
    db.query("delete from npi_profiles where id=$1", [ids.owner]),
    /at least one/,
  );
  await assert.rejects(
    db.query("update npi_profiles set active=false where id=$1", [ids.owner]),
    /at least one/,
  );
});
let run;
test("full report includes more than the 500-row screen cap and pages without truncation", async () => {
  await db.exec("reset role");
  await db.query(
    "insert into npi_work_orders(company_id,site_id,task_id,planned_date,title,worker_led,status)select $1,$2,$3,'2026-11-23','Visit '||g,true,'approved'from generate_series(1,603)g",
    [ids.co, ids.site, ids.task],
  );
  await db.query(
    "insert into npi_work_orders(company_id,site_id,task_id,planned_date,title,status)values($1,$2,$3,'2026-11-23','Other company','approved')",
    [ids.co2, ids.site, ids.task],
  );
  await as(ids.owner);
  const f = { kind: "work", from: "2026-11-23", to: "2026-11-23" };
  run = (
    await db.query("select npi_report_start($1,$2)r", [
      JSON.stringify(f),
      crypto.randomUUID(),
    ])
  ).rows[0].r;
  assert.equal(run.total, 604);
  const a = (await db.query("select npi_report_page($1,1)r", [run.id])).rows[0]
    .r;
  const b = (await db.query("select npi_report_page($1,2)r", [run.id])).rows[0]
    .r;
  assert.equal(a.rows.length, 500);
  assert.equal(b.rows.length, 104);
  assert.equal(new Set([...a.rows, ...b.rows].map((r) => r.work_id)).size, 604);
});
test("report snapshots remain unchanged after work edits and are actor-bound", async () => {
  await db.exec("reset role");
  await db.query(
    "update npi_work_orders set title='Changed after snapshot'where company_id=$1",
    [ids.co],
  );
  await as(ids.owner);
  const page = (await db.query("select npi_report_page($1,1)r", [run.id]))
    .rows[0].r;
  assert.ok(page.rows.some((r) => r.title.startsWith("Visit")));
  await as(ids.sub);
  await assert.rejects(
    db.query("select npi_report_page($1,1)", [run.id]),
    /unavailable/,
  );
});
test("company report filters cannot expose another company; workers cannot export management data", async () => {
  await as(ids.sub);
  const own = (
    await db.query("select npi_report_start($1,$2)r", [
      JSON.stringify({ kind: "work", from: "2026-11-23", to: "2026-11-23" }),
      crypto.randomUUID(),
    ])
  ).rows[0].r;
  assert.equal(own.total, 603);
  const foreign = (
    await db.query("select npi_report_start($1,$2)r", [
      JSON.stringify({
        kind: "work",
        from: "2026-11-23",
        to: "2026-11-23",
        company: ids.co2,
      }),
      crypto.randomUUID(),
    ])
  ).rows[0].r;
  assert.equal(foreign.total, 0);
  await as(ids.worker);
  await assert.rejects(
    db.query("select npi_report_start($1,$2)", [
      JSON.stringify({ kind: "hours", from: "2026-11-23", to: "2026-11-23" }),
      crypto.randomUUID(),
    ]),
    /Administrator/,
  );
});
test("verification secrets and report snapshots are not directly readable by authenticated users", async () => {
  await as(ids.owner);
  await assert.rejects(
    db.query("select *from npi_email_verifications"),
    /permission/,
  );
  await assert.rejects(
    db.query("select npi_identity('resolve','worker')"),
    /permission/,
  );
  await assert.rejects(db.query("select *from npi_report_rows"), /permission/);
});

test("hours report counts attendance once across multiple service lines and separates reviewed hours", async () => {
  await db.exec("reset role");
  const w = (
    await db.query(
      "select id from npi_work_orders where company_id=$1 limit 1",
      [ids.co],
    )
  ).rows[0].id;
  const contract = (
    await db.query(
      "insert into npi_contracts(name)values('Test contract')returning id",
    )
  ).rows[0].id;
  for (const code of ["A", "B"]) {
    const item = (
      await db.query(
        "insert into npi_service_items(contract_id,task_id,code,name,unit)values($1,$2,$3,$3,'visit')returning id",
        [contract, ids.task, code],
      )
    ).rows[0].id;
    await db.query(
      "insert into npi_visit_lines(work_id,line_id,line_label,unit,snow_required)values($1,$2,$3,'visit',false)",
      [w, item, code],
    );
  }
  await db.query("insert into npi_work_members values($1,$2)", [w, ids.worker]);
  for (const [kind, time, breaks] of [
    ["check-in", "2026-11-23T17:00:00Z", 0],
    ["check-out", "2026-11-23T18:45:00Z", 15],
  ])
    await db.query(
      "insert into npi_attendance_events(work_id,worker_id,captured_by,event_kind,device_time,received_at,latitude,longitude,accuracy_metres,idempotency_key,break_minutes)values($1,$2,$2,$3,$4,$4,61,-149,10,$5,$6)",
      [w, ids.worker, kind, time, crypto.randomUUID(), breaks],
    );
  await db.query(
    "insert into npi_hour_reviews(work_id,worker_id,claimed_minutes,accepted_minutes)values($1,$2,100,95)",
    [w, ids.worker],
  );
  await as(ids.owner);
  const report = (
    await db.query("select npi_report_start($1,$2)r", [
      JSON.stringify({ kind: "hours", from: "2026-11-23", to: "2026-11-23" }),
      crypto.randomUUID(),
    ])
  ).rows[0].r;
  const rows = (await db.query("select npi_report_page($1,1)r", [report.id]))
    .rows[0].r.rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].recorded_hours, 1.5);
  assert.equal(rows[0].claimed_hours, 1.6667);
  assert.equal(rows[0].approved_hours, 1.5833);
  assert.equal(rows[0].break_minutes, 15);
});
test("a report expires cleanly and private evidence not in the report cannot be bundled", async () => {
  await db.exec("reset role");
  await db.query(
    "update npi_report_runs set expires_at=now()-interval '1 second'where id=$1",
    [run.id],
  );
  await as(ids.owner);
  await assert.rejects(
    db.query("select npi_report_page($1,1)", [run.id]),
    /expired|unavailable/,
  );
  const report = (
    await db.query("select npi_report_start($1,$2)r", [
      JSON.stringify({
        kind: "evidence",
        from: "2026-11-23",
        to: "2026-11-23",
      }),
      crypto.randomUUID(),
    ])
  ).rows[0].r;
  await assert.rejects(
    db.query("select npi_report_evidence($1,$2)", [
      report.id,
      [crypto.randomUUID()],
    ]),
    /not in report/,
  );
});
test("a non-secret registration ticket can resume an uncertain registration without opening the invitation to a different request", async () => {
  const inv = await invited(ids.owner, "sub", "resume@example.test", ids.co);
  const req = crypto.randomUUID(),
    attempt = crypto.randomUUID();
  await enroll("begin", inv.hash, req, attempt, "resume.admin", "Resume Admin");
  await assert.rejects(
    enroll("preview", inv.hash, crypto.randomUUID(), null),
    /unavailable/,
  );
  const preview = await enroll("preview", inv.hash, req, null);
  assert.equal(preview.email, "resume@example.test");
});

test("verification is bound to the email that received the link", async () => {
  const user = await register(
    await invited(ids.owner, "sub", "verify.bound@example.test", ids.co),
    "verify.bound",
  );
  const hash = "e".repeat(64);
  await ident("issue", { user, hash });
  await db.exec("reset role");
  await db.query(
    "update auth.users set email='changed@example.test'where id=$1",
    [user],
  );
  await assert.rejects(ident("verify", { hash }), /expired|unavailable/);
});

test("the responsible administrator can reopen an accidental decline without activating access", async () => {
  const person = await register(
    await invited(ids.sub, "worker", "review.again@example.test", ids.co),
    "review.again",
  );
  await verify(person);
  await as(ids.sub);
  await ops("reject_account", { id: person, version: 1 });
  await as(ids.owner);
  await assert.rejects(
    ops("reopen_registration", { id: person, version: 2 }),
    /responsible/,
  );
  await as(ids.sub);
  await ops("reopen_registration", { id: person, version: 2 });
  await as(person);
  assert.equal(
    (await db.query("select npi_account_status()r")).rows[0].r.status,
    "pending",
  );
  assert.equal((await db.query("select npi_role()r")).rows[0].r, null);
});
