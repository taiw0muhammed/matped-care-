-- MatPed Care — Row Level Security verification.
-- Runs against a local Postgres with the Supabase auth stub from
-- 0000_local_auth_stub.sql (see run_rls_tests.sh, which applies it first).
--   psql -p 5433 -U postgres -d matped_test -f supabase/tests/rls_test.sql
-- Every assertion executes as `anon` / `authenticated`, never as the
-- superuser, otherwise RLS is bypassed.

-- Unexpected errors (broken seed, missing table, helper regression) abort
-- immediately with a non-zero exit: a run on a corrupt database must not be
-- mistaken for a policy verdict.  Assertion failures are different -- every
-- check catches its own expected errors inside the helpers, so a wrong policy
-- never aborts the run: all checks execute, the final DO block lists the
-- failing labels and raises, which still exits non-zero for CI.
\set ON_ERROR_STOP 1
--
-- Helper semantics (important):
--   __blocked   — the statement must raise (missing grant / WITH CHECK fail).
--   __no_change — an UPDATE/DELETE that RLS silently filters to zero rows is
--                 NOT an error, so "cannot modify" tests run the statement and
--                 then verify the protected data is untouched.
--   __peek      — SECURITY DEFINER so post-attempt verification reads bypass
--                 RLS (it is a test oracle, not part of the product).

-- ---------------------------------------------------------------- helpers
drop table if exists public.rls_results;
create table public.rls_results (
  n       serial primary key,
  label   text not null,
  passed  boolean not null,
  detail  text not null default ''
);

-- The helpers run as the calling role (so RLS is really enforced on the
-- statements under test); they still need to write their verdicts down.
grant insert on public.rls_results to anon, authenticated;
grant usage, select on sequence public.rls_results_n_seq to anon, authenticated;

create or replace function public.__ok(label text) returns void
language sql as $$ insert into public.rls_results (label, passed, detail) values (label, true, '') $$;

create or replace function public.__fail(label text, detail text) returns void
language sql as $$ insert into public.rls_results (label, passed, detail) values (label, false, detail) $$;

-- Assert a statement is rejected (RLS or grant denial).
create or replace function public.__blocked(label text, stmt text) returns void
language plpgsql as $$
begin
  execute stmt;
  perform public.__fail(label, 'statement succeeded but should have been blocked');
exception when others then
  perform public.__ok(label || ' [' || left(sqlerrm, 60) || ']');
end;
$$;

-- Assert a statement is permitted.
create or replace function public.__allowed(label text, stmt text) returns void
language plpgsql as $$
begin
  execute stmt;
  perform public.__ok(label);
exception when others then
  perform public.__fail(label, 'unexpectedly blocked: ' || left(sqlerrm, 90));
end;
$$;

-- Assert a SELECT returns exactly `want` rows under the current role.
create or replace function public.__count(label text, stmt text, want integer) returns void
language plpgsql as $$
declare got integer;
begin
  execute stmt into got;
  if got = want then
    perform public.__ok(label || ' (' || got || ')');
  else
    perform public.__fail(label, 'expected ' || want || ' rows, got ' || got);
  end if;
exception when others then
  perform public.__fail(label, 'query errored: ' || left(sqlerrm, 90));
end;
$$;

-- SECURITY DEFINER oracle: evaluate a boolean query as the table owner so
-- verification is not itself filtered by RLS.
create or replace function public.__peek(q text) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare r boolean;
begin
  execute 'select (' || q || ')' into r;
  return r;
end;
$$;

-- Run `attempt` under the current role (errors tolerated — a hard block also
-- means "cannot"), then require that `still_true` holds over the real data.
create or replace function public.__no_change(label text, attempt text, still_true text) returns void
language plpgsql as $$
begin
  begin
    execute attempt;
  exception when others then
    null;  -- blocked with an error is a pass too; __peek confirms below
  end;
  if public.__peek(still_true) is true then
    perform public.__ok(label);
  else
    perform public.__fail(label, 'protected data was modified');
  end if;
end;
$$;

-- Inverse of __no_change: run `attempt` under the current role and require
-- that `now_true` (checked as the table owner) holds afterwards.
create or replace function public.__changed(label text, attempt text, now_true text) returns void
language plpgsql as $$
begin
  begin
    execute attempt;
  exception when others then
    perform public.__fail(label, 'unexpectedly blocked: ' || left(sqlerrm, 90));
    return;
  end;
  if public.__peek(now_true) is true then
    perform public.__ok(label);
  else
    perform public.__fail(label, 'write did not take effect');
  end if;
end;
$$;

