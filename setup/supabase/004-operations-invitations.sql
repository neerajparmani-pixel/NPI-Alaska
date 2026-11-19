-- Operations release upgrade. Run after 002; preserves existing accounts and records.
begin;
alter table public.npi_profiles add column if not exists account_status text not null default 'approved' check(account_status in ('pending','approved','rejected','suspended'));
alter table public.npi_profiles add column if not exists access_version integer not null default 1;
alter table public.npi_profiles add constraint npi_pending_not_active check(account_status='approved' or not active);
-- Preserve the meaning of pre-upgrade inactive company accounts.
update public.npi_profiles set account_status='suspended' where not active and role<>'npi' and account_status='approved';
create table public.npi_contracts (
 id uuid primary key default gen_random_uuid(), name text not null, client text not null default '', reference text not null default '', active boolean not null default true
);
create table public.npi_contract_scopes (
 id uuid primary key default gen_random_uuid(), contract_id uuid not null references public.npi_contracts,
 company_id uuid not null references public.npi_companies, site_id uuid not null references public.npi_sites,
 active boolean not null default true, unique(contract_id,company_id,site_id)
);
alter table public.npi_work_orders add column if not exists contract_id uuid references public.npi_contracts;
create table public.npi_invitations (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.npi_companies,
 role text not null check(role in ('sub','worker')), token_hash text not null unique check(token_hash ~ '^[0-9a-f]{64}$'),
 created_by uuid not null references public.npi_profiles, created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '7 days', revoked boolean not null default false,
 max_uses integer not null check(max_uses in (1,100)), check((role='sub' and max_uses=1) or(role='worker' and max_uses=100))
);
create table public.npi_enrollments (
 request_id uuid primary key, invitation_id uuid not null references public.npi_invitations,
 username text not null unique, display_name text not null, user_id uuid unique references auth.users,
 phase text not null default 'reserved' check(phase in ('reserved','complete')),
 attempt_id uuid not null, lease_until timestamptz not null default now()+interval '90 seconds', created_at timestamptz not null default now()
);
create index npi_invites_company on public.npi_invitations(company_id,created_at);
create index npi_enroll_invite on public.npi_enrollments(invitation_id);
create or replace function public.npi_role() returns text language sql stable security definer set search_path=public,pg_temp as $$
 select p.role from public.npi_profiles p where p.id=auth.uid() and p.active and p.account_status='approved' and(p.role='npi' or exists(select 1 from public.npi_companies c where c.id=p.company_id and c.active))
$$;
create or replace function public.npi_dispatch_scope(p_company uuid,p_site uuid,p_contract uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.npi_contract_scopes s join public.npi_contracts c on c.id=s.contract_id join public.npi_companies co on co.id=s.company_id where s.company_id=p_company and s.site_id=p_site and s.contract_id=p_contract and s.active and c.active and co.active)
$$;
create function public.npi_account_status() returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare p public.npi_profiles; c public.npi_companies;begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 select * into p from public.npi_profiles where id=auth.uid();
 if not found then return jsonb_build_object('status','unassigned');end if;
 select * into c from public.npi_companies where id=p.company_id;
 return jsonb_build_object('status',case when p.role<>'npi' and not coalesce(c.active,false) then 'suspended' when p.account_status='approved' and not p.active then 'suspended' else p.account_status end,'display_name',p.display_name,'company',c.name);
