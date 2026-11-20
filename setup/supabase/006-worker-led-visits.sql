-- Operations 3.0. Apply ONCE after 005. No contracts, prices or seeded records.
begin;
alter table public.npi_work_orders add column worker_led boolean not null default false;
alter table public.npi_work_orders add column callout_location text not null default '';
create table public.npi_service_items (
 id uuid primary key default gen_random_uuid(),contract_id uuid not null references public.npi_contracts,
 parent_id uuid references public.npi_service_items,task_id uuid not null references public.npi_tasks,
 code text not null check(length(code) between 1 and 30),name text not null check(length(name) between 1 and 150),
 unit text not null default 'visit' check(unit in ('visit','hour','load','yard')),
 snow_required boolean not null default false,callout boolean not null default false,
 min_inches numeric check(min_inches>=0 and min_inches<=120),max_inches numeric check(max_inches>0 and max_inches<=120),
 active boolean not null default true,version integer not null default 1,check(max_inches is null or min_inches is null or max_inches>min_inches),unique(contract_id,code)
);
create table public.npi_visit_lines (
 id uuid primary key default gen_random_uuid(),work_id uuid not null references public.npi_work_orders,
 line_id uuid not null references public.npi_service_items,sub_id uuid references public.npi_service_items,
 line_label text not null,sub_label text,unit text not null,quantity numeric not null default 1 check(quantity>0 and quantity<=100000),
 snow_required boolean not null,snow_inches numeric check(snow_inches>=0 and snow_inches<=120),
 ruler_evidence uuid references public.npi_evidence,measurement_source text check(measurement_source in ('manual','automatic-confirmed')),
 completed boolean not null default false,created_at timestamptz not null default now(),measured_at timestamptz,version integer not null default 1,unique(work_id,line_id)
);
alter table public.npi_notification_settings add column daily_summary boolean not null default true;
alter table public.npi_service_items enable row level security;
alter table public.npi_visit_lines enable row level security;
revoke all on public.npi_service_items,public.npi_visit_lines from public,anon,authenticated;
grant select on public.npi_service_items,public.npi_visit_lines to authenticated;
grant all on public.npi_service_items,public.npi_visit_lines to service_role;
create policy item_read on public.npi_service_items for select to authenticated using(public.npi_role()='npi' or(public.npi_role()is not null and exists(select 1 from public.npi_contract_scopes s where s.contract_id=npi_service_items.contract_id and s.company_id=public.npi_company() and s.active)));
create policy visit_line_read on public.npi_visit_lines for select to authenticated using(public.npi_can_work(work_id));
create function public.npi_visit_context(p_work uuid default null)returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare r text:=public.npi_role();co uuid:=public.npi_company();begin
 if r is null then raise exception 'Active account required';end if;
 return jsonb_build_object('items',coalesce((select jsonb_agg(i)from public.npi_service_items i where r='npi'or exists(select 1 from public.npi_contract_scopes s where s.contract_id=i.contract_id and s.company_id=co and s.active)),'[]'::jsonb),
 'scopes',coalesce((select jsonb_agg(x)from(select s.*,c.name contract_name,si.name site_name,si.address,si.latitude,si.longitude from public.npi_contract_scopes s join public.npi_contracts c on c.id=s.contract_id join public.npi_sites si on si.id=s.site_id where s.active and c.active and(r='npi'or s.company_id=co))x),'[]'::jsonb),
 'crew',coalesce((select jsonb_agg(x)from(select id,display_name from public.npi_profiles where role='worker'and active and account_status='approved'and company_id=co)x),'[]'::jsonb),
 'lines',coalesce((select jsonb_agg(x)from(select l.* from public.npi_visit_lines l where public.npi_can_work(l.work_id)and(p_work is null or l.work_id=p_work)order by created_at desc limit 10000)x),'[]'::jsonb),
 'duplicates',coalesce((select jsonb_agg(x)from(select w.site_id,w.contract_id,w.id from public.npi_work_orders w where w.company_id=co and w.status in ('draft','in-progress')and w.planned_date=(now()at time zone 'America/Anchorage')::date limit 500)x),'[]'::jsonb));