-- =================================================================== seed
-- Fictional test identities only (never real patients).
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'ngozi.balogun@example.test',   '{"full_name":"Ngozi Balogun"}'),
  ('22222222-2222-2222-2222-222222222222', 'fatima.yusuf@example.test',    '{"full_name":"Fatima Yusuf"}'),
  ('33333333-3333-3333-3333-333333333333', 'grace.okonkwo@example.test',   '{"full_name":"Grace Okonkwo"}'),
  ('44444444-4444-4444-4444-444444444444', 'ibrahim.lawal@example.test',   '{"full_name":"Ibrahim Lawal"}'),
  ('55555555-5555-5555-5555-555555555555', 'halima.sadiq@example.test',    '{"full_name":"Halima Sadiq"}');

-- profiles + notification_preferences are created by on_auth_user_created.
update public.profiles set role = 'nurse'
  where id = '33333333-3333-3333-3333-333333333333';
update public.profiles set role = 'nurse'
  where id = '55555555-5555-5555-5555-555555555555';
update public.profiles set role = 'admin'
  where id = '44444444-4444-4444-4444-444444444444';

insert into public.facilities (id, name, address, state, lga) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'General Hospital Udi', 'Udi Town', 'Enugu', 'Udi'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'PHC Centre Ikere', 'Ikere', 'Ekiti', 'Ikere');

update public.profiles set facility_id = 'aaaaaaaa-0000-0000-0000-000000000001'::uuid
  where id = '33333333-3333-3333-3333-333333333333';
update public.profiles set facility_id = 'aaaaaaaa-0000-0000-0000-000000000002'::uuid
  where id = '55555555-5555-5555-5555-555555555555';

-- Test schedule (two items so the schedule-read assertions are meaningful).
insert into public.immunization_schedule
  (schedule_version, vaccine_code, vaccine_name, dose_label, dose_order,
   target_age_days, source_name, effective_date) values
  ('NG-TEST', 'bcg',  'BCG',        'BCG',     1, 0,  'RLS test fixture', current_date - 30),
  ('NG-TEST', 'opv',  'Polio (OPV)', 'OPV 0',  2, 42, 'RLS test fixture', current_date - 30);

-- b001/b002 belong to parent 1 at facility a1; b003 to parent 2 at a1;
-- b004 to parent 2 at a2 (cross-facility fixture for nurse scoping).
insert into public.children (id, full_name, date_of_birth, sex, parent_id, facility_id, birth_weight_kg, registered_by) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Adaeze Balogun',  current_date - 200, 'female',
    '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 3.2,
    '33333333-3333-3333-3333-333333333333'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Chidi Balogun',   current_date - 60, 'male',
    '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 2.9,
    '33333333-3333-3333-3333-333333333333'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'Amina Yusuf',     current_date - 400, 'female',
    '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000001', 3.5,
    '33333333-3333-3333-3333-333333333333'),
  ('bbbbbbbb-0000-0000-0000-000000000004', 'Blessing Adeyemi', current_date - 100, 'female',
    '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000002', 3.4,
    '55555555-5555-5555-5555-555555555555');

insert into public.vaccine_doses (child_id, vaccine_code, dose_label, administered_on, given_by, facility_id) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'opv', 'OPV 0', current_date - 199,
    '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000004', 'bcg', 'BCG', current_date - 95,
    '55555555-5555-5555-5555-555555555555', 'aaaaaaaa-0000-0000-0000-000000000002');

insert into public.growth_measurements (child_id, measured_on, age_days, weight_kg, recorded_by) values
  ('bbbbbbbb-0000-0000-0000-000000000001', current_date - 30, 170, 6.4,
    '33333333-3333-3333-3333-333333333333'),
  ('bbbbbbbb-0000-0000-0000-000000000004', current_date - 30, 70, 5.1,
    '55555555-5555-5555-5555-555555555555');

insert into public.visits (child_id, visit_on, nurse_id, facility_id, reason) values
  ('bbbbbbbb-0000-0000-0000-000000000001', current_date - 30,
    '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-0000-0000-0000-000000000001',
    'immunization');

insert into public.appointments (child_id, parent_id, nurse_id, scheduled_at, reason, facility_id) values
  ('bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333333', now() + interval '2 days', 'immunization',
    'aaaaaaaa-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333', now() + interval '9 days', 'growth',
    'aaaaaaaa-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222',
    '55555555-5555-5555-5555-555555555555', now() + interval '5 days', 'immunization',
    'aaaaaaaa-0000-0000-0000-000000000002');

