// Data-access layer with two interchangeable backends behind one set of
// function signatures:
//   - local: localStorage "tables" (storage.ts), used when Supabase
//     credentials are absent — data stays in this browser only.
//   - cloud: Supabase Postgres scoped to the signed-in user via RLS
//     (supabase/schema.sql), used when supabaseConfig.ts is filled in.
// Page components never know which backend is active.

import { newId, nowIso, readSingleton, readTable, writeSingleton, writeTable } from './storage'
import { cloudEnabled, must, supabase, uid } from './supabase'
import type {
  BodyMetric,
  Exercise,
  Food,
  FoodLog,
  Meal,
  PlanExercise,
  Profile,
  WorkoutLog,
  WorkoutLogSet,
  WorkoutPlan,
} from '../types/database'

function mustFind<T extends { id: string }>(table: string, id: string): T {
  const row = readTable<T>(table).find((r) => r.id === id)
  if (!row) throw new Error(`${table} row ${id} not found`)
  return row
}

// ── profile (singleton) ──────────────────────────────────────
const DEFAULT_PROFILE: Omit<Profile, 'id' | 'created_at'> = {
  display_name: 'Me',
  unit_system: 'imperial',
  daily_calorie_target: null,
  daily_protein_target_g: null,
  daily_carb_target_g: null,
  daily_fat_target_g: null,
}

function profileFromCloudRow(row: Record<string, unknown>): Profile {
  const { user_id, ...rest } = row
  return { id: user_id, ...rest } as Profile
}

export async function getProfile(): Promise<Profile> {
  if (cloudEnabled) {
    const userId = await uid()
    const existing = must(
      await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle()
    ) as Record<string, unknown> | null
    if (existing) return profileFromCloudRow(existing)
    const created = must(
      await supabase
        .from('profiles')
        .insert({ user_id: userId, ...DEFAULT_PROFILE })
        .select()
        .single()
    ) as Record<string, unknown>
    return profileFromCloudRow(created)
  }
  const existing = readSingleton<Profile>('profile')
  if (existing) return existing
  const created: Profile = { id: newId(), created_at: nowIso(), ...DEFAULT_PROFILE }
  writeSingleton('profile', created)
  return created
}

export async function updateProfile(patch: Partial<Omit<Profile, 'id'>>): Promise<Profile> {
  if (cloudEnabled) {
    await getProfile() // ensure the row exists
    const updated = must(
      await supabase
        .from('profiles')
        .update(patch)
        .eq('user_id', await uid())
        .select()
        .single()
    ) as Record<string, unknown>
    return profileFromCloudRow(updated)
  }
  const current = await getProfile()
  const updated = { ...current, ...patch }
  writeSingleton('profile', updated)
  return updated
}

// ── foods ─────────────────────────────────────────────────
export async function listFoods(): Promise<Food[]> {
  if (cloudEnabled) {
    return must(await supabase.from('foods').select('*').order('name'))
  }
  return readTable<Food>('foods').sort((a, b) => a.name.localeCompare(b.name))
}

export async function createFood(food: Omit<Food, 'id' | 'created_at'>): Promise<Food> {
  const row: Food = { id: newId(), created_at: nowIso(), ...food }
  if (cloudEnabled) {
    return must(
      await supabase
        .from('foods')
        .insert({ ...row, user_id: await uid() })
        .select()
        .single()
    )
  }
  writeTable('foods', [...readTable<Food>('foods'), row])
  return row
}

export async function deleteFood(id: string): Promise<void> {
  if (cloudEnabled) {
    // FK cascade removes this food's food_logs server-side.
    must(await supabase.from('foods').delete().eq('id', id).select())
    return
  }
  writeTable(
    'foods',
    readTable<Food>('foods').filter((f) => f.id !== id)
  )
  writeTable(
    'food_logs',
    readTable<FoodLog>('food_logs').filter((l) => l.food_id !== id)
  )
}

// ── food logs ─────────────────────────────────────────────
export type FoodLogWithFood = FoodLog & { food: Food | null }

