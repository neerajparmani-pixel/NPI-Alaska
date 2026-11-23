-- v3.2.0: apply ONCE after 007. Existing accounts, original attendance and uploads remain.
begin;
alter table public.npi_profiles add column invited_by uuid references public.npi_profiles;
alter table public.npi_profiles add column requires_email_verification boolean not null default false;
alter table public.npi_invitations alter column company_id drop not null;
alter table public.npi_invitations drop constraint npi_invitations_role_check;
alter table public.npi_invitations drop constraint npi_invitations_max_uses_check;
alter table public.npi_invitations drop constraint npi_invitations_check;
alter table public.npi_invitations add column invited_email text not null default '';
-- Old unbound links must be replaced; completed accounts are unaffected.
update public.npi_invitations set revoked=true where not revoked;
update public.npi_invitations set max_uses=1;
alter table public.npi_invitations add constraint invite_role check(role in('npi','sub','worker'));
alter table public.npi_invitations add constraint invite_single_use check(max_uses=1);
alter table public.npi_invitations add constraint invite_company check((role='npi'and company_id is null)or(role<>'npi'and company_id is not null));
alter table public.npi_invitations alter column expires_at set default now()+interval '72 hours';
create table public.npi_email_verifications(user_id uuid primary key references auth.users,email text not null,token_hash text not null unique,expires_at timestamptz not null,consumed_at timestamptz,issued_at timestamptz not null default now());
create table public.npi_sync_status(id text primary key default 'workbook',last_success_at timestamptz,last_error_at timestamptz,message text not null default '');
create table public.npi_report_runs(id uuid primary key default gen_random_uuid(),actor_id uuid not null references public.npi_profiles,request_id uuid not null,filter jsonb not null,created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '1 hour',total integer not null default 0,unique(actor_id,request_id));
create table public.npi_report_rows(run_id uuid references public.npi_report_runs on delete cascade,seq bigint,row jsonb not null,primary key(run_id,seq));
do $$declare t text;begin foreach t in array array['npi_email_verifications','npi_sync_status','npi_report_runs','npi_report_rows']loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant all on public.%I to service_role',t);end loop;end $$;
create or replace function public.npi_role()returns text language sql stable security definer set search_path=public,pg_temp as $$
 select p.role from public.npi_profiles p where p.id=auth.uid()and p.active and p.account_status='approved'and(not p.requires_email_verification or exists(select 1 from auth.users u where u.id=p.id and u.email_confirmed_at is not null))and(p.role='npi'or exists(select 1 from public.npi_companies c where c.id=p.company_id and c.active))
$$;
create or replace function public.npi_account_status()returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$declare p public.npi_profiles;begin
 if auth.uid()is null then raise exception 'Sign in required';end if;select *into p from public.npi_profiles where id=auth.uid();
 return jsonb_build_object('status',case when p.id is null then 'unassigned'when p.requires_email_verification and not exists(select 1 from auth.users where id=p.id and email_confirmed_at is not null)then 'verify-email'when p.role<>'npi'and not exists(select 1 from public.npi_companies where id=p.company_id and active)then 'suspended'when p.account_status='approved'and not p.active then 'suspended'else p.account_status end,'display_name',p.display_name,'company',(select name from public.npi_companies where id=p.company_id));end $$;
create or replace function public.npi_public_gate(p_bucket text,p_kind text)returns boolean language plpgsql security definer set search_path=public,pg_temp as $$declare hits int;win timestamptz:=date_trunc('minute',now());begin
 if length(p_bucket)>90 or p_kind not in('preview','registration','global','login','recovery','verify','resend')then raise exception 'Invalid rate bucket';end if;
 insert into public.npi_public_limits values(p_bucket,win,p_kind,1)on conflict(bucket,window_at,kind)do update set hits=npi_public_limits.hits+1 returning npi_public_limits.hits into hits;
 delete from public.npi_public_limits where window_at<now()-interval '1 day';
 return hits<=case p_kind when 'global'then 200 when 'preview'then 60 when 'registration'then 10 when 'login'then 10 when 'verify'then 10 when 'resend'then 3 else 5 end;end $$;
