-- v3.1.0. Apply ONCE after 006. No original attendance or evidence is deleted.
begin;
alter table public.npi_work_orders add column service_date date;
alter table public.npi_work_orders add column last_activity_at timestamptz not null default now();
update public.npi_work_orders set service_date=(select min(received_at)at time zone 'America/Anchorage' from public.npi_attendance_events where work_id=npi_work_orders.id and event_kind='check-in')::date;
alter table public.npi_work_orders alter column planned_date drop not null;
alter table public.npi_work_orders add constraint visit_date_required check(planned_date is not null or(worker_led and status in('draft','cancelled')));
alter table public.npi_notification_settings alter column daily_summary set default false;
update public.npi_notification_settings set daily_summary=false;
alter table public.npi_notification_settings add column last_digest_date date;
alter table public.npi_service_items add column review_below_inches numeric not null default 2 check(review_below_inches between 0 and 120);
alter table public.npi_evidence add column service_line_id uuid references public.npi_visit_lines;
alter table public.npi_visit_lines add column review_required boolean not null default false;
alter table public.npi_visit_lines add column review_reason text not null default '';
-- Preserve existing historical shared-photo references; enforce uniqueness for new claims.
create table public.npi_ruler_claims(evidence_id uuid primary key references public.npi_evidence,line_id uuid not null references public.npi_visit_lines,work_id uuid not null references public.npi_work_orders);
create table public.npi_exception_events(id uuid primary key default gen_random_uuid(),work_id uuid not null references public.npi_work_orders,worker_id uuid not null references public.npi_profiles,reason text not null,submitted_at timestamptz not null default now(),unique(work_id,worker_id));
insert into public.npi_exception_events(work_id,worker_id,reason,submitted_at)select w.id,r.worker_id,w.evidence_exception_reason,coalesce((select min(event_time)from public.npi_work_history where work_id=w.id and action='submit_hours'),w.created_at,now())from public.npi_hour_reviews r join public.npi_work_orders w on w.id=r.work_id where r.claimed_minutes is not null and length(btrim(w.evidence_exception_reason))>0;
create table public.npi_open_attendance(worker_id uuid primary key references public.npi_profiles,event_id uuid not null references public.npi_attendance_events,work_id uuid not null references public.npi_work_orders,received_at timestamptz not null);
create index open_attendance_age on public.npi_open_attendance(received_at);
insert into public.npi_open_attendance select worker_id,id,work_id,received_at from(select distinct on(worker_id)*from public.npi_attendance_events order by worker_id,received_at desc,id desc)x where event_kind='check-in';
create table public.npi_public_limits(bucket text not null,window_at timestamptz not null,kind text not null,hits integer not null,primary key(bucket,window_at,kind));
create table public.npi_snow_attempts(id uuid primary key default gen_random_uuid(),worker_id uuid not null references public.npi_profiles,evidence_id uuid not null references public.npi_evidence,state text not null default 'inflight'check(state in('inflight','succeeded','failed')),started_at timestamptz not null default now());
create index snow_attempt_worker on public.npi_snow_attempts(worker_id,started_at desc);
do $$declare t text;begin foreach t in array array['npi_ruler_claims','npi_exception_events','npi_open_attendance','npi_public_limits','npi_snow_attempts']loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant all on public.%I to service_role',t);end loop;end $$;
create function public.npi_band_ready(p_parent uuid)returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 with bands as(select *,lag(max_inches)over(order by min_inches,id)previous_max,row_number()over(order by min_inches,id)n from public.npi_service_items where parent_id=p_parent and active)
 select exists(select 1 from bands)and not exists(select 1 from bands where min_inches is null or(n=1 and min_inches<>0)or(n>1 and(previous_max is null or min_inches<>previous_max)))and(select max_inches is null from bands order by min_inches desc,id desc limit 1)
$$;
-- Snow parents start as drafts; create bands before activating them.
create function public.npi_item_before()returns trigger language plpgsql security definer set search_path=public,pg_temp as $$begin if TG_OP='INSERT'and NEW.parent_id is null and NEW.snow_required then NEW.active:=false;end if;return NEW;end $$;
create function public.npi_item_after()returns trigger language plpgsql security definer set search_path=public,pg_temp as $$declare p public.npi_service_items;begin
 select *into p from public.npi_service_items where id=coalesce(NEW.parent_id,NEW.id)for update;
 if p.parent_id is null and p.active and p.snow_required and not public.npi_band_ready(p.id)then raise exception 'Complete contiguous snow bands from 0 inches through an open-ended highest band before activation';end if;return NEW;
