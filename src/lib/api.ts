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

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message)
  return data as T
}

// ── profiles ──────────────────────────────────────────────
export async function updateProfile(userId: string, patch: Partial<Omit<Profile, 'id'>>) {
  return unwrap(
    await supabase.from('profiles').update(patch).eq('id', userId).select('*').single()
  )
}

// ── foods ─────────────────────────────────────────────────
export async function listFoods(userId: string): Promise<Food[]> {
  return unwrap(
    await supabase
      .from('foods')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true })
  )
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

export async function listFoodLogsForDate(
  userId: string,
  date: string
): Promise<FoodLogWithFood[]> {
  return unwrap(
    await supabase
      .from('food_logs')
      .select('*, food:foods(*)')
      .eq('user_id', userId)
      .eq('logged_date', date)
      .order('created_at', { ascending: true })
  )
}

export async function listFoodLogsInRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<FoodLogWithFood[]> {
  return unwrap(
    await supabase
      .from('food_logs')
      .select('*, food:foods(*)')
      .eq('user_id', userId)
      .gte('logged_date', startDate)
      .lte('logged_date', endDate)
  )
}

export async function createFoodLog(log: {
  user_id: string
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
export async function listExercises(userId: string): Promise<Exercise[]> {
  return unwrap(
    await supabase
      .from('exercises')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true })
  )
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
export async function listWorkoutPlans(userId: string): Promise<WorkoutPlan[]> {
  return unwrap(
    await supabase
      .from('workout_plans')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
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
export async function listWorkoutLogs(userId: string): Promise<WorkoutLog[]> {
  return unwrap(
    await supabase
      .from('workout_logs')
      .select('*')
      .eq('user_id', userId)
      .order('logged_date', { ascending: false })
  )
}

export async function listWorkoutLogsInRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<WorkoutLog[]> {
  return unwrap(
    await supabase
      .from('workout_logs')
      .select('*')
      .eq('user_id', userId)
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

export async function updateWorkoutLog(id: string, patch: Partial<Omit<WorkoutLog, 'id' | 'user_id'>>) {
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
  userId: string,
  startDate: string,
  endDate: string
): Promise<BodyMetric[]> {
  return unwrap(
    await supabase
      .from('body_metrics')
      .select('*')
      .eq('user_id', userId)
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
      .upsert(metric, { onConflict: 'user_id,logged_date' })
      .select('*')
      .single()
  )
}