create function public.npi_account_notice(p_user uuid,p_event text)returns void language plpgsql security definer set search_path=public,pg_temp as $$declare p public.npi_profiles;who uuid;s public.npi_notification_settings;email text;title text;message text;key text;begin
 select *into p from public.npi_profiles where id=p_user;title:=case when p_event='pending'then 'Account awaiting approval'when p_event='approved'then 'Account approved'when p_event='rejected'then 'Registration declined'when p_event='suspended'then 'Account access paused'else 'Account access restored'end;
 message:=case when p_event='pending'then p.display_name||' has verified their email. Review the registration in People & access.'else 'Your NPI account status has changed: '||p_event||'. Open https://alaska.npi6030.com/live/ to sign in or contact your administrator.'end;
 key:='account:'||p.id||':'||p_event||':'||p.access_version;
 if p_event='pending'then
  for who in select id from public.npi_profiles where active and account_status='approved'and((p.role='npi'and id=p.invited_by)or(p.role='sub'and role='npi')or(p.role='worker'and role='sub'and company_id=p.company_id))loop insert into public.npi_notifications(recipient_id,title,message,event_key)values(who,title,message,key)on conflict(recipient_id,event_key)do nothing;end loop;
  for s in select *from public.npi_notification_settings where scope=case when p.role='worker'then p.company_id::text else 'npi'end loop for email in select jsonb_array_elements_text(s.emails)loop insert into public.npi_email_outbox(scope,recipient,subject,message,dedupe)values(s.scope,email,title,message,key||':'||email)on conflict(dedupe)do nothing;end loop;end loop;
 else
  select u.email into email from auth.users u where u.id=p.id;
  if p.requires_email_verification and email is not null then insert into public.npi_email_outbox(scope,recipient,subject,message,dedupe)values(coalesce(p.company_id::text,'npi'),email,title,message,key||':'||email)on conflict(dedupe)do nothing;end if;
 end if;end $$;