end $$;
-- Add the explicitly approved below-two recording category, without prices.
do $$declare p public.npi_service_items;was_active boolean;begin
 for p in select *from public.npi_service_items where parent_id is null and snow_required for update loop
 was_active:=p.active;update public.npi_service_items set active=false where id=p.id;
 if(select min(min_inches)from public.npi_service_items where parent_id=p.id and active)=2 then
 insert into public.npi_service_items(contract_id,parent_id,task_id,code,name,unit,min_inches,max_inches)values(p.contract_id,p.id,p.task_id,left(p.code,17)||'-LOW2-'||left(gen_random_uuid()::text,4),'Below 2 inches',p.unit,0,2);
 end if;
 update public.npi_service_items set active=was_active and public.npi_band_ready(p.id),version=version+1 where id=p.id;
 end loop;
end $$;
create trigger item_prepare before insert on public.npi_service_items for each row execute function public.npi_item_before();
create trigger item_coverage after insert or update on public.npi_service_items for each row execute function public.npi_item_after();
create function public.npi_attendance_track()returns trigger language plpgsql security definer set search_path=public,pg_temp as $$begin
 if NEW.event_kind='check-in'then insert into public.npi_open_attendance values(NEW.worker_id,NEW.id,NEW.work_id,NEW.received_at)on conflict(worker_id)do update set event_id=excluded.event_id,work_id=excluded.work_id,received_at=excluded.received_at;
 update public.npi_work_orders set service_date=(NEW.received_at at time zone 'America/Anchorage')::date,planned_date=(NEW.received_at at time zone 'America/Anchorage')::date where id=NEW.work_id and worker_led and service_date is null;
 else delete from public.npi_open_attendance where worker_id=NEW.worker_id and work_id=NEW.work_id;end if;return NEW;end $$;
create trigger attendance_open after insert on public.npi_attendance_events for each row execute function public.npi_attendance_track();
create function public.npi_work_activity()returns trigger language plpgsql as $$begin NEW.last_activity_at:=clock_timestamp();return NEW;end $$;
create trigger work_activity before update on public.npi_work_orders for each row execute function public.npi_work_activity();
create function public.npi_expire_prepared()returns void language plpgsql security definer set search_path=public,pg_temp as $$declare w public.npi_work_orders;begin
 for w in select *from public.npi_work_orders where worker_led and status='draft'and last_activity_at<now()-interval '24 hours'and not exists(select 1 from public.npi_attendance_events where work_id=npi_work_orders.id)for update skip locked loop
 update public.npi_work_orders set status='cancelled',review_note='Prepared visit expired after 24 hours without saved activity',version=version+1 where id=w.id;
 insert into public.npi_work_history(work_id,action,detail)values(w.id,'Prepared visit expired','{"reason":"24 hours without saved activity"}');end loop;end $$;
create function public.npi_public_gate(p_bucket text,p_kind text)returns boolean language plpgsql security definer set search_path=public,pg_temp as $$declare hits int;win timestamptz:=date_trunc('minute',now());begin
 if length(p_bucket)>80 or p_kind not in('preview','registration','global')then raise exception 'Invalid rate bucket';end if;
 insert into public.npi_public_limits values(p_bucket,win,p_kind,1)on conflict(bucket,window_at,kind)do update set hits=npi_public_limits.hits+1 returning npi_public_limits.hits into hits;
 delete from public.npi_public_limits where window_at<now()-interval '1 day';
 return hits<=case p_kind when 'global'then 200 when 'preview'then 60 else 10 end;
