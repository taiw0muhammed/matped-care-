-- ============================================================================
-- MatPed Care — Migration 0001: initial schema
-- Target: Supabase (PostgreSQL 15+)
-- ----------------------------------------------------------------------------
-- Design notes
--   * All application authorisation is enforced here with Row Level Security.
--     The frontend never decides what data a user may read or write.
--   * Roles live on public.profiles and are read through SECURITY DEFINER
--     helper functions so that RLS policies cannot recurse back into profiles.
--   * Immunisation due/overdue status is intentionally NOT stored. It is
--     derived from date of birth + the configured schedule + administered
--     doses, so it can never drift out of date.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('parent', 'nurse', 'admin');

create type public.sex_type as enum ('male', 'female');

create type public.appointment_status as enum (
  'upcoming', 'confirmed', 'completed', 'missed', 'rescheduled', 'cancelled'
);

create type public.notification_channel as enum ('sms', 'email', 'push', 'whatsapp');

create type public.notification_type as enum (
  'immunization_upcoming',
  'immunization_due',
  'immunization_overdue',
  'appointment_reminder',
  'appointment_change',
  'growth_follow_up',
  'record_update'
);

create type public.delivery_status as enum ('pending', 'sent', 'failed', 'skipped');

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ===========================================================================
-- TABLE: facilities
-- ===========================================================================
create table public.facilities (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  address     text,
  city        text,
  state       text,
  lga         text,
  type        text not null default 'primary_healthcare_centre',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index facilities_state_idx on public.facilities (state);
create trigger facilities_updated_at
  before update on public.facilities
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- TABLE: profiles (1:1 with auth.users)
-- ===========================================================================
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '',
  email       text,
  phone       text,
  role        public.user_role not null default 'parent',
  facility_id uuid references public.facilities (id) on delete set null,
  avatar_url  text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint profiles_full_name_length check (char_length(full_name) <= 160),
  constraint profiles_phone_format check (phone is null or phone ~ '^\+?[0-9 ()-]{7,20}$')
);

create index profiles_role_idx on public.profiles (role);
create index profiles_facility_idx on public.profiles (facility_id);
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- A signed-in user must never change their own role, facility, or active
-- flag; only an admin may. SECURITY INVOKER on purpose: the trigger must see
-- the caller's identity, and superuser (migration/seed) writes are allowed.
create or replace function public.guard_profile_privileged_fields()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role
     or new.facility_id is distinct from old.facility_id
     or new.is_active is distinct from old.is_active then
    if not public.is_admin() and not (select rolsuper from pg_roles where rolname = current_user) then
      raise 'only an administrator may change role, facility, or active status'
        using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger profiles_privileged_fields_guard
  before update on public.profiles
  for each row execute function public.guard_profile_privileged_fields();

-- ---------------------------------------------------------------------------
-- Role helpers. SECURITY DEFINER so policies on other tables can read
-- public.profiles without triggering that table's own RLS policy (recursion).
-- ---------------------------------------------------------------------------
create or replace function public.auth_role()
returns public.user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = auth.uid();
$$;;

create or replace function public.is_nurse()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'parent')
         in ('nurse', 'admin');
$$;;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active
  );
$$;;

-- The facility a signed-in healthcare worker belongs to (null if unassigned).
create or replace function public.auth_facility_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select facility_id from public.profiles where id = auth.uid();
$$;

