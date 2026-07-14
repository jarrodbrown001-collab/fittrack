import { useEffect, useMemo, useState } from 'react'
import { useProfile } from '../hooks/useProfile'
import { Modal } from '../components/Modal'
import { ProgressBar } from '../components/ProgressBar'
import {
  createFood,
  createFoodLog,
  deleteFood,
  deleteFoodLog,
  listFoodLogsForDate,
  listFoods,
  logEntryMacros,
  logEntryName,
  logTimestamp,
  type FoodLogWithFood,
} from '../lib/api'
import { addDays, formatDateLabel, formatTime, isoAt, timeNowHM, todayStr } from '../lib/date'
import type { Food, Meal } from '../types/database'

const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack', 'drink']

const MEAL_BADGE: Record<Meal, string> = {
  breakfast: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  lunch: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  dinner: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  snack: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  drink: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
}

function defaultMealForNow(): Meal {
  const h = new Date().getHours()
  if (h < 10) return 'breakfast'
  if (h < 14) return 'lunch'
  if (h < 17) return 'snack'
  if (h < 21) return 'dinner'
  return 'snack'
}

function totalsFor(logs: FoodLogWithFood[]) {
  return logs.reduce(
    (acc, log) => {
      const m = logEntryMacros(log)
      acc.calories += m.calories
      acc.protein_g += m.protein_g
      acc.carbs_g += m.carbs_g
      acc.fat_g += m.fat_g
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
  const [showManageFoods, setShowManageFoods] = useState(false)
  const [showLogFromLibrary, setShowLogFromLibrary] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [foodList, logList] = await Promise.all([listFoods(), listFoodLogsForDate(date)])
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

  // Timeline rows with a running calorie/protein sum after each entry.
  const timeline = useMemo(() => {
    let calories = 0
    let protein = 0
    return logs.map((log) => {
      const m = logEntryMacros(log)
      calories += m.calories
      protein += m.protein_g
      return { log, macros: m, runningCalories: calories, runningProtein: protein }
    })
  }, [logs])

  if (!profile) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Nutrition</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowLogFromLibrary(true)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            + From library
          </button>
          <button
            onClick={() => setShowManageFoods(true)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Manage foods
          </button>
        </div>
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

      <QuickAdd date={date} onLogged={load} />

      <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
          Timeline
        </h2>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : timeline.length === 0 ? (
          <p className="text-sm text-slate-400">Nothing logged yet — quick add your first entry above.</p>
        ) : (
          <>
            <div className="hidden grid-cols-[3.5rem_1fr_11rem_7rem_1.5rem] gap-2 border-b border-slate-100 pb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400 sm:grid dark:border-slate-800">
              <span>Time</span>
              <span>Entry</span>
              <span className="text-right">Cal · P/C/F</span>
              <span className="text-right">Running</span>
              <span />
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {timeline.map(({ log, macros, runningCalories, runningProtein }) => (
                <li
                  key={log.id}
                  className="grid grid-cols-[3.5rem_1fr_1.5rem] items-center gap-2 py-2 text-sm sm:grid-cols-[3.5rem_1fr_11rem_7rem_1.5rem]"
                >
                  <span className="text-xs text-slate-400">{formatTime(logTimestamp(log))}</span>
                  <div className="min-w-0">
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {logEntryName(log)}
                    </span>
                    {log.quantity !== 1 && (
                      <span className="ml-1 text-slate-400">×{log.quantity}</span>
                    )}
                    <span
                      className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize ${MEAL_BADGE[log.meal]}`}
                    >
                      {log.meal}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-400 sm:hidden">
                      {Math.round(macros.calories)} cal · {Math.round(macros.protein_g)}/
                      {Math.round(macros.carbs_g)}/{Math.round(macros.fat_g)}g · running{' '}
                      {Math.round(runningCalories)} cal
                    </span>
                  </div>
                  <span className="hidden text-right text-slate-500 sm:block dark:text-slate-400">
                    {Math.round(macros.calories)} cal ·{' '}
                    <span className="text-xs">
                      {Math.round(macros.protein_g)}/{Math.round(macros.carbs_g)}/
                      {Math.round(macros.fat_g)}g
                    </span>
                  </span>
                  <span className="hidden text-right text-xs sm:block">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {Math.round(runningCalories)} cal
                    </span>
                    <span className="block text-slate-400">{Math.round(runningProtein)}g pro</span>
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
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {showManageFoods && (
        <ManageFoodsModal foods={foods} onClose={() => setShowManageFoods(false)} onChange={load} />
      )}

      {showLogFromLibrary && (
        <LogFoodModal
          foods={foods}
          date={date}
          onClose={() => setShowLogFromLibrary(false)}
          onLogged={load}
        />
      )}
    </div>
  )
}

function QuickAdd({ date, onLogged }: { date: string; onLogged: () => void }) {
  const empty = { name: '', calories: '', protein_g: '', carbs_g: '', fat_g: '' }
  const [form, setForm] = useState(empty)
  const [meal, setMeal] = useState<Meal>(defaultMealForNow())
  const [time, setTime] = useState(timeNowHM())
  const [saveToLibrary, setSaveToLibrary] = useState(false)

  const set = (key: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const add = async () => {
    if (!form.name.trim()) return
    const macros = {
      calories: Number(form.calories) || 0,
      protein_g: Number(form.protein_g) || 0,
      carbs_g: Number(form.carbs_g) || 0,
      fat_g: Number(form.fat_g) || 0,
    }
    let food_id: string | null = null
    if (saveToLibrary) {
      const food = await createFood({
        name: form.name.trim(),
        serving_size: 1,
        serving_unit: 'serving',
        ...macros,
      })
      food_id = food.id
    }
    await createFoodLog({
      logged_date: date,
      logged_at: isoAt(date, time),
      meal,
      quantity: 1,
      food_id,
      ...(food_id ? {} : { name: form.name.trim(), ...macros }),
    })
    setForm(empty)
    setSaveToLibrary(false)
    setTime(timeNowHM())
    setMeal(defaultMealForNow())
    onLogged()
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Quick add</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_8rem_6.5rem]">
        <input
          placeholder="What did you have?"
          className="col-span-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm sm:col-span-1 dark:border-slate-700 dark:bg-slate-800"
          value={form.name}
          onChange={set('name')}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <select
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm capitalize dark:border-slate-700 dark:bg-slate-800"
          value={meal}
          onChange={(e) => setMeal(e.target.value as Meal)}
        >
          {MEALS.map((m) => (
            <option key={m} value={m} className="capitalize">
              {m}
            </option>
          ))}
        </select>
        <input
          type="time"
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {(
          [
            ['calories', 'Cal'],
            ['protein_g', 'Protein g'],
            ['carbs_g', 'Carbs g'],
            ['fat_g', 'Fat g'],
          ] as const
        ).map(([key, label]) => (
          <input
            key={key}
            type="number"
            min="0"
            placeholder={label}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            value={form[key]}
            onChange={set(key)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <input
            type="checkbox"
            checked={saveToLibrary}
            onChange={(e) => setSaveToLibrary(e.target.checked)}
          />
          Also save to food library
        </label>
        <button
          onClick={add}
          className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Log it
        </button>
      </div>
    </section>
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
  foods,
  date,
  onClose,
  onLogged,
}: {
  foods: Food[]
  date: string
  onClose: () => void
  onLogged: () => void
}) {
  const [foodId, setFoodId] = useState(foods[0]?.id ?? '')
  const [quantity, setQuantity] = useState(1)
  const [meal, setMeal] = useState<Meal>(defaultMealForNow())
  const [time, setTime] = useState(timeNowHM())

  const log = async () => {
    if (!foodId) return
    await createFoodLog({
      food_id: foodId,
      logged_date: date,
      logged_at: isoAt(date, time),
      meal,
      quantity,
    })
    onLogged()
    onClose()
  }

  return (
    <Modal title="Log from library" onClose={onClose}>
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
          <div className="grid grid-cols-3 gap-2">
            <label className="block text-sm">
              <span className="mb-1 block text-slate-500 dark:text-slate-400">Qty (× serving)</span>
              <input
                type="number"
                step="0.25"
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-500 dark:text-slate-400">Meal</span>
              <select
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm capitalize dark:border-slate-700 dark:bg-slate-800"
                value={meal}
                onChange={(e) => setMeal(e.target.value as Meal)}
              >
                {MEALS.map((m) => (
                  <option key={m} value={m} className="capitalize">
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-500 dark:text-slate-400">Time</span>
              <input
                type="time"
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </label>
          </div>
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