function joinFood(logs: FoodLog[]): FoodLogWithFood[] {
  const foods = readTable<Food>('foods')
  return logs.map((l) => ({ ...l, food: foods.find((f) => f.id === l.food_id) ?? null }))
}

// Consumption time for ordering/display: logged_at when present,
// otherwise fall back to when the row was created (legacy rows).
export function logTimestamp(log: FoodLog): string {
  return log.logged_at ?? log.created_at
}

export function logEntryName(log: FoodLogWithFood): string {
  return log.food?.name ?? log.name ?? 'Entry'
}

// Effective macros for one log row (quantity applied), regardless of
// whether it references a library food or carries inline quick-add values.
export function logEntryMacros(log: FoodLogWithFood): {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
} {
  const src = log.food ?? {
    calories: log.calories ?? 0,
    protein_g: log.protein_g ?? 0,
    carbs_g: log.carbs_g ?? 0,
    fat_g: log.fat_g ?? 0,
  }
  const q = log.quantity
  return {
    calories: src.calories * q,
    protein_g: src.protein_g * q,
    carbs_g: src.carbs_g * q,
    fat_g: src.fat_g * q,
  }
}

export async function listFoodLogsForDate(date: string): Promise<FoodLogWithFood[]> {
  if (cloudEnabled) {
    const logs = must(
      await supabase.from('food_logs').select('*, food:foods(*)').eq('logged_date', date)
    ) as FoodLogWithFood[]
    return logs.sort((a, b) => logTimestamp(a).localeCompare(logTimestamp(b)))
  }
  const logs = readTable<FoodLog>('food_logs')
    .filter((l) => l.logged_date === date)
    .sort((a, b) => logTimestamp(a).localeCompare(logTimestamp(b)))
  return joinFood(logs)
}

export async function listFoodLogsInRange(
  startDate: string,
  endDate: string
): Promise<FoodLogWithFood[]> {
  if (cloudEnabled) {
    return must(
      await supabase
        .from('food_logs')
        .select('*, food:foods(*)')
        .gte('logged_date', startDate)
        .lte('logged_date', endDate)
    ) as FoodLogWithFood[]
  }
  const logs = readTable<FoodLog>('food_logs').filter(
    (l) => l.logged_date >= startDate && l.logged_date <= endDate
  )
  return joinFood(logs)
}

export async function createFoodLog(log: {
  logged_date: string
  meal: Meal
  quantity: number
  food_id?: string | null
  logged_at?: string | null
  name?: string | null
  calories?: number | null
  protein_g?: number | null
  carbs_g?: number | null
  fat_g?: number | null
}): Promise<FoodLog> {
  const row: FoodLog = {
    id: newId(),
    created_at: nowIso(),
    logged_date: log.logged_date,
    meal: log.meal,
    quantity: log.quantity,
    food_id: log.food_id ?? null,
    logged_at: log.logged_at ?? null,
    name: log.name ?? null,
    calories: log.calories ?? null,
    protein_g: log.protein_g ?? null,
    carbs_g: log.carbs_g ?? null,
    fat_g: log.fat_g ?? null,
  }
  if (cloudEnabled) {
    return must(
      await supabase
        .from('food_logs')
        .insert({ ...row, user_id: await uid() })
        .select()
        .single()
    )
  }
  writeTable('food_logs', [...readTable<FoodLog>('food_logs'), row])
  return row
}

export async function deleteFoodLog(id: string): Promise<void> {
  if (cloudEnabled) {
    must(await supabase.from('food_logs').delete().eq('id', id).select())
    return
  }
  writeTable(
    'food_logs',
    readTable<FoodLog>('food_logs').filter((l) => l.id !== id)
  )
}

// ── exercises ─────────────────────────────────────────────
export async function listExercises(): Promise<Exercise[]> {
  if (cloudEnabled) {
    return must(await supabase.from('exercises').select('*').order('name'))
  }
  return readTable<Exercise>('exercises').sort((a, b) => a.name.localeCompare(b.name))
}