end $$;
create function public.npi_visit_action(p_action text,p_body jsonb,p_request uuid)returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare who uuid:=auth.uid();r text:=public.npi_role();co uuid:=public.npi_company();cmd public.npi_commands;w public.npi_work_orders;item public.npi_service_items;parent public.npi_service_items;l public.npi_visit_lines;ev public.npi_evidence;ident uuid;result jsonb;crew uuid[];v uuid;body jsonb:=p_body;qty numeric;inch numeric;selected_sub uuid;scope_row public.npi_contract_scopes;begin
 if r is null or p_request is null or jsonb_typeof(body)<>'object'or octet_length(body::text)>16000 then raise exception 'Active account and valid request required';end if;
 perform pg_advisory_xact_lock(hashtextextended(who::text||p_request::text,0));
 select * into cmd from public.npi_commands where actor_id=who and request_id=p_request;
 if found then if cmd.action<>'visit:'||p_action or cmd.body<>body then raise exception 'Request changed';end if;return cmd.result;end if;
 if p_action='save_item'then
  if r<>'npi'then raise exception 'NPI administrator required';end if;
  ident:=nullif(body->>'id','')::uuid;
  if nullif(body->>'parent_id','')is not null then
   select * into parent from public.npi_service_items where id=(body->>'parent_id')::uuid for update;
   if parent.id is null or parent.parent_id is not null or parent.contract_id<>(body->>'contract_id')::uuid or parent.task_id<>(body->>'task_id')::uuid then raise exception 'Choose a parent line from the same contract and service';end if;
  end if;
  if parent.id is not null then
   if body->>'unit'<>parent.unit then raise exception 'Sub-line unit must match its parent';end if;
   if parent.snow_required and nullif(body->>'min_inches','')is null then raise exception 'Snow sub-line needs a minimum depth';end if;
   if nullif(body->>'min_inches','')is not null and exists(select 1 from public.npi_service_items x where x.parent_id=parent.id and x.active and x.min_inches is not null and coalesce(x.max_inches,121)> (body->>'min_inches')::numeric and coalesce(nullif(body->>'max_inches','')::numeric,121)>x.min_inches)then raise exception 'Snow bands must not overlap';end if;
  end if;
  if ident is null then
   insert into public.npi_service_items(contract_id,parent_id,task_id,code,name,unit,snow_required,callout,min_inches,max_inches)values((body->>'contract_id')::uuid,parent.id,(body->>'task_id')::uuid,btrim(body->>'code'),btrim(body->>'name'),body->>'unit',coalesce((body->>'snow_required')::boolean,false),coalesce((body->>'callout')::boolean,false),nullif(body->>'min_inches','')::numeric,nullif(body->>'max_inches','')::numeric)returning id into ident;
  else
   select * into item from public.npi_service_items where id=ident for update;
   if item.version is distinct from(body->>'version')::int then raise exception 'Item changed; refresh';end if;
   -- Hierarchy and bounds are immutable: retire an item and create its replacement.
   if coalesce((body->>'active')::boolean,item.active)and item.parent_id is not null and item.min_inches is not null then
    perform 1 from public.npi_service_items where id=item.parent_id for update;
    if exists(select 1 from public.npi_service_items x where x.parent_id=item.parent_id and x.id<>item.id and x.active and x.min_inches is not null and coalesce(x.max_inches,121)>item.min_inches and coalesce(item.max_inches,121)>x.min_inches)then raise exception 'Snow bands must not overlap';end if;
   end if;
   update public.npi_service_items set active=coalesce((body->>'active')::boolean,active),version=version+1 where id=ident;
  end if;
 elsif p_action='create_visit'then
  if r<>'worker'then raise exception 'Worker account required';end if;
  select * into scope_row from public.npi_contract_scopes where id=(body->>'scope_id')::uuid;
  if scope_row.company_id is distinct from co or not public.npi_dispatch_scope(co,scope_row.site_id,scope_row.contract_id)then raise exception 'Site is outside company scope';end if;
  select * into item from public.npi_service_items where id=(body->>'line_id')::uuid and parent_id is null and active;
  if item.id is null or item.contract_id<>scope_row.contract_id or not exists(select 1 from public.npi_tasks where id=item.task_id and active)then raise exception 'Choose an active contract service';end if;
  if length(btrim(coalesce(body->>'callout_location','')))>0 and not item.callout then raise exception 'Manual location is available for call-out services only';end if;
  select array_agg(distinct x::uuid order by x::uuid)into crew from jsonb_array_elements_text(body->'members')x;
  if coalesce(cardinality(crew),0)not between 1 and 50 or not(who=any(crew))or exists(select 1 from unnest(crew)x where not exists(select 1 from public.npi_profiles where id=x and role='worker'and active and account_status='approved'and company_id=co))then raise exception 'Choose approved company crew including yourself';end if;
  foreach v in array crew loop
   perform pg_advisory_xact_lock(hashtextextended('attendance:'||v::text,0));
   if(select event_kind from public.npi_attendance_events where worker_id=v order by received_at desc,id desc limit 1)='check-in'then raise exception 'A selected worker already has an open visit';end if;
   if exists(select 1 from public.npi_work_orders z join public.npi_work_members m on m.work_id=z.id where m.worker_id=v and z.worker_led and z.status='draft')then raise exception 'Resume the existing prepared visit before creating another';end if;
  end loop;
  insert into public.npi_work_orders(company_id,site_id,task_id,contract_id,planned_date,equipment,title,kind,checklist,worker_led,created_by,area,callout_location,evidence_policy)
  values(co,scope_row.site_id,item.task_id,item.contract_id,(now()at time zone 'America/Anchorage')::date,left(coalesce(body->>'equipment',''),150),item.name,'site','[]',true,who,left(coalesce(body->>'area',''),300),left(btrim(coalesce(body->>'callout_location','')),300),(select evidence_policy from public.npi_tasks where id=item.task_id))returning id into ident;
  insert into public.npi_work_members select ident,x from unnest(crew)x;
  insert into public.npi_hour_reviews(work_id,worker_id)select ident,x from unnest(crew)x;
  insert into public.npi_visit_lines(work_id,line_id,line_label,unit,snow_required)values(ident,item.id,item.code||' · '||item.name,item.unit,item.snow_required);
  insert into public.npi_work_history(work_id,actor_id,action,detail)values(ident,who,'Worker prepared visit',jsonb_build_object('line_id',item.id,'crew',crew));
 else
  select * into w from public.npi_work_orders where id=(body->>'work_id')::uuid for update;
  if w.id is null or not w.worker_led or not public.npi_can_work(w.id)or r<>'worker'or w.status not in ('draft','in-progress','returned')then raise exception 'Visit is not editable';end if;
  if w.version is distinct from(body->>'version')::int then raise exception 'Visit changed; refresh';end if;
  ident:=w.id;
  if p_action='add_service'then
   if not public.npi_dispatch_scope(w.company_id,w.site_id,w.contract_id)then raise exception 'Company scope is no longer active';end if;
   select x.* into item from public.npi_service_items x where x.id=(body->>'line_id')::uuid and x.active and x.parent_id is null and x.contract_id=w.contract_id and exists(select 1 from public.npi_tasks t where t.id=x.task_id and t.active);
   if item.id is null then raise exception 'Choose a service in this contract';end if;
   if exists(select 1 from public.npi_attendance_events where work_id=w.id and event_kind='check-out')then raise exception 'Add services before checkout';end if;
   insert into public.npi_visit_lines(work_id,line_id,line_label,unit,snow_required)values(w.id,item.id,item.code||' · '||item.name,item.unit,item.snow_required);
   update public.npi_work_orders set evidence_policy=jsonb_build_object('before',(evidence_policy->>'before')::boolean or (select (evidence_policy->>'before')::boolean from public.npi_tasks where id=item.task_id),'after',(evidence_policy->>'after')::boolean or(select (evidence_policy->>'after')::boolean from public.npi_tasks where id=item.task_id)),version=version+1 where id=w.id;
  elsif p_action='save_line'then
   select * into l from public.npi_visit_lines where id=(body->>'id')::uuid and work_id=w.id for update;
   if l.id is null or l.version is distinct from(body->>'line_version')::int then raise exception 'Work item changed; refresh';end if;
   qty:=(body->>'quantity')::numeric;
   if qty is null or qty='NaN'::numeric or qty<=0 or qty>100000 or(l.unit in ('load','visit')and qty<>trunc(qty))then raise exception 'Enter a valid quantity';end if;
   selected_sub:=nullif(body->>'sub_id','')::uuid;
   if l.snow_required then
    inch:=(body->>'snow_inches')::numeric;
    if inch is null or inch='NaN'::numeric or inch<0 or inch>120 or not coalesce((body->>'measurement_confirmed')::boolean,false)then raise exception 'Confirm measured snow inches';end if;
    if l.snow_inches is not null and l.snow_inches<>inch and length(btrim(coalesce(body->>'reason','')))<1 then raise exception 'Explain the changed snow measurement';end if;
    select * into ev from public.npi_evidence where id=(body->>'ruler_evidence')::uuid and work_id=w.id and stage='before'and kind='photo';
    if ev.id is null then raise exception 'A before-work ruler photo is required';end if;
    -- Existing confirmed pre-start evidence may be corrected but cannot be replaced after starting.
    if exists(select 1 from public.npi_attendance_events where work_id=w.id and event_kind='check-in'and received_at<ev.created_at)and l.created_at<=(select min(received_at)from public.npi_attendance_events where work_id=w.id and event_kind='check-in')then raise exception 'Use the ruler photo recorded before start';end if;
    if l.snow_inches is not null and inch=l.snow_inches and l.sub_id is not null then selected_sub:=l.sub_id;else
    select id into selected_sub from public.npi_service_items where parent_id=l.line_id and active and min_inches is not null and inch>=min_inches and(max_inches is null or inch<max_inches)order by min_inches desc limit 1;end if;
    if selected_sub is null then raise exception 'No configured snow band matches these inches; report the issue to your administrator';end if;
   elsif exists(select 1 from public.npi_service_items where parent_id=l.line_id and active)then
    if not exists(select 1 from public.npi_service_items where id=selected_sub and parent_id=l.line_id and active)then raise exception 'Select a sub-line item';end if;
   elsif selected_sub is not null then raise exception 'Invalid sub-line item';end if;
   insert into public.npi_work_history(work_id,actor_id,action,detail)values(w.id,who,'Service value before change',to_jsonb(l));
   update public.npi_visit_lines set sub_id=selected_sub,sub_label=(select code||' · '||name from public.npi_service_items where id=selected_sub),quantity=qty,snow_inches=inch,ruler_evidence=case when l.snow_required then ev.id else null end,measurement_source=case when l.snow_required then case when body->>'measurement_source'='automatic-confirmed'then 'automatic-confirmed'else 'manual'end end,measured_at=case when l.snow_required then now()else null end,completed=coalesce((body->>'completed')::boolean,false),version=version+1 where id=l.id;
   update public.npi_work_orders set version=version+1 where id=w.id;
  elsif p_action='cancel_prepared'then
   if w.status<>'draft'or exists(select 1 from public.npi_attendance_events where work_id=w.id)then raise exception 'Only an unstarted visit can be cancelled';end if;
   update public.npi_work_orders set status='cancelled',review_note='Worker cancelled prepared visit',version=version+1 where id=w.id;
  else raise exception 'Unknown visit action';end if;
  insert into public.npi_work_history(work_id,actor_id,action,detail)values(w.id,who,'Visit: '||p_action,body-'version');
 end if;
 result:=jsonb_build_object('id',ident,'action',p_action);
 insert into public.npi_commands(actor_id,request_id,action,body,result)values(who,p_request,'visit:'||p_action,body,result);
 insert into public.npi_audit(actor_id,action,record_id)values(who,'visit:'||p_action,ident);
 return result;
