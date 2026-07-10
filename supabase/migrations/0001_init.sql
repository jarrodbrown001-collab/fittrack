-- FitTrack initial schema
-- Run this in the Supabase SQL editor (or via `supabase db push`) on a fresh project.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  unit_system text not null default 'imperial' check (unit_system in ('imperial', 'metric')),
  daily_calorie_target int,
  daily_protein_target_g int,
  daily_carb_target_g int,
  daily_fat_target_g int,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- foods
-- ─────────────────────────────────────────────────────────────
create table public.foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
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

create policy "foods_all_own" on public.foods
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- food_logs
-- ─────────────────────────────────────────────────────────────
create table public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete cascade,
  logged_date date not null,
  meal text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  quantity numeric not null default 1,
  created_at timestamptz not null default now()
);

alter table public.food_logs enable row level security;

create policy "food_logs_all_own" on public.food_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index food_logs_user_date_idx on public.food_logs (user_id, logged_date);

-- ─────────────────────────────────────────────────────────────
-- exercises
-- ─────────────────────────────────────────────────────────────
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  category text not null check (category in ('strength', 'cardio')),
  muscle_group text,
  modality text,
  created_at timestamptz not null default now()
);

alter table public.exercises enable row level security;

create policy "exercises_all_own" on public.exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- workout_plans
-- ─────────────────────────────────────────────────────────────
create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type text not null check (type in ('strength', 'cardio', 'mixed')),
  schedule_notes text,
  created_at timestamptz not null default now()
);

alter table public.workout_plans enable row level security;

create policy "workout_plans_all_own" on public.workout_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- plan_exercises (scoped through parent workout_plans, no user_id column)
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

create policy "plan_exercises_all_own" on public.plan_exercises
  for all using (
    exists (
      select 1 from public.workout_plans wp
      where wp.id = plan_exercises.plan_id and wp.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.workout_plans wp
      where wp.id = plan_exercises.plan_id and wp.user_id = auth.uid()
    )
  );

create index plan_exercises_plan_idx on public.plan_exercises (plan_id, order_index);

-- ─────────────────────────────────────────────────────────────
-- workout_logs
-- ─────────────────────────────────────────────────────────────
create table public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid references public.workout_plans (id) on delete set null,
  logged_date date not null,
  duration_min int,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.workout_logs enable row level security;

create policy "workout_logs_all_own" on public.workout_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index workout_logs_user_date_idx on public.workout_logs (user_id, logged_date);

-- ─────────────────────────────────────────────────────────────
-- workout_log_sets (scoped through parent workout_logs, no user_id column)
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

create policy "workout_log_sets_all_own" on public.workout_log_sets
  for all using (
    exists (
      select 1 from public.workout_logs wl
      where wl.id = workout_log_sets.workout_log_id and wl.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.workout_logs wl
      where wl.id = workout_log_sets.workout_log_id and wl.user_id = auth.uid()
    )
  );

create index workout_log_sets_log_idx on public.workout_log_sets (workout_log_id);

-- ─────────────────────────────────────────────────────────────
-- body_metrics
-- ─────────────────────────────────────────────────────────────
create table public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_date date not null,
  weight numeric,
  body_fat_pct numeric,
  measurements jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, logged_date)
);

alter table public.body_metrics enable row level security;

create policy "body_metrics_all_own" on public.body_metrics
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index body_metrics_user_date_idx on public.body_metrics (user_id, logged_date);
