-- MatPed Care — minimal local stand-in for the parts of Supabase that the
-- migration depends on (auth schema, JWT helpers, request roles).
-- Only for running supabase/tests/rls_test.sql against a vanilla Postgres.
-- On real Supabase these objects already exist; never apply this file there.

-- --------------------------------------------------------------- roles
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role authenticated nologin;
    create role service_role nologin bypassrls;
  end if;
end $$;

-- --------------------------------------------------------------- auth schema
create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
  id                 uuid primary key,
  email              text unique,
  phone              text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);
grant select on auth.users to authenticated;

-- Supabase exposes the JWT subject as a flat GUC plus the full claims object.
create or replace function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create or replace function auth.role() returns text
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )
$$;

grant execute on function auth.uid() to anon, authenticated, service_role;
grant execute on function auth.role() to anon, authenticated, service_role;