end $$;
create or replace function public.npi_snow_read_reserve(p_evidence uuid)returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$declare e public.npi_evidence;v uuid;begin
 if public.npi_role()is distinct from 'worker'then raise exception 'Worker required';end if;
 perform pg_advisory_xact_lock(hashtextextended('snow-read:'||auth.uid()::text,0));
 select *into e from public.npi_evidence where id=p_evidence and stage='before'and source='app-camera'and captured_at is not null and preview_path is not null;
 if e.id is null or not public.npi_can_work(e.work_id)then raise exception 'Camera ruler photo unavailable';end if;
 update public.npi_snow_attempts set state='failed'where worker_id=auth.uid()and state='inflight'and started_at<now()-interval '90 seconds';
 if(select count(*)from public.npi_snow_attempts where worker_id=auth.uid()and started_at>now()-interval '1 hour')>=30 or(select count(*)from public.npi_snow_attempts where worker_id=auth.uid()and state='succeeded'and started_at>now()-interval '1 hour')>=10 or(select count(*)from public.npi_snow_attempts where worker_id=auth.uid()and state='inflight')>=2 then raise exception 'Reading limit reached; use manual entry';end if;
 insert into public.npi_snow_attempts(worker_id,evidence_id)values(auth.uid(),e.id)returning id into v;return jsonb_build_object('path',e.preview_path,'attempt_id',v);end $$;
create function public.npi_snow_read_finish(p_attempt uuid,p_success boolean)returns void language sql security definer set search_path=public,pg_temp as $$update public.npi_snow_attempts set state=case when p_success then 'succeeded'else 'failed'end where id=p_attempt and state='inflight'$$;