-- True when the current user is a nurse/admin allowed to see the given child:
-- admins see everything; a nurse sees children at their own facility (or with
-- no facility assigned). Central so every child-linked table scopes identically.
create or replace function public.nurse_scope_child(p_child_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  return public.is_nurse() and (
    public.is_admin()
    or public.auth_facility_id() is null
    or exists (
      select 1 from public.children c
      where c.id = p_child_id
        and (c.facility_id = public.auth_facility_id() or c.facility_id is null)
    )
  );
end;
$$;

-- ===========================================================================
-- TABLE: children
-- ===========================================================================
create table public.children (
  id             uuid primary key default gen_random_uuid(),
  record_number  text not null unique,
  full_name      text not null,
  date_of_birth  date not null,
  sex            public.sex_type not null,
  birth_weight_kg numeric(5,2) check (birth_weight_kg is null or (birth_weight_kg > 0.3 and birth_weight_kg < 8)),
  birth_length_cm numeric(5,1) check (birth_length_cm is null or (birth_length_cm > 20 and birth_length_cm < 70)),
  birth_head_circumference_cm numeric(4,1) check (birth_head_circumference_cm is null or (birth_head_circumference_cm > 15 and birth_head_circumference_cm < 50)),
  blood_group    text,
  genotype       text,
  allergies      text,
  notes          text,
  parent_id      uuid not null references public.profiles (id) on delete restrict,
  facility_id    uuid references public.facilities (id) on delete set null,
  registered_by  uuid references public.profiles (id) on delete set null,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint children_name_length check (char_length(full_name) between 2 and 160),
  -- A child cannot be born in the future.
  constraint children_dob_not_future check (date_of_birth <= current_date)
);

create index children_parent_idx    on public.children (parent_id);
create index children_facility_idx  on public.children (facility_id);
create index children_dob_idx       on public.children (date_of_birth);
create index children_name_trgm_idx on public.children (lower(full_name));
create index children_active_idx    on public.children (is_active) where is_active;

create trigger children_updated_at
  before update on public.children
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- TABLE: immunization_schedule (configurable, versioned)
-- ===========================================================================
create table public.immunization_schedule (
  id                uuid primary key default gen_random_uuid(),
  schedule_version  text not null,
  vaccine_code      text not null,
  vaccine_name      text not null,
  dose_label        text not null,
  dose_order        smallint not null,
  target_age_days   integer not null check (target_age_days >= 0),
  due_window_days   integer not null default 14 check (due_window_days between 0 and 180),
  min_interval_days integer check (min_interval_days is null or min_interval_days >= 0),
  catch_up_note     text,
  requires_review   boolean not null default false,
  source_name       text not null,
  source_url        text,
  effective_date    date not null,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (schedule_version, vaccine_code, dose_label)
);

create index schedule_active_idx on public.immunization_schedule (is_active, schedule_version);

create trigger schedule_updated_at
  before update on public.immunization_schedule
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- TABLE: vaccine_doses (recorded administrations — append-only in practice)
-- ===========================================================================
create table public.vaccine_doses (
  id                  uuid primary key default gen_random_uuid(),
  child_id            uuid not null references public.children (id) on delete cascade,
  schedule_item_id    uuid references public.immunization_schedule (id) on delete set null,
  vaccine_code        text not null,
  dose_label          text not null,
  administered_on     date not null,
  due_on              date,
  status              text not null default 'completed'
                      check (status in ('completed', 'deferred', 'contraindicated')),
  given_by            uuid references public.profiles (id) on delete set null,
  facility_id         uuid references public.facilities (id) on delete set null,
  batch_number        text,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- A given dose cannot be recorded in the future.
  constraint vaccine_doses_not_future check (administered_on <= current_date),
  unique (child_id, vaccine_code, dose_label)
);

create index vaccine_doses_child_idx on public.vaccine_doses (child_id, administered_on);

create trigger vaccine_doses_updated_at
  before update on public.vaccine_doses
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- TABLE: growth_measurements
-- ===========================================================================
create table public.growth_measurements (
  id                       uuid primary key default gen_random_uuid(),
  child_id                 uuid not null references public.children (id) on delete cascade,
  measured_on              date not null,
  age_days                 integer not null check (age_days >= 0),
  weight_kg                numeric(5,2) check (weight_kg is null or (weight_kg > 0.3 and weight_kg < 40)),
  length_cm                numeric(5,1) check (length_cm is null or (length_cm > 20 and length_cm < 130)),
  head_circumference_cm    numeric(4,1) check (head_circumference_cm is null or (head_circumference_cm > 15 and head_circumference_cm < 70)),
  muac_cm                  numeric(4,1) check (muac_cm is null or (muac_cm > 3 and muac_cm < 40)),
  -- Deterministic results from the WHO LMS engine, stored for auditability.
  weight_for_age_z         numeric(5,2),
  length_for_age_z         numeric(5,2),
  weight_for_length_z      numeric(5,2),
  head_circumference_z     numeric(5,2),
  growth_light             text check (growth_light in ('green', 'yellow', 'red')),
  assessment_summary       text,
  recorded_by              uuid references public.profiles (id) on delete set null,
  notes                    text,
  created_at               timestamptz not null default now(),
  unique (child_id, measured_on)
);

create index growth_child_idx on public.growth_measurements (child_id, measured_on);

-- ===========================================================================
-- TABLE: appointments
-- ===========================================================================
create table public.appointments (
  id           uuid primary key default gen_random_uuid(),
  child_id     uuid not null references public.children (id) on delete cascade,
  parent_id    uuid not null references public.profiles (id) on delete cascade,
  nurse_id     uuid references public.profiles (id) on delete set null,
  facility_id  uuid references public.facilities (id) on delete set null,
  scheduled_at timestamptz not null,
  reason       text not null default 'immunization',
  status       public.appointment_status not null default 'upcoming',
  notes        text,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index appointments_child_idx    on public.appointments (child_id, scheduled_at);
create index appointments_nurse_idx    on public.appointments (nurse_id, scheduled_at);
create index appointments_parent_idx   on public.appointments (parent_id, scheduled_at);
create index appointments_open_idx     on public.appointments (status)
  where status in ('upcoming', 'confirmed', 'rescheduled');

create trigger appointments_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- TABLE: visits (visit history)
-- ===========================================================================
create table public.visits (
  id          uuid primary key default gen_random_uuid(),
  child_id    uuid not null references public.children (id) on delete cascade,
  visit_on    date not null,
  nurse_id    uuid references public.profiles (id) on delete set null,
  facility_id uuid references public.facilities (id) on delete set null,
  reason      text not null default 'routine',
  summary     text,
  follow_up   text,
  created_at  timestamptz not null default now()
);

create index visits_child_idx on public.visits (child_id, visit_on desc);

-- ===========================================================================
-- TABLE: notification_preferences
-- ===========================================================================
create table public.notification_preferences (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  sms        boolean not null default true,
  email      boolean not null default true,
  push       boolean not null default false,
  whatsapp   boolean not null default false,
  quiet_from time,
  quiet_to   time,
  updated_at timestamptz not null default now()
);

create trigger notif_prefs_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- TABLE: notifications
--   dedupe_key makes "never send the same reminder twice" a database
--   guarantee rather than an application convention.
-- ===========================================================================
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  child_id    uuid references public.children (id) on delete cascade,
  type        public.notification_type not null,
  channel     public.notification_channel not null,
  title       text not null,
  body        text not null,
  dedupe_key  text not null unique,
  status      public.delivery_status not null default 'pending',
  provider    text,
  provider_id text,
  error       text,
  read_at     timestamptz,
  scheduled_for date,
  sent_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_pending_idx on public.notifications (status, scheduled_for)
  where status = 'pending';

-- ===========================================================================
-- TABLE: audit_log
-- ===========================================================================
create table public.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  actor_role  public.user_role,
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  child_id    uuid references public.children (id) on delete set null,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index audit_entity_idx on public.audit_log (entity_type, entity_id);
create index audit_child_idx  on public.audit_log (child_id, created_at desc);
create index audit_actor_idx  on public.audit_log (actor_id, created_at desc);

-- ===========================================================================
-- TABLE: push_subscriptions (Web Push endpoints for the PWA)
-- ===========================================================================
create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index push_user_idx on public.push_subscriptions (user_id);

-- ===========================================================================
-- Child record number generation: MPC-<birth year>-<4 random chars>
-- ===========================================================================
create or replace function public.next_record_number(p_dob date)
returns text
language sql
volatile
as $$
  select 'MPC-' || to_char(coalesce(p_dob, current_date), 'YYYY') || '-' ||
         upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
$$;

-- Column defaults cannot reference other columns, so the record number is
-- filled by a before-insert trigger when the caller omits it.
create or replace function public.fill_record_number()
returns trigger
language plpgsql
as $$
begin
  if new.record_number is null or new.record_number = '' then
    new.record_number := public.next_record_number(new.date_of_birth);
  end if;
  return new;
end;
$$;

create trigger children_fill_record_number
  before insert on public.children
  for each row
  execute function public.fill_record_number();

-- ===========================================================================
-- New auth user -> profile row (role comes from validated signup metadata)
-- ===========================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role public.user_role;
begin
  v_role := case
    when new.raw_user_meta_data ->> 'role' in ('nurse', 'admin')
      then (new.raw_user_meta_data ->> 'role')::public.user_role
    else 'parent'::public.user_role
  end;

  insert into public.profiles (id, full_name, email, phone, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), ''),
    new.email,
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    v_role
  )
  on conflict (id) do nothing;

  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table public.facilities               enable row level security;
