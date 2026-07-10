import { supabase } from './supabase'
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

export const PROFILE_ID = '00000000-0000-0000-0000-000000000001'

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message)
  return data as T
}

// ── profile (singleton) ──────────────────────────────────────
export async function getProfile(): Promise<Profile> {
  return unwrap(await supabase.from('profiles').select('*').eq('id', PROFILE_ID).single())
}

export async function updateProfile(patch: Partial<Omit<Profile, 'id'>>) {
  return unwrap(
    await supabase.from('profiles').update(patch).eq('id', PROFILE_ID).select('*').single()
  )
}

// ── foods ─────────────────────────────────────────────────
export async function listFoods(): Promise<Food[]> {
  return unwrap(await supabase.from('foods').select('*').order('name', { ascending: true }))
}

export async function createFood(food: Omit<Food, 'id' | 'created_at'>): Promise<Food> {
  return unwrap(await supabase.from('foods').insert(food).select('*').single())
}

export async function deleteFood(id: string) {
  const { error } = await supabase.from('foods').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ── food logs ─────────────────────────────────────────────
export type FoodLogWithFood = FoodLog & { food: Food }

export async function listFoodLogsForDate(date: string): Promise<FoodLogWithFood[]> {
  return unwrap(
    await supabase
      .from('food_logs')
      .select('*, food:foods(*)')
      .eq('logged_date', date)
      .order('created_at', { ascending: true })
  )
}

export async function listFoodLogsInRange(
  startDate: string,
  endDate: string
): Promise<FoodLogWithFood[]> {
  return unwrap(
    await supabase
      .from('food_logs')
      .select('*, food:foods(*)')
      .gte('logged_date', startDate)
      .lte('logged_date', endDate)
  )
}

export async function createFoodLog(log: {
  food_id: string
  logged_date: string
  meal: Meal
  quantity: number
}): Promise<FoodLog> {
  return unwrap(await supabase.from('food_logs').insert(log).select('*').single())
}

export async function deleteFoodLog(id: string) {
  const { error } = await supabase.from('food_logs').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ── exercises ─────────────────────────────────────────────
export async function listExercises(): Promise<Exercise[]> {
  return unwrap(await supabase.from('exercises').select('*').order('name', { ascending: true }))
}

export async function createExercise(
  exercise: Omit<Exercise, 'id' | 'created_at'>
): Promise<Exercise> {
  return unwrap(await supabase.from('exercises').insert(exercise).select('*').single())
}

export async function deleteExercise(id: string) {
  const { error } = await supabase.from('exercises').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ── workout plans ─────────────────────────────────────────
export async function listWorkoutPlans(): Promise<WorkoutPlan[]> {
  return unwrap(
    await supabase.from('workout_plans').select('*').order('created_at', { ascending: false })
  )
}

export async function createWorkoutPlan(
  plan: Omit<WorkoutPlan, 'id' | 'created_at'>
): Promise<WorkoutPlan> {
  return unwrap(await supabase.from('workout_plans').insert(plan).select('*').single())
}

export async function deleteWorkoutPlan(id: string) {
  const { error } = await supabase.from('workout_plans').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export type PlanExerciseWithExercise = PlanExercise & { exercise: Exercise }

export async function getWorkoutPlan(planId: string): Promise<WorkoutPlan> {
  return unwrap(await supabase.from('workout_plans').select('*').eq('id', planId).single())
}

export async function listPlanExercises(planId: string): Promise<PlanExerciseWithExercise[]> {
  return unwrap(
    await supabase
      .from('plan_exercises')
      .select('*, exercise:exercises(*)')
      .eq('plan_id', planId)
      .order('order_index', { ascending: true })
  )
}

export async function addPlanExercise(pe: Omit<PlanExercise, 'id'>): Promise<PlanExercise> {
  return unwrap(await supabase.from('plan_exercises').insert(pe).select('*').single())
}

export async function deletePlanExercise(id: string) {
  const { error } = await supabase.from('plan_exercises').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ── workout logs ──────────────────────────────────────────
export async function listWorkoutLogs(): Promise<WorkoutLog[]> {
  return unwrap(
    await supabase.from('workout_logs').select('*').order('logged_date', { ascending: false })
  )
}

export async function listWorkoutLogsInRange(
  startDate: string,
  endDate: string
): Promise<WorkoutLog[]> {
  return unwrap(
    await supabase
      .from('workout_logs')
      .select('*')
      .gte('logged_date', startDate)
      .lte('logged_date', endDate)
  )
}

export async function getWorkoutLog(id: string): Promise<WorkoutLog> {
  return unwrap(await supabase.from('workout_logs').select('*').eq('id', id).single())
}

export async function createWorkoutLog(
  log: Omit<WorkoutLog, 'id' | 'created_at'>
): Promise<WorkoutLog> {
  return unwrap(await supabase.from('workout_logs').insert(log).select('*').single())
}

export async function updateWorkoutLog(id: string, patch: Partial<Omit<WorkoutLog, 'id'>>) {
  return unwrap(
    await supabase.from('workout_logs').update(patch).eq('id', id).select('*').single()
  )
}

export async function deleteWorkoutLog(id: string) {
  const { error } = await supabase.from('workout_logs').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export type WorkoutLogSetWithExercise = WorkoutLogSet & { exercise: Exercise }

export async function listWorkoutLogSets(
  workoutLogId: string
): Promise<WorkoutLogSetWithExercise[]> {
  return unwrap(
    await supabase
      .from('workout_log_sets')
      .select('*, exercise:exercises(*)')
      .eq('workout_log_id', workoutLogId)
      .order('set_number', { ascending: true })
  )
}

export async function addWorkoutLogSet(
  set: Omit<WorkoutLogSet, 'id'>
): Promise<WorkoutLogSet> {
  return unwrap(await supabase.from('workout_log_sets').insert(set).select('*').single())
}

export async function updateWorkoutLogSet(id: string, patch: Partial<Omit<WorkoutLogSet, 'id'>>) {
  return unwrap(
    await supabase.from('workout_log_sets').update(patch).eq('id', id).select('*').single()
  )
}

export async function deleteWorkoutLogSet(id: string) {
  const { error } = await supabase.from('workout_log_sets').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ── body metrics ──────────────────────────────────────────
export async function listBodyMetricsInRange(
  startDate: string,
  endDate: string
): Promise<BodyMetric[]> {
  return unwrap(
    await supabase
      .from('body_metrics')
      .select('*')
      .gte('logged_date', startDate)
      .lte('logged_date', endDate)
      .order('logged_date', { ascending: true })
  )
}

export async function upsertBodyMetric(
  metric: Omit<BodyMetric, 'id' | 'created_at'>
): Promise<BodyMetric> {
  return unwrap(
    await supabase
      .from('body_metrics')
      .upsert(metric, { onConflict: 'logged_date' })
      .select('*')
      .single()
  )
}