create or replace function public.npi_field_action(p_action text,p_body jsonb,p_request uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare who uuid:=auth.uid();r text:=public.npi_role();co uuid:=public.npi_company();ident uuid:=nullif(p_body->>'id','')::uuid;w public.npi_work_orders;i public.npi_issues;cmd public.npi_field_commands;result jsonb;target_scope text;mail jsonb;entry text;path text;mime text;seq text;worker uuid;note text;rep integer;child jsonb;crew jsonb;old_crew jsonb;begin
 if r is null or who is null or p_request is null or jsonb_typeof(p_body)<>'object' or octet_length(p_body::text)>65536 then raise exception 'Active account and valid request required';end if;
 perform pg_advisory_xact_lock(hashtextextended(who::text||p_request::text,0));
 select * into cmd from public.npi_field_commands where actor_id=who and request_id=p_request;
 if found then if cmd.action<>p_action or cmd.body<>p_body then raise exception 'Request changed';end if;return cmd.result;end if;
 if p_action='notification_settings' then
  if r not in ('npi','sub') then raise exception 'Administrator required';end if;
  target_scope:=case when r='npi' then 'npi' else co::text end;mail:=p_body->'emails';
  if jsonb_typeof(mail)<>'array' or jsonb_array_length(mail)>10 or exists(select 1 from jsonb_array_elements_text(mail)x where length(x)>254 or x !~ '^[A-Za-z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') then raise exception 'Enter up to ten valid email addresses';end if;
  insert into public.npi_notification_settings(scope,emails,escalation_minutes,daily_summary,updated_by) values(target_scope,mail,(p_body->>'escalation_minutes')::int,coalesce((p_body->>'daily_summary')::boolean,false),who) on conflict(scope) do update set emails=excluded.emails,escalation_minutes=excluded.escalation_minutes,daily_summary=excluded.daily_summary,updated_by=who,updated_at=now();
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
   if r<>'worker' or (w.status not in ('in-progress','returned')and not(w.worker_led and w.status='draft'and p_body->>'stage'='before')) then raise exception 'Evidence can be added only during work or correction';end if;
   path:=p_body->>'path';mime:=p_body->>'original_mime';
   if path not like w.id::text||'/'||who::text||'/%' or not exists(select 1 from storage.objects o where bucket_id='work-evidence' and name=path and owner_id=who::text)then raise exception 'Upload your original file first';end if;
   if mime not in ('image/jpeg','image/png','image/webp','image/heic','image/heif','image/tiff','image/gif','image/bmp','image/avif','application/pdf')or not exists(select 1 from storage.objects o where bucket_id='work-evidence' and name=path and metadata->>'mimetype'=mime)or (p_body->>'bytes')::bigint not between 1 and 20971520 then raise exception 'Invalid original file metadata';end if;
   if p_body->>'preview_path' is not null and not exists(select 1 from storage.objects o where bucket_id='work-evidence' and name=p_body->>'preview_path' and owner_id=who::text and name like w.id::text||'/'||who::text||'/%' and metadata->>'mimetype'='image/jpeg')then raise exception 'Upload your preview first';end if;
   if (p_body->>'stage')<>'timecard' and (mime not like 'image/%' or p_body->>'preview_path' is null)then raise exception 'A viewable photo preview is required';end if;
   if p_body->>'source'='app-camera' and (p_body->>'captured_at' is null or (p_body->>'captured_at')::timestamptz>clock_timestamp()+interval '2 minutes')then raise exception 'Valid camera capture time required';end if;
   if nullif(p_body->>'issue_id','') is not null and not exists(select 1 from public.npi_issues where id=(p_body->>'issue_id')::uuid and work_id=w.id)then raise exception 'Issue does not belong to this work';end if;
   if nullif(p_body->>'service_line_id','')is not null and not exists(select 1 from public.npi_visit_lines where id=(p_body->>'service_line_id')::uuid and work_id=w.id)then raise exception 'Service does not belong to this visit';end if;
   insert into public.npi_evidence(work_id,uploaded_by,path,kind,stage,preview_path,source,captured_at,filename,original_mime,bytes,issue_id,service_line_id) values(w.id,who,path,case when p_body->>'stage'='timecard' then 'timecard' else 'photo'end,p_body->>'stage',p_body->>'preview_path',p_body->>'source',case when p_body->>'source'='app-camera' then (p_body->>'captured_at')::timestamptz else null end,left(p_body->>'filename',200),mime,(p_body->>'bytes')::bigint,nullif(p_body->>'issue_id','')::uuid,nullif(p_body->>'service_line_id','')::uuid) returning id into ident;
   update public.npi_work_orders set version=version+1 where id=w.id;
  elsif p_action='outcome' then
   if w.version is distinct from(p_body->>'version')::int then raise exception 'Work changed; refresh';end if;
   if r<>'worker' or(w.status not in ('in-progress','returned')and not(w.worker_led and w.status='draft'))then raise exception 'Only active assigned workers can report the outcome';end if;
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


create or replace function public.npi_email_claim_v2() returns setof public.npi_email_outbox language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.npi_issues;s integer;w public.npi_work_orders;attendance_row record;begin
 for i in select * from public.npi_issues where urgency='urgent' and status='open' and escalated_at is null for update skip locked loop
  select coalesce(min(escalation_minutes),60)into s from public.npi_notification_settings where scope='npi';
  if i.created_at < now()-make_interval(mins=>coalesce(s,60))then perform public.npi_notify(i.work_id,i.id,'Urgent issue unacknowledged',left(i.description,600),i.id::text||':escalation');update public.npi_issues set escalated_at=now()where id=i.id;end if;
 end loop;
 for w in select * from public.npi_work_orders where not worker_led and status='draft' and planned_date<(now()at time zone 'America/Anchorage')::date limit 1000 loop
 perform public.npi_notify(w.id,null,'Unstarted work is overdue','Review the assignment date and contact the company.',w.id::text||':overdue:'||(now()at time zone 'America/Anchorage')::date::text);end loop;
 for attendance_row in select event_id as id,work_id,received_at,'check-in'::text event_kind from public.npi_open_attendance where received_at<now()-interval '12 hours' order by received_at limit 1000 loop
 if attendance_row.event_kind='check-in'and attendance_row.received_at<now()-interval '12 hours'then perform public.npi_notify(attendance_row.work_id,null,'Open attendance needs review','A worker has an open shift over twelve hours. Check whether checkout was missed.',attendance_row.id::text||':open-shift:'||(now()at time zone 'America/Anchorage')::date::text);end if;end loop;
 update public.npi_email_outbox set status='failed',error='Delivery window expired; inspect before manually resending'where status in ('queued','retry','processing')and created_at<now()-interval '12 hours';
 return query with selected as(select id from public.npi_email_outbox where(status in ('queued','retry')or(status='processing'and next_attempt<now()))and next_attempt<=now()and attempts<6 order by created_at for update skip locked limit 20)update public.npi_email_outbox e set status='processing',attempts=attempts+1,next_attempt=now()+interval '2 minutes'from selected s where e.id=s.id returning e.*;
end $$;

create or replace function public.npi_email_claim()returns setof public.npi_email_outbox language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.npi_notification_settings;email text;day date:=(now()at time zone 'America/Anchorage')::date;started int;pending_count int;issues_count int;submitted_count int;recorded_hours numeric;begin
 perform public.npi_expire_prepared();
 if extract(hour from now()at time zone 'America/Anchorage')>=7 then
  for s in select * from public.npi_notification_settings where daily_summary and last_digest_date is distinct from day for update skip locked loop
   select count(*)into started from public.npi_work_orders where created_at>=((day-1)::timestamp at time zone 'America/Anchorage')and created_at<(day::timestamp at time zone 'America/Anchorage')and(s.scope='npi'or company_id::text=s.scope);
   select count(*)into pending_count from public.npi_work_orders where status=case when s.scope='npi'then 'npi-review'else 'contractor-review'end and(s.scope='npi'or company_id::text=s.scope);
   select count(*)into issues_count from public.npi_issues i join public.npi_work_orders w on w.id=i.work_id where i.status<>'resolved'and(s.scope='npi'or w.company_id::text=s.scope);
   select count(distinct w.id),coalesce(sum(public.npi_recorded_minutes(w.id,r.worker_id)),0)/60 into submitted_count,recorded_hours from public.npi_work_orders w join public.npi_hour_reviews r on r.work_id=w.id where(s.scope='npi'or w.company_id::text=s.scope)and exists(select 1 from public.npi_work_history h where h.work_id=w.id and h.action='submit_hours'and h.event_time>=((day-1)::timestamp at time zone 'America/Anchorage')and h.event_time<(day::timestamp at time zone 'America/Anchorage'));
   for email in select jsonb_array_elements_text(s.emails)loop
    insert into public.npi_email_outbox(scope,recipient,subject,message,dedupe)values(s.scope,email,'NPI daily operations summary',format('Yesterday: %s new visits; %s visits submitted with %s recorded worker-hours across those visits. Current queue: %s work records need your review; %s unresolved issues. Open https://alaska.npi6030.com/live/ to inspect hours, photos and locations.',started,submitted_count,round(recorded_hours,2),pending_count,issues_count),'daily:'||s.scope||':'||day::text||':'||email)on conflict(dedupe)do nothing;
   end loop;
   update public.npi_notification_settings set last_digest_date=day where scope=s.scope;
  end loop;
 end if;
 return query select * from public.npi_email_claim_v2();
end $$;

create or replace function public.npi_work_search(p_filter jsonb default '{}',p_page integer default 1)returns jsonb language plpgsql stable security invoker set search_path=public,pg_temp as $$
begin
 if public.npi_role()is null then raise exception 'Active account required';end if;
 if p_page not between 1 and 100000 then raise exception 'Invalid page';end if;
 return(with matching as materialized(select w.*,(select name from public.npi_sites where id=w.site_id)site_name,(select display_name from public.npi_profiles where id=w.created_by)assigned_by,(select jsonb_agg(m.worker_id)from public.npi_work_members m where m.work_id=w.id)assigned_workers from public.npi_work_orders w where
 (coalesce(p_filter->>'contract','')=''or w.contract_id=(p_filter->>'contract')::uuid)and(coalesce(p_filter->>'company','')=''or w.company_id=(p_filter->>'company')::uuid)and(coalesce(p_filter->>'site','')=''or w.site_id=(p_filter->>'site')::uuid)and(coalesce(p_filter->>'status','')=''or w.status=p_filter->>'status')and(coalesce(p_filter->>'worker','')=''or exists(select 1 from public.npi_work_members m where m.work_id=w.id and m.worker_id=(p_filter->>'worker')::uuid))and(coalesce(p_filter->>'from','')=''or w.planned_date>=(p_filter->>'from')::date)and(coalesce(p_filter->>'to','')=''or w.planned_date<=(p_filter->>'to')::date)and(coalesce(p_filter->>'q','')=''or strpos(lower(w.title),lower(left(p_filter->>'q',150)))>0 or exists(select 1 from public.npi_sites s where s.id=w.site_id and strpos(lower(s.name),lower(left(p_filter->>'q',150)))>0)or exists(select 1 from public.npi_visit_lines l where l.work_id=w.id and (strpos(lower(l.line_label),lower(left(p_filter->>'q',150)))>0 or strpos(lower(l.sub_label),lower(left(p_filter->>'q',150)))>0))))
 select jsonb_build_object('total',(select count(*)from matching),'rows',coalesce((select jsonb_agg(x)from(select * from matching order by planned_date desc nulls last,id limit 50 offset(p_page-1)*50)x),'[]'::jsonb)));
end $$;


alter function public.npi_visit_action(text,jsonb,uuid)rename to npi_visit_action_v3;
revoke all on function public.npi_visit_action_v3(text,jsonb,uuid)from public,anon,authenticated;
create function public.npi_visit_action(p_action text,p_body jsonb,p_request uuid)returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;w public.npi_work_orders;l public.npi_visit_lines;e public.npi_evidence;threshold numeric;begin
 if public.npi_role()is null then raise exception 'Active account required';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request::text,0));
 if exists(select 1 from public.npi_commands where actor_id=auth.uid()and request_id=p_request)then return public.npi_visit_action_v3(p_action,p_body,p_request);end if;
 perform public.npi_expire_prepared();
 if p_action='save_line'then
  select *into l from public.npi_visit_lines where id=(p_body->>'id')::uuid;
  if l.id is null or not public.npi_can_work(l.work_id)then raise exception 'Work access denied';end if;
  if l.snow_required then
   select *into e from public.npi_evidence where id=(p_body->>'ruler_evidence')::uuid and work_id=l.work_id and stage='before'and source='app-camera'and captured_at is not null;
   if e.id is null then raise exception 'Capture a ruler photo directly in the app';end if;
   if e.service_line_id is not null and e.service_line_id<>l.id then raise exception 'Ruler photo belongs to another service';end if;
   if e.captured_at<l.created_at-interval '2 minutes' then raise exception 'Capture new ruler evidence for this service';end if;
   if exists(select 1 from public.npi_ruler_claims where evidence_id=e.id and line_id<>l.id)then raise exception 'This ruler photo is already used for another service';end if;
  end if;
 end if;
 result:=public.npi_visit_action_v3(p_action,p_body,p_request);
 if p_action='save_item'and nullif(p_body->>'id','')is null and coalesce((p_body->>'snow_required')::boolean,false)and nullif(p_body->>'parent_id','')is null then
  insert into public.npi_service_items(contract_id,parent_id,task_id,code,name,unit,min_inches,max_inches)select contract_id,id,task_id,left(code,17)||'-LOW2-'||left(gen_random_uuid()::text,4),'Below 2 inches',unit,0,2 from public.npi_service_items where id=(result->>'id')::uuid;
 elsif p_action='create_visit'then update public.npi_work_orders set planned_date=null where id=(result->>'id')::uuid;
 elsif p_action='save_line'and l.snow_required then
  update public.npi_evidence set service_line_id=l.id where id=e.id;
  insert into public.npi_ruler_claims values(e.id,l.id,l.work_id)on conflict(evidence_id)do nothing;
  -- Detect concurrent use rather than trusting the earlier read.
  if not exists(select 1 from public.npi_ruler_claims where evidence_id=e.id and line_id=l.id)then raise exception 'Ruler photo already used';end if;
  select review_below_inches into threshold from public.npi_service_items where id=l.line_id;
  update public.npi_visit_lines set review_required=snow_inches<threshold,review_reason=case when snow_inches<threshold then 'Below '||threshold||' inches: work recording only; contract entitlement requires review'else ''end where id=l.id;
  if(p_body->>'snow_inches')::numeric<threshold then perform public.npi_notify(l.work_id,null,'Below-threshold work requires review','Review the ruler evidence and the recorded service; no billing entitlement is implied.',p_request::text||':below');end if;
 end if;
 return result;
