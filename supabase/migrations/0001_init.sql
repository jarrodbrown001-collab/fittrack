-- FitTrack initial schema (single-user, no auth)
-- Run this in the Supabase SQL editor (or via `supabase db push`) on a fresh project.
--
-- There is no login. Every table is open to the `anon` role via permissive RLS
-- policies (kept enabled, but with `using (true)`) rather than left unprotected —
-- this is a personal single-user app, not a multi-tenant one. Do not point this
-- schema at a project whose anon key you'd mind being read/write-able by anyone
-- who has it.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────
-- profiles — singleton row (app always reads/writes the one row)
-- ─────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  display_name text,
  unit_system text not null default 'imperial' check (unit_system in ('imperial', 'metric')),
  daily_calorie_target int,
  daily_protein_target_g int,
  daily_carb_target_g int,
  daily_fat_target_g int,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_all" on public.profiles
  for all using (true) with check (true);

insert into public.profiles (id, display_name) values
  ('00000000-0000-0000-0000-000000000001', 'Me');

-- ─────────────────────────────────────────────────────────────
-- foods
-- ─────────────────────────────────────────────────────────────
create table public.foods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  serving_size numeric not null,
  serving_unit text not null,
  calories numeric not null default 0,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table public.foods enable row level security;

create policy "foods_all" on public.foods
  for all using (true) with check (true);

-- ─────────────────────────────────────────────────────────────
-- food_logs
-- ─────────────────────────────────────────────────────────────
create table public.food_logs (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.foods (id) on delete cascade,
  logged_date date not null,
  meal text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  quantity numeric not null default 1,
  created_at timestamptz not null default now()
);

alter table public.food_logs enable row level security;

create policy "food_logs_all" on public.food_logs
  for all using (true) with check (true);

create index food_logs_date_idx on public.food_logs (logged_date);

-- ─────────────────────────────────────────────────────────────
-- exercises
-- ─────────────────────────────────────────────────────────────
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('strength', 'cardio')),
  muscle_group text,
  modality text,
  created_at timestamptz not null default now()
);

alter table public.exercises enable row level security;

create policy "exercises_all" on public.exercises
  for all using (true) with check (true);

-- ─────────────────────────────────────────────────────────────
-- workout_plans
-- ─────────────────────────────────────────────────────────────
create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('strength', 'cardio', 'mixed')),
  schedule_notes text,
  created_at timestamptz not null default now()
);

alter table public.workout_plans enable row level security;

create policy "workout_plans_all" on public.workout_plans
  for all using (true) with check (true);

-- ─────────────────────────────────────────────────────────────
-- plan_exercises
-- ─────────────────────────────────────────────────────────────
create table public.plan_exercises (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.workout_plans (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  order_index int not null default 0,
  target_sets int,
  target_reps int,
  target_weight numeric,
  target_distance numeric,
  target_duration_sec int,
  target_pace text
);

alter table public.plan_exercises enable row level security;

create policy "plan_exercises_all" on public.plan_exercises
  for all using (true) with check (true);

create index plan_exercises_plan_idx on public.plan_exercises (plan_id, order_index);

-- ─────────────────────────────────────────────────────────────
-- workout_logs
-- ─────────────────────────────────────────────────────────────
create table public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references public.workout_plans (id) on delete set null,
  logged_date date not null,
  duration_min int,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.workout_logs enable row level security;

create policy "workout_logs_all" on public.workout_logs
  for all using (true) with check (true);

create index workout_logs_date_idx on public.workout_logs (logged_date);

-- ─────────────────────────────────────────────────────────────
-- workout_log_sets
-- ─────────────────────────────────────────────────────────────
create table public.workout_log_sets (
  id uuid primary key default gen_random_uuid(),
  workout_log_id uuid not null references public.workout_logs (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  set_number int,
  reps int,
  weight numeric,
  distance numeric,
  duration_sec int,
  pace text
);

alter table public.workout_log_sets enable row level security;

create policy "workout_log_sets_all" on public.workout_log_sets
  for all using (true) with check (true);

create index workout_log_sets_log_idx on public.workout_log_sets (workout_log_id);

-- ─────────────────────────────────────────────────────────────
-- body_metrics
-- ─────────────────────────────────────────────────────────────
create table public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  logged_date date not null unique,
  weight numeric,
  body_fat_pct numeric,
  measurements jsonb,
  created_at timestamptz not null default now()
);

alter table public.body_metrics enable row level security;

create policy "body_metrics_all" on public.body_metrics
  for all using (true) with check (true);

create index body_metrics_date_idx on public.body_metrics (logged_date);