-- Preserve the prior non-account contract operations; account mutations are owned here.
alter function public.npi_ops_action(text,jsonb,uuid)rename to npi_ops_action_v31;
revoke all on function public.npi_ops_action_v31(text,jsonb,uuid)from public,anon,authenticated;
create function public.npi_ops_action(p_action text,p_body jsonb,p_request uuid)returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r text:=public.npi_role();who uuid:=auth.uid();co uuid:=public.npi_company();target public.npi_profiles;inv public.npi_invitations;cmd public.npi_commands;ident uuid;result jsonb;next_status text;v_email text;v_role text;v_company uuid;begin
 if r is null or r not in('npi','sub')then raise exception 'Active administrator required';end if;
 if p_request is null or jsonb_typeof(p_body)<>'object'or octet_length(p_body::text)>8000 then raise exception 'Invalid request';end if;
 if p_action not in('create_invite','reissue_invite','revoke_invite','approve_worker','reject_worker','approve_account','reject_account','reopen_registration','suspend_account','restore_account')then return public.npi_ops_action_v31(p_action,p_body,p_request);end if;
 perform pg_advisory_xact_lock(hashtextextended(who::text||p_request::text,0));
 select *into cmd from public.npi_commands where actor_id=who and request_id=p_request;
 if found then if cmd.action<>'ops:'||p_action or cmd.body<>p_body then raise exception 'Request identifier reused';end if;return cmd.result;end if;
 if p_action in('create_invite','reissue_invite')then
  if p_action='reissue_invite'then
   select *into inv from public.npi_invitations where id=(p_body->>'id')::uuid for update;
   if inv.id is null or exists(select 1 from public.npi_enrollments where invitation_id=inv.id)then raise exception 'Invitation already used or unavailable';end if;
   v_email:=inv.invited_email;v_role:=inv.role;v_company:=inv.company_id;
  else v_email:=lower(btrim(p_body->>'email'));v_role:=p_body->>'role';v_company:=nullif(p_body->>'company_id','')::uuid;end if;
  if v_email is null or length(v_email)>254 or v_email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'or v_role is null or v_role not in('npi','sub','worker')or coalesce(p_body->>'token_hash','')!~'^[0-9a-f]{64}$'then raise exception 'Check invitation email and role';end if;
  if(r='npi'and v_role not in('npi','sub'))or(r='sub'and(v_role<>'worker'or v_company is distinct from co))then raise exception 'Invite only your permitted account type';end if;
  if(v_role='npi'and v_company is not null)or(v_role<>'npi'and not exists(select 1 from public.npi_companies where id=v_company and active))then raise exception 'Choose the correct company';end if;
  if exists(select 1 from auth.users where lower(auth.users.email)=v_email)then raise exception 'An account already exists; use verification or password recovery';end if;
  if p_action='reissue_invite'then update public.npi_invitations set revoked=true where id=inv.id;end if;
  insert into public.npi_invitations(company_id,role,token_hash,created_by,max_uses,invited_email)values(v_company,v_role,p_body->>'token_hash',who,1,v_email)returning id into ident;
 elsif p_action='revoke_invite'then
  ident:=(p_body->>'id')::uuid;update public.npi_invitations set revoked=true where id=ident and((r='npi'and role in('npi','sub'))or(r='sub'and role='worker'and company_id=co));if not found then raise exception 'Invitation access denied';end if;
 else
  -- Serialises last-admin protection and concurrent access changes.
  perform pg_advisory_xact_lock(hashtextextended('npi-administration-access',0));
  select *into target from public.npi_profiles where id=(p_body->>'id')::uuid for update;ident:=target.id;
  if ident is null or ident=who or(r='sub'and(target.role<>'worker'or target.company_id is distinct from co))then raise exception 'Account access denied';end if;
  if target.access_version is distinct from(p_body->>'version')::int then raise exception 'Account changed; refresh first';end if;
  if p_action='reopen_registration'then
   if target.account_status<>'rejected'then raise exception 'Registration is not declined';end if;
   if(target.role='worker'and r<>'sub')or(target.role<>'worker'and r<>'npi')or(target.role='npi'and target.invited_by is distinct from who)then raise exception 'The responsible administrator must reopen this registration';end if;
   next_status:='pending';
  elsif p_action in('approve_account','reject_account','approve_worker','reject_worker')then
   if target.account_status<>'pending'then raise exception 'Registration is not pending';end if;
   if(target.role='worker'and r<>'sub')or(target.role<>'worker'and r<>'npi')or(target.role='npi'and target.invited_by is distinct from who)then raise exception 'The responsible administrator must review this registration';end if;
   if target.requires_email_verification and not exists(select 1 from auth.users where id=ident and email_confirmed_at is not null)then raise exception 'Email verification is required first';end if;
   next_status:=case when p_action in('approve_account','approve_worker')then 'approved'else 'rejected'end;
  elsif p_action='suspend_account'then
   if target.account_status<>'approved'then raise exception 'Account is not active';end if;
   if target.role='npi'and(select count(*)from public.npi_profiles where role='npi'and active and account_status='approved')<=1 then raise exception 'Keep at least one active NPI administrator';end if;next_status:='suspended';
  else if target.account_status<>'suspended'then raise exception 'Account is not suspended';end if;next_status:='approved';end if;
  if next_status='approved'and target.role<>'npi'and not exists(select 1 from public.npi_companies where id=target.company_id and active)then raise exception 'Active company required';end if;
  update public.npi_profiles set account_status=next_status,active=(next_status='approved'),access_version=access_version+1 where id=ident;
  perform public.npi_account_notice(ident,next_status);
 end if;
 result:=jsonb_build_object('id',ident);insert into public.npi_commands(actor_id,request_id,action,body,result)values(who,p_request,'ops:'||p_action,p_body,result);insert into public.npi_audit(actor_id,action,record_id)values(who,p_action,ident);return result;end $$;
-- Block all direct demotions/deletions of the last active NPI admin as well.
create function public.npi_last_admin()returns trigger language plpgsql security definer set search_path=public,pg_temp as $$begin
 if OLD.role='npi'and OLD.active and OLD.account_status='approved'and(TG_OP='DELETE'or NEW.role<>'npi'or not NEW.active or NEW.account_status<>'approved')then
 perform pg_advisory_xact_lock(hashtextextended('npi-administration-access',0));
 if not exists(select 1 from public.npi_profiles where role='npi'and active and account_status='approved'and id<>OLD.id)then raise exception 'Keep at least one active NPI administrator';end if;end if;
 if TG_OP='DELETE'then return OLD;end if;return NEW;end $$;
