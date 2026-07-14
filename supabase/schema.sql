-- FitTrack schema for Supabase (Postgres + RLS).
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
--
-- Every table is scoped to the signed-in user via user_id + row-level
-- security, so the public anon key in the app bundle can only ever touch
-- rows belonging to the authenticated account.

create table profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  unit_system text not null default 'imperial',
  daily_calorie_target double precision,
  daily_protein_target_g double precision,
  daily_carb_target_g double precision,
  daily_fat_target_g double precision,
  created_at timestamptz not null default now()
);

create table foods (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  serving_size double precision not null default 1,
  serving_unit text not null default 'serving',
  calories double precision not null default 0,
  protein_g double precision not null default 0,
  carbs_g double precision not null default 0,
  fat_g double precision not null default 0,
  created_at timestamptz not null default now()
);

create table food_logs (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id uuid references foods (id) on delete cascade,
  logged_date text not null, -- local YYYY-MM-DD day key (not a UTC date)
  logged_at timestamptz,
  meal text not null,
  quantity double precision not null default 1,
  name text,
  calories double precision,
  protein_g double precision,
  carbs_g double precision,
  fat_g double precision,
  created_at timestamptz not null default now()
);

create table exercises (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  category text not null,
  muscle_group text,
  modality text,
  created_at timestamptz not null default now()
);

create table workout_plans (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type text not null,
  schedule_notes text,
  created_at timestamptz not null default now()
);

create table plan_exercises (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null references workout_plans (id) on delete cascade,
  exercise_id uuid not null references exercises (id) on delete cascade,
  order_index integer not null default 0,
  target_sets integer,
  target_reps integer,
  target_weight double precision,
  target_distance double precision,
  target_duration_sec integer,
  target_pace text
);

create table workout_logs (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid references workout_plans (id) on delete set null,
  logged_date text not null,
  duration_min double precision,
  notes text,
  created_at timestamptz not null default now()
);

create table workout_log_sets (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workout_log_id uuid not null references workout_logs (id) on delete cascade,
  exercise_id uuid not null references exercises (id) on delete cascade,
  set_number integer,
  reps integer,
  weight double precision,
  distance double precision,
  duration_sec integer,
  pace text
);

create table body_metrics (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_date text not null,
  weight double precision,
  body_fat_pct double precision,
  measurements jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, logged_date)
);

-- The 12-week training plan tab stores its whole log as one JSON document.
create table training_plan (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Row-level security: each user sees only their own rows.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','foods','food_logs','exercises','workout_plans',
    'plan_exercises','workout_logs','workout_log_sets','body_metrics','training_plan'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "own rows" on %I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t
    );
  end loop;
end $$;
