import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
const db = new PGlite();
const npi = crypto.randomUUID(),
  sub = crypto.randomUUID(),
  other = crypto.randomUUID(),
  co = crypto.randomUUID(),
  foreign = crypto.randomUUID(),
  site = crypto.randomUUID(),
  service = crypto.randomUUID();
let contract, invite, request, worker, createdWork;
async function as(id) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
}
async function ops(action, body, req = crypto.randomUUID()) {
  return (
    await db.query("select npi_ops_action($1,$2::jsonb,$3) result", [
      action,
      JSON.stringify(body),
      req,
    ])
  ).rows[0].result;
}
async function enroll(
  mode,
  hash,
  req = null,
  attempt = null,
  username = "",
  name = "",
  user = null,
) {
  await db.exec("reset role;set role service_role");
  return (
    await db.query("select npi_enroll($1,$2,$3,$4,$5,$6,$7) result", [
      mode,
      hash,
      req,
      attempt,
      username,
      name,
      user,
    ])
  ).rows[0].result;
}
before(async () => {
  await db.exec(
    "create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,storage to anon,authenticated,service_role;grant select on auth.users to service_role;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb);alter table storage.objects enable row level security;grant select,insert on storage.objects to authenticated;",
  );
  for (const name of [
    "001-foundation",
    "002-live-access",
    "004-operations-invitations",
  ]) {
    let legacy;
    if (name === "004-operations-invitations") {
      legacy = crypto.randomUUID();
      const company = crypto.randomUUID();
      await db.query("insert into auth.users(id) values($1)", [legacy]);
      await db.query(
        "insert into npi_companies(id,name) values($1,'Existing company')",
        [company],
      );
      await db.query(
        "insert into npi_profiles(id,company_id,username,display_name,role,active) values($1,$2,'legacy.worker','Existing inactive worker','worker',false)",
        [legacy, company],
      );
    }
    await db.exec(await readFile(`setup/supabase/${name}.sql`, "utf8"));
    if (legacy) {
      const p = (
        await db.query(
          "select active,account_status from npi_profiles where id=$1",
          [legacy],
        )
      ).rows[0];
      assert.equal(p.active, false);
      assert.equal(p.account_status, "suspended");
    }
  }
  await db.query(
    "insert into npi_companies(id,name) values($1,'Whitter test'),($2,'Other')",
    [co, foreign],
  );
  for (const [id, role, company] of [
    [npi, "npi", null],
    [sub, "sub", co],
    [other, "sub", foreign],
  ]) {
    await db.query("insert into auth.users(id) values($1)", [id]);
    await db.query(
      "insert into npi_profiles(id,role,company_id,username,display_name) values($1,$2,$3,$4,$4)",
      [id, role, company, id],
    );
  }
  await db.query(
    "insert into npi_sites(id,name) values($1,'Test courthouse')",
    [site],
  );
  await db.query("insert into npi_tasks(id,name) values($1,'Snow service')", [
    service,
  ]);
});
after(() => db.close());
test("NPI owns contracts and scope; subcontractors cannot assign themselves other sites or invite administrators", async () => {
  await as(npi);
  contract = (
    await ops("create_contract", { name: "Court work", client: "Court" })
  ).id;
  await ops("assign_scope", {
    contract_id: contract,
    company_id: co,
    site_id: site,
  });
  await as(sub);
  await assert.rejects(ops("create_contract", { name: "Bad" }), /NPI/);
  await assert.rejects(
    ops("create_invite", {
      company_id: co,
      role: "sub",
      token_hash: "a".repeat(64),
    }),
    /permitted/,
  );
  await assert.rejects(
    ops("create_invite", {
      company_id: foreign,
      role: "worker",
      token_hash: "a".repeat(64),
    }),
    /permitted/,
  );
  const context = (await db.query("select npi_ops_context() c")).rows[0].c;
  assert.equal(context.contracts.length, 1);
  assert.equal(context.scopes[0].company_id, co);
  await as(other);
  assert.equal(
    (await db.query("select npi_ops_context() c")).rows[0].c.contracts.length,
    0,
  );
});
test("worker invitation fixes role/company, serializes retry, binds trusted Auth identity and blocks pending access", async () => {
  await as(sub);
  invite = (
    await ops("create_invite", {
      company_id: co,
      role: "worker",
      token_hash: "b".repeat(64),
    })
  ).id;
  request = crypto.randomUUID();
  const attempt = crypto.randomUUID();
  assert.equal(
    (await enroll("preview", "b".repeat(64))).company,
    "Whitter test",
  );
  await enroll(
    "begin",
    "b".repeat(64),
    request,
    attempt,
    "alex.test",
    "Alex Test",
  );
  await assert.rejects(
    enroll(
      "begin",
      "b".repeat(64),
      request,
      crypto.randomUUID(),
      "alex.test",
      "Alex Test",
    ),
    /busy/,
  );
  worker = crypto.randomUUID();
  await db.exec("reset role");
  await db.query(
    "insert into auth.users(id,email,raw_app_meta_data) values($1,$2,$3)",
    [
      worker,
      "alex.test@users.npi6030.com",
      JSON.stringify({ npi_enrollment_id: request }),
    ],
  );
  await enroll("finish", "b".repeat(64), request, attempt, "", "", worker);
  await as(worker);
  assert.equal(
    (await db.query("select npi_account_status() s")).rows[0].s.status,
    "pending",
  );
  await assert.rejects(db.query("select npi_live_snapshot()"), /no active/);
  await assert.rejects(
    db.query("select npi_enroll('preview',$1)", ["b".repeat(64)]),
    /permission denied/,
  );
  await assert.rejects(
    ops("approve_worker", { id: worker, version: 1 }),
    /administrator/,
  );
  await as(other);
  await assert.rejects(
    ops("approve_worker", { id: worker, version: 1 }),
    /access denied/,
  );
  await as(sub);
  const req = crypto.randomUUID();
  await ops("approve_worker", { id: worker, version: 1 }, req);
  await ops("approve_worker", { id: worker, version: 1 }, req);
  await as(worker);
  assert.equal(
    (await db.query("select npi_account_status() s")).rows[0].s.status,
    "approved",
  );
});
test("subcontractor dispatch is scoped and NPI can inspect original evidence and accepted hours", async () => {
  await as(sub);
  const input = {
    company_id: co,
    contract_id: contract,
    site_id: site,
    task_id: service,
    planned_date: "2026-11-19",
    title: "Clear access",
    members: [worker],
    checklist: ["Clear access"],
    kind: "site",
  };
  await assert.rejects(
    db.query("select npi_live_action($1,$2,$3)", [
      "create_work",
      JSON.stringify({ ...input, company_id: foreign }),
      crypto.randomUUID(),
    ]),
    /dispatch denied/,
  );
  await assert.rejects(
    db.query("select npi_live_action($1,$2,$3)", [
      "create_work",
      JSON.stringify({ ...input, contract_id: crypto.randomUUID() }),
      crypto.randomUUID(),
    ]),
    /assigned to this subcontract/,
  );
  const result = (
    await db.query("select npi_live_action($1,$2,$3) r", [
      "create_work",
      JSON.stringify(input),
      crypto.randomUUID(),
    ])
  ).rows[0].r;
  createdWork = result.id;
  await as(worker);
  assert.equal(
    (await db.query("select npi_live_snapshot() s")).rows[0].s.work[0].id,
    result.id,
  );
  await as(npi);
  const snapshot = (await db.query("select npi_live_snapshot() s")).rows[0].s;
  assert.equal(snapshot.work[0].contract_id, contract);
  assert.equal(snapshot.members[0].worker_id, worker);
  await assert.rejects(
    db.query("select npi_live_action($1,$2,$3)", [
      "draft_document",
      "{}",
      crypto.randomUUID(),
    ]),
    /Billing is deferred/,
  );
});
test("new operations database retains both GPS events through company and NPI review", async () => {
  const act = async (action, body) =>
    (
      await db.query("select npi_live_action($1,$2::jsonb,$3) r", [
        action,
        JSON.stringify(body),
        crypto.randomUUID(),
      ])
    ).rows[0].r;
  const snapshot = async () =>
    (await db.query("select npi_live_snapshot() s")).rows[0].s;
  await as(worker);
  let w = (await snapshot()).work[0];
  createdWork = w.id;
  const point = {
    id: w.id,
    version: w.version,
    members: [worker],
    event_kind: "check-in",
    device_time: new Date(Date.now() - 3000).toISOString(),
    latitude: 61.2,
    longitude: -149.9,
    accuracy_metres: 12,
  };
  await act("clock", point);
  await db.exec("reset role");
  await db.query(
    "update npi_attendance_events set received_at=now()-interval '105 minutes' where work_id=$1",
    [w.id],
  );
  await db.query(
    "insert into npi_evidence(work_id,uploaded_by,path,kind) values($1,$2,$3,'photo')",
    [w.id, worker, w.id + "/" + worker + "/test-photo.jpg"],
  );
  await as(worker);
  w = (await snapshot()).work[0];
  await act("tasks", {
    id: w.id,
    version: w.version,
    completed_tasks: [0],
    loads: 0,
  });
  w = (await snapshot()).work[0];
  await act("clock", {
    ...point,
    version: w.version,
    event_kind: "check-out",
    device_time: new Date().toISOString(),
    latitude: 61.201,
    longitude: -149.901,
    break_minutes: 0,
  });
  w = (await snapshot()).work[0];
  await act("submit_hours", {
    id: w.id,
    version: w.version,
    use_recorded: true,
  });
  await as(npi);
  w = (await snapshot()).work[0];
  await assert.rejects(
    act("npi_approve", { id: w.id, version: w.version, accept_claimed: true }),
    /approval|stage|review/i,
  );
  await as(sub);
  w = (await snapshot()).work[0];
  await act("company_approve", { id: w.id, version: w.version });
  await as(npi);
  w = (await snapshot()).work[0];
  await act("npi_approve", {
    id: w.id,
    version: w.version,
    accept_claimed: true,
  });
  const result = await snapshot();
  assert.equal(result.work[0].status, "approved");
  assert.equal(result.events.length, 2);
  assert.deepEqual(
    result.events.map((e) => Number(e.latitude)).sort(),
    [61.2, 61.201],
  );
  assert.equal(result.evidence.length, 1);
  assert.equal(
    result.reviews[0].accepted_minutes,
    result.reviews[0].claimed_minutes,
  );
  assert.ok(Number(result.reviews[0].accepted_minutes) >= 105);
});
test("NPI admin invitations are single-use; expired/revoked links cannot register; suspension blocks work", async () => {
  await as(npi);
  const id = (
    await ops("create_invite", {
      company_id: foreign,
      role: "sub",
      token_hash: "c".repeat(64),
    })
  ).id;
  const req = crypto.randomUUID(),
    attempt = crypto.randomUUID();
  await enroll("begin", "c".repeat(64), req, attempt, "new.admin", "New Admin");
  await assert.rejects(
    enroll(
      "begin",
      "c".repeat(64),
      crypto.randomUUID(),
      crypto.randomUUID(),
      "next.admin",
      "Next Admin",
    ),
    /unavailable/,
  );
  await as(npi);
  await ops("revoke_invite", { id });
  await assert.rejects(enroll("preview", "c".repeat(64)), /unavailable/);
  await as(npi);
  const expired = (
    await ops("create_invite", {
      company_id: foreign,
      role: "sub",
      token_hash: "e".repeat(64),
    })
  ).id;
  await db.exec("reset role");
  await db.query(
    "update npi_invitations set expires_at=now()-interval '1 day' where id=$1",
    [expired],
  );
  await assert.rejects(enroll("preview", "e".repeat(64)), /unavailable/);

  await as(sub);
  await ops("suspend_account", { id: worker, version: 2 });
  await as(worker);
  await assert.rejects(db.query("select npi_live_snapshot()"), /no active/);
});

test("single-use NPI invitation activates the company administrator without creating worker authority for NPI", async () => {
  await as(npi);
  await ops("create_invite", {
    company_id: foreign,
    role: "sub",
    token_hash: "d".repeat(64),
  });
  const req = crypto.randomUUID(),
    attempt = crypto.randomUUID(),
    uid = crypto.randomUUID();
  await enroll(
    "begin",
    "d".repeat(64),
    req,
    attempt,
    "company.admin",
    "Company Admin",
  );
  await db.exec("reset role");
  await db.query(
    "insert into auth.users(id,email,raw_app_meta_data) values($1,$2,$3)",
    [
      uid,
      "company.admin@users.npi6030.com",
      JSON.stringify({ npi_enrollment_id: req }),
    ],
  );
  await enroll("finish", "d".repeat(64), req, attempt, "", "", uid);
  await as(uid);
  assert.equal((await db.query("select npi_role() r")).rows[0].r, "sub");
  assert.equal((await db.query("select npi_company() c")).rows[0].c, foreign);
  await assert.rejects(
    db.query("select token_hash from npi_invitations"),
    /permission denied/,
  );
  await as(npi);
  await assert.rejects(
    ops("approve_worker", { id: worker, version: 3 }),
    /Company administrator/,
  );
});
