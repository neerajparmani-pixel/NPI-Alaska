-- Operations 2.0. Apply AFTER 004, once. Originals are preserved; no hard-delete workflow.
begin;
alter table public.npi_work_orders add column created_by uuid references public.npi_profiles;
alter table public.npi_work_orders add column created_at timestamptz;
alter table public.npi_work_orders alter column created_at set default now();
alter table public.npi_work_orders add column area text not null default '';
alter table public.npi_work_orders add column instructions text not null default '';
alter table public.npi_work_orders add column evidence_policy jsonb not null default '{"before":true,"after":true}';
alter table public.npi_work_orders add column outcome text not null default 'complete' check(outcome in ('complete','partial','unable'));
alter table public.npi_work_orders add column outcome_reason text not null default '';
alter table public.npi_work_orders add column repeat_group uuid;
alter table public.npi_work_orders add column evidence_exception_reason text not null default '';
alter table public.npi_sites add column radius_metres integer not null default 200 check(radius_metres between 50 and 5000);
alter table public.npi_work_orders drop constraint npi_work_orders_status_check;
alter table public.npi_work_orders add constraint npi_work_orders_status_check check(status in ('draft','in-progress','contractor-review','npi-review','approved','returned','cancelled'));
alter table public.npi_sites add column instructions text not null default '';
alter table public.npi_sites add column latitude double precision check(latitude between -90 and 90);
alter table public.npi_sites add column longitude double precision check(longitude between -180 and 180);
alter table public.npi_tasks add column evidence_policy jsonb not null default '{"before":true,"after":true}';
alter table public.npi_evidence add column stage text not null default 'progress' check(stage in ('before','progress','after','issue','timecard'));
alter table public.npi_evidence add column preview_path text;
alter table public.npi_evidence add column source text not null default 'file' check(source in ('file','app-camera'));
alter table public.npi_evidence add column captured_at timestamptz;
alter table public.npi_evidence add column filename text not null default '';
alter table public.npi_evidence add column original_mime text;
alter table public.npi_evidence add column bytes bigint not null default 0;
alter table public.npi_evidence add column issue_id uuid;
create table public.npi_work_history(id uuid primary key default gen_random_uuid(),work_id uuid not null references public.npi_work_orders,actor_id uuid references public.npi_profiles,event_time timestamptz not null default now(),action text not null,detail jsonb not null default '{}');
create table public.npi_issues(id uuid primary key default gen_random_uuid(),work_id uuid not null references public.npi_work_orders,reporter_id uuid not null references public.npi_profiles,category text not null check(category in ('access','safety','equipment','weather','work','other')),urgency text not null check(urgency in ('normal','urgent')),description text not null check(length(description) between 1 and 2000),status text not null default 'open' check(status in ('open','acknowledged','in-progress','resolved')),owner_id uuid references public.npi_profiles,resolution text not null default '',created_at timestamptz not null default now(),updated_at timestamptz not null default now(),version integer not null default 1,escalated_at timestamptz);
alter table public.npi_evidence add foreign key(issue_id) references public.npi_issues;
create table public.npi_issue_comments(id uuid primary key default gen_random_uuid(),issue_id uuid not null references public.npi_issues,actor_id uuid not null references public.npi_profiles,body text not null check(length(body) between 1 and 2000),created_at timestamptz not null default now());
create table public.npi_notification_settings(scope text primary key,emails jsonb not null default '[]',escalation_minutes integer not null default 60 check(escalation_minutes between 15 and 1440),updated_by uuid references public.npi_profiles,updated_at timestamptz not null default now());
create table public.npi_notifications(id uuid primary key default gen_random_uuid(),recipient_id uuid not null references public.npi_profiles,work_id uuid references public.npi_work_orders,issue_id uuid references public.npi_issues,title text not null,message text not null,event_key text,created_at timestamptz not null default now(),read_at timestamptz,unique(recipient_id,event_key));
create table public.npi_email_outbox(id uuid primary key default gen_random_uuid(),work_id uuid references public.npi_work_orders,issue_id uuid references public.npi_issues,scope text not null,recipient text not null,subject text not null,message text not null,dedupe text not null unique,status text not null default 'queued' check(status in ('queued','processing','sent','retry','failed')),attempts integer not null default 0,created_at timestamptz not null default now(),next_attempt timestamptz not null default now(),provider_id text,error text);
create table public.npi_field_commands(actor_id uuid not null,request_id uuid not null,action text not null,body jsonb not null,result jsonb not null,primary key(actor_id,request_id));
create index npi_issue_work on public.npi_issues(work_id,created_at desc);
create index npi_notice_user on public.npi_notifications(recipient_id,created_at desc);
create index npi_history_work on public.npi_work_history(work_id,event_time desc);
create index npi_email_pending on public.npi_email_outbox(status,next_attempt);
-- All browser writes go through validated RPCs. No direct writes or outbox reads.
do $$ declare t text;begin foreach t in array array['npi_work_history','npi_issues','npi_issue_comments','npi_notification_settings','npi_notifications','npi_email_outbox','npi_field_commands'] loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant all on public.%I to service_role',t);
end loop;end $$;
create function public.npi_notify(p_work uuid,p_issue uuid,p_title text,p_message text,p_key text,p_reporter boolean default false) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.npi_work_orders;s public.npi_notification_settings;email text;who uuid;begin
 select * into w from public.npi_work_orders where id=p_work;
 for who in select p.id from public.npi_profiles p where p.active and (p.role='npi' or(p.role='sub' and p.company_id=w.company_id)or(p_reporter and p.id=(select reporter_id from public.npi_issues where id=p_issue))) loop
 insert into public.npi_notifications(recipient_id,work_id,issue_id,title,message,event_key) values(who,p_work,p_issue,p_title,p_message,p_key)on conflict(recipient_id,event_key)do nothing;
 end loop;
 for s in select * from public.npi_notification_settings where scope in ('npi',w.company_id::text) loop
 for email in select jsonb_array_elements_text(s.emails) loop
 insert into public.npi_email_outbox(work_id,issue_id,scope,recipient,subject,message,dedupe) values(p_work,p_issue,s.scope,email,p_title,p_message,p_key||':'||email) on conflict(dedupe) do nothing;
 end loop;end loop;
