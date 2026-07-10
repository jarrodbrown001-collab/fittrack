// Data-access layer. Everything is stored in the browser via localStorage
// (see src/lib/storage.ts) — there is no server, no network calls here.
// Functions stay async so call sites don't care that reads/writes are sync.

import { newId, nowIso, readSingleton, readTable, writeSingleton, writeTable } from './storage'
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

export async function getProfile(): Promise<Profile> {
  const existing = readSingleton<Profile>('profile')
  if (existing) return existing
  const created: Profile = { id: newId(), created_at: nowIso(), ...DEFAULT_PROFILE }
  writeSingleton('profile', created)
  return created
}

export async function updateProfile(patch: Partial<Omit<Profile, 'id'>>): Promise<Profile> {
  const current = await getProfile()
  const updated = { ...current, ...patch }
  writeSingleton('profile', updated)
  return updated
}

// ── foods ─────────────────────────────────────────────────
export async function listFoods(): Promise<Food[]> {
  return readTable<Food>('foods').sort((a, b) => a.name.localeCompare(b.name))
}

export async function createFood(food: Omit<Food, 'id' | 'created_at'>): Promise<Food> {
  const row: Food = { id: newId(), created_at: nowIso(), ...food }
  writeTable('foods', [...readTable<Food>('foods'), row])
  return row
}

export async function deleteFood(id: string): Promise<void> {
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
export type FoodLogWithFood = FoodLog & { food: Food }

function joinFood(logs: FoodLog[]): FoodLogWithFood[] {
  const foods = readTable<Food>('foods')
  return logs.map((l) => ({ ...l, food: foods.find((f) => f.id === l.food_id)! }))
}

export async function listFoodLogsForDate(date: string): Promise<FoodLogWithFood[]> {
  const logs = readTable<FoodLog>('food_logs')
    .filter((l) => l.logged_date === date)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
  return joinFood(logs)
}

export async function listFoodLogsInRange(
  startDate: string,
  endDate: string
): Promise<FoodLogWithFood[]> {
  const logs = readTable<FoodLog>('food_logs').filter(
    (l) => l.logged_date >= startDate && l.logged_date <= endDate
  )
  return joinFood(logs)
}

export async function createFoodLog(log: {
  food_id: string
  logged_date: string
  meal: Meal
  quantity: number
}): Promise<FoodLog> {
  const row: FoodLog = { id: newId(), created_at: nowIso(), ...log }
  writeTable('food_logs', [...readTable<FoodLog>('food_logs'), row])
  return row
}

export async function deleteFoodLog(id: string): Promise<void> {
  writeTable(
    'food_logs',
    readTable<FoodLog>('food_logs').filter((l) => l.id !== id)
  )
}

// ── exercises ─────────────────────────────────────────────
export async function listExercises(): Promise<Exercise[]> {
  return readTable<Exercise>('exercises').sort((a, b) => a.name.localeCompare(b.name))
}

export async function createExercise(
  exercise: Omit<Exercise, 'id' | 'created_at'>
): Promise<Exercise> {
  const row: Exercise = { id: newId(), created_at: nowIso(), ...exercise }
  writeTable('exercises', [...readTable<Exercise>('exercises'), row])
  return row
}

export async function deleteExercise(id: string): Promise<void> {
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
  return readTable<WorkoutPlan>('workout_plans').sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  )
}

export async function createWorkoutPlan(
  plan: Omit<WorkoutPlan, 'id' | 'created_at'>
): Promise<WorkoutPlan> {
  const row: WorkoutPlan = { id: newId(), created_at: nowIso(), ...plan }
  writeTable('workout_plans', [...readTable<WorkoutPlan>('workout_plans'), row])
  return row
}

export async function deleteWorkoutPlan(id: string): Promise<void> {
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
  return mustFind<WorkoutPlan>('workout_plans', planId)
}