end $$;
-- Authenticated management: role/company derived exclusively from the current identity.
create function public.npi_ops_action(p_action text,p_body jsonb,p_request uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare who uuid:=auth.uid(); r text:=public.npi_role(); co uuid:=public.npi_company(); ident uuid; target public.npi_profiles; cmd public.npi_commands; result jsonb; v_company uuid;begin
 if r is null or r not in ('npi','sub') then raise exception 'Active administrator required';end if;
 if p_request is null or jsonb_typeof(p_body)<>'object' or octet_length(p_body::text)>8000 then raise exception 'Invalid request';end if;
 perform pg_advisory_xact_lock(hashtextextended(who::text||p_request::text,0));
 select * into cmd from public.npi_commands where actor_id=who and request_id=p_request;
 if found then if cmd.action<>'ops:'||p_action or cmd.body<>p_body then raise exception 'Request identifier reused';end if;return cmd.result;end if;
 if p_action='create_contract' then
  if r<>'npi' then raise exception 'NPI administrator required';end if;
  if length(btrim(coalesce(p_body->>'name','')))<1 or length(p_body->>'name')>150 or length(coalesce(p_body->>'client',''))>150 or length(coalesce(p_body->>'reference',''))>100 then raise exception 'Check contract details';end if;
  insert into public.npi_contracts(name,client,reference) values(btrim(p_body->>'name'),btrim(coalesce(p_body->>'client','')),btrim(coalesce(p_body->>'reference',''))) returning id into ident;
 elsif p_action='assign_scope' then
  if r<>'npi' then raise exception 'NPI administrator required';end if;
  if not exists(select 1 from public.npi_contracts where id=(p_body->>'contract_id')::uuid and active) or not exists(select 1 from public.npi_companies where id=(p_body->>'company_id')::uuid and active) then raise exception 'Choose an active contract and company';end if;
  insert into public.npi_contract_scopes(contract_id,company_id,site_id) values((p_body->>'contract_id')::uuid,(p_body->>'company_id')::uuid,(p_body->>'site_id')::uuid) on conflict(contract_id,company_id,site_id) do update set active=true returning id into ident;
 elsif p_action='create_invite' then
  v_company:=(p_body->>'company_id')::uuid;
  if p_body->>'role' is null or p_body->>'role' not in ('sub','worker') or p_body->>'token_hash' is null or p_body->>'token_hash' !~ '^[0-9a-f]{64}$' then raise exception 'Invalid invitation';end if;
  if (r='sub' and(v_company is distinct from co or p_body->>'role'<>'worker')) or (r='npi' and p_body->>'role'<>'sub') then raise exception 'Invite only your permitted account type';end if;
  if not exists(select 1 from public.npi_companies where id=v_company and active) then raise exception 'Active company required';end if;
  insert into public.npi_invitations(company_id,role,token_hash,created_by,max_uses) values(v_company,p_body->>'role',p_body->>'token_hash',who,case when p_body->>'role'='sub' then 1 else 100 end) returning id into ident;
 elsif p_action='revoke_invite' then
  ident:=(p_body->>'id')::uuid;
  update public.npi_invitations set revoked=true where id=ident and(r='npi' or(company_id=co and role='worker'));
  if not found then raise exception 'Invitation access denied';end if;
 elsif p_action in ('approve_worker','reject_worker','suspend_account','restore_account') then
  ident:=(p_body->>'id')::uuid;
  select * into target from public.npi_profiles where id=ident for update;
  if not found or target.role='npi' or(r='sub' and(target.company_id is distinct from co or target.role<>'worker')) then raise exception 'Account access denied';end if;
  if target.access_version<>(p_body->>'version')::int or p_body->>'version' is null then raise exception 'Account changed; refresh first';end if;
  if p_action in ('approve_worker','reject_worker') and r<>'sub' then raise exception 'Company administrator must approve its workers';end if;
  if p_action='suspend_account' and target.account_status<>'approved' then raise exception 'Only approved accounts can be paused';end if;
  if p_action in ('approve_worker','reject_worker') and(target.role<>'worker' or target.account_status<>'pending') then raise exception 'Worker is not pending';end if;
  if p_action='restore_account' and target.account_status<>'suspended' then raise exception 'Account is not suspended';end if;
  if p_action in ('approve_worker','restore_account') and not exists(select 1 from public.npi_companies where id=target.company_id and active) then raise exception 'Active company required';end if;
  update public.npi_profiles set active=(p_action in ('approve_worker','restore_account')), account_status=case p_action when 'approve_worker' then 'approved' when 'reject_worker' then 'rejected' when 'restore_account' then 'approved' else 'suspended' end,access_version=access_version+1 where id=ident;
 else raise exception 'Unsupported operation';end if;
 result:=jsonb_build_object('id',ident);
 insert into public.npi_commands(actor_id,request_id,action,body,result) values(who,p_request,'ops:'||p_action,p_body,result);
 insert into public.npi_audit(actor_id,action,record_id) values(who,p_action,ident);
 return result;
end $$;
-- Public registration is brokered by the Edge Function; these RPCs are service-role only.
-- Passwords and plaintext invitation tokens are never written to application tables.
create function public.npi_enroll(p_mode text,p_hash text,p_request uuid default null,p_attempt uuid default null,p_username text default '',p_name text default '',p_user uuid default null) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare inv public.npi_invitations; reg public.npi_enrollments; co public.npi_companies; account auth.users; used integer;begin
 select * into inv from public.npi_invitations where token_hash=p_hash for update;
 if not found then raise exception 'Invitation unavailable';end if;
 select * into co from public.npi_companies where id=inv.company_id;
 if inv.revoked or inv.expires_at<=now() or not co.active or not exists(select 1 from public.npi_profiles where id=inv.created_by and active and account_status='approved') then raise exception 'Invitation unavailable';end if;
 select count(*) into used from public.npi_enrollments where invitation_id=inv.id;
 if p_mode='preview' then
  if used>=inv.max_uses then raise exception 'Invitation unavailable';end if;
  return jsonb_build_object('company',co.name,'role',inv.role,'expires_at',inv.expires_at);
 end if;
 if p_request is null or p_attempt is null then raise exception 'Invalid registration';end if;
 select * into reg from public.npi_enrollments where request_id=p_request for update;
 if found and reg.invitation_id<>inv.id then raise exception 'Registration changed';end if;
 if p_mode='begin' then
  if p_username !~ '^[a-z0-9][a-z0-9._-]{2,49}$' or length(btrim(p_name))<1 or length(p_name)>150 then raise exception 'Invalid registration';end if;
  if reg.request_id is not null then
   if reg.username<>p_username or reg.display_name<>btrim(p_name) then raise exception 'Registration changed';end if;
   if reg.phase='complete' then return jsonb_build_object('complete',true,'status',case when inv.role='worker' then 'pending' else 'approved' end);end if;
   select * into account from auth.users where email=reg.username||'@users.npi6030.com' and raw_app_meta_data->>'npi_enrollment_id'=p_request::text;
   if account.id is not null then
    update public.npi_enrollments set attempt_id=p_attempt,user_id=account.id where request_id=p_request;
    return jsonb_build_object('user_id',account.id,'role',inv.role);
   end if;
   if reg.lease_until>now() then raise exception 'Registration busy';end if;
   update public.npi_enrollments set attempt_id=p_attempt,lease_until=now()+interval '90 seconds' where request_id=p_request;
  else
   if used>=inv.max_uses then raise exception 'Invitation unavailable';end if;
   if exists(select 1 from public.npi_profiles where username=p_username) or exists(select 1 from auth.users where email=p_username||'@users.npi6030.com') or exists(select 1 from public.npi_enrollments where username=p_username) then raise exception 'Username unavailable';end if;
   insert into public.npi_enrollments(request_id,invitation_id,username,display_name,attempt_id) values(p_request,inv.id,p_username,btrim(p_name),p_attempt);
  end if;
  return jsonb_build_object('role',inv.role,'complete',false);
 elsif p_mode='finish' then
  if reg.request_id is null or reg.attempt_id<>p_attempt then raise exception 'Registration changed';end if;
  if reg.phase='complete' then return jsonb_build_object('status',case when inv.role='worker' then 'pending' else 'approved' end);end if;
  select * into account from auth.users where id=p_user and email=reg.username||'@users.npi6030.com' and raw_app_meta_data->>'npi_enrollment_id'=p_request::text;
  if account.id is null then raise exception 'Registration identity mismatch';end if;
  insert into public.npi_profiles(id,company_id,username,display_name,role,active,account_status) values(p_user,inv.company_id,reg.username,reg.display_name,inv.role,inv.role='sub',case when inv.role='worker' then 'pending' else 'approved' end);
  update public.npi_enrollments set user_id=p_user,phase='complete' where request_id=p_request;
  insert into public.npi_audit(actor_id,action,record_id) values(inv.created_by,'invitation_registered',p_user);
  return jsonb_build_object('status',case when inv.role='worker' then 'pending' else 'approved' end);
 elsif p_mode='release' then
  if reg.attempt_id=p_attempt and reg.phase='reserved' then
   if not exists(select 1 from auth.users where email=reg.username||'@users.npi6030.com') then delete from public.npi_enrollments where request_id=p_request;
   else update public.npi_enrollments set lease_until=now() where request_id=p_request;end if;
  end if;
  return '{}'::jsonb;
 else raise exception 'Invalid registration';end if;
end $$;
-- Scope policies: company administrators get only their contracted sites and contracts.
do $$ declare t text;begin foreach t in array array['npi_contracts','npi_contract_scopes','npi_invitations','npi_enrollments'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on table public.%I from public,anon,authenticated',t);
 execute format('grant all on table public.%I to service_role',t);
end loop;end $$;
grant select on public.npi_contracts,public.npi_contract_scopes to authenticated;
create policy npi_contract_read on public.npi_contracts for select to authenticated using(public.npi_role()='npi' or exists(select 1 from public.npi_contract_scopes s where s.contract_id=npi_contracts.id and s.company_id=public.npi_company()));
create policy npi_scope_read on public.npi_contract_scopes for select to authenticated using(public.npi_role()='npi' or (public.npi_role()='sub' and company_id=public.npi_company()) or(public.npi_role()='worker' and exists(select 1 from public.npi_work_orders w where w.contract_id=npi_contract_scopes.contract_id and w.site_id=npi_contract_scopes.site_id and w.company_id=npi_contract_scopes.company_id and public.npi_can_work(w.id))));
drop policy npi_read on public.npi_sites;
create policy npi_read on public.npi_sites for select to authenticated using(public.npi_role()='npi' or(public.npi_role()='sub' and exists(select 1 from public.npi_contract_scopes s where s.site_id=npi_sites.id and s.company_id=public.npi_company())) or exists(select 1 from public.npi_work_orders w where w.site_id=npi_sites.id and public.npi_can_work(w.id)));
create function public.npi_ops_context() returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if public.npi_role() is null or public.npi_role() not in ('npi','sub') then raise exception 'Active administrator required';end if;
 return jsonb_build_object('contracts',coalesce((select jsonb_agg(c) from(select c.* from public.npi_contracts c where public.npi_role()='npi' or exists(select 1 from public.npi_contract_scopes s where s.contract_id=c.id and s.company_id=public.npi_company()) order by c.name limit 500)c),'[]'::jsonb),'scopes',coalesce((select jsonb_agg(s) from(select * from public.npi_contract_scopes where public.npi_role()='npi' or company_id=public.npi_company() limit 2000)s),'[]'::jsonb),'invitations',coalesce((select jsonb_agg(i) from(select i.id,i.company_id,i.role,i.created_at,i.expires_at,i.revoked,i.max_uses,(select count(*) from public.npi_enrollments e where e.invitation_id=i.id) as uses from public.npi_invitations i where public.npi_role()='npi' or i.company_id=public.npi_company() order by i.created_at desc limit 100)i),'[]'::jsonb));
end $$;
revoke all on function public.npi_enroll(text,text,uuid,uuid,text,text,uuid),public.npi_account_status(),public.npi_ops_action(text,jsonb,uuid),public.npi_ops_context(),public.npi_dispatch_scope(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.npi_enroll(text,text,uuid,uuid,text,text,uuid) to service_role;
grant execute on function public.npi_account_status(),public.npi_ops_action(text,jsonb,uuid),public.npi_ops_context() to authenticated;

-- Extend validated dispatch while preserving attendance/approval invariants.
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
 if p_action in ('save_company','save_site','save_task','save_rate','review_sheet') and r<>'npi' then raise exception 'NPI administrator required';end if;
 if p_action in ('save_rate','draft_document') then raise exception 'Billing is deferred in this operations release';end if;
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
  if r not in ('npi','sub') or(r='sub' and (p_body->>'company_id')::uuid is distinct from public.npi_company()) then raise exception 'Company dispatch denied';end if;
  if not public.npi_dispatch_scope((p_body->>'company_id')::uuid,(p_body->>'site_id')::uuid,(p_body->>'contract_id')::uuid) then raise exception 'Choose a site assigned to this subcontract';end if;
  if not exists(select 1 from public.npi_companies where id=(p_body->>'company_id')::uuid and active) or not exists(select 1 from public.npi_tasks where id=(p_body->>'task_id')::uuid and active) then raise exception 'Choose an active company and service';end if;
  select array_agg(value::uuid) into members from jsonb_array_elements_text(p_body->'members');
  if coalesce(cardinality(members),0)<1 or cardinality(members)>50 or cardinality(members)<>(select count(distinct x) from unnest(members)x) then raise exception 'Choose one to fifty distinct assigned workers';end if;
  if (select count(*) from public.npi_profiles where id=any(members) and active and role='worker' and company_id=(p_body->>'company_id')::uuid)<>cardinality(members) then raise exception 'Workers must belong to this company';end if;
  if jsonb_typeof(p_body->'checklist')<>'array' or jsonb_array_length(p_body->'checklist')<1 or jsonb_array_length(p_body->'checklist')>20 or exists(select 1 from jsonb_array_elements_text(p_body->'checklist')x where length(btrim(x))<1 or length(x)>200) then raise exception 'Provide one to twenty task instructions';end if;
  insert into public.npi_work_orders(contract_id,company_id,site_id,task_id,planned_date,equipment,title,kind,checklist) values((p_body->>'contract_id')::uuid,(p_body->>'company_id')::uuid,(p_body->>'site_id')::uuid,(p_body->>'task_id')::uuid,(p_body->>'planned_date')::date,left(coalesce(p_body->>'equipment',''),150),left(coalesce(p_body->>'title',''),200),coalesce(p_body->>'kind','site'),p_body->'checklist') returning id into ident;
  insert into public.npi_work_members select ident,x from unnest(members)x;
  insert into public.npi_hour_reviews(work_id,worker_id) select ident,x from unnest(members)x;
 elsif p_action='review_sheet' then
  if p_body->>'decision' is null or p_body->>'decision' not in ('accept','reject') then raise exception 'Choose accept or reject';end if;
  select * into change from public.npi_sync_changes where id=ident for update;
  if not found or change.status<>'pending' then raise exception 'Change is not pending';end if;
  if p_body->>'decision'='reject' then update public.npi_sync_changes set status='rejected',message='Rejected by NPI' where id=ident;
  elsif change.record_table='npi_rates' then
   raise exception 'Pricing is deferred in this operations release';
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
   if r not in ('npi','sub') then raise exception 'Administrator required';end if;
   if w.status<>'draft' then raise exception 'Only unstarted work can be rescheduled';end if;
   update public.npi_work_orders set planned_date=(p_body->>'planned_date')::date,equipment=left(p_body->>'equipment',150),version=version+1 where id=ident;
  else raise exception 'Unknown operation';end if;
 end if;
 result:=jsonb_build_object('id',ident,'action',p_action);
 insert into public.npi_commands values(who,p_request,p_action,p_body,result,now_at);
 insert into public.npi_audit(actor_id,action,record_id) values(who,p_action,ident);
 return result;
end $$;

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
 'rates','[]'::jsonb,
 'work',coalesce((select jsonb_agg(x) from(select * from public.npi_work_orders where (p_stage='all' or status=p_stage) and (p_work_id is null or id=p_work_id) order by planned_date desc,id limit 500)x),'[]'::jsonb),
 'members',coalesce((select jsonb_agg(x) from(select * from public.npi_work_members where p_work_id is null or work_id=p_work_id limit 25000)x),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(x) from(select * from public.npi_attendance_events where p_work_id is null or work_id=p_work_id order by received_at desc limit 10000)x),'[]'::jsonb),
 'reviews',coalesce((select jsonb_agg(x) from(select r.*,public.npi_visible_recorded_minutes(r.work_id,r.worker_id) as recorded_minutes from public.npi_hour_reviews r where p_work_id is null or r.work_id=p_work_id limit 25000)x),'[]'::jsonb),
 'evidence',coalesce((select jsonb_agg(x) from(select * from public.npi_evidence where p_work_id is null or work_id=p_work_id order by created_at desc limit 5000)x),'[]'::jsonb),
 'documents','[]'::jsonb,
 'lines','[]'::jsonb,
 'audit',coalesce((select jsonb_agg(x) from(select * from public.npi_audit order by event_time desc limit 500)x),'[]'::jsonb),
 'changes',coalesce((select jsonb_agg(x) from(select * from public.npi_sync_changes order by received_at desc limit 500)x),'[]'::jsonb)
 );
end $$;

notify pgrst,'reload schema';
commit;
