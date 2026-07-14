// One-time uploader: copies this browser's localStorage data into Supabase
// for the signed-in user. Upserts by primary key, so re-running is safe —
// but it overwrites cloud rows with local ones, so it's meant to be run
// once, from the device that holds the real data, right after cloud sync
// is first enabled.

import { readSingleton, readTable } from './storage'
import { must, supabase, uid } from './supabase'
import type { FoodLog, Profile } from '../types/database'

export async function migrateLocalToCloud(): Promise<string> {
  const userId = await uid()
  const done: string[] = []

  const push = async (table: string, rows: Record<string, unknown>[], onConflict = 'id') => {
    if (rows.length === 0) return
    must(
      await supabase
        .from(table)
        .upsert(
          rows.map((r) => ({ ...r, user_id: userId })),
          { onConflict }
        )
        .select()
    )
    done.push(`${table} (${rows.length})`)
  }

  // Parents before children, matching the FK graph.
  await push('foods', readTable('foods'))

  // Legacy food_logs rows predate quick-add and lack its columns entirely —
  // normalize to explicit nulls so Postgres gets every column.
  const foodLogs = readTable<FoodLog>('food_logs').map((l) => ({
    id: l.id,
    food_id: l.food_id ?? null,
    logged_date: l.logged_date,
    logged_at: l.logged_at ?? null,
    meal: l.meal,
    quantity: l.quantity,
    name: l.name ?? null,
    calories: l.calories ?? null,
    protein_g: l.protein_g ?? null,
    carbs_g: l.carbs_g ?? null,
    fat_g: l.fat_g ?? null,
    created_at: l.created_at,
  }))
  await push('food_logs', foodLogs)

  await push('exercises', readTable('exercises'))
  await push('workout_plans', readTable('workout_plans'))
  await push('plan_exercises', readTable('plan_exercises'))
  await push('workout_logs', readTable('workout_logs'))
  await push('workout_log_sets', readTable('workout_log_sets'))
  await push('body_metrics', readTable('body_metrics'), 'user_id,logged_date')

  const profile = readSingleton<Profile>('profile')
  if (profile) {
    const { id: _id, created_at: _createdAt, ...rest } = profile
    must(await supabase.from('profiles').upsert({ user_id: userId, ...rest }).select())
    done.push('profile')
  }

  const plan = readSingleton<Record<string, unknown>>('training_plan')
  if (plan) {
    must(await supabase.from('training_plan').upsert({ user_id: userId, data: plan }).select())
    done.push('training plan')
  }

  return done.length > 0 ? `Uploaded: ${done.join(', ')}` : 'No local data found on this device.'
}