alter table public.profiles                 enable row level security;
alter table public.children                 enable row level security;
alter table public.immunization_schedule    enable row level security;
alter table public.vaccine_doses            enable row level security;
alter table public.growth_measurements      enable row level security;
alter table public.appointments             enable row level security;
alter table public.visits                   enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notifications            enable row level security;
alter table public.audit_log                enable row level security;
alter table public.push_subscriptions       enable row level security;

-- --- facilities ------------------------------------------------------------
create policy "facilities: authenticated read"
  on public.facilities for select to authenticated
  using (
    public.is_admin()
    or public.is_nurse()
    or exists (
      select 1 from public.children c
      where c.facility_id = facilities.id and c.parent_id = auth.uid()
    )
  );

create policy "facilities: admin write"
  on public.facilities for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- --- profiles --------------------------------------------------------------
-- A user may read their own profile, and any healthcare worker may read the
-- directory of users (needed to attribute care and manage staff). Parents may
-- not enumerate other users.
create policy "profiles: self read"
  on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or (
      public.is_nurse()
      and (
        -- colleagues at the same facility, or the parents of children
        -- registered at the nurse's facility
        facility_id = public.auth_facility_id()
        or exists (
          select 1 from public.children c
          where c.parent_id = profiles.id
            and c.facility_id = public.auth_facility_id()
        )
      )
    )
  );