create trigger protect_last_npi before update or delete on public.npi_profiles for each row execute function public.npi_last_admin();
create or replace function public.npi_enroll(p_mode text,p_hash text,p_request uuid default null,p_attempt uuid default null,p_username text default '',p_name text default '',p_user uuid default null)returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare inv public.npi_invitations;reg public.npi_enrollments;account auth.users;begin
 select *into inv from public.npi_invitations where token_hash=p_hash for update;
 if inv.id is null or inv.revoked or inv.expires_at<=now()or inv.invited_email=''or not exists(select 1 from public.npi_profiles where id=inv.created_by and active and account_status='approved')or(inv.role<>'npi'and not exists(select 1 from public.npi_companies where id=inv.company_id and active))then raise exception 'Invitation unavailable';end if;
 if p_mode='preview'then if exists(select 1 from public.npi_enrollments where invitation_id=inv.id)and not exists(select 1 from public.npi_enrollments where invitation_id=inv.id and request_id=p_request)then raise exception 'Invitation unavailable';end if;return jsonb_build_object('company',case when inv.role='npi'then 'NPI Administration'else(select name from public.npi_companies where id=inv.company_id)end,'role',inv.role,'email',inv.invited_email,'expires_at',inv.expires_at,'release','3.2.0');end if;
 if p_request is null or p_attempt is null then raise exception 'Invalid registration';end if;
 select *into reg from public.npi_enrollments where request_id=p_request for update;
 if reg.request_id is not null and(reg.invitation_id<>inv.id or reg.username<>p_username and p_mode='begin')then raise exception 'Registration changed';end if;
 if p_mode='begin'then
  if p_username!~'^[a-z0-9][a-z0-9._-]{2,49}$'or length(btrim(p_name))<1 or length(p_name)>150 then raise exception 'Invalid registration';end if;
  if reg.request_id is not null then
   if reg.display_name<>btrim(p_name)then raise exception 'Registration changed';end if;
   if reg.phase='complete'then return jsonb_build_object('complete',true,'status','verify-email','user_id',reg.user_id,'email',inv.invited_email);end if;
   select *into account from auth.users where lower(email)=inv.invited_email and raw_app_meta_data->>'npi_enrollment_id'=p_request::text;
   if account.id is not null then update public.npi_enrollments set attempt_id=p_attempt,user_id=account.id where request_id=p_request;return jsonb_build_object('user_id',account.id,'role',inv.role,'email',inv.invited_email);end if;
   if reg.lease_until>now()then raise exception 'Registration busy';end if;update public.npi_enrollments set attempt_id=p_attempt,lease_until=now()+interval '90 seconds'where request_id=p_request;
  else
   if exists(select 1 from public.npi_enrollments where invitation_id=inv.id)then raise exception 'Invitation unavailable';end if;
   if exists(select 1 from public.npi_profiles where username=p_username)or exists(select 1 from public.npi_enrollments where username=p_username)or exists(select 1 from auth.users where lower(email)=inv.invited_email)then raise exception 'Username unavailable';end if;
   insert into public.npi_enrollments(request_id,invitation_id,username,display_name,attempt_id)values(p_request,inv.id,p_username,btrim(p_name),p_attempt);
  end if;return jsonb_build_object('complete',false,'role',inv.role,'email',inv.invited_email);
 elsif p_mode='finish'then
  if reg.request_id is null or reg.attempt_id<>p_attempt then raise exception 'Registration changed';end if;
  if reg.phase='complete'then return jsonb_build_object('status','verify-email','user_id',reg.user_id);end if;
  select *into account from auth.users where id=p_user and lower(email)=inv.invited_email and raw_app_meta_data->>'npi_enrollment_id'=p_request::text;
  if account.id is null then raise exception 'Registration identity mismatch';end if;
  insert into public.npi_profiles(id,company_id,username,display_name,role,active,account_status,invited_by,requires_email_verification)values(p_user,inv.company_id,reg.username,reg.display_name,inv.role,false,'pending',inv.created_by,true);
  update public.npi_enrollments set user_id=p_user,phase='complete'where request_id=p_request;insert into public.npi_audit(actor_id,action,record_id)values(inv.created_by,'invitation_registered',p_user);return jsonb_build_object('status','verify-email','user_id',p_user);
 elsif p_mode='release'then
  if reg.attempt_id=p_attempt and reg.phase='reserved'then if not exists(select 1 from auth.users where lower(email)=inv.invited_email)then delete from public.npi_enrollments where request_id=p_request;else update public.npi_enrollments set lease_until=now()where request_id=p_request;end if;end if;return '{}'::jsonb;
 else raise exception 'Invalid registration';end if;end $$;
