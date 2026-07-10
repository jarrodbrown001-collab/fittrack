import { useEffect, useMemo, useState } from 'react'
import { useProfile } from '../hooks/useProfile'
import { Modal } from '../components/Modal'
import { ProgressBar } from '../components/ProgressBar'
import {
  createFood,
  createFoodLog,
  deleteFood,
  deleteFoodLog,
  listFoodLogsInRange,
  listFoods,
  type FoodLogWithFood,
} from '../lib/api'
import { addDays, formatDateLabel, todayStr } from '../lib/date'
import type { Food, Meal } from '../types/database'

const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack']

function totalsFor(logs: FoodLogWithFood[]) {
  return logs.reduce(
    (acc, log) => {
      const q = log.quantity
      acc.calories += log.food.calories * q
      acc.protein_g += log.food.protein_g * q
      acc.carbs_g += log.food.carbs_g * q
      acc.fat_g += log.food.fat_g * q
      return acc
    },
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  )
}

export function Nutrition() {
  const { profile } = useProfile()
  const [date, setDate] = useState(todayStr())
  const [foods, setFoods] = useState<Food[]>([])
  const [logs, setLogs] = useState<FoodLogWithFood[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddFood, setShowAddFood] = useState(false)
  const [showLogFood, setShowLogFood] = useState<Meal | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [foodList, logList] = await Promise.all([
        listFoods(),
        listFoodLogsInRange(date, date),
      ])
      setFoods(foodList)
      setLogs(logList)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  const totals = useMemo(() => totalsFor(logs), [logs])

  const logsByMeal = useMemo(() => {
    const map: Record<Meal, FoodLogWithFood[]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
    }
    for (const log of logs) map[log.meal].push(log)
    return map
  }, [logs])

  if (!profile) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Nutrition</h1>
        <button
          onClick={() => setShowAddFood(true)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          + Manage foods
        </button>
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => setDate((d) => addDays(d, -1))}
          className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          ←
        </button>
        <span className="w-40 text-center text-sm font-medium text-slate-700 dark:text-slate-300">
          {formatDateLabel(date)}
        </span>
        <button
          onClick={() => setDate((d) => addDays(d, 1))}
          className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          →
        </button>
      </div>

      <section className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-white p-5 sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-900">
        <ProgressBar
          label="Calories"
          value={totals.calories}
          target={profile.daily_calorie_target ?? 0}
        />
        <ProgressBar
          label="Protein"
          value={totals.protein_g}
          target={profile.daily_protein_target_g ?? 0}
          unit="g"
        />
        <ProgressBar
          label="Carbs"
          value={totals.carbs_g}
          target={profile.daily_carb_target_g ?? 0}
          unit="g"
        />
        <ProgressBar
          label="Fat"
          value={totals.fat_g}
          target={profile.daily_fat_target_g ?? 0}
          unit="g"
        />
      </section>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="space-y-4">
          {MEALS.map((meal) => (
            <section
              key={meal}
              className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold capitalize text-slate-700 dark:text-slate-300">
                  {meal}
                </h2>
                <button
                  onClick={() => setShowLogFood(meal)}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                >
                  + Add food
                </button>
              </div>
              {logsByMeal[meal].length === 0 ? (
                <p className="text-sm text-slate-400">Nothing logged yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {logsByMeal[meal].map((log) => (
                    <li key={log.id} className="flex items-center justify-between py-2 text-sm">
                      <div>
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {log.food.name}
                        </span>
                        <span className="ml-2 text-slate-400">
                          ×{log.quantity} {log.food.serving_unit}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-500 dark:text-slate-400">
                          {Math.round(log.food.calories * log.quantity)} cal
                        </span>
                        <button
                          onClick={async () => {
                            await deleteFoodLog(log.id)
                            load()
                          }}
                          className="text-slate-300 hover:text-red-500"
                        >
                          ✕
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      {showAddFood && (
        <ManageFoodsModal foods={foods} onClose={() => setShowAddFood(false)} onChange={load} />
      )}

      {showLogFood && (
        <LogFoodModal
          meal={showLogFood}
          foods={foods}
          date={date}
          onClose={() => setShowLogFood(null)}
          onLogged={load}
        />
      )}
    </div>
  )
}

function ManageFoodsModal({
  foods,
  onClose,
  onChange,
}: {
  foods: Food[]
  onClose: () => void
  onChange: () => void
}) {
  const [form, setForm] = useState({
    name: '',
    serving_size: 1,
    serving_unit: 'serving',
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
  })

  const add = async () => {
    if (!form.name.trim()) return
    await createFood(form)
    setForm({
      name: '',
      serving_size: 1,
      serving_unit: 'serving',
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
    })
    onChange()
  }

  return (
    <Modal title="Manage foods" onClose={onClose}>
      <div className="mb-4 max-h-56 space-y-1 overflow-y-auto">
        {foods.length === 0 && <p className="text-sm text-slate-400">No custom foods yet.</p>}
        {foods.map((f) => (
          <div key={f.id} className="flex items-center justify-between text-sm">
            <span className="text-slate-700 dark:text-slate-300">
              {f.name}{' '}
              <span className="text-slate-400">
                ({f.serving_size} {f.serving_unit} · {f.calories} cal)
              </span>
            </span>
            <button
              onClick={async () => {
                await deleteFood(f.id)
                onChange()
              }}
              className="text-slate-300 hover:text-red-500"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        <input
          placeholder="Food name"
          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            placeholder="Serving size"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            value={form.serving_size}
            onChange={(e) => setForm((f) => ({ ...f, serving_size: Number(e.target.value) }))}
          />
          <input
            placeholder="Unit (g, cup, each)"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            value={form.serving_unit}
            onChange={(e) => setForm((f) => ({ ...f, serving_unit: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-4 gap-2">
          <input
            type="number"
            placeholder="Cal"
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            value={form.calories}
            onChange={(e) => setForm((f) => ({ ...f, calories: Number(e.target.value) }))}
          />
          <input
            type="number"
            placeholder="Protein"
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            value={form.protein_g}
            onChange={(e) => setForm((f) => ({ ...f, protein_g: Number(e.target.value) }))}
          />
          <input
            type="number"
            placeholder="Carbs"
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            value={form.carbs_g}
            onChange={(e) => setForm((f) => ({ ...f, carbs_g: Number(e.target.value) }))}
          />
          <input
            type="number"
            placeholder="Fat"
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            value={form.fat_g}
            onChange={(e) => setForm((f) => ({ ...f, fat_g: Number(e.target.value) }))}
          />
        </div>
        <button
          onClick={add}
          className="w-full rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Add food
        </button>
      </div>
    </Modal>
  )
}

function LogFoodModal({
  meal,
  foods,
  date,
  onClose,
  onLogged,
}: {
  meal: Meal
  foods: Food[]
  date: string
  onClose: () => void
  onLogged: () => void
}) {
  const [foodId, setFoodId] = useState(foods[0]?.id ?? '')
  const [quantity, setQuantity] = useState(1)

  const log = async () => {
    if (!foodId) return
    await createFoodLog({ food_id: foodId, logged_date: date, meal, quantity })
    onLogged()
    onClose()
  }

  return (
    <Modal title={`Log food — ${meal}`} onClose={onClose}>
      {foods.length === 0 ? (
        <p className="text-sm text-slate-500">Add a food first via "Manage foods".</p>
      ) : (
        <div className="space-y-3">
          <select
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            value={foodId}
            onChange={(e) => setFoodId(e.target.value)}
          >
            {foods.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.serving_size} {f.serving_unit})
              </option>
            ))}
          </select>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-500 dark:text-slate-400">
              Quantity (× serving)
            </span>
            <input
              type="number"
              step="0.25"
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </label>
          <button
            onClick={log}
            className="w-full rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Log it
          </button>
        </div>
      )}
    </Modal>
  )
}