end $$;
create function public.npi_field_snapshot() returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare r text:=public.npi_role();begin
 if r is null then raise exception 'Active account required';end if;
 return jsonb_build_object(
 'issues',coalesce((select jsonb_agg(x)from(select i.* from public.npi_issues i where public.npi_can_work(i.work_id) order by i.created_at desc limit 1000)x),'[]'::jsonb),
 'comments',coalesce((select jsonb_agg(x)from(select c.* from public.npi_issue_comments c join public.npi_issues i on i.id=c.issue_id where public.npi_can_work(i.work_id) order by c.created_at desc limit 2000)x),'[]'::jsonb),
 'history',coalesce((select jsonb_agg(x)from(select h.* from public.npi_work_history h where public.npi_can_work(h.work_id) order by h.event_time desc limit 2000)x),'[]'::jsonb),
 'notifications',coalesce((select jsonb_agg(x)from(select * from public.npi_notifications where recipient_id=auth.uid() order by created_at desc limit 100)x),'[]'::jsonb),
 'email_status',case when r='worker' then '[]'::jsonb else coalesce((select jsonb_agg(x)from(select e.id,e.work_id,e.issue_id,e.recipient,e.status,e.attempts,e.error,e.created_at from public.npi_email_outbox e where r='npi' or e.scope=public.npi_company()::text order by e.created_at desc limit 200)x),'[]'::jsonb)end,
 'settings',case when r='worker' then '[]'::jsonb else coalesce((select jsonb_agg(s)from public.npi_notification_settings s where scope=case when r='npi' then 'npi' else public.npi_company()::text end),'[]'::jsonb)end,
 'storage',case when r='worker' then null else (select jsonb_build_object('files',count(*),'bytes',coalesce(sum(e.bytes),0))from public.npi_evidence e where public.npi_can_work(e.work_id))end);