-- Only the broker can resolve emails or change verification state. No passwords/tokens are stored.
create function public.npi_identity(p_mode text,p_username text default '',p_user uuid default null,p_hash text default '')returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$declare u auth.users;v public.npi_email_verifications;p public.npi_profiles;begin
 if p_mode='resolve'then select a.*into u from auth.users a join public.npi_profiles profile on profile.id=a.id where lower(profile.username)=lower(p_username)or lower(a.email)=lower(p_username)limit 1;return jsonb_build_object('email',u.email,'id',u.id,'confirmed',u.email_confirmed_at is not null);end if;
 if p_mode='issue'then
  select *into u from auth.users where id=p_user;select *into p from public.npi_profiles where id=p_user and requires_email_verification;
  if u.id is null or p.id is null or u.email_confirmed_at is not null then return '{}'::jsonb;end if;
  if p_hash!~'^[0-9a-f]{64}$'then raise exception 'Invalid verification';end if;
  insert into public.npi_email_verifications(user_id,email,token_hash,expires_at)values(p_user,lower(u.email),p_hash,now()+interval '24 hours')on conflict(user_id)do update set email=excluded.email,token_hash=excluded.token_hash,expires_at=excluded.expires_at,consumed_at=null,issued_at=now();return jsonb_build_object('email',u.email);
 end if;
 select *into v from public.npi_email_verifications where token_hash=p_hash;
 if v.user_id is null or v.expires_at<=now()or not exists(select 1 from auth.users where id=v.user_id and lower(email)=v.email)then raise exception 'Verification expired or unavailable';end if;
 if p_mode='verify'then return jsonb_build_object('user_id',v.user_id,'complete',v.consumed_at is not null);end if;
 if p_mode='finish'then
  if not exists(select 1 from auth.users where id=v.user_id and email_confirmed_at is not null)then raise exception 'Email not verified';end if;
  if v.consumed_at is null then update public.npi_email_verifications set consumed_at=now()where user_id=v.user_id;perform public.npi_account_notice(v.user_id,'pending');insert into public.npi_audit(actor_id,action,record_id)select invited_by,'email_verified',id from public.npi_profiles where id=v.user_id;end if;return jsonb_build_object('status',(select account_status from public.npi_profiles where id=v.user_id));end if;
 raise exception 'Invalid identity action';end $$;
create function public.npi_people_context()returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$declare r text:=public.npi_role();begin
 if r is null or r not in('npi','sub')then raise exception 'Administrator required';end if;
 return jsonb_build_object('release','3.2.0','people',coalesce((select jsonb_agg(x)from(select p.id,p.company_id,p.username,p.display_name,p.role,p.active,p.account_status,p.access_version,p.invited_by,p.requires_email_verification,case when not p.requires_email_verification then true else u.email_confirmed_at is not null end email_verified,u.email from public.npi_profiles p left join auth.users u on u.id=p.id where r='npi'or p.company_id=public.npi_company()order by p.display_name)x),'[]'::jsonb),'invitations',coalesce((select jsonb_agg(x)from(select i.id,i.company_id,i.role,i.invited_email,i.created_by,i.created_at,i.expires_at,i.revoked,i.max_uses,(select count(*)from public.npi_enrollments where invitation_id=i.id)uses from public.npi_invitations i where(r='npi'and i.role in('npi','sub'))or(r='sub'and i.company_id=public.npi_company()and i.role='worker')order by i.created_at desc limit 500)x),'[]'::jsonb),'history',coalesce((select jsonb_agg(x)from(select a.action,a.event_time,actor.display_name actor,coalesce(person.display_name,i.invited_email,'Account') target from public.npi_audit a left join public.npi_profiles actor on actor.id=a.actor_id left join public.npi_profiles person on person.id=a.record_id left join public.npi_invitations i on i.id=a.record_id where a.action in('create_invite','reissue_invite','revoke_invite','invitation_registered','email_verified','approve_account','reject_account','approve_worker','reject_worker','reopen_registration','suspend_account','restore_account')and(r='npi'or(person.company_id=public.npi_company()and person.role='worker')or(i.company_id=public.npi_company()and i.role='worker'))order by a.event_time desc limit 200)x),'[]'::jsonb),'sync',case when r='npi'then(select to_jsonb(s)from public.npi_sync_status s where id='workbook')else null end);
end $$;
create function public.npi_sheet_status(p_ok boolean,p_message text default '')returns void language plpgsql security definer set search_path=public,pg_temp as $$begin
 insert into public.npi_sync_status(id,last_success_at,last_error_at,message)values('workbook',case when p_ok then now()end,case when not p_ok then now()end,left(p_message,300))on conflict(id)do update set last_success_at=case when p_ok then now()else npi_sync_status.last_success_at end,last_error_at=case when not p_ok then now()else npi_sync_status.last_error_at end,message=left(p_message,300);end $$;