export async function listPlanExercises(planId: string): Promise<PlanExerciseWithExercise[]> {
  const exercises = readTable<Exercise>('exercises')
  return readTable<PlanExercise>('plan_exercises')
    .filter((pe) => pe.plan_id === planId)
    .sort((a, b) => a.order_index - b.order_index)
    .map((pe) => ({ ...pe, exercise: exercises.find((e) => e.id === pe.exercise_id)! }))
}

export async function addPlanExercise(pe: Omit<PlanExercise, 'id'>): Promise<PlanExercise> {
  const row: PlanExercise = { id: newId(), ...pe }
  writeTable('plan_exercises', [...readTable<PlanExercise>('plan_exercises'), row])
  return row
}

export async function deletePlanExercise(id: string): Promise<void> {
  writeTable(
    'plan_exercises',
    readTable<PlanExercise>('plan_exercises').filter((pe) => pe.id !== id)
  )
}

// ── workout logs ──────────────────────────────────────────
export async function listWorkoutLogs(): Promise<WorkoutLog[]> {
  return readTable<WorkoutLog>('workout_logs').sort((a, b) =>
    b.logged_date.localeCompare(a.logged_date)
  )
}

export async function listWorkoutLogsInRange(
  startDate: string,
  endDate: string
): Promise<WorkoutLog[]> {
  return readTable<WorkoutLog>('workout_logs').filter(
    (l) => l.logged_date >= startDate && l.logged_date <= endDate
  )
}

export async function getWorkoutLog(id: string): Promise<WorkoutLog> {
  return mustFind<WorkoutLog>('workout_logs', id)
}

export async function createWorkoutLog(
  log: Omit<WorkoutLog, 'id' | 'created_at'>
): Promise<WorkoutLog> {
  const row: WorkoutLog = { id: newId(), created_at: nowIso(), ...log }
  writeTable('workout_logs', [...readTable<WorkoutLog>('workout_logs'), row])
  return row
}

export async function updateWorkoutLog(
  id: string,
  patch: Partial<Omit<WorkoutLog, 'id'>>
): Promise<WorkoutLog> {
  const rows = readTable<WorkoutLog>('workout_logs')
  const updated = { ...mustFind<WorkoutLog>('workout_logs', id), ...patch }
  writeTable(
    'workout_logs',
    rows.map((r) => (r.id === id ? updated : r))
  )
  return updated
}

export async function deleteWorkoutLog(id: string): Promise<void> {
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
  const exercises = readTable<Exercise>('exercises')
  return readTable<WorkoutLogSet>('workout_log_sets')
    .filter((s) => s.workout_log_id === workoutLogId)
    .sort((a, b) => (a.set_number ?? 0) - (b.set_number ?? 0))
    .map((s) => ({ ...s, exercise: exercises.find((e) => e.id === s.exercise_id)! }))
}

export async function addWorkoutLogSet(set: Omit<WorkoutLogSet, 'id'>): Promise<WorkoutLogSet> {
  const row: WorkoutLogSet = { id: newId(), ...set }
  writeTable('workout_log_sets', [...readTable<WorkoutLogSet>('workout_log_sets'), row])
  return row
}

export async function updateWorkoutLogSet(
  id: string,
  patch: Partial<Omit<WorkoutLogSet, 'id'>>
): Promise<WorkoutLogSet> {
  const rows = readTable<WorkoutLogSet>('workout_log_sets')
  const updated = { ...mustFind<WorkoutLogSet>('workout_log_sets', id), ...patch }
  writeTable(
    'workout_log_sets',
    rows.map((r) => (r.id === id ? updated : r))
  )
  return updated
}

export async function deleteWorkoutLogSet(id: string): Promise<void> {
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
  return readTable<BodyMetric>('body_metrics')
    .filter((m) => m.logged_date >= startDate && m.logged_date <= endDate)
    .sort((a, b) => a.logged_date.localeCompare(b.logged_date))
}

export async function upsertBodyMetric(
  metric: Omit<BodyMetric, 'id' | 'created_at'>
): Promise<BodyMetric> {
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
