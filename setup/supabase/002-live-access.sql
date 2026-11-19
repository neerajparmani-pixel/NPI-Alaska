-- Run AFTER 001-foundation.sql. No demo workers, prices or records are imported.
begin;
-- Browser identities must never create objects used by definer functions.
revoke create on schema public from public,anon,authenticated;
alter table public.npi_work_orders add column if not exists title text not null default '';
alter table public.npi_work_orders add column if not exists kind text not null default 'site' check(kind in ('site','hauling'));
alter table public.npi_work_orders add column if not exists checklist jsonb not null default '["Complete assigned work","Inspect work area"]'::jsonb;
alter table public.npi_work_orders add column if not exists completed_tasks jsonb not null default '[]'::jsonb;
alter table public.npi_work_orders add column if not exists loads integer not null default 0 check(loads>=0);
alter table public.npi_work_orders add column if not exists review_note text not null default '';
alter table public.npi_attendance_events add column if not exists break_minutes numeric(12,4) not null default 0 check(break_minutes>=0);
alter table public.npi_hour_reviews alter column claimed_minutes type numeric(12,4);
alter table public.npi_hour_reviews alter column accepted_minutes type numeric(12,4);
create table if not exists public.npi_work_members (
 work_id uuid references public.npi_work_orders not null, worker_id uuid references public.npi_profiles not null,
 primary key(work_id,worker_id)
);
create table if not exists public.npi_evidence (
 id uuid primary key default gen_random_uuid(), work_id uuid not null references public.npi_work_orders,
 uploaded_by uuid not null references public.npi_profiles, path text not null unique,
 kind text not null check(kind in ('photo','timecard')), created_at timestamptz not null default now()
);
create table if not exists public.npi_commands (
 actor_id uuid not null references public.npi_profiles, request_id uuid not null,
 action text not null, body jsonb not null, result jsonb not null,
 created_at timestamptz not null default now(), primary key(actor_id,request_id)
);
-- A separate allocation table prevents duplicate work billing on either side.
create table if not exists public.npi_document_allocations (
 work_id uuid not null references public.npi_work_orders, kind text not null,
 document_id uuid not null references public.npi_documents, primary key(work_id,kind)
);
create index if not exists npi_work_company_date on public.npi_work_orders(company_id,planned_date desc,id);
create index if not exists npi_members_worker on public.npi_work_members(worker_id,work_id);
create index if not exists npi_events_work_worker on public.npi_attendance_events(work_id,worker_id,received_at,id);
create index if not exists npi_events_worker_recent on public.npi_attendance_events(worker_id,received_at desc,id desc);
create index if not exists npi_evidence_work on public.npi_evidence(work_id);
create index if not exists npi_rate_scope on public.npi_rates(site_id,task_id,side,company_id,basis,effective_from);
-- Supplier references belong to each supplier; customer references belong to NPI.
alter table public.npi_documents drop constraint if exists npi_documents_kind_reference_key;
create unique index if not exists npi_customer_reference on public.npi_documents(lower(reference)) where kind='customer-invoice';
create unique index if not exists npi_supplier_reference on public.npi_documents(company_id,lower(reference)) where kind='subcontractor-bill';
-- All helpers use a pinned search path and derive authority from auth.uid().
create or replace function public.npi_role() returns text language sql stable security definer set search_path=public,pg_temp
 as $$ select p.role from public.npi_profiles p where p.id=auth.uid() and p.active and (p.role='npi' or exists(select 1 from public.npi_companies c where c.id=p.company_id and c.active)) $$;
create or replace function public.npi_company() returns uuid language sql stable security definer set search_path=public,pg_temp
 as $$ select company_id from public.npi_profiles where id=auth.uid() and active and public.npi_role() is not null $$;
create or replace function public.npi_can_work(p_id uuid) returns boolean language sql stable security definer set search_path=public,pg_temp
 as $$ select exists(select 1 from public.npi_work_orders w where w.id=p_id and
 (public.npi_role()='npi' or (public.npi_role()='sub' and w.company_id=public.npi_company()) or
 (public.npi_role()='worker' and exists(select 1 from public.npi_work_members m where m.work_id=w.id and m.worker_id=auth.uid())))) $$;