end $$;
alter function public.npi_live_action(text,jsonb,uuid)rename to npi_live_action_v30;
revoke all on function public.npi_live_action_v30(text,jsonb,uuid)from public,anon,authenticated;
create function public.npi_live_action(p_action text,p_body jsonb,p_request uuid)returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.npi_work_orders;result jsonb;begin
 if public.npi_role()is null or p_request is null then raise exception 'Active account required';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request::text,0));
 if exists(select 1 from public.npi_commands where actor_id=auth.uid()and request_id=p_request)then return public.npi_live_action_v30(p_action,p_body,p_request);end if;
 perform public.npi_expire_prepared();
 if p_action in('clock','submit_hours','company_approve','npi_approve')then
  select *into w from public.npi_work_orders where id=(p_body->>'id')::uuid for update;
  if not public.npi_can_work(w.id)then raise exception 'Work access denied';end if;
  if p_action in('company_approve','npi_approve')and exists(select 1 from public.npi_visit_lines where work_id=w.id and review_required)and not coalesce((p_body->>'acknowledge_below_threshold')::boolean,false)then raise exception 'Explicitly acknowledge below-threshold work';end if;
  if length(btrim(w.evidence_exception_reason))=0 and(p_action='submit_hours'or(p_action='clock'and p_body->>'event_kind'='check-in'))then
   if(w.evidence_policy->>'before')::boolean and not exists(select 1 from public.npi_evidence where work_id=w.id and stage='before')then raise exception 'Before photos required or explicitly explain missing evidence';end if;
   if p_action='submit_hours'and(w.evidence_policy->>'after')::boolean and not exists(select 1 from public.npi_evidence where work_id=w.id and stage='after')then raise exception 'After photos required or explicitly explain missing evidence';end if;
   if w.worker_led and exists(select 1 from public.npi_visit_lines x where x.work_id=w.id and x.snow_required and(x.snow_inches is null or x.sub_id is null or not exists(select 1 from public.npi_evidence e where e.id=x.ruler_evidence and e.work_id=w.id and e.source='app-camera'and e.captured_at is not null)))then raise exception 'Camera ruler evidence and a confirmed measurement are required, or explicitly explain the evidence exception';end if;
  end if;
 end if;
 result:=public.npi_live_action_v30(p_action,p_body,p_request);
 if p_action='submit_hours'and length(btrim(w.evidence_exception_reason))>0 then insert into public.npi_exception_events(work_id,worker_id,reason)values(w.id,auth.uid(),w.evidence_exception_reason)on conflict(work_id,worker_id)do nothing;end if;
 return result;