end $$;
create function public.npi_field_action(p_action text,p_body jsonb,p_request uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare who uuid:=auth.uid();r text:=public.npi_role();co uuid:=public.npi_company();ident uuid:=nullif(p_body->>'id','')::uuid;w public.npi_work_orders;i public.npi_issues;cmd public.npi_field_commands;result jsonb;target_scope text;mail jsonb;entry text;path text;mime text;seq text;worker uuid;note text;rep integer;child jsonb;crew jsonb;old_crew jsonb;begin
 if r is null or who is null or p_request is null or jsonb_typeof(p_body)<>'object' or octet_length(p_body::text)>65536 then raise exception 'Active account and valid request required';end if;
 perform pg_advisory_xact_lock(hashtextextended(who::text||p_request::text,0));
 select * into cmd from public.npi_field_commands where actor_id=who and request_id=p_request;
 if found then if cmd.action<>p_action or cmd.body<>p_body then raise exception 'Request changed';end if;return cmd.result;end if;
 if p_action='notification_settings' then
  if r not in ('npi','sub') then raise exception 'Administrator required';end if;
  target_scope:=case when r='npi' then 'npi' else co::text end;mail:=p_body->'emails';
  if jsonb_typeof(mail)<>'array' or jsonb_array_length(mail)>10 or exists(select 1 from jsonb_array_elements_text(mail)x where length(x)>254 or x !~ '^[A-Za-z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') then raise exception 'Enter up to ten valid email addresses';end if;
  insert into public.npi_notification_settings(scope,emails,escalation_minutes,updated_by) values(target_scope,mail,(p_body->>'escalation_minutes')::int,who) on conflict(scope) do update set emails=excluded.emails,escalation_minutes=excluded.escalation_minutes,updated_by=who,updated_at=now();
 elsif p_action='test_email' then
  if r not in ('npi','sub') then raise exception 'Administrator required';end if;target_scope:=case when r='npi' then 'npi' else co::text end;
  select emails into mail from public.npi_notification_settings s where s.scope=target_scope;
  if mail is null or jsonb_array_length(mail)=0 then raise exception 'Save recipient emails first';end if;
  for entry in select jsonb_array_elements_text(mail)loop insert into public.npi_email_outbox(scope,recipient,subject,message,dedupe) values(target_scope,entry,'NPI notification test','This is a requested NPI email configuration test.',p_request::text||':'||entry);end loop;
 elsif p_action='read_notifications' then update public.npi_notifications set read_at=now() where recipient_id=who and read_at is null;
 elsif p_action='service_policy' then
  if r<>'npi' then raise exception 'NPI required';end if;
  update public.npi_tasks set evidence_policy=jsonb_build_object('before',coalesce((p_body->>'before')::boolean,true),'after',coalesce((p_body->>'after')::boolean,true)),version=version+1 where id=ident;if not found then raise exception 'Service unavailable';end if;
 elsif p_action='site_detail' then
  if r<>'npi' then raise exception 'NPI required';end if;
  update public.npi_sites set instructions=left(p_body->>'instructions',2000),latitude=nullif(p_body->>'latitude','')::float8,longitude=nullif(p_body->>'longitude','')::float8,radius_metres=coalesce((p_body->>'radius_metres')::int,200),version=version+1 where id=ident and version=(p_body->>'version')::int;if not found then raise exception 'Location changed; refresh';end if;
 else
  if p_action in ('issue_update','issue_comment') then
   select * into i from public.npi_issues where id=ident for update;ident:=i.work_id;
  end if;
  select * into w from public.npi_work_orders where id=ident for update;
  if w.id is null or not public.npi_can_work(w.id) then raise exception 'Work access denied';end if;
  if p_action='report_issue' then
   if length(btrim(coalesce(p_body->>'description','')))<1 then raise exception 'Describe the issue';end if;
   insert into public.npi_issues(work_id,reporter_id,category,urgency,description) values(w.id,who,p_body->>'category',p_body->>'urgency',btrim(p_body->>'description')) returning * into i;
   perform public.npi_notify(w.id,i.id,'Issue reported: '||i.category,left(i.description,600),i.id::text||':open');ident:=i.id;
  elsif p_action='issue_update' then
   if r not in ('npi','sub') then raise exception 'Administrator required';end if;
   if i.version is distinct from(p_body->>'version')::int then raise exception 'Issue changed; refresh';end if;
   worker:=nullif(p_body->>'owner_id','')::uuid;
   if worker is not null and not exists(select 1 from public.npi_profiles p where id=worker and p.active and(p.role='npi' or(p.role='sub' and p.company_id=w.company_id)))then raise exception 'Choose a responsible administrator';end if;
   if p_body->>'status'='resolved' and length(btrim(coalesce(p_body->>'resolution','')))<1 then raise exception 'Explain the resolution';end if;
   update public.npi_issues set status=p_body->>'status',owner_id=worker,resolution=left(p_body->>'resolution',2000),version=version+1,updated_at=now() where id=i.id;
   perform public.npi_notify(w.id,i.id,'Issue '||(p_body->>'status'),left(coalesce(p_body->>'resolution','See the issue in the app.'),600),p_request::text,true);ident:=i.id;
  elsif p_action='issue_comment' then
   insert into public.npi_issue_comments(issue_id,actor_id,body) values(i.id,who,btrim(p_body->>'comment'));ident:=i.id;
   perform public.npi_notify(w.id,i.id,'Issue comment added',left(p_body->>'comment',600),p_request::text,true);
  elsif p_action='evidence' then
   if r<>'worker' or w.status not in ('in-progress','returned') then raise exception 'Evidence can be added only during work or correction';end if;
   path:=p_body->>'path';mime:=p_body->>'original_mime';
   if path not like w.id::text||'/'||who::text||'/%' or not exists(select 1 from storage.objects o where bucket_id='work-evidence' and name=path and owner_id=who::text)then raise exception 'Upload your original file first';end if;
   if mime not in ('image/jpeg','image/png','image/webp','image/heic','image/heif','image/tiff','image/gif','image/bmp','image/avif','application/pdf')or not exists(select 1 from storage.objects o where bucket_id='work-evidence' and name=path and metadata->>'mimetype'=mime)or (p_body->>'bytes')::bigint not between 1 and 20971520 then raise exception 'Invalid original file metadata';end if;
   if p_body->>'preview_path' is not null and not exists(select 1 from storage.objects o where bucket_id='work-evidence' and name=p_body->>'preview_path' and owner_id=who::text and name like w.id::text||'/'||who::text||'/%' and metadata->>'mimetype'='image/jpeg')then raise exception 'Upload your preview first';end if;
   if (p_body->>'stage')<>'timecard' and (mime not like 'image/%' or p_body->>'preview_path' is null)then raise exception 'A viewable photo preview is required';end if;
   if p_body->>'source'='app-camera' and (p_body->>'captured_at' is null or (p_body->>'captured_at')::timestamptz>clock_timestamp()+interval '2 minutes')then raise exception 'Valid camera capture time required';end if;
   if nullif(p_body->>'issue_id','') is not null and not exists(select 1 from public.npi_issues where id=(p_body->>'issue_id')::uuid and work_id=w.id)then raise exception 'Issue does not belong to this work';end if;
   insert into public.npi_evidence(work_id,uploaded_by,path,kind,stage,preview_path,source,captured_at,filename,original_mime,bytes,issue_id) values(w.id,who,path,case when p_body->>'stage'='timecard' then 'timecard' else 'photo'end,p_body->>'stage',p_body->>'preview_path',p_body->>'source',case when p_body->>'source'='app-camera' then (p_body->>'captured_at')::timestamptz else null end,left(p_body->>'filename',200),mime,(p_body->>'bytes')::bigint,nullif(p_body->>'issue_id','')::uuid) returning id into ident;
   update public.npi_work_orders set version=version+1 where id=w.id;
  elsif p_action='outcome' then
   if w.version is distinct from(p_body->>'version')::int then raise exception 'Work changed; refresh';end if;
   if r<>'worker' or w.status not in ('in-progress','returned')then raise exception 'Only active assigned workers can report the outcome';end if;
   if p_body->>'outcome'<>'complete' and length(btrim(coalesce(p_body->>'reason','')))<1 then raise exception 'Explain incomplete or unavailable work';end if;
   update public.npi_work_orders set outcome=p_body->>'outcome',outcome_reason=left(coalesce(p_body->>'reason',''),2000),evidence_exception_reason=btrim(left(coalesce(p_body->>'evidence_exception_reason',''),2000)),version=version+1 where id=w.id;
  elsif p_action='work_plan' then
   if r not in ('npi','sub') or w.status in ('approved','cancelled')then raise exception 'Work plan cannot be changed';end if;
   if w.version is distinct from(p_body->>'version')::int then raise exception 'Work changed; refresh';end if;
   if length(btrim(coalesce(p_body->>'reason','')))<1 then raise exception 'Explain the assignment change';end if;
   if w.status<>'draft' and p_body?'members' then raise exception 'Once started, preserve the original crew; create a separate assignment for additional workers';end if;
   select coalesce(jsonb_agg(worker_id),'[]'::jsonb)into old_crew from public.npi_work_members where work_id=w.id;
   if p_body?'members' then
    if jsonb_array_length(p_body->'members') not between 1 and 50 or exists(select 1 from jsonb_array_elements_text(p_body->'members')x where not exists(select 1 from public.npi_profiles where id=x::uuid and role='worker' and active and company_id=w.company_id))then raise exception 'Choose approved workers from this company';end if;
    delete from public.npi_hour_reviews where work_id=w.id and worker_id not in(select value::uuid from jsonb_array_elements_text(p_body->'members'));
    delete from public.npi_work_members where work_id=w.id;
    insert into public.npi_work_members select w.id,value::uuid from jsonb_array_elements_text(p_body->'members');
    insert into public.npi_hour_reviews(work_id,worker_id)select w.id,value::uuid from jsonb_array_elements_text(p_body->'members')on conflict(work_id,worker_id)do nothing;
   end if;
   update public.npi_work_orders set area=left(coalesce(p_body->>'area',area),300),instructions=left(coalesce(p_body->>'instructions',instructions),2000),version=version+1 where id=w.id;
   insert into public.npi_work_history(work_id,actor_id,action,detail)values(w.id,who,'Assignment changed',jsonb_build_object('reason',p_body->>'reason','before_members',old_crew,'change',p_body));
  elsif p_action='repeat_work' then
   if r not in ('npi','sub') then raise exception 'Administrator required';end if;
   rep:=(p_body->>'count')::int;if rep not between 1 and 12 or (p_body->>'interval_days')::int not between 1 and 365 then raise exception 'Choose one to twelve repeats and a valid interval';end if;
   select jsonb_agg(worker_id)into crew from public.npi_work_members where work_id=w.id;
   for rep in 0..rep-1 loop
    child:=public.npi_live_action('create_work',jsonb_build_object('company_id',w.company_id,'site_id',w.site_id,'contract_id',w.contract_id,'task_id',w.task_id,'planned_date',(p_body->>'first_date')::date+rep*(p_body->>'interval_days')::int,'equipment',w.equipment,'title',w.title,'kind',w.kind,'checklist',w.checklist,'area',w.area,'instructions',w.instructions,'members',crew),gen_random_uuid());
    update public.npi_work_orders set repeat_group=p_request where id=(child->>'id')::uuid;
   end loop;
  elsif p_action='cancel_work' then
   if w.version is distinct from(p_body->>'version')::int then raise exception 'Work changed; refresh';end if;
   if r not in ('npi','sub') or w.status<>'draft' or exists(select 1 from public.npi_attendance_events where work_id=w.id)then raise exception 'Only unstarted assignments can be cancelled';end if;
   if length(btrim(coalesce(p_body->>'reason','')))<1 then raise exception 'Explain cancellation';end if;
   update public.npi_work_orders set status='cancelled',review_note=left(p_body->>'reason',1000),version=version+1 where id=w.id;
  else raise exception 'Unknown field action';end if;
 end if;
 if w.id is not null and p_action not in ('work_plan','evidence')then insert into public.npi_work_history(work_id,actor_id,action,detail)values(w.id,who,p_action,jsonb_build_object('reason',coalesce(p_body->>'reason',p_body->>'description',p_body->>'resolution')));end if;
 if p_action='work_plan'then insert into public.npi_notifications(recipient_id,work_id,title,message)select worker_id,work_id,'Assignment updated','Review the updated area and instructions before working.'from public.npi_work_members where work_id=w.id;end if;
 result:=jsonb_build_object('id',ident,'action',p_action);
 if p_action<>'read_notifications'then insert into public.npi_audit(actor_id,action,record_id)values(who,'field:'||p_action,ident);end if;
 insert into public.npi_field_commands values(who,p_request,p_action,p_body,result);return result;
end $$;
-- Wrap the existing transactional mutations; keep original authority and idempotency.
alter function public.npi_live_action(text,jsonb,uuid) rename to npi_live_action_v1;
revoke all on function public.npi_live_action_v1(text,jsonb,uuid) from public,anon,authenticated;
create function public.npi_live_action(p_action text,p_body jsonb,p_request uuid)returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;w public.npi_work_orders;r text:=public.npi_role();before_members jsonb;amount numeric;original numeric;s public.npi_sites;distance float8;begin
 if r is null or p_request is null then raise exception 'Active account required';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request::text,0));
 if exists(select 1 from public.npi_commands where actor_id=auth.uid() and request_id=p_request)then return public.npi_live_action_v1(p_action,p_body,p_request);end if;
 if p_action in ('npi_approve','company_approve')then
  select * into w from public.npi_work_orders where id=(p_body->>'id')::uuid;
  if(w.outcome<>'complete' or length(w.evidence_exception_reason)>0)and not coalesce((p_body->>'acknowledge_outcome')::boolean,false)then raise exception 'Explicitly acknowledge the incomplete-work outcome before approving';end if;
 end if;
 if p_action='submit_hours' then
  select * into w from public.npi_work_orders where id=(p_body->>'id')::uuid for update;
  if not public.npi_can_work(w.id)then raise exception 'Work access denied';end if;
  if w.outcome='complete' and length(w.evidence_exception_reason)=0 and (((w.evidence_policy->>'before')::boolean and not exists(select 1 from public.npi_evidence where work_id=w.id and stage='before'))or((w.evidence_policy->>'after')::boolean and not exists(select 1 from public.npi_evidence where work_id=w.id and stage='after')))then raise exception 'Upload required before and after photos first, or explain incomplete work';end if;
 end if;
 if p_action='submit_hours' and(w.outcome<>'complete' or length(w.evidence_exception_reason)>0)then
  if r<>'worker' or w.status not in ('in-progress','returned')or(w.outcome<>'complete'and length(btrim(w.outcome_reason))<1)then raise exception 'Explain the incomplete work before submitting';end if;
  if exists(select 1 from public.npi_work_members m where m.work_id=w.id and(select event_kind from public.npi_attendance_events where work_id=w.id and worker_id=m.worker_id order by received_at desc,id desc limit 1)is distinct from 'check-out')then raise exception 'All assigned crew members must check out first';end if;
  if w.outcome='complete'and exists(select 1 from generate_series(0,jsonb_array_length(w.checklist)-1)x where not w.completed_tasks @> to_jsonb(array[x]))then raise exception 'Complete the checklist or report partial work';end if;
  if w.outcome='complete'and w.kind='hauling'and w.loads<1 then raise exception 'Record completed loads or report partial/unavailable work';end if;
  original:=public.npi_recorded_minutes(w.id,auth.uid());amount:=case when coalesce((p_body->>'use_recorded')::boolean,false)then original else(p_body->>'claimed_minutes')::numeric end;
  if w.version is distinct from(p_body->>'version')::int or amount is null or amount<0 or amount>100000 or(abs(amount-original)>0.01 and length(btrim(coalesce(p_body->>'reason','')))<1)then raise exception 'Check work version and explain corrected hours';end if;
  update public.npi_hour_reviews set claimed_minutes=amount,reason=p_body->>'reason',version=version+1 where work_id=w.id and worker_id=auth.uid();
  update public.npi_work_orders set status=case when not exists(select 1 from public.npi_hour_reviews where work_id=w.id and claimed_minutes is null)then 'contractor-review'else 'in-progress'end,version=version+1 where id=w.id;
  result:=jsonb_build_object('id',w.id,'action',p_action);insert into public.npi_commands(actor_id,request_id,action,body,result)values(auth.uid(),p_request,p_action,p_body,result);
 else result:=public.npi_live_action_v1(p_action,p_body,p_request);end if;
 if p_action='clock' then
  select * into w from public.npi_work_orders where id=(p_body->>'id')::uuid;select * into s from public.npi_sites where id=w.site_id;
  if s.latitude is not null and s.longitude is not null then distance:=6371000*acos(greatest(-1.0,least(1.0,sin(radians(s.latitude))*sin(radians((p_body->>'latitude')::float8))+cos(radians(s.latitude))*cos(radians((p_body->>'latitude')::float8))*cos(radians((p_body->>'longitude')::float8-s.longitude)))));end if;
  if (p_body->>'accuracy_metres')::float8>100 or distance>s.radius_metres then perform public.npi_notify(w.id,null,'Attendance location needs review','Inspect the recorded GPS position, accuracy and configured site centre. This is a review flag, not an automatic rejection.',p_request::text||':gps');end if;
 end if;
 if p_action='create_work' then
  update public.npi_work_orders set created_by=auth.uid(),area=left(coalesce(p_body->>'area',''),300),instructions=left(coalesce(p_body->>'instructions',''),2000),evidence_policy=(select evidence_policy from public.npi_tasks where id=(p_body->>'task_id')::uuid) where id=(result->>'id')::uuid;
  insert into public.npi_work_history(work_id,actor_id,action,detail)values((result->>'id')::uuid,auth.uid(),'Assignment created',jsonb_build_object('members',p_body->'members'));
  insert into public.npi_notifications(recipient_id,work_id,title,message)select worker_id,work_id,'New assignment','Open My work to review the instructions.'from public.npi_work_members where work_id=(result->>'id')::uuid;
 elsif p_action in ('submit_hours','company_approve','npi_approve','return_work','plan_work','clock')then
  insert into public.npi_work_history(work_id,actor_id,action,detail)values((p_body->>'id')::uuid,auth.uid(),p_action,jsonb_build_object('reason',p_body->>'reason'));
  if p_action in ('submit_hours','company_approve','npi_approve','return_work')then
   perform public.npi_notify((p_body->>'id')::uuid,null,case p_action when 'submit_hours'then 'Work ready for company review'when 'company_approve'then 'Work ready for NPI verification'when 'npi_approve'then 'Work accepted'else 'Correction requested'end,coalesce(p_body->>'reason','Open the work record to review the details.'),p_request::text);
   insert into public.npi_notifications(recipient_id,work_id,title,message)select worker_id,work_id,case when p_action='npi_approve'then 'Work accepted'else 'Work review updated'end,coalesce(p_body->>'reason','Open your work record for the current status.')from public.npi_work_members where work_id=(p_body->>'id')::uuid;
  end if;
 end if;
 return result;