end $$;

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
  insert into public.npi_notification_settings(scope,emails,escalation_minutes,daily_summary,updated_by) values(target_scope,mail,(p_body->>'escalation_minutes')::int,coalesce((p_body->>'daily_summary')::boolean,true),who) on conflict(scope) do update set emails=excluded.emails,escalation_minutes=excluded.escalation_minutes,daily_summary=excluded.daily_summary,updated_by=who,updated_at=now();
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
   insert into public.npi_evidence(work_id,uploaded_by,path,kind,stage,preview_path,source,captured_at,filename,original_mime,bytes,issue_id) values(w.id,who,path,case when p_body->>'stage'='timecard' then 'timecard' else 'photo'end,p_body->>'stage',p_body->>'preview_path',p_body->>'source',case when p_body->>'source'='app-camera' then (p_body->>'captured_at')::timestamptz else null end,left(p_body->>'filename',200),mime,(p_body->>'bytes')::bigint,nullif(p_body->>'issue_id','')::uuid) returning id into ident;
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

alter function public.npi_live_action(text,jsonb,uuid)rename to npi_live_action_v2;
revoke all on function public.npi_live_action_v2(text,jsonb,uuid)from public,anon,authenticated;
create function public.npi_live_action(p_action text,p_body jsonb,p_request uuid)returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.npi_work_orders;l public.npi_visit_lines;begin
 if public.npi_role()is null or p_request is null then raise exception 'Active account required';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request::text,0));
 if exists(select 1 from public.npi_commands where actor_id=auth.uid()and request_id=p_request)then return public.npi_live_action_v2(p_action,p_body,p_request);end if;
 if p_action in ('clock','submit_hours')then
  select * into w from public.npi_work_orders where id=(p_body->>'id')::uuid for update;
  if w.worker_led then
   if not public.npi_can_work(w.id)then raise exception 'Visit access denied';end if;
   if p_action='clock'and p_body->>'event_kind'='check-in'then
    if not public.npi_dispatch_scope(w.company_id,w.site_id,w.contract_id)then raise exception 'Company scope is no longer active';end if;
    if w.outcome='complete'and length(w.evidence_exception_reason)=0 and(w.evidence_policy->>'before')::boolean and not exists(select 1 from public.npi_evidence where work_id=w.id and stage='before')then raise exception 'Upload before photos before starting';end if;
    if w.outcome='complete'and length(w.evidence_exception_reason)=0 and exists(select 1 from public.npi_visit_lines where work_id=w.id and snow_required and(ruler_evidence is null or snow_inches is null or sub_id is null))then raise exception 'Confirm snow inches and ruler photo before starting';end if;
   elsif p_action='submit_hours'and w.outcome='complete'and length(w.evidence_exception_reason)=0 then
    if exists(select 1 from public.npi_visit_lines x where x.work_id=w.id and(not x.completed or(x.snow_required and x.ruler_evidence is null)or(x.sub_id is null and exists(select 1 from public.npi_service_items where parent_id=x.line_id and active))))then raise exception 'Complete every service item and its required measurement';end if;
   end if;
  end if;
 end if;
 return public.npi_live_action_v2(p_action,p_body,p_request);