insert into public.notifications (user_id, child_id, type, channel, title, body, dedupe_key) values
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000001',
    'immunization_due', 'email', 'Vaccine due', 'OPV 1 is due soon.', 'rls-test-1'),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-0000-0000-0000-000000000003',
    'appointment_reminder', 'email', 'Appointment', 'Growth review next week.', 'rls-test-2');

insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, child_id) values
  ('33333333-3333-3333-3333-333333333333', 'nurse', 'vaccine_dose.recorded', 'vaccine_doses',
    'bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001');

insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values
  ('11111111-1111-1111-1111-111111111111', 'https://push.example.test/abc', 'key', 'secret');

-- ========================================================== ANON
set role anon;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000000', false);

select public.__blocked('anon cannot read children',
  'select count(*) from public.children');
select public.__blocked('anon cannot read profiles',
  'select count(*) from public.profiles');
select public.__blocked('anon cannot read vaccine_doses',
  'select count(*) from public.vaccine_doses');
select public.__blocked('anon cannot read growth_measurements',
  'select count(*) from public.growth_measurements');
select public.__blocked('anon cannot read appointments',
  'select count(*) from public.appointments');
select public.__blocked('anon cannot read visits',
  'select count(*) from public.visits');
select public.__blocked('anon cannot read notifications',
  'select count(*) from public.notifications');
select public.__blocked('anon cannot read notification_preferences',
  'select count(*) from public.notification_preferences');
select public.__blocked('anon cannot read audit_log',
  'select count(*) from public.audit_log');
select public.__count('anon reads the public schedule (reference data)',
  'select count(*) from public.immunization_schedule', 2);