end $$;
-- Partial/unable submissions are reviewed exceptions, never silently accepted as completed work.
-- These preserve the existing requirement for original attendance and a photo evidence record.
create function public.npi_email_claim() returns setof public.npi_email_outbox language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.npi_issues;s integer;w public.npi_work_orders;attendance_row record;begin
 for i in select * from public.npi_issues where urgency='urgent' and status='open' and escalated_at is null for update skip locked loop
  select coalesce(min(escalation_minutes),60)into s from public.npi_notification_settings where scope='npi';
  if i.created_at < now()-make_interval(mins=>coalesce(s,60))then perform public.npi_notify(i.work_id,i.id,'Urgent issue unacknowledged',left(i.description,600),i.id::text||':escalation');update public.npi_issues set escalated_at=now()where id=i.id;end if;
 end loop;
 for w in select * from public.npi_work_orders where status='draft' and planned_date<(now()at time zone 'America/Anchorage')::date limit 1000 loop
 perform public.npi_notify(w.id,null,'Unstarted work is overdue','Review the assignment date and contact the company.',w.id::text||':overdue:'||(now()at time zone 'America/Anchorage')::date::text);end loop;
 for attendance_row in select distinct on(worker_id) * from public.npi_attendance_events order by worker_id,received_at desc,id desc loop
 if attendance_row.event_kind='check-in'and attendance_row.received_at<now()-interval '12 hours'then perform public.npi_notify(attendance_row.work_id,null,'Open attendance needs review','A worker has an open shift over twelve hours. Check whether checkout was missed.',attendance_row.id::text||':open-shift:'||(now()at time zone 'America/Anchorage')::date::text);end if;end loop;
 update public.npi_email_outbox set status='failed',error='Delivery window expired; inspect before manually resending'where status in ('queued','retry','processing')and created_at<now()-interval '12 hours';
 return query with selected as(select id from public.npi_email_outbox where(status in ('queued','retry')or(status='processing'and next_attempt<now()))and next_attempt<=now()and attempts<6 order by created_at for update skip locked limit 20)update public.npi_email_outbox e set status='processing',attempts=attempts+1,next_attempt=now()+interval '2 minutes'from selected s where e.id=s.id returning e.*;