end $$;
-- Daily summary is queued once per recipient/scope/day by the existing dispatcher.
alter function public.npi_email_claim()rename to npi_email_claim_v2;
revoke all on function public.npi_email_claim_v2()from public,anon,authenticated;
create function public.npi_email_claim()returns setof public.npi_email_outbox language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.npi_notification_settings;email text;day date:=(now()at time zone 'America/Anchorage')::date;started int;pending_count int;issues_count int;submitted_count int;recorded_hours numeric;begin
 if extract(hour from now()at time zone 'America/Anchorage')>=7 then
  for s in select * from public.npi_notification_settings where daily_summary loop
   select count(*)into started from public.npi_work_orders where created_at>=((day-1)::timestamp at time zone 'America/Anchorage')and created_at<(day::timestamp at time zone 'America/Anchorage')and(s.scope='npi'or company_id::text=s.scope);
   select count(*)into pending_count from public.npi_work_orders where status=case when s.scope='npi'then 'npi-review'else 'contractor-review'end and(s.scope='npi'or company_id::text=s.scope);
   select count(*)into issues_count from public.npi_issues i join public.npi_work_orders w on w.id=i.work_id where i.status<>'resolved'and(s.scope='npi'or w.company_id::text=s.scope);
   select count(distinct w.id),coalesce(sum(public.npi_recorded_minutes(w.id,r.worker_id)),0)/60 into submitted_count,recorded_hours from public.npi_work_orders w join public.npi_hour_reviews r on r.work_id=w.id where(s.scope='npi'or w.company_id::text=s.scope)and exists(select 1 from public.npi_work_history h where h.work_id=w.id and h.action='submit_hours'and h.event_time>=((day-1)::timestamp at time zone 'America/Anchorage')and h.event_time<(day::timestamp at time zone 'America/Anchorage'));
   for email in select jsonb_array_elements_text(s.emails)loop
    insert into public.npi_email_outbox(scope,recipient,subject,message,dedupe)values(s.scope,email,'NPI daily operations summary',format('Yesterday: %s new visits; %s visits submitted with %s recorded worker-hours across those visits. Current queue: %s work records need your review; %s unresolved issues. Open https://alaska.npi6030.com/live/ to inspect hours, photos and locations.',started,submitted_count,round(recorded_hours,2),pending_count,issues_count),'daily:'||s.scope||':'||day::text||':'||email)on conflict(dedupe)do nothing;
   end loop;
  end loop;
 end if;
 return query select * from public.npi_email_claim_v2();
