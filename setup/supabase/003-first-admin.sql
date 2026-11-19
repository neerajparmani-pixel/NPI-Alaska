-- Run in the Supabase SQL Editor, AFTER creating your real owner login in Auth.
-- Replace the example email below with YOUR confirmed NPI owner account email.
-- This is an owner-only setup step, not a public self-enrollment endpoint.
begin;
do $$
declare owner_id uuid; owner_email text:='REPLACE_WITH_YOUR_CONFIRMED_ADMIN_EMAIL';
begin
 perform pg_advisory_xact_lock(hashtextextended('npi-first-owner',0));
 if exists(select 1 from public.npi_profiles where role='npi' and active) then
  raise notice 'An active NPI administrator already exists. No privileges changed.';
  return;
 end if;
 select id into owner_id from auth.users where lower(email)=lower(owner_email) and email_confirmed_at is not null;
 if owner_id is null then raise exception 'Create and confirm the owner account in Authentication > Users first, and replace the email placeholder in this script.';end if;
 insert into public.npi_profiles(id,username,display_name,role,active) values(owner_id,'npi.owner','NPI Administrator','npi',true);
end $$;
commit;