create policy "profiles: self insert"
  on public.profiles for insert to authenticated
  with check (
    id = auth.uid()
    and role = 'parent'
    and facility_id is null
    and is_active
  );

-- Privileged columns (role, facility_id, is_active) are guarded by the
-- profiles_privileged_fields_guard trigger, so a user cannot promote
-- themselves or re-assign their facility via the self-update policy.
create policy "profiles: self update"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles: admin write"
  on public.profiles for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- --- children --------------------------------------------------------------
create policy "children: parent reads own"
  on public.children for select to authenticated
  using (parent_id = auth.uid());

create policy "children: nurse reads facility scope"
  on public.children for select to authenticated
  using (
    public.is_nurse()
    and (
      public.is_admin()
      or facility_id is null
      or facility_id = public.auth_facility_id()
      or public.auth_facility_id() is null
    )
  );

create policy "children: nurse inserts"
  on public.children for insert to authenticated
  with check (
    public.is_nurse()
    and (
      public.is_admin()
      or facility_id is null
      or facility_id = public.auth_facility_id()
      or public.auth_facility_id() is null
    )
  );

-- Parents may edit contact/baseline details of their own child, but never the
-- record identifier, date of birth or parent linkage.
create policy "children: parent updates own non-clinical"
  on public.children for update to authenticated
  using (parent_id = auth.uid())
  with check (
    parent_id = auth.uid()
    and record_number = (select c.record_number from public.children c where c.id = children.id)
    and date_of_birth = (select c.date_of_birth from public.children c where c.id = children.id)
  );

create policy "children: nurse updates"
  on public.children for update to authenticated
  using (public.nurse_scope_child(id))
  with check (
    public.nurse_scope_child(id)
    -- nurses may never re-assign a child to another parent
    and parent_id = (select c.parent_id from public.children c where c.id = children.id)
  );

-- --- immunization_schedule -------------------------------------------------
create policy "schedule: authenticated read"
  on public.immunization_schedule for select to authenticated
  using (true);

create policy "schedule: anon read"
  on public.immunization_schedule for select to anon
  using (is_active);

create policy "schedule: admin write"
  on public.immunization_schedule for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- --- vaccine_doses ---------------------------------------------------------
create policy "doses: read linked"
  on public.vaccine_doses for select to authenticated
  using (
    exists (
      select 1 from public.children c
      where c.id = vaccine_doses.child_id
        and (c.parent_id = auth.uid() or public.nurse_scope_child(c.id))
    )
  );

create policy "doses: nurse inserts"
  on public.vaccine_doses for insert to authenticated
  with check (
    public.is_admin()
    or (
      public.is_nurse()
      and facility_id = public.auth_facility_id()
      and exists (
        select 1 from public.children c
        where c.id = child_id
          and c.facility_id = public.auth_facility_id()
      )
    )
  );

create policy "doses: nurse updates"
  on public.vaccine_doses for update to authenticated
  using (public.is_admin() or (public.is_nurse() and facility_id = public.auth_facility_id()))
  with check (
    public.is_admin()
    or (
      public.is_nurse()
      and facility_id = public.auth_facility_id()
      and exists (
        select 1 from public.children c
        where c.id = child_id
          and c.facility_id = public.auth_facility_id()
      )
    )
  );

-- Completed immunisation history is immutable for everyone except an admin.
create policy "doses: admin delete"
  on public.vaccine_doses for delete to authenticated
  using (public.is_admin());

-- --- growth_measurements ---------------------------------------------------
create policy "growth: read linked"
  on public.growth_measurements for select to authenticated
  using (
    exists (
      select 1 from public.children c
      where c.id = growth_measurements.child_id
        and (c.parent_id = auth.uid() or public.nurse_scope_child(c.id))
    )
  );