export async function createExercise(
  exercise: Omit<Exercise, 'id' | 'created_at'>
): Promise<Exercise> {
  const row: Exercise = { id: newId(), created_at: nowIso(), ...exercise }
  if (cloudEnabled) {
    return must(
      await supabase
        .from('exercises')
        .insert({ ...row, user_id: await uid() })
        .select()
        .single()
    )
  }
  writeTable('exercises', [...readTable<Exercise>('exercises'), row])
  return row
}

export async function deleteExercise(id: string): Promise<void> {
  if (cloudEnabled) {
    // FK cascade removes plan_exercises and workout_log_sets server-side.
    must(await supabase.from('exercises').delete().eq('id', id).select())
    return
  }
  writeTable(
    'exercises',
    readTable<Exercise>('exercises').filter((e) => e.id !== id)
  )
  writeTable(
    'plan_exercises',
    readTable<PlanExercise>('plan_exercises').filter((pe) => pe.exercise_id !== id)
  )
  writeTable(
    'workout_log_sets',
    readTable<WorkoutLogSet>('workout_log_sets').filter((s) => s.exercise_id !== id)
  )
}

// ── workout plans ─────────────────────────────────────────
export async function listWorkoutPlans(): Promise<WorkoutPlan[]> {
  if (cloudEnabled) {
    return must(
      await supabase.from('workout_plans').select('*').order('created_at', { ascending: false })
    )
  }
  return readTable<WorkoutPlan>('workout_plans').sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  )
}

export async function createWorkoutPlan(
  plan: Omit<WorkoutPlan, 'id' | 'created_at'>
): Promise<WorkoutPlan> {
  const row: WorkoutPlan = { id: newId(), created_at: nowIso(), ...plan }
  if (cloudEnabled) {
    return must(
      await supabase
        .from('workout_plans')
        .insert({ ...row, user_id: await uid() })
        .select()
        .single()
    )
  }
  writeTable('workout_plans', [...readTable<WorkoutPlan>('workout_plans'), row])
  return row
}

export async function deleteWorkoutPlan(id: string): Promise<void> {
  if (cloudEnabled) {
    // FK cascade removes plan_exercises; workout_logs.plan_id is set null.
    must(await supabase.from('workout_plans').delete().eq('id', id).select())
    return
  }
  writeTable(
    'workout_plans',
    readTable<WorkoutPlan>('workout_plans').filter((p) => p.id !== id)
  )
  writeTable(
    'plan_exercises',
    readTable<PlanExercise>('plan_exercises').filter((pe) => pe.plan_id !== id)
  )
  writeTable(
    'workout_logs',
    readTable<WorkoutLog>('workout_logs').map((l) =>
      l.plan_id === id ? { ...l, plan_id: null } : l
    )
  )
}

export type PlanExerciseWithExercise = PlanExercise & { exercise: Exercise }

export async function getWorkoutPlan(planId: string): Promise<WorkoutPlan> {
  if (cloudEnabled) {
    return must(await supabase.from('workout_plans').select('*').eq('id', planId).single())
  }
  return mustFind<WorkoutPlan>('workout_plans', planId)
}

export async function listPlanExercises(planId: string): Promise<PlanExerciseWithExercise[]> {
  if (cloudEnabled) {
    const rows = must(
      await supabase
        .from('plan_exercises')
        .select('*, exercise:exercises(*)')
        .eq('plan_id', planId)
        .order('order_index')
    ) as PlanExerciseWithExercise[]
    return rows
  }
  const exercises = readTable<Exercise>('exercises')
  return readTable<PlanExercise>('plan_exercises')
    .filter((pe) => pe.plan_id === planId)
    .sort((a, b) => a.order_index - b.order_index)
    .map((pe) => ({ ...pe, exercise: exercises.find((e) => e.id === pe.exercise_id)! }))
}

export async function addPlanExercise(pe: Omit<PlanExercise, 'id'>): Promise<PlanExercise> {
  const row: PlanExercise = { id: newId(), ...pe }
  if (cloudEnabled) {
    return must(
      await supabase
        .from('plan_exercises')
        .insert({ ...row, user_id: await uid() })
        .select()
        .single()
    )
  }
  writeTable('plan_exercises', [...readTable<PlanExercise>('plan_exercises'), row])
  return row
}