end $$;
revoke all on function public.npi_visit_context(uuid),public.npi_visit_action(text,jsonb,uuid),public.npi_live_action(text,jsonb,uuid),public.npi_email_claim()from public,anon,authenticated;
grant execute on function public.npi_visit_context(uuid),public.npi_visit_action(text,jsonb,uuid),public.npi_live_action(text,jsonb,uuid)to authenticated;
grant execute on function public.npi_email_claim()to service_role;
create function public.npi_snow_read_reserve(p_evidence uuid)returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.npi_evidence;begin
 if public.npi_role()<>'worker'then raise exception 'Worker account required';end if;
 perform pg_advisory_xact_lock(hashtextextended('snow-read:'||auth.uid()::text,0));
 select * into e from public.npi_evidence where id=p_evidence and stage='before'and preview_path is not null;
 if e.id is null or not public.npi_can_work(e.work_id)then raise exception 'Photo access denied';end if;
 if(select count(*)from public.npi_audit where actor_id=auth.uid()and action='snow_read_requested'and event_time>now()-interval '1 hour')>=10 then raise exception 'Reading limit reached; use manual entry';end if;
 insert into public.npi_audit(actor_id,action,record_id)values(auth.uid(),'snow_read_requested',e.id);
 return jsonb_build_object('path',e.preview_path);