create function public.npi_sheet_people(p_offset integer default 0)returns setof jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select to_jsonb(x)from(select p.id,p.company_id,p.username,p.display_name,p.role,p.active,p.account_status,p.access_version,p.invited_by,p.requires_email_verification,u.email,case when p.requires_email_verification then u.email_confirmed_at is not null else true end email_verified from public.npi_profiles p left join auth.users u on u.id=p.id order by p.id limit 1000 offset greatest(0,p_offset))x
$$;
revoke all on function public.npi_sheet_people(integer)from public,anon,authenticated;
grant execute on function public.npi_sheet_people(integer)to service_role;
create index npi_attendance_report on public.npi_attendance_events(work_id,worker_id,received_at,id);
create index npi_work_report_date on public.npi_work_orders((coalesce(service_date,planned_date,(created_at at time zone 'America/Anchorage')::date)),company_id);
-- Report rows are a frozen, actor-bound snapshot, not the limited screen dataset.
create function public.npi_report_start(p_filter jsonb,p_request uuid)returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r text:=public.npi_role();run public.npi_report_runs;kind text:=p_filter->>'kind';from_date date:=(p_filter->>'from')::date;to_date date:=(p_filter->>'to')::date;ids uuid[];n integer;begin
 if r is null or r not in('npi','sub')then raise exception 'Administrator required';end if;
 if p_request is null or kind is null or kind not in('work','hours','evidence','issues')or from_date is null or to_date is null or to_date<from_date or to_date-from_date>366 then raise exception 'Choose a report type and a date range of at most 367 days';end if;
 perform pg_advisory_xact_lock(hashtextextended('npi-report-snapshots',0));
 delete from public.npi_report_runs where expires_at<now();select *into run from public.npi_report_runs where actor_id=auth.uid()and request_id=p_request;
 if run.id is not null then if run.filter<>p_filter then raise exception 'Report request changed';end if;return to_jsonb(run)-'actor_id';end if;
 if(select count(*)from public.npi_report_runs where actor_id=auth.uid()and created_at>now()-interval '1 minute')>=5 or(select count(*)from public.npi_report_runs where actor_id=auth.uid())>=10 then raise exception 'Report limit reached; reuse a recent report or wait for its expiry';end if;
 select array_agg(w.id order by w.id)into ids from public.npi_work_orders w where(r='npi'or w.company_id=public.npi_company())and coalesce(w.service_date,w.planned_date,(w.created_at at time zone 'America/Anchorage')::date)between from_date and to_date
 and(nullif(p_filter->>'company','')is null or w.company_id=(p_filter->>'company')::uuid)and(nullif(p_filter->>'site','')is null or w.site_id=(p_filter->>'site')::uuid)and(nullif(p_filter->>'status','')is null or w.status=p_filter->>'status')and(nullif(p_filter->>'worker','')is null or exists(select 1 from public.npi_work_members m where m.work_id=w.id and m.worker_id=(p_filter->>'worker')::uuid))and(nullif(p_filter->>'service','')is null or exists(select 1 from public.npi_visit_lines l where l.work_id=w.id and(l.line_id=(p_filter->>'service')::uuid or l.sub_id=(p_filter->>'service')::uuid)));
 if cardinality(ids)>100000 then raise exception 'Too many matching visits; narrow the date range. No report was truncated';end if;
 insert into public.npi_report_runs(actor_id,request_id,filter)values(auth.uid(),p_request,p_filter)returning *into run;
 if kind='work'then
 insert into public.npi_report_rows select run.id,row_number()over(order by w.id),jsonb_build_object('work_id',w.id,'date',coalesce(w.service_date,w.planned_date),'company',c.name,'site',s.name,'address',s.address,'contract',ct.name,'status',w.status,'title',w.title,'services',(select string_agg(l.line_label||coalesce(' / '||nullif(l.sub_label,''),'')||' · '||l.quantity||' '||l.unit,'; 'order by l.id)from public.npi_visit_lines l where l.work_id=w.id),'workers',(select string_agg(p.display_name,'; 'order by p.display_name)from public.npi_work_members m join public.npi_profiles p on p.id=m.worker_id where m.work_id=w.id),'recorded_hours',(select round(sum(public.npi_recorded_minutes(w.id,m.worker_id))/60,4)from public.npi_work_members m where m.work_id=w.id),'claimed_hours',(select round(sum(h.claimed_minutes)/60.0,4)from public.npi_hour_reviews h where h.work_id=w.id),'approved_hours',(select round(sum(h.accepted_minutes)/60.0,4)from public.npi_hour_reviews h where h.work_id=w.id),'evidence_exception',w.evidence_exception_reason,'below_threshold',exists(select 1 from public.npi_visit_lines l where l.work_id=w.id and l.review_required),'record_link','https://alaska.npi6030.com/live/#work='||w.id)
 from public.npi_work_orders w join public.npi_companies c on c.id=w.company_id join public.npi_sites s on s.id=w.site_id left join public.npi_contracts ct on ct.id=w.contract_id where w.id=any(ids)and(r='npi'or w.company_id=public.npi_company());
 elsif kind='hours'then
 insert into public.npi_report_rows select run.id,row_number()over(order by w.id,m.worker_id),jsonb_build_object('work_id',w.id,'date',coalesce(w.service_date,w.planned_date),'company',c.name,'site',s.name,'worker',p.display_name,'status',w.status,'check_in_utc',(select min(received_at)from public.npi_attendance_events where work_id=w.id and worker_id=m.worker_id and event_kind='check-in'),'check_out_utc',(select max(received_at)from public.npi_attendance_events where work_id=w.id and worker_id=m.worker_id and event_kind='check-out'),'check_in_latitude',first_event.latitude,'check_in_longitude',first_event.longitude,'check_in_accuracy_metres',first_event.accuracy_metres,'check_out_latitude',last_event.latitude,'check_out_longitude',last_event.longitude,'check_out_accuracy_metres',last_event.accuracy_metres,'check_in_map',case when first_event.id is not null then 'https://www.google.com/maps?q='||first_event.latitude||','||first_event.longitude end,'check_out_map',case when last_event.id is not null then 'https://www.google.com/maps?q='||last_event.latitude||','||last_event.longitude end,'break_minutes',(select coalesce(sum(break_minutes),0)from public.npi_attendance_events where work_id=w.id and worker_id=m.worker_id and event_kind='check-out'),'recorded_hours',round(public.npi_recorded_minutes(w.id,m.worker_id)/60,4),'claimed_hours',round(h.claimed_minutes/60.0,4),'approved_hours',round(h.accepted_minutes/60.0,4),'review_reason',h.reason,'record_link','https://alaska.npi6030.com/live/#work='||w.id)
 from public.npi_work_orders w join public.npi_companies c on c.id=w.company_id join public.npi_sites s on s.id=w.site_id join public.npi_work_members m on m.work_id=w.id join public.npi_profiles p on p.id=m.worker_id left join public.npi_hour_reviews h on h.work_id=w.id and h.worker_id=m.worker_id
 left join lateral(select *from public.npi_attendance_events where work_id=w.id and worker_id=m.worker_id and event_kind='check-in'order by received_at,id limit 1)first_event on true
 left join lateral(select *from public.npi_attendance_events where work_id=w.id and worker_id=m.worker_id and event_kind='check-out'order by received_at desc,id desc limit 1)last_event on true
 where w.id=any(ids)and(r='npi'or w.company_id=public.npi_company())and(nullif(p_filter->>'worker','')is null or m.worker_id=(p_filter->>'worker')::uuid);
 elsif kind='evidence'then
 insert into public.npi_report_rows select run.id,row_number()over(order by w.id,e.id),jsonb_build_object('work_id',w.id,'evidence_id',e.id,'date',coalesce(w.service_date,w.planned_date),'company',c.name,'site',s.name,'stage',e.stage,'filename',e.filename,'source',e.source,'captured_at',e.captured_at,'uploaded_at',e.created_at,'bytes',e.bytes,'measurement_inches',(select l.snow_inches from public.npi_visit_lines l where l.ruler_evidence=e.id limit 1),'below_threshold',exists(select 1 from public.npi_visit_lines l where l.ruler_evidence=e.id and l.review_required),'record_link','https://alaska.npi6030.com/live/#work='||w.id)
 from public.npi_evidence e join public.npi_work_orders w on w.id=e.work_id join public.npi_companies c on c.id=w.company_id join public.npi_sites s on s.id=w.site_id where w.id=any(ids)and(r='npi'or w.company_id=public.npi_company());
 else
 insert into public.npi_report_rows select run.id,row_number()over(order by w.id,i.id),jsonb_build_object('work_id',w.id,'date',coalesce(w.service_date,w.planned_date),'company',c.name,'site',s.name,'category',i.category,'urgency',i.urgency,'issue_status',i.status,'description',i.description,'resolution',i.resolution,'reported_at',i.created_at,'updated_at',i.updated_at,'record_link','https://alaska.npi6030.com/live/#work='||w.id)
 from public.npi_issues i join public.npi_work_orders w on w.id=i.work_id join public.npi_companies c on c.id=w.company_id join public.npi_sites s on s.id=w.site_id where w.id=any(ids)and(r='npi'or w.company_id=public.npi_company());
 end if;
 select count(*)into n from public.npi_report_rows where run_id=run.id;
 if n>100000 then raise exception 'More than 100,000 rows; narrow filters. No rows were silently omitted';end if;
 if(select coalesce(sum(octet_length(row::text)),0)from public.npi_report_rows)>50*1024*1024 then raise exception 'Report storage busy; narrow the period or retry after existing snapshots expire. No partial report was created';end if;
 update public.npi_report_runs set total=n where id=run.id;return jsonb_build_object('id',run.id,'total',n,'filter',p_filter,'created_at',run.created_at,'expires_at',run.expires_at);end $$;