end $$;
alter function public.npi_visit_context(uuid)rename to npi_visit_context_v3;
revoke all on function public.npi_visit_context_v3(uuid)from public,anon,authenticated;
create function public.npi_visit_context(p_work uuid default null)returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$declare result jsonb;begin
 if public.npi_role()is null then raise exception 'Active account required';end if;perform public.npi_expire_prepared();
 result:=public.npi_visit_context_v3(p_work);
 return result||jsonb_build_object('release','3.1.0','exceptions',case when public.npi_role()='worker'then '[]'::jsonb else coalesce((select jsonb_agg(x)from(select p.id worker_id,p.display_name,count(distinct r.work_id)submitted_visits,count(distinct e.work_id)exception_visits,round(100.0*count(distinct e.work_id)/greatest(count(distinct r.work_id),1),1)exception_percent from public.npi_profiles p join public.npi_hour_reviews r on r.worker_id=p.id and r.claimed_minutes is not null join public.npi_work_orders w on w.id=r.work_id left join public.npi_exception_events e on e.work_id=r.work_id and e.worker_id=p.id where public.npi_role()='npi'or w.company_id=public.npi_company() group by p.id,p.display_name)x),'[]'::jsonb)end);
end $$;
-- All new maintenance/rate-limit primitives are service-only unless explicitly granted.
revoke all on function public.npi_band_ready(uuid),public.npi_item_before(),public.npi_item_after(),public.npi_attendance_track(),public.npi_work_activity(),public.npi_expire_prepared(),public.npi_public_gate(text,text),public.npi_snow_read_finish(uuid,boolean),public.npi_visit_action(text,jsonb,uuid),public.npi_live_action(text,jsonb,uuid),public.npi_visit_context(uuid)from public,anon,authenticated;
grant execute on function public.npi_public_gate(text,text),public.npi_snow_read_finish(uuid,boolean),public.npi_expire_prepared()to service_role;
grant execute on function public.npi_visit_action(text,jsonb,uuid),public.npi_live_action(text,jsonb,uuid),public.npi_visit_context(uuid)to authenticated;
commit;
