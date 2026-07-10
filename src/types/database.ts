// Plain data shapes for FitTrack's local storage backend (see src/lib/storage.ts).

export type UnitSystem = 'imperial' | 'metric'
export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type ExerciseCategory = 'strength' | 'cardio'
export type PlanType = 'strength' | 'cardio' | 'mixed'

export type Profile = {
  id: string
  display_name: string | null
  unit_system: UnitSystem
  daily_calorie_target: number | null
  daily_protein_target_g: number | null
  daily_carb_target_g: number | null
  daily_fat_target_g: number | null
  created_at: string
}

export type Food = {
  id: string
  name: string
  serving_size: number
  serving_unit: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  created_at: string
}

export type FoodLog = {
  id: string
  food_id: string
  logged_date: string
  meal: Meal
  quantity: number
  created_at: string
}

export type Exercise = {
  id: string
  name: string
  category: ExerciseCategory
  muscle_group: string | null
  modality: string | null
  created_at: string
}

export type WorkoutPlan = {
  id: string
  name: string
  type: PlanType
  schedule_notes: string | null
  created_at: string
}

export type PlanExercise = {
  id: string
  plan_id: string
  exercise_id: string
  order_index: number
  target_sets: number | null
  target_reps: number | null
  target_weight: number | null
  target_distance: number | null
  target_duration_sec: number | null
  target_pace: string | null
}

export type WorkoutLog = {
  id: string
  plan_id: string | null
  logged_date: string
  duration_min: number | null
  notes: string | null
  created_at: string
}

export type WorkoutLogSet = {
  id: string
  workout_log_id: string
  exercise_id: string
  set_number: number | null
  reps: number | null
  weight: number | null
  distance: number | null
  duration_sec: number | null
  pace: string | null
}

export type BodyMetric = {
  id: string
  logged_date: string
  weight: number | null
  body_fat_pct: number | null
  measurements: Record<string, number> | null
  created_at: string
}