create function public.npi_report_page(p_run uuid,p_page integer default 1)returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$declare run public.npi_report_runs;r text:=public.npi_role();begin
 if r is null or r not in('npi','sub')then raise exception 'Administrator required';end if;select *into run from public.npi_report_runs where id=p_run and actor_id=auth.uid()and expires_at>now();if run.id is null or p_page<1 then raise exception 'Report expired or unavailable; generate again';end if;
 -- A company permission change invalidates the snapshot immediately.
 if exists(select 1 from public.npi_report_rows x join public.npi_work_orders w on w.id=(x.row->>'work_id')::uuid where x.run_id=run.id and r='sub'and w.company_id<>public.npi_company())then raise exception 'Report access changed; generate again';end if;
 return jsonb_build_object('total',run.total,'rows',coalesce((select jsonb_agg(row order by seq)from(select row,seq from public.npi_report_rows where run_id=run.id and seq between(p_page-1)*500+1 and p_page*500)x),'[]'::jsonb));end $$;
create function public.npi_report_evidence(p_run uuid,p_ids uuid[])returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$begin
 if public.npi_role()is null or public.npi_role()not in('npi','sub')or cardinality(p_ids)>20 then raise exception 'Select up to 20 authorised files';end if;
 if not exists(select 1 from public.npi_report_runs where id=p_run and actor_id=auth.uid()and expires_at>now()and filter->>'kind'='evidence')then raise exception 'Report unavailable';end if;
 if exists(select 1 from unnest(p_ids)i where not exists(select 1 from public.npi_report_rows where run_id=p_run and row->>'evidence_id'=i::text))then raise exception 'Evidence not in report';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'path',e.path,'filename',e.filename,'bytes',e.bytes))from public.npi_evidence e where e.id=any(p_ids)and public.npi_can_work(e.work_id)),'[]'::jsonb);end $$;