end $$;
create function public.npi_email_result(p_id uuid,p_sent boolean,p_provider text,p_error text) returns void language sql security definer set search_path=public,pg_temp as $$update public.npi_email_outbox set status=case when p_sent then 'sent'when attempts>=6 then 'failed'else 'retry'end,provider_id=left(p_provider,200),error=left(p_error,500),next_attempt=now()+make_interval(mins=>least(60,power(2,attempts)::int))where id=p_id and status='processing'$$;
-- Read policies added only where needed; sensitive recipient lists stay behind RPCs.
grant select on public.npi_work_history,public.npi_issues,public.npi_issue_comments to authenticated;
create policy field_history_read on public.npi_work_history for select to authenticated using(public.npi_can_work(work_id));
create policy field_issue_read on public.npi_issues for select to authenticated using(public.npi_can_work(work_id));
create policy field_comment_read on public.npi_issue_comments for select to authenticated using(exists(select 1 from public.npi_issues i where i.id=issue_id and public.npi_can_work(i.work_id)));
revoke all on function public.npi_notify(uuid,uuid,text,text,text,boolean),public.npi_field_snapshot(),public.npi_field_action(text,jsonb,uuid),public.npi_live_action(text,jsonb,uuid),public.npi_email_claim(),public.npi_email_result(uuid,boolean,text,text)from public,anon,authenticated;
grant execute on function public.npi_field_snapshot(),public.npi_field_action(text,jsonb,uuid),public.npi_live_action(text,jsonb,uuid)to authenticated;
grant execute on function public.npi_email_claim(),public.npi_email_result(uuid,boolean,text,text)to service_role;
update storage.buckets set file_size_limit=20971520,allowed_mime_types=array['image/jpeg','image/png','image/webp','image/heic','image/heif','image/tiff','image/gif','image/bmp','image/avif','application/pdf']where id='work-evidence';
create function public.npi_work_search(p_filter jsonb default '{}',p_page integer default 1)returns jsonb language plpgsql stable security invoker set search_path=public,pg_temp as $$
begin
 if public.npi_role()is null then raise exception 'Active account required';end if;
 if p_page not between 1 and 100000 then raise exception 'Invalid page';end if;
 return(with matching as materialized(select w.*,(select name from public.npi_sites where id=w.site_id)site_name,(select display_name from public.npi_profiles where id=w.created_by)assigned_by,(select jsonb_agg(m.worker_id)from public.npi_work_members m where m.work_id=w.id)assigned_workers from public.npi_work_orders w where
 (coalesce(p_filter->>'contract','')=''or w.contract_id=(p_filter->>'contract')::uuid)and(coalesce(p_filter->>'company','')=''or w.company_id=(p_filter->>'company')::uuid)and(coalesce(p_filter->>'site','')=''or w.site_id=(p_filter->>'site')::uuid)and(coalesce(p_filter->>'status','')=''or w.status=p_filter->>'status')and(coalesce(p_filter->>'worker','')=''or exists(select 1 from public.npi_work_members m where m.work_id=w.id and m.worker_id=(p_filter->>'worker')::uuid))and(coalesce(p_filter->>'from','')=''or w.planned_date>=(p_filter->>'from')::date)and(coalesce(p_filter->>'to','')=''or w.planned_date<=(p_filter->>'to')::date)and(coalesce(p_filter->>'q','')=''or w.title ilike '%'||left(p_filter->>'q',150)||'%'or exists(select 1 from public.npi_sites s where s.id=w.site_id and s.name ilike '%'||left(p_filter->>'q',150)||'%')))
 select jsonb_build_object('total',(select count(*)from matching),'rows',coalesce((select jsonb_agg(x)from(select * from matching order by planned_date desc,id limit 50 offset(p_page-1)*50)x),'[]'::jsonb)));
end $$;
revoke all on function public.npi_work_search(jsonb,integer)from public,anon;grant execute on function public.npi_work_search(jsonb,integer)to authenticated;
commit;