export async function deletePlanExercise(id: string): Promise<void> {
  if (cloudEnabled) {
    must(await supabase.from('plan_exercises').delete().eq('id', id).select())
    return
  }
  writeTable(
    'plan_exercises',
    readTable<PlanExercise>('plan_exercises').filter((pe) => pe.id !== id)
  )
}

// ── workout logs ──────────────────────────────────────────
export async function listWorkoutLogs(): Promise<WorkoutLog[]> {
  if (cloudEnabled) {
    return must(
      await supabase.from('workout_logs').select('*').order('logged_date', { ascending: false })
    )
  }
  return readTable<WorkoutLog>('workout_logs').sort((a, b) =>
    b.logged_date.localeCompare(a.logged_date)
  )
}

export async function listWorkoutLogsInRange(
  startDate: string,
  endDate: string
): Promise<WorkoutLog[]> {
  if (cloudEnabled) {
    return must(
      await supabase
        .from('workout_logs')
        .select('*')
        .gte('logged_date', startDate)
        .lte('logged_date', endDate)
    )
  }
  return readTable<WorkoutLog>('workout_logs').filter(
    (l) => l.logged_date >= startDate && l.logged_date <= endDate
  )
}

export async function getWorkoutLog(id: string): Promise<WorkoutLog> {
  if (cloudEnabled) {
    return must(await supabase.from('workout_logs').select('*').eq('id', id).single())
  }
  return mustFind<WorkoutLog>('workout_logs', id)
}

export async function createWorkoutLog(
  log: Omit<WorkoutLog, 'id' | 'created_at'>
): Promise<WorkoutLog> {
  const row: WorkoutLog = { id: newId(), created_at: nowIso(), ...log }
  if (cloudEnabled) {
    return must(
      await supabase
        .from('workout_logs')
        .insert({ ...row, user_id: await uid() })
        .select()
        .single()
    )
  }
  writeTable('workout_logs', [...readTable<WorkoutLog>('workout_logs'), row])
  return row
}

export async function updateWorkoutLog(
  id: string,
  patch: Partial<Omit<WorkoutLog, 'id'>>
): Promise<WorkoutLog> {
  if (cloudEnabled) {
    return must(
      await supabase.from('workout_logs').update(patch).eq('id', id).select().single()
    )
  }
  const rows = readTable<WorkoutLog>('workout_logs')
  const updated = { ...mustFind<WorkoutLog>('workout_logs', id), ...patch }
  writeTable(
    'workout_logs',
    rows.map((r) => (r.id === id ? updated : r))
  )
  return updated
}

export async function deleteWorkoutLog(id: string): Promise<void> {
  if (cloudEnabled) {
    // FK cascade removes this log's workout_log_sets server-side.
    must(await supabase.from('workout_logs').delete().eq('id', id).select())
    return
  }
  writeTable(
    'workout_logs',
    readTable<WorkoutLog>('workout_logs').filter((l) => l.id !== id)
  )
  writeTable(
    'workout_log_sets',
    readTable<WorkoutLogSet>('workout_log_sets').filter((s) => s.workout_log_id !== id)
  )
}

export type WorkoutLogSetWithExercise = WorkoutLogSet & { exercise: Exercise }

export async function listWorkoutLogSets(
  workoutLogId: string
): Promise<WorkoutLogSetWithExercise[]> {
  if (cloudEnabled) {
    const rows = must(
      await supabase
        .from('workout_log_sets')
        .select('*, exercise:exercises(*)')
        .eq('workout_log_id', workoutLogId)
    ) as WorkoutLogSetWithExercise[]
    return rows.sort((a, b) => (a.set_number ?? 0) - (b.set_number ?? 0))
  }
  const exercises = readTable<Exercise>('exercises')
  return readTable<WorkoutLogSet>('workout_log_sets')
    .filter((s) => s.workout_log_id === workoutLogId)
    .sort((a, b) => (a.set_number ?? 0) - (b.set_number ?? 0))
    .map((s) => ({ ...s, exercise: exercises.find((e) => e.id === s.exercise_id)! }))
}