-- The existing minute dispatcher also clears expired report cache, never work records.
alter function public.npi_email_claim()rename to npi_email_claim_v31;
revoke all on function public.npi_email_claim_v31()from public,anon,authenticated;
create function public.npi_email_claim()returns setof public.npi_email_outbox language plpgsql security definer set search_path=public,pg_temp as $$begin
 delete from public.npi_report_runs where expires_at<now();return query select *from public.npi_email_claim_v31();end $$;
revoke all on function public.npi_email_claim()from public,anon,authenticated;
grant execute on function public.npi_email_claim()to service_role;
-- Mark the changed frontend/backend contract explicitly.
alter function public.npi_visit_context(uuid)rename to npi_visit_context_v31;
revoke all on function public.npi_visit_context_v31(uuid)from public,anon,authenticated;
create function public.npi_visit_context(p_work uuid default null)returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$begin return public.npi_visit_context_v31(p_work)||jsonb_build_object('release','3.2.0');end $$;
revoke all on function public.npi_account_notice(uuid,text),public.npi_last_admin(),public.npi_identity(text,text,uuid,text),public.npi_people_context(),public.npi_sheet_status(boolean,text),public.npi_report_start(jsonb,uuid),public.npi_report_page(uuid,integer),public.npi_report_evidence(uuid,uuid[]),public.npi_ops_action(text,jsonb,uuid),public.npi_visit_context(uuid)from public,anon,authenticated;
grant execute on function public.npi_identity(text,text,uuid,text),public.npi_sheet_status(boolean,text)to service_role;
grant execute on function public.npi_people_context(),public.npi_report_start(jsonb,uuid),public.npi_report_page(uuid,integer),public.npi_report_evidence(uuid,uuid[]),public.npi_ops_action(text,jsonb,uuid),public.npi_visit_context(uuid)to authenticated;
notify pgrst,'reload schema';
commit;
