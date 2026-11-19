-- Foundation for a NEW NPI project; not a connected app migration.
-- Default deny: no anon/authenticated policies are installed.
-- Apply once via the project SQL editor. No private data is seeded.
begin;
create table public.npi_companies (
 id uuid primary key default gen_random_uuid(), name text not null,
 active boolean not null default true, version integer not null default 1
);
create table public.npi_profiles (
 id uuid primary key references auth.users(id), company_id uuid references public.npi_companies,
 username text not null unique, display_name text not null,
 role text not null check (role in ('npi','sub','worker')), active boolean not null default true,
 check (role = 'npi' or company_id is not null)
);
create table public.npi_sites (
 id uuid primary key default gen_random_uuid(), name text not null,
 address text, timezone text not null default 'America/Anchorage', photo_path text,
 version integer not null default 1
);
create table public.npi_tasks (
 id uuid primary key default gen_random_uuid(), name text not null unique,
 description text, active boolean not null default true, version integer not null default 1
);
create table public.npi_rates (
 id uuid primary key default gen_random_uuid(), side text not null check(side in ('customer','subcontractor')),
 company_id uuid references public.npi_companies, site_id uuid not null references public.npi_sites,
 task_id uuid not null references public.npi_tasks,
 basis text not null check(basis in ('hourly','fixed','per-visit','per-load')),
 amount_cents bigint not null check(amount_cents between 0 and 999999999), currency text not null default 'USD' check(currency='USD'),
 effective_from date not null, effective_through date,
 version integer not null default 1, created_at timestamptz not null default now(),
 check(effective_through is null or effective_through >= effective_from),
 check((side='customer' and company_id is null) or (side='subcontractor' and company_id is not null))
);
create table public.npi_work_orders (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.npi_companies,
 site_id uuid not null references public.npi_sites, task_id uuid not null references public.npi_tasks,
 planned_date date not null, equipment text,
 status text not null default 'draft' check(status in ('draft','in-progress','contractor-review','npi-review','approved','returned')),
 version integer not null default 1
);
create table public.npi_attendance_events (
 id uuid primary key default gen_random_uuid(), work_id uuid not null references public.npi_work_orders,
 worker_id uuid not null references public.npi_profiles, captured_by uuid not null references public.npi_profiles,
 event_kind text not null check(event_kind in ('check-in','check-out')),
 device_time timestamptz not null, received_at timestamptz not null default now(),
 latitude double precision not null check(latitude between -90 and 90),
 longitude double precision not null check(longitude between -180 and 180),
 accuracy_metres double precision not null check(accuracy_metres >= 0),
 idempotency_key uuid not null unique
);
create table public.npi_hour_reviews (
 id uuid primary key default gen_random_uuid(), work_id uuid not null references public.npi_work_orders,
 worker_id uuid not null references public.npi_profiles,
 claimed_minutes integer check(claimed_minutes >= 0), accepted_minutes integer check(accepted_minutes >= 0),
 company_reviewer uuid references public.npi_profiles, npi_reviewer uuid references public.npi_profiles,
 reason text, version integer not null default 1, unique(work_id, worker_id)
);
create table public.npi_documents (
 id uuid primary key default gen_random_uuid(), kind text not null check(kind in ('customer-invoice','subcontractor-bill')),
 company_id uuid references public.npi_companies, reference text not null,
 status text not null default 'draft', currency text not null default 'USD',
 subtotal_cents bigint check(subtotal_cents >= 0), tax_cents bigint check(tax_cents >= 0),
 total_cents bigint check(total_cents >= 0), issued_at timestamptz, version integer not null default 1,
 unique(kind, reference)
);
create table public.npi_document_lines (
 id uuid primary key default gen_random_uuid(), document_id uuid not null references public.npi_documents,
 work_id uuid not null references public.npi_work_orders, rate_id uuid references public.npi_rates,
 description text not null, quantity numeric(14,4) not null check(quantity>0),
 basis text not null, unit_cents bigint not null check(unit_cents>=0),
 line_cents bigint not null check(line_cents>=0)
 -- Issuance API must snapshot rates, prevent duplicate work allocation and lock issued lines.
);
create table public.npi_sync_changes (
 id uuid primary key default gen_random_uuid(), record_table text not null, record_id uuid not null,
 expected_version integer not null, proposal jsonb not null,
 status text not null default 'pending' check(status in ('pending','accepted','rejected','conflict')),
 message text, received_at timestamptz not null default now()
);
create table public.npi_audit (
 id uuid primary key default gen_random_uuid(), actor_id uuid references public.npi_profiles,
 action text not null, record_id uuid, event_time timestamptz not null default now()
);
do $$ declare t text; begin
 foreach t in array array['npi_companies','npi_profiles','npi_sites','npi_tasks','npi_rates','npi_work_orders','npi_attendance_events','npi_hour_reviews','npi_documents','npi_document_lines','npi_sync_changes','npi_audit'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on table public.%I from anon, authenticated',t);
 end loop;
end $$;
commit;