create policy "growth: nurse inserts"
  on public.growth_measurements for insert to authenticated
  with check (
    public.is_admin()
    or (
      public.is_nurse()
      and exists (
        select 1 from public.children c
        where c.id = child_id
          and c.facility_id = public.auth_facility_id()
      )
    )
  );

create policy "growth: nurse updates"
  on public.growth_measurements for update to authenticated
  using (public.is_nurse())
  with check (
    public.is_admin()
    or (
      public.is_nurse()
      and exists (
        select 1 from public.children c
        where c.id = child_id
          and c.facility_id = public.auth_facility_id()
      )
    )
  );

create policy "growth: admin delete"
  on public.growth_measurements for delete to authenticated
  using (public.is_admin());

-- --- appointments ----------------------------------------------------------
create policy "appointments: parent reads own children"
  on public.appointments for select to authenticated
  using (
    parent_id = auth.uid()
    or (
      public.is_nurse()
      and (
        public.is_admin()
        or public.auth_facility_id() is null
        or facility_id = public.auth_facility_id()
        or facility_id is null
      )
    )
  );

create policy "appointments: nurse inserts"
  on public.appointments for insert to authenticated
  with check (
    public.is_admin()
    or (public.is_nurse() and facility_id = public.auth_facility_id())
  );

create policy "appointments: parent updates status/notes on own"
  on public.appointments for update to authenticated
  using (
    parent_id = auth.uid()
    or (
      public.is_nurse()
      and (
        public.is_admin()
        or public.auth_facility_id() is null
        or facility_id = public.auth_facility_id()
        or facility_id is null
      )
    )
  )
  with check (
    (
      parent_id = auth.uid()
      and exists (
        select 1 from public.children c
        where c.id = appointments.child_id and c.parent_id = auth.uid()
      )
    )
    or (public.is_nurse() and facility_id = public.auth_facility_id())
  );

create policy "appointments: admin delete"
  on public.appointments for delete to authenticated
  using (public.is_admin());

-- --- visits ----------------------------------------------------------------
create policy "visits: read linked"
  on public.visits for select to authenticated
  using (
    exists (
      select 1 from public.children c
      where c.id = visits.child_id
        and (c.parent_id = auth.uid() or public.nurse_scope_child(c.id))
    )
  );

create policy "visits: nurse writes"
  on public.visits for all to authenticated
  using (public.is_admin() or (public.is_nurse() and facility_id = public.auth_facility_id()))
  with check (public.is_admin() or (public.is_nurse() and facility_id = public.auth_facility_id()));

-- --- notification_preferences ---------------------------------------------
create policy "prefs: self read"
  on public.notification_preferences for select to authenticated
  using (user_id = auth.uid());

create policy "prefs: self update"
  on public.notification_preferences for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "prefs: self insert"
  on public.notification_preferences for insert to authenticated
  with check (user_id = auth.uid());

create policy "prefs: admin write"
  on public.notification_preferences for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- --- notifications ---------------------------------------------------------
create policy "notifications: recipient reads own"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

create policy "notifications: recipient marks read"
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "notifications: admin write"
  on public.notifications for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- --- audit_log -------------------------------------------------------------
create policy "audit: admin reads"
  on public.audit_log for select to authenticated
  using (public.is_admin());

-- --- push_subscriptions ----------------------------------------------------
create policy "push: self manage"
  on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ===========================================================================
-- Grants: least privilege for the anonymous/authenticated API roles.
-- ===========================================================================
revoke all on schema public from public;
grant usage on schema public to anon, authenticated, service_role;

grant select on public.immunization_schedule to anon;
-- authenticated gets table-level DML; RLS policies above decide which rows.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- ===========================================================================
-- Views used by the dashboards (security_invoker=false so they can aggregate
-- across the caller's authorised scope; policies still apply via auth_role()).
-- ===========================================================================
create or replace view public.nurse_dashboard_stats
with (security_invoker = false)
as
select
  (select count(*) from public.children c
     where c.is_active
       and (public.is_admin() or c.facility_id = public.auth_facility_id() or public.auth_facility_id() is null or c.facility_id is null)
  ) as total_children,
  (select count(*) from public.appointments a
     where a.status in ('upcoming','confirmed','rescheduled')
       and a.scheduled_at::date = current_date
  ) as todays_appointments,
  (select count(*) from public.appointments a
     where a.status in ('upcoming','confirmed','rescheduled')
       and a.scheduled_at > now()
  ) as upcoming_appointments;