create or replace function public.npi_recorded_minutes(p_work uuid,p_worker uuid) returns numeric language sql stable security definer set search_path=public,pg_temp
 as $$ with e as (select *,lag(received_at) over(order by received_at,id) as previous_time,
 lag(event_kind) over(order by received_at,id) as previous_kind from public.npi_attendance_events where work_id=p_work and worker_id=p_worker)
 select coalesce(round(sum(greatest(0,extract(epoch from(received_at-previous_time))/60-break_minutes)) filter(where event_kind='check-out' and previous_kind='check-in'),4),0) from e $$;

create or replace function public.npi_visible_recorded_minutes(p_work uuid,p_worker uuid) returns numeric language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.npi_can_work(p_work) then raise exception 'Assignment access denied';end if;
 return public.npi_recorded_minutes(p_work,p_worker);
end $$;

-- Read policies. Browser mutations are allowed only through the validated action RPC.
do $$ declare t text; begin
 foreach t in array array['npi_companies','npi_profiles','npi_sites','npi_tasks','npi_rates','npi_work_orders','npi_attendance_events','npi_hour_reviews','npi_documents','npi_document_lines','npi_sync_changes','npi_audit','npi_work_members','npi_evidence','npi_commands','npi_document_allocations'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on table public.%I from anon, authenticated',t);
  execute format('grant all on table public.%I to service_role',t);
 end loop;
end $$;
grant select on public.npi_companies,public.npi_profiles,public.npi_sites,public.npi_tasks,public.npi_rates,public.npi_work_orders,public.npi_attendance_events,public.npi_hour_reviews,public.npi_documents,public.npi_document_lines,public.npi_sync_changes,public.npi_audit,public.npi_work_members,public.npi_evidence to authenticated;
drop policy if exists npi_read on public.npi_profiles;
create policy npi_read on public.npi_profiles for select to authenticated using(
 id=auth.uid() or public.npi_role()='npi' or (public.npi_role()='sub' and company_id=public.npi_company()) or
 (public.npi_role()='worker' and exists(select 1 from public.npi_work_members m where m.worker_id=npi_profiles.id and public.npi_can_work(m.work_id)))
);
drop policy if exists npi_read on public.npi_companies;
create policy npi_read on public.npi_companies for select to authenticated using(public.npi_role()='npi' or id=public.npi_company());
drop policy if exists npi_read on public.npi_sites;
create policy npi_read on public.npi_sites for select to authenticated using(public.npi_role() is not null);
drop policy if exists npi_read on public.npi_tasks;
create policy npi_read on public.npi_tasks for select to authenticated using(public.npi_role() is not null);
drop policy if exists npi_read on public.npi_rates;
create policy npi_read on public.npi_rates for select to authenticated using(public.npi_role()='npi' or (public.npi_role()='sub' and side='subcontractor' and company_id=public.npi_company()));
drop policy if exists npi_read on public.npi_work_orders;
create policy npi_read on public.npi_work_orders for select to authenticated using(public.npi_can_work(id));
drop policy if exists npi_read on public.npi_work_members;
create policy npi_read on public.npi_work_members for select to authenticated using(public.npi_can_work(work_id));
drop policy if exists npi_read on public.npi_attendance_events;
create policy npi_read on public.npi_attendance_events for select to authenticated using(public.npi_can_work(work_id));
drop policy if exists npi_read on public.npi_hour_reviews;
create policy npi_read on public.npi_hour_reviews for select to authenticated using(public.npi_can_work(work_id));
drop policy if exists npi_read on public.npi_evidence;
create policy npi_read on public.npi_evidence for select to authenticated using(public.npi_can_work(work_id));
drop policy if exists npi_read on public.npi_documents;
create policy npi_read on public.npi_documents for select to authenticated using(public.npi_role()='npi' or (public.npi_role()='sub' and kind='subcontractor-bill' and company_id=public.npi_company()));
drop policy if exists npi_read on public.npi_document_lines;
create policy npi_read on public.npi_document_lines for select to authenticated using(exists(select 1 from public.npi_documents d where d.id=document_id));
drop policy if exists npi_read on public.npi_sync_changes;
create policy npi_read on public.npi_sync_changes for select to authenticated using(public.npi_role()='npi');
drop policy if exists npi_read on public.npi_audit;
create policy npi_read on public.npi_audit for select to authenticated using(public.npi_role()='npi');

-- Versioned, overlap-checked prices; private helper, not a browser RPC.
create or replace function public.npi_save_rate(b jsonb) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare r uuid:=coalesce(nullif(b->>'id','')::uuid,gen_random_uuid()); old public.npi_rates; c uuid:=nullif(b->>'company_id','')::uuid;
 s uuid:=(b->>'site_id')::uuid; t uuid:=(b->>'task_id')::uuid; f date:=(b->>'effective_from')::date; z date:=nullif(b->>'effective_through','')::date;
 amount bigint:=(b->>'amount_cents')::bigint;
begin
 if b->>'side' not in ('customer','subcontractor') or b->>'basis' not in ('hourly','fixed','per-visit','per-load') or amount is null or amount<0 or amount>999999999 or f is null or (z is not null and z<f) then raise exception 'Invalid price or effective dates'; end if;
 if b->>'side'='customer' then c:=null; elsif c is null then raise exception 'Choose a company'; end if;
 perform pg_advisory_xact_lock(hashtextextended('rate:'||s::text||t::text||coalesce(c::text,'customer')||(b->>'basis'),0));
 select * into old from public.npi_rates where id=r for update;
 if not found and nullif(b->>'id','') is not null then raise exception 'Rate no longer exists';end if;
 if found and old.version<>coalesce((b->>'version')::int,0) then raise exception 'Stale rate: reload before saving'; end if;
 if exists(select 1 from public.npi_rates x where x.id<>r and x.side=b->>'side' and x.site_id=s and x.task_id=t and x.company_id is not distinct from c and x.basis=b->>'basis' and x.effective_from<=coalesce(z,'infinity'::date) and f<=coalesce(x.effective_through,'infinity'::date)) then raise exception 'Overlapping effective dates'; end if;
 insert into public.npi_rates(id,side,company_id,site_id,task_id,basis,amount_cents,effective_from,effective_through) values(r,b->>'side',c,s,t,b->>'basis',amount,f,z)
 on conflict(id) do update set side=excluded.side,company_id=excluded.company_id,site_id=excluded.site_id,task_id=excluded.task_id,basis=excluded.basis,amount_cents=excluded.amount_cents,effective_from=excluded.effective_from,effective_through=excluded.effective_through,version=npi_rates.version+1;
 return r;
end $$;
create or replace function public.npi_live_action(p_action text,p_body jsonb,p_request uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare who uuid:=auth.uid(); r text:=public.npi_role(); co uuid:=public.npi_company(); w public.npi_work_orders;
 ident uuid:=nullif(p_body->>'id','')::uuid; member uuid; members uuid[]; prior public.npi_attendance_events; result jsonb;
 cmd public.npi_commands; expected integer; amount numeric; original numeric; now_at timestamptz:=clock_timestamp();
 kind text; ref text; rate public.npi_rates; doc uuid; qty numeric; line bigint; change public.npi_sync_changes; field_name text; field_limit integer;
begin
 if who is null or r is null then raise exception 'Active company account required'; end if;
 if p_request is null or p_body is null or jsonb_typeof(p_body)<>'object' then raise exception 'Request identifier and object required'; end if;
 if octet_length(p_body::text)>65536 then raise exception 'Request is too large';end if;
 for field_name,field_limit in select * from (values('name',150),('address',300),('equipment',150),('title',200),('description',1000),('reason',1000),('reference',100))v(name,maximum) loop
  if p_body ? field_name and (jsonb_typeof(p_body->field_name) not in ('string','null') or length(p_body->>field_name)>field_limit) then raise exception '% must be text up to % characters',field_name,field_limit;end if;
 end loop;
 perform pg_advisory_xact_lock(hashtextextended(who::text||p_request::text,0));
 select * into cmd from public.npi_commands where actor_id=who and request_id=p_request;
 if found then
  if cmd.action<>p_action or cmd.body<>p_body then raise exception 'Request key already used with different content';end if;
  return cmd.result;
 end if;
 if p_action in ('save_company','save_site','save_task','create_work','save_rate','review_sheet','plan_work') and r<>'npi' then raise exception 'NPI administrator required';end if;
 if p_action='save_company' then
  if length(btrim(coalesce(p_body->>'name','')))<1 or length(p_body->>'name')>150 then raise exception 'Company name required'; end if;
  if ident is not null then raise exception 'Company editing is not enabled';end if;
  insert into public.npi_companies(name) values(btrim(p_body->>'name')) returning id into ident;
 elsif p_action='save_task' then
  if length(btrim(coalesce(p_body->>'name','')))<1 or length(p_body->>'name')>150 then raise exception 'Service name required'; end if;
  insert into public.npi_tasks(name,description) values(btrim(p_body->>'name'),left(coalesce(p_body->>'description',''),1000)) returning id into ident;
 elsif p_action='save_site' then
  if length(btrim(coalesce(p_body->>'name','')))<1 or length(p_body->>'name')>150 then raise exception 'Location name required';end if;
  if ident is null then insert into public.npi_sites(name,address,photo_path) values(btrim(p_body->>'name'),left(coalesce(p_body->>'address',''),300),p_body->>'photo_path') returning id into ident;
  else update public.npi_sites set name=btrim(p_body->>'name'),address=left(coalesce(p_body->>'address',''),300),version=version+1 where id=ident and version=(p_body->>'version')::int; if not found then raise exception 'Stale location';end if;end if;
 elsif p_action='save_rate' then ident:=public.npi_save_rate(p_body);
 elsif p_action='create_work' then
  if not exists(select 1 from public.npi_companies where id=(p_body->>'company_id')::uuid and active) or not exists(select 1 from public.npi_tasks where id=(p_body->>'task_id')::uuid and active) then raise exception 'Choose an active company and service';end if;
  select array_agg(value::uuid) into members from jsonb_array_elements_text(p_body->'members');
  if coalesce(cardinality(members),0)<1 or cardinality(members)>50 or cardinality(members)<>(select count(distinct x) from unnest(members)x) then raise exception 'Choose one to fifty distinct assigned workers';end if;
  if (select count(*) from public.npi_profiles where id=any(members) and active and role='worker' and company_id=(p_body->>'company_id')::uuid)<>cardinality(members) then raise exception 'Workers must belong to this company';end if;
  if jsonb_typeof(p_body->'checklist')<>'array' or jsonb_array_length(p_body->'checklist')<1 or jsonb_array_length(p_body->'checklist')>20 or exists(select 1 from jsonb_array_elements_text(p_body->'checklist')x where length(btrim(x))<1 or length(x)>200) then raise exception 'Provide one to twenty task instructions';end if;
  insert into public.npi_work_orders(company_id,site_id,task_id,planned_date,equipment,title,kind,checklist) values((p_body->>'company_id')::uuid,(p_body->>'site_id')::uuid,(p_body->>'task_id')::uuid,(p_body->>'planned_date')::date,left(coalesce(p_body->>'equipment',''),150),left(coalesce(p_body->>'title',''),200),coalesce(p_body->>'kind','site'),p_body->'checklist') returning id into ident;
  insert into public.npi_work_members select ident,x from unnest(members)x;
  insert into public.npi_hour_reviews(work_id,worker_id) select ident,x from unnest(members)x;
 elsif p_action='review_sheet' then
  if p_body->>'decision' is null or p_body->>'decision' not in ('accept','reject') then raise exception 'Choose accept or reject';end if;
  select * into change from public.npi_sync_changes where id=ident for update;
  if not found or change.status<>'pending' then raise exception 'Change is not pending';end if;
  if p_body->>'decision'='reject' then update public.npi_sync_changes set status='rejected',message='Rejected by NPI' where id=ident;
  elsif change.record_table='npi_rates' then
   perform public.npi_save_rate(change.proposal||jsonb_build_object('id',change.record_id,'version',change.expected_version));
   update public.npi_sync_changes set status='accepted',message='Reviewed and applied by NPI' where id=ident;
  elsif change.record_table='npi_sites' then
   if length(btrim(coalesce(change.proposal->>'name','')))<1 or length(change.proposal->>'name')>150 then raise exception 'Valid location name required';end if;
   update public.npi_sites set name=left(change.proposal->>'name',150),address=left(change.proposal->>'address',300),version=version+1 where id=change.record_id and version=change.expected_version;
   if not found then raise exception 'Stale spreadsheet change';end if;
   update public.npi_sync_changes set status='accepted',message='Reviewed and applied by NPI' where id=ident;
  elsif change.record_table='npi_work_orders' then
   update public.npi_work_orders set planned_date=(change.proposal->>'planned_date')::date,equipment=left(change.proposal->>'equipment',150),version=version+1 where id=change.record_id and version=change.expected_version and status='draft' and not exists(select 1 from public.npi_attendance_events e where e.work_id=change.record_id);
   if not found then raise exception 'Stale or already started assignment';end if;
   update public.npi_sync_changes set status='accepted',message='Reviewed and applied by NPI' where id=ident;
  else raise exception 'Unsupported spreadsheet change';end if;
 elsif p_action='draft_document' then
  kind:=p_body->>'kind';ref:=btrim(p_body->>'reference');
  if kind is null or (kind='customer-invoice' and r<>'npi') or (kind='subcontractor-bill' and r not in ('npi','sub')) or kind not in ('customer-invoice','subcontractor-bill') then raise exception 'Document permission denied';end if;
  select * into w from public.npi_work_orders where id=(p_body->>'work_id')::uuid for update;
  if not found or not public.npi_can_work(w.id) or w.status<>'approved' then raise exception 'Choose NPI-approved work';end if;
  select * into rate from public.npi_rates where id=(p_body->>'rate_id')::uuid;
  if not found or rate.side<>(case when kind='customer-invoice' then 'customer' else 'subcontractor' end) or rate.site_id<>w.site_id or rate.task_id<>w.task_id or (kind='subcontractor-bill' and rate.company_id<>w.company_id) or w.planned_date<rate.effective_from or w.planned_date>coalesce(rate.effective_through,'infinity'::date) then raise exception 'Rate does not match approved work and service date';end if;
  qty:=(p_body->>'quantity')::numeric;
  if qty is null or qty<=0 or qty>1000000 or qty<>round(qty,4) or (rate.basis='fixed' and qty<>1) or (rate.basis in ('per-load','per-visit') and qty<>trunc(qty)) or ref is null or length(ref)<1 or length(ref)>100 then raise exception 'Check reference and billable quantity';end if;
  line:=round(qty*rate.amount_cents);doc:=gen_random_uuid();
  insert into public.npi_documents(id,kind,company_id,reference,status,subtotal_cents) values(doc,kind,w.company_id,ref,'draft',line);
  insert into public.npi_document_allocations values(w.id,kind,doc);
  insert into public.npi_document_lines(document_id,work_id,rate_id,description,quantity,basis,unit_cents,line_cents) values(doc,w.id,rate.id,coalesce(w.title,'Service'),qty,rate.basis,rate.amount_cents,line);
  ident:=doc;
 else
  select * into w from public.npi_work_orders where id=ident for update;
  if not found or not public.npi_can_work(ident) then raise exception 'Assignment access denied';end if;
  if w.version<>coalesce((p_body->>'version')::int,0) then raise exception 'Assignment changed: refresh and review before saving';end if;
  if p_action='clock' then
   if r<>'worker' or w.status not in ('draft','in-progress','returned') then raise exception 'Only assigned workers can record attendance before submission';end if;
   select array_agg(value::uuid order by value) into members from jsonb_array_elements_text(p_body->'members');
   if coalesce(cardinality(members),0)<1 or not(who=any(members)) or cardinality(members)<>(select count(distinct x) from unnest(members)x) or exists(select 1 from unnest(members)x where not exists(select 1 from public.npi_work_members m join public.npi_profiles p on p.id=m.worker_id where m.work_id=ident and m.worker_id=x and p.active)) then raise exception 'Crew must include you and assigned active workers only';end if;
   kind:=p_body->>'event_kind';
   if kind is null or kind not in ('check-in','check-out') or abs(extract(epoch from(now_at-(p_body->>'device_time')::timestamptz)))>120 or (p_body->>'device_time') is null or (p_body->>'latitude') is null or (p_body->>'longitude') is null or (p_body->>'accuracy_metres') is null then raise exception 'Fresh device location required for each event';end if;
   foreach member in array members loop
    perform pg_advisory_xact_lock(hashtextextended('attendance:'||member::text,0));
    select * into prior from public.npi_attendance_events where worker_id=member order by received_at desc,id desc limit 1;
    if kind='check-in' and prior.event_kind='check-in' then raise exception 'Worker already has an open attendance event';end if;
    if kind='check-out' and (prior.id is null or prior.event_kind<>'check-in' or prior.work_id<>ident) then raise exception 'No matching open check-in';end if;
    if kind='check-out' and (p_body->>'device_time')::timestamptz<=prior.device_time then raise exception 'Capture a new checkout location';end if;
    if (p_body->>'accuracy_metres')::float8 in ('NaN'::float8,'Infinity'::float8,'-Infinity'::float8) then raise exception 'Finite position accuracy required';end if;
    amount:=case when kind='check-out' then coalesce((p_body->>'break_minutes')::numeric,0) else 0 end;
    if kind='check-out' and (amount<0 or amount>extract(epoch from(now_at-prior.received_at))/60) then raise exception 'Break exceeds recorded interval';end if;
    insert into public.npi_attendance_events(work_id,worker_id,captured_by,event_kind,device_time,received_at,latitude,longitude,accuracy_metres,idempotency_key,break_minutes) values(ident,member,who,kind,(p_body->>'device_time')::timestamptz,now_at,(p_body->>'latitude')::float8,(p_body->>'longitude')::float8,(p_body->>'accuracy_metres')::float8,gen_random_uuid(),amount);
   end loop;
   update public.npi_hour_reviews set claimed_minutes=null,accepted_minutes=null,company_reviewer=null,npi_reviewer=null,version=version+1 where work_id=ident;
   update public.npi_work_orders set status='in-progress',version=version+1 where id=ident;
  elsif p_action='tasks' then
   if r<>'worker' or w.status not in ('in-progress','returned') then raise exception 'Tasks are editable only during work or correction';end if;
   if jsonb_typeof(p_body->'completed_tasks')<>'array' or exists(select 1 from jsonb_array_elements_text(p_body->'completed_tasks')x where x::int<0 or x::int>=jsonb_array_length(w.checklist)) then raise exception 'Invalid task selection';end if;
   update public.npi_work_orders set completed_tasks=p_body->'completed_tasks',loads=coalesce((p_body->>'loads')::int,0),version=version+1 where id=ident;
  elsif p_action='evidence' then
   if r<>'worker' or w.status not in ('in-progress','returned') then raise exception 'Evidence can be added only during work or correction';end if;
   if p_body->>'path' not like ident::text||'/'||who::text||'/%' or not exists(select 1 from storage.objects o where o.bucket_id='work-evidence' and o.name=p_body->>'path' and o.owner_id=who::text) then raise exception 'Upload an owned file into the work-evidence bucket first';end if;
   if p_body->>'kind'='photo' and not exists(select 1 from storage.objects o where o.bucket_id='work-evidence' and o.name=p_body->>'path' and o.metadata->>'mimetype' in ('image/jpeg','image/png','image/webp')) then raise exception 'Photo evidence must be an image';end if;
   insert into public.npi_evidence(work_id,uploaded_by,path,kind) values(ident,who,p_body->>'path',p_body->>'kind');
   update public.npi_work_orders set version=version+1 where id=ident;
  elsif p_action='submit_hours' then
   if r<>'worker' or w.status not in ('in-progress','returned') then raise exception 'Only workers submit their own hours';end if;
   select * into prior from public.npi_attendance_events where work_id=ident and worker_id=who order by received_at desc,id desc limit 1;
   if prior.id is null or prior.event_kind<>'check-out' then raise exception 'Record checkout with a separate location first';end if;
   if exists(select 1 from generate_series(0,jsonb_array_length(w.checklist)-1)x where not w.completed_tasks @> to_jsonb(array[x])) or not exists(select 1 from public.npi_evidence e where e.work_id=ident and e.kind='photo') or (w.kind='hauling' and (w.loads<1 or not exists(select 1 from public.npi_evidence e where e.work_id=ident and e.kind='timecard'))) then raise exception 'Complete tasks, photo evidence and any required hauling timecard/loads first';end if;
   if exists(select 1 from public.npi_work_members m where m.work_id=ident and (select e.event_kind from public.npi_attendance_events e where e.work_id=ident and e.worker_id=m.worker_id order by e.received_at desc,e.id desc limit 1) is distinct from 'check-out') then raise exception 'All assigned crew members must check out before hours are submitted';end if;
   original:=public.npi_recorded_minutes(ident,who);amount:=case when coalesce((p_body->>'use_recorded')::boolean,false) then original else (p_body->>'claimed_minutes')::numeric end;
   if amount is null or amount<0 or amount>100000 or (abs(amount-original)>0.01 and length(btrim(coalesce(p_body->>'reason','')))<1) then raise exception 'Check claimed hours and explain differences';end if;
   update public.npi_hour_reviews set claimed_minutes=amount,reason=left(p_body->>'reason',1000),version=version+1 where work_id=ident and worker_id=who;
   update public.npi_work_orders set status=case when not exists(select 1 from public.npi_hour_reviews where work_id=ident and claimed_minutes is null) then 'contractor-review' else 'in-progress' end,version=version+1 where id=ident;
  elsif p_action='company_approve' then
   if r<>'sub' or w.company_id<>co or w.status<>'contractor-review' then raise exception 'Company approval must come from its subcontractor admin';end if;
   if exists(select 1 from public.npi_hour_reviews where work_id=ident and claimed_minutes is null) then raise exception 'Every assigned worker must submit hours';end if;
   update public.npi_hour_reviews set company_reviewer=who,version=version+1 where work_id=ident;
   update public.npi_work_orders set status='npi-review',version=version+1 where id=ident;
  elsif p_action='npi_approve' then
   if r<>'npi' or w.status<>'npi-review' then raise exception 'Company approval must precede NPI approval';end if;
   for member in select worker_id from public.npi_hour_reviews where work_id=ident loop
    if coalesce((p_body->>'accept_claimed')::boolean,false) then select claimed_minutes into amount from public.npi_hour_reviews where work_id=ident and worker_id=member;else amount:=(p_body->'accepted_minutes'->>member::text)::numeric;end if;
    if amount is null or amount<0 or amount>100000 or exists(select 1 from public.npi_hour_reviews where work_id=ident and worker_id=member and (company_reviewer is null or (abs(claimed_minutes-amount)>0.01 and length(btrim(coalesce(p_body->>'reason','')))<1))) then raise exception 'Provide accepted hours for every worker and a reason for changes';end if;
    update public.npi_hour_reviews set accepted_minutes=amount,npi_reviewer=who,version=version+1 where work_id=ident and worker_id=member;
   end loop;
   update public.npi_work_orders set status='approved',review_note=left(coalesce(p_body->>'reason',''),1000),version=version+1 where id=ident;
  elsif p_action='return_work' then
   if not ((r='sub' and w.company_id=co and w.status='contractor-review') or (r='npi' and w.status='npi-review')) or length(btrim(coalesce(p_body->>'reason','')))<1 then raise exception 'Approval-stage correction requires a reason';end if;
   update public.npi_work_orders set status=case when r='npi' then 'contractor-review' else 'returned' end,review_note=left(p_body->>'reason',1000),version=version+1 where id=ident;
  elsif p_action='plan_work' then
   if w.status<>'draft' then raise exception 'Only unstarted work can be rescheduled';end if;
   update public.npi_work_orders set planned_date=(p_body->>'planned_date')::date,equipment=left(p_body->>'equipment',150),version=version+1 where id=ident;
  else raise exception 'Unknown operation';end if;
 end if;
 result:=jsonb_build_object('id',ident,'action',p_action);
 insert into public.npi_commands values(who,p_request,p_action,p_body,result,now_at);
 insert into public.npi_audit(actor_id,action,record_id) values(who,p_action,ident);
 return result;
end $$;
drop function if exists public.npi_live_snapshot();
create or replace function public.npi_live_snapshot(p_stage text default 'all',p_work_id uuid default null) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if public.npi_role() is null then raise exception 'Your authenticated account has no active NPI profile';end if;
 if p_stage not in ('all','draft','in-progress','contractor-review','npi-review','approved','returned') then raise exception 'Invalid work filter';end if;
 return jsonb_build_object(
 'scope_stage',p_stage,
 'summary',(select jsonb_build_object('active',count(*) filter(where status='in-progress'),'company_review',count(*) filter(where status='contractor-review'),'npi_review',count(*) filter(where status='npi-review'),'approved',count(*) filter(where status='approved'),'work_count',count(*)) from public.npi_work_orders),
 'profile',(select to_jsonb(p) from public.npi_profiles p where id=auth.uid()),
 'companies',coalesce((select jsonb_agg(x) from(select * from public.npi_companies order by name limit 500)x),'[]'::jsonb),
 'people',coalesce((select jsonb_agg(x) from(select * from public.npi_profiles order by display_name limit 1000)x),'[]'::jsonb),
 'sites',coalesce((select jsonb_agg(x) from(select * from public.npi_sites order by name limit 500)x),'[]'::jsonb),
 'tasks',coalesce((select jsonb_agg(x) from(select * from public.npi_tasks order by name limit 500)x),'[]'::jsonb),
 'rates',coalesce((select jsonb_agg(x) from(select * from public.npi_rates order by effective_from desc limit 1000)x),'[]'::jsonb),
 'work',coalesce((select jsonb_agg(x) from(select * from public.npi_work_orders where (p_stage='all' or status=p_stage) and (p_work_id is null or id=p_work_id) order by planned_date desc,id limit 500)x),'[]'::jsonb),
 'members',coalesce((select jsonb_agg(x) from(select * from public.npi_work_members where p_work_id is null or work_id=p_work_id limit 25000)x),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(x) from(select * from public.npi_attendance_events where p_work_id is null or work_id=p_work_id order by received_at desc limit 10000)x),'[]'::jsonb),
 'reviews',coalesce((select jsonb_agg(x) from(select r.*,public.npi_visible_recorded_minutes(r.work_id,r.worker_id) as recorded_minutes from public.npi_hour_reviews r where p_work_id is null or r.work_id=p_work_id limit 25000)x),'[]'::jsonb),
 'evidence',coalesce((select jsonb_agg(x) from(select * from public.npi_evidence where p_work_id is null or work_id=p_work_id order by created_at desc limit 5000)x),'[]'::jsonb),
 'documents',coalesce((select jsonb_agg(x) from(select * from public.npi_documents order by id limit 500)x),'[]'::jsonb),
 'lines',coalesce((select jsonb_agg(x) from(select * from public.npi_document_lines limit 5000)x),'[]'::jsonb),
 'audit',coalesce((select jsonb_agg(x) from(select * from public.npi_audit order by event_time desc limit 500)x),'[]'::jsonb),
 'changes',coalesce((select jsonb_agg(x) from(select * from public.npi_sync_changes order by received_at desc limit 500)x),'[]'::jsonb)
 );
end $$;
-- Private bridge export: original recorded hours are calculated on the server.
create or replace function public.npi_sheet_hour_reviews(p_offset integer default 0) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(x),'[]'::jsonb) from (select r.*,public.npi_recorded_minutes(r.work_id,r.worker_id) as recorded_minutes from public.npi_hour_reviews r order by r.id limit 1000 offset greatest(0,least(p_offset,100000)))x
$$;
revoke all on function public.npi_sheet_hour_reviews(integer) from public,anon,authenticated;
grant execute on function public.npi_sheet_hour_reviews(integer) to service_role;
-- Explicit grants prevent definer helper functions from becoming public RPCs.
revoke all on function public.npi_role(),public.npi_company(),public.npi_can_work(uuid),public.npi_recorded_minutes(uuid,uuid),public.npi_visible_recorded_minutes(uuid,uuid),public.npi_save_rate(jsonb),public.npi_live_action(text,jsonb,uuid),public.npi_live_snapshot(text,uuid) from public,anon,authenticated;
grant execute on function public.npi_role(),public.npi_company(),public.npi_can_work(uuid),public.npi_visible_recorded_minutes(uuid,uuid),public.npi_live_action(text,jsonb,uuid),public.npi_live_snapshot(text,uuid) to authenticated;
create or replace function public.npi_storage_work(p_name text) returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if split_part(p_name,'/',1) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false;end if;
 return public.npi_can_work(split_part(p_name,'/',1)::uuid);
end $$;
revoke all on function public.npi_storage_work(text) from public,anon,authenticated;
grant execute on function public.npi_storage_work(text) to authenticated;
-- Uploads are private and assigned-work scoped; no overwrite/delete of original evidence.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('work-evidence','work-evidence',false,8388608,array['image/jpeg','image/png','image/webp','application/pdf']) on conflict(id) do update set public=false,file_size_limit=8388608,allowed_mime_types=excluded.allowed_mime_types;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('invoice-files','invoice-files',false,8388608,array['application/pdf']) on conflict(id) do update set public=false;
drop policy if exists npi_evidence_read on storage.objects;
create policy npi_evidence_read on storage.objects for select to authenticated using(bucket_id='work-evidence' and public.npi_storage_work(name));
drop policy if exists npi_evidence_upload on storage.objects;
create policy npi_evidence_upload on storage.objects for insert to authenticated with check(bucket_id='work-evidence' and split_part(name,'/',2)=auth.uid()::text and public.npi_role()='worker' and public.npi_storage_work(name) and exists(select 1 from public.npi_work_orders w where w.id=(split_part(name,'/',1))::uuid and w.status in ('in-progress','returned')));
notify pgrst,'reload schema';
commit;