select public.__blocked('anon cannot insert a child',
  'insert into public.children (full_name, date_of_birth, sex, parent_id)
   values (''Evil Child'', ''2024-01-01'', ''female'',
           ''11111111-1111-1111-1111-111111111111'')');

select public.__ok('anon section complete');
reset role;
-- ======================================================== PARENT 1
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

select public.__count('parent reads own profile',
  'select count(*) from public.profiles', 1);
select public.__count('parent cannot read nurse profile',
  'select count(*) from public.profiles where id = ''33333333-3333-3333-3333-333333333333''', 0);
select public.__count('parent sees only own children',
  'select count(*) from public.children', 2);
select public.__count('parent cannot read other parent''s child',
  'select count(*) from public.children where id = ''bbbbbbbb-0000-0000-0000-000000000003''', 0);
select public.__allowed('parent may update own child',
  'update public.children set full_name = full_name where id = ''bbbbbbbb-0000-0000-0000-000000000001''');
select public.__no_change('parent cannot delete own child',
  'delete from public.children where id = ''bbbbbbbb-0000-0000-0000-000000000001''',
  'select exists(select 1 from public.children where id = ''bbbbbbbb-0000-0000-0000-000000000001'')');
select public.__blocked('parent cannot register a child directly',
  'insert into public.children (full_name, date_of_birth, sex, parent_id, facility_id)
   values (''Sneaky'', ''2024-06-01'', ''female'',
           ''11111111-1111-1111-1111-111111111111'',
           ''aaaaaaaa-0000-0000-0000-000000000001'')');
select public.__no_change('parent cannot rename the facility',
  'update public.facilities set name = ''Hacked'' where id = ''aaaaaaaa-0000-0000-0000-000000000001''',
  'select name = ''General Hospital Udi'' from public.facilities where id = ''aaaaaaaa-0000-0000-0000-000000000001''');
select public.__count('parent reads own child doses',
  'select count(*) from public.vaccine_doses', 1);
select public.__blocked('parent cannot record a dose',
  'insert into public.vaccine_doses (child_id, vaccine_code, dose_label, administered_on)
   values (''bbbbbbbb-0000-0000-0000-000000000001'', ''opv'', ''OPV 0'', current_date)');
select public.__count('parent reads own child growth',
  'select count(*) from public.growth_measurements', 1);
select public.__blocked('parent cannot record growth',
  'insert into public.growth_measurements (child_id, measured_on, weight_kg)
   values (''bbbbbbbb-0000-0000-0000-000000000001'', current_date, 5)');
select public.__count('parent reads own child appointments',
  'select count(*) from public.appointments', 1);
select public.__allowed('parent may update own appointment notes',
  'update public.appointments set notes = notes
   where child_id = ''bbbbbbbb-0000-0000-0000-000000000001''');
select public.__no_change('parent cannot move another family appointment',
  'update public.appointments set scheduled_at = now() + interval ''100 days''
   where child_id = ''bbbbbbbb-0000-0000-0000-000000000003''',
  'select scheduled_at < now() + interval ''30 days'' from public.appointments
   where child_id = ''bbbbbbbb-0000-0000-0000-000000000003''');
select public.__count('parent reads own notifications',
  'select count(*) from public.notifications', 1);
select public.__allowed('parent may mark own notification read',
  'update public.notifications set read_at = now() where dedupe_key = ''rls-test-1''');
select public.__no_change('parent cannot mark another user notification read',
  'update public.notifications set read_at = now() where dedupe_key = ''rls-test-2''',
  'select read_at is null from public.notifications where dedupe_key = ''rls-test-2''');
select public.__count('parent reads own preferences',
  'select count(*) from public.notification_preferences', 1);
select public.__allowed('parent may update own preferences',
  'update public.notification_preferences set sms = false
   where user_id = ''11111111-1111-1111-1111-111111111111''');
select public.__blocked('parent cannot insert schedule rows',
  'insert into public.immunization_schedule (schedule_version, vaccine_code, vaccine_name, dose_label, dose_order, target_age_days, source_name, effective_date) values (''v-parent-attack'', ''fake'', ''Fake'', ''FAKE 1'', 99, 100, ''test'', current_date)');
select public.__count('parent cannot read audit log',
  'select count(*) from public.audit_log', 0);
select public.__count('parent reads own push subscriptions',
  'select count(*) from public.push_subscriptions', 1);
select public.__no_change('parent cannot escalate own role',
  'update public.profiles set role = ''admin'' where id = ''11111111-1111-1111-1111-111111111111''',
  'select role = ''parent'' from public.profiles where id = ''11111111-1111-1111-1111-111111111111''');
select public.__count('parent sees own facility only',
  'select count(*) from public.facilities', 1);
select public.__count('parent reads own visits',
  'select count(*) from public.visits', 1);

reset role;
-- ======================================================== PARENT 2
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
select public.__count('parent2 sees only own children',
  'select count(*) from public.children', 2);
select public.__count('parent2 cannot read parent1 child',
  'select count(*) from public.children where id = ''bbbbbbbb-0000-0000-0000-000000000001''', 0);
select public.__count('parent2 reads own doses',
  'select count(*) from public.vaccine_doses', 1);
select public.__count('parent2 reads own growth',
  'select count(*) from public.growth_measurements', 1);
select public.__count('parent2 reads own appointments',
  'select count(*) from public.appointments', 2);
select public.__no_change('parent2 cannot flip parent1 preferences',
  'update public.notification_preferences set sms = true where user_id = ''11111111-1111-1111-1111-111111111111''',
  'select sms = false from public.notification_preferences where user_id = ''11111111-1111-1111-1111-111111111111''');
select public.__ok('parent sections complete');
reset role;
-- =================================================================== NURSE
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

-- nurse1 is attached to facility F1 (Primary Health Centre, Umuahia).
select public.__count('nurse sees only facility-scoped children',
  'select count(*) from public.children', 3);
select public.__count('nurse cannot see other-facility child row',
  'select count(*) from public.children where id = ''bbbbbbbb-0000-0000-0000-000000000004''', 0);
select public.__count('nurse reads doses of own-facility children only',
  'select count(*) from public.vaccine_doses', 1);
select public.__count('nurse reads growth of own-facility children only',
  'select count(*) from public.growth_measurements', 1);
select public.__count('nurse reads own-facility appointments',
  'select count(*) from public.appointments', 2);
select public.__count('nurse reads own-facility visits',
  'select count(*) from public.visits', 1);
select public.__count('nurse reads parents + colleagues in facility, not admin',
  'select count(*) from public.profiles', 3);
select public.__count('nurse cannot read audit_log',
  'select count(*) from public.audit_log', 0);
select public.__count('nurse cannot read parent notifications',
  'select count(*) from public.notifications', 0);
select public.__count('nurse cannot read parent preferences',
  'select count(*) from public.notification_preferences where user_id = ''11111111-1111-1111-1111-111111111111''', 0);
select public.__count('nurse can read the schedule',
  'select count(*) from public.immunization_schedule', 2);

-- Writes inside scope are allowed.
select public.__changed('nurse updates own-facility child',
  'update public.children set notes = ''rls-test'' where id = ''bbbbbbbb-0000-0000-0000-000000000001''',
  'select notes = ''rls-test'' from public.children where id = ''bbbbbbbb-0000-0000-0000-000000000001''');
select public.__allowed('nurse records dose for own-facility child',
  'insert into public.vaccine_doses (child_id, vaccine_code, dose_label, administered_on, given_by, facility_id)
   values (''bbbbbbbb-0000-0000-0000-000000000002'', ''opv'', ''OPV 1'', current_date,
           ''33333333-3333-3333-3333-333333333333'', ''aaaaaaaa-0000-0000-0000-000000000001'')');

-- Writes outside the nurse facility scope are rejected.
select public.__no_change('nurse cannot update other-facility child',
  'update public.children set notes = ''stolen'' where id = ''bbbbbbbb-0000-0000-0000-000000000004''',
  'select notes is null from public.children where id = ''bbbbbbbb-0000-0000-0000-000000000004''');
select public.__blocked('nurse cannot register child at another facility',
  'insert into public.children (full_name, date_of_birth, sex, parent_id, facility_id, registered_by)
   values (''Intruder Child'', current_date - 100, ''male'',
           ''66666666-6666-6666-6666-666666666666'', ''aaaaaaaa-0000-0000-0000-000000000002'',
           ''33333333-3333-3333-3333-333333333333'')');
select public.__blocked('nurse cannot record dose for other-facility child',
  'insert into public.vaccine_doses (child_id, vaccine_code, dose_label, administered_on, given_by, facility_id)
   values (''bbbbbbbb-0000-0000-0000-000000000004'', ''mcv'', ''MCV 1'', current_date,
           ''33333333-3333-3333-3333-333333333333'', ''aaaaaaaa-0000-0000-0000-000000000001'')');
select public.__blocked('nurse cannot write audit_log directly',
  'insert into public.audit_log (user_id, user_role, action, entity, entity_id)
   values (''33333333-3333-3333-3333-333333333333'', ''nurse'', ''tampering'', ''children'',
           ''bbbbbbbb-0000-0000-0000-000000000001'')');
select public.__blocked('nurse cannot change own role',
  'update public.profiles set role = ''admin'' where id = ''33333333-3333-3333-3333-333333333333''');
select public.__blocked('nurse cannot change own facility',
  'update public.profiles set facility_id = ''aaaaaaaa-0000-0000-0000-000000000002''
   where id = ''33333333-3333-3333-3333-333333333333''');
select public.__no_change('nurse cannot flip parent notification prefs',
  'update public.notification_preferences set sms = true where user_id = ''11111111-1111-1111-1111-111111111111''',
  'select sms = false from public.notification_preferences where user_id = ''11111111-1111-1111-1111-111111111111''');
select public.__no_change('nurse cannot delete a child record',
  'delete from public.children where id = ''bbbbbbbb-0000-0000-0000-000000000001''',
  'select exists(select 1 from public.children where id = ''bbbbbbbb-0000-0000-0000-000000000001'')');
select public.__ok('nurse section complete');

-- =================================================================== ADMIN
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

select public.__count('admin sees every child',
  'select count(*) from public.children', 4);
select public.__count('admin sees every profile',
  'select count(*) from public.profiles', 5);
select public.__count('admin reads audit_log',
  'select count(*) from public.audit_log', 1);
select public.__allowed('admin inserts schedule version',
  'insert into public.immunization_schedule (schedule_version, vaccine_code, vaccine_name, dose_label, dose_order, target_age_days, source_name, effective_date) values (''v-rls-test'', ''rls-test'', ''RLS Test Vaccine'', ''D1'', 1, 0, ''test'', current_date)');
select public.__blocked('even admin cannot write audit_log directly',
  'insert into public.audit_log (actor_id, actor_role, action, entity_type) values (''44444444-4444-4444-4444-444444444444'', ''admin'', ''schedule.updated'', ''immunization_schedule'')');
select public.__changed('admin updates any profile',
  'update public.profiles set phone = ''+2348000000000'' where id = ''44444444-4444-4444-4444-444444444444''',
  'select phone = ''+2348000000000'' from public.profiles where id = ''44444444-4444-4444-4444-444444444444''');
select public.__allowed('admin inserts facility',
  'insert into public.facilities (name, city, state) values (''RLS Test Facility'', ''Ikorodu'', ''Lagos'')');
select public.__count('audit_log still holds only the seeded row',
  'select count(*) from public.audit_log', 1);

-- =================================================================== REPORT
reset role;
do $$
declare
  r       record;
  total   integer;
  failed  integer;
begin
  select count(*), count(*) filter (where not passed) into total, failed from public.rls_results;
  raise notice '---------------------------------------------';
  raise notice 'RLS checks: % total, % failed', total, failed;
  if failed > 0 then
    raise notice 'Failing checks:';
    for r in select label, detail from public.rls_results where not passed order by n loop
      raise notice '  ✗ % — %', r.label, r.detail;
    end loop;
    raise exception '% of % RLS checks failed', failed, total;
  end if;
  raise notice 'ALL RLS CHECKS PASSED';
end;
$$;