export async function addWorkoutLogSet(set: Omit<WorkoutLogSet, 'id'>): Promise<WorkoutLogSet> {
  const row: WorkoutLogSet = { id: newId(), ...set }
  if (cloudEnabled) {
    return must(
      await supabase
        .from('workout_log_sets')
        .insert({ ...row, user_id: await uid() })
        .select()
        .single()
    )
  }
  writeTable('workout_log_sets', [...readTable<WorkoutLogSet>('workout_log_sets'), row])
  return row
}

export async function updateWorkoutLogSet(
  id: string,
  patch: Partial<Omit<WorkoutLogSet, 'id'>>
): Promise<WorkoutLogSet> {
  if (cloudEnabled) {
    return must(
      await supabase.from('workout_log_sets').update(patch).eq('id', id).select().single()
    )
  }
  const rows = readTable<WorkoutLogSet>('workout_log_sets')
  const updated = { ...mustFind<WorkoutLogSet>('workout_log_sets', id), ...patch }
  writeTable(
    'workout_log_sets',
    rows.map((r) => (r.id === id ? updated : r))
  )
  return updated
}

export async function deleteWorkoutLogSet(id: string): Promise<void> {
  if (cloudEnabled) {
    must(await supabase.from('workout_log_sets').delete().eq('id', id).select())
    return
  }
  writeTable(
    'workout_log_sets',
    readTable<WorkoutLogSet>('workout_log_sets').filter((s) => s.id !== id)
  )
}

// ── body metrics ──────────────────────────────────────────
export async function listBodyMetricsInRange(
  startDate: string,
  endDate: string
): Promise<BodyMetric[]> {
  if (cloudEnabled) {
    return must(
      await supabase
        .from('body_metrics')
        .select('*')
        .gte('logged_date', startDate)
        .lte('logged_date', endDate)
        .order('logged_date')
    )
  }
  return readTable<BodyMetric>('body_metrics')
    .filter((m) => m.logged_date >= startDate && m.logged_date <= endDate)
    .sort((a, b) => a.logged_date.localeCompare(b.logged_date))
}

export async function upsertBodyMetric(
  metric: Omit<BodyMetric, 'id' | 'created_at'>
): Promise<BodyMetric> {
  if (cloudEnabled) {
    const userId = await uid()
    const existing = must(
      await supabase
        .from('body_metrics')
        .select('*')
        .eq('logged_date', metric.logged_date)
        .maybeSingle()
    )
    if (existing) {
      return must(
        await supabase
          .from('body_metrics')
          .update(metric)
          .eq('id', (existing as BodyMetric).id)
          .select()
          .single()
      )
    }
    return must(
      await supabase
        .from('body_metrics')
        .insert({ id: newId(), user_id: userId, ...metric })
        .select()
        .single()
    )
  }
  const rows = readTable<BodyMetric>('body_metrics')
  const existing = rows.find((m) => m.logged_date === metric.logged_date)
  const row: BodyMetric = existing
    ? { ...existing, ...metric }
    : { id: newId(), created_at: nowIso(), ...metric }
  writeTable(
    'body_metrics',
    existing ? rows.map((m) => (m.id === row.id ? row : m)) : [...rows, row]
  )
  return row
}

// ── training plan (12-week tab, one JSON document) ────────
export async function getTrainingPlanData(): Promise<Record<string, unknown> | null> {
  if (cloudEnabled) {
    const row = must(
      await supabase.from('training_plan').select('data').maybeSingle()
    ) as { data: Record<string, unknown> } | null
    return row?.data ?? null
  }
  return readSingleton('training_plan')
}

export async function saveTrainingPlanData(data: Record<string, unknown>): Promise<void> {
  if (cloudEnabled) {
    must(
      await supabase
        .from('training_plan')
        .upsert({ user_id: await uid(), data, updated_at: nowIso() })
        .select()
    )
    return
  }
  writeSingleton('training_plan', data)
}