end $$;
revoke all on function public.npi_snow_read_reserve(uuid)from public,anon;
grant execute on function public.npi_snow_read_reserve(uuid)to authenticated;
create or replace function public.npi_work_search(p_filter jsonb default '{}',p_page integer default 1)returns jsonb language plpgsql stable security invoker set search_path=public,pg_temp as $$
begin
 if public.npi_role()is null then raise exception 'Active account required';end if;
 if p_page not between 1 and 100000 then raise exception 'Invalid page';end if;
 return(with matching as materialized(select w.*,(select name from public.npi_sites where id=w.site_id)site_name,(select display_name from public.npi_profiles where id=w.created_by)assigned_by,(select jsonb_agg(m.worker_id)from public.npi_work_members m where m.work_id=w.id)assigned_workers from public.npi_work_orders w where
 (coalesce(p_filter->>'contract','')=''or w.contract_id=(p_filter->>'contract')::uuid)and(coalesce(p_filter->>'company','')=''or w.company_id=(p_filter->>'company')::uuid)and(coalesce(p_filter->>'site','')=''or w.site_id=(p_filter->>'site')::uuid)and(coalesce(p_filter->>'status','')=''or w.status=p_filter->>'status')and(coalesce(p_filter->>'worker','')=''or exists(select 1 from public.npi_work_members m where m.work_id=w.id and m.worker_id=(p_filter->>'worker')::uuid))and(coalesce(p_filter->>'from','')=''or w.planned_date>=(p_filter->>'from')::date)and(coalesce(p_filter->>'to','')=''or w.planned_date<=(p_filter->>'to')::date)and(coalesce(p_filter->>'q','')=''or w.title ilike '%'||left(p_filter->>'q',150)||'%'or exists(select 1 from public.npi_sites s where s.id=w.site_id and s.name ilike '%'||left(p_filter->>'q',150)||'%')or exists(select 1 from public.npi_visit_lines l where l.work_id=w.id and (l.line_label ilike '%'||left(p_filter->>'q',150)||'%'or l.sub_label ilike '%'||left(p_filter->>'q',150)||'%'))))
 select jsonb_build_object('total',(select count(*)from matching),'rows',coalesce((select jsonb_agg(x)from(select * from matching order by planned_date desc,id limit 50 offset(p_page-1)*50)x),'[]'::jsonb)));
end $$;

commit;
