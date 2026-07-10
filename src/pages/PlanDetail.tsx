import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useProfile } from '../hooks/useProfile'
import { Modal } from '../components/Modal'
import {
  addPlanExercise,
  createWorkoutLog,
  deletePlanExercise,
  getWorkoutPlan,
  listExercises,
  listPlanExercises,
  type PlanExerciseWithExercise,
} from '../lib/api'
import { todayStr } from '../lib/date'
import { distanceUnitLabel, displayToKg, displayToKm, kgToDisplay, kmToDisplay, weightUnitLabel } from '../lib/units'
import type { Exercise, WorkoutPlan } from '../types/database'

export function PlanDetail() {
  const { planId } = useParams<{ planId: string }>()
  const { profile } = useProfile()
  const navigate = useNavigate()
  const [plan, setPlan] = useState<WorkoutPlan | null>(null)
  const [planExercises, setPlanExercises] = useState<PlanExerciseWithExercise[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [starting, setStarting] = useState(false)

  const load = async () => {
    if (!planId) return
    const [p, pes, exs] = await Promise.all([
      getWorkoutPlan(planId),
      listPlanExercises(planId),
      listExercises(),
    ])
    setPlan(p)
    setPlanExercises(pes)
    setExercises(exs)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId])

  const startSession = async () => {
    if (!plan) return
    setStarting(true)
    try {
      const log = await createWorkoutLog({
        plan_id: plan.id,
        logged_date: todayStr(),
        duration_min: null,
        notes: null,
      })
      navigate(`/workouts/${log.id}`)
    } finally {
      setStarting(false)
    }
  }

  if (!plan || !profile) return <p className="text-sm text-slate-500">Loading…</p>

  const system = profile.unit_system

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
            {plan.name}
          </h1>
          <p className="text-xs capitalize text-slate-400">
            {plan.type} {plan.schedule_notes && `· ${plan.schedule_notes}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            + Add exercise
          </button>
          <button
            onClick={startSession}
            disabled={starting || planExercises.length === 0}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {starting ? 'Starting…' : 'Start session'}
          </button>
        </div>
      </div>

      {planExercises.length === 0 ? (
        <p className="text-sm text-slate-400">No exercises in this plan yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {planExercises.map((pe, i) => (
            <li key={pe.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {i + 1}. {pe.exercise.name}
                </span>
                <div className="text-xs text-slate-400">
                  {pe.exercise.category === 'strength'
                    ? [
                        pe.target_sets && `${pe.target_sets} sets`,
                        pe.target_reps && `${pe.target_reps} reps`,
                        pe.target_weight != null &&
                          `${kgToDisplay(pe.target_weight, system).toFixed(0)} ${weightUnitLabel(system)}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    : [
                        pe.target_distance != null &&
                          `${kmToDisplay(pe.target_distance, system).toFixed(2)} ${distanceUnitLabel(system)}`,
                        pe.target_duration_sec && `${Math.round(pe.target_duration_sec / 60)} min`,
                        pe.target_pace && `${pe.target_pace} pace`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                </div>
              </div>
              <button
                onClick={async () => {
                  await deletePlanExercise(pe.id)
                  load()
                }}
                className="text-slate-300 hover:text-red-500"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {showAdd && planId && (
        <AddPlanExerciseModal
          planId={planId}
          exercises={exercises}
          nextOrder={planExercises.length}
          unitSystem={system}
          onClose={() => setShowAdd(false)}
          onAdded={load}
        />
      )}
    </div>
  )
}

function AddPlanExerciseModal({
  planId,
  exercises,
  nextOrder,
  unitSystem,
  onClose,
  onAdded,
}: {
  planId: string
  exercises: Exercise[]
  nextOrder: number
  unitSystem: 'imperial' | 'metric'
  onClose: () => void
  onAdded: () => void
}) {
  const [exerciseId, setExerciseId] = useState(exercises[0]?.id ?? '')
  const selected = exercises.find((e) => e.id === exerciseId)
  const [sets, setSets] = useState(3)
  const [reps, setReps] = useState(10)
  const [weight, setWeight] = useState(0)
  const [distance, setDistance] = useState(0)
  const [durationMin, setDurationMin] = useState(0)
  const [pace, setPace] = useState('')

  const add = async () => {
    if (!selected) return
    await addPlanExercise({
      plan_id: planId,
      exercise_id: selected.id,
      order_index: nextOrder,
      target_sets: selected.category === 'strength' ? sets : null,
      target_reps: selected.category === 'strength' ? reps : null,
      target_weight: selected.category === 'strength' ? displayToKg(weight, unitSystem) : null,
      target_distance: selected.category === 'cardio' ? displayToKm(distance, unitSystem) : null,
      target_duration_sec: selected.category === 'cardio' ? durationMin * 60 : null,
      target_pace: selected.category === 'cardio' ? pace || null : null,
    })
    onAdded()
    onClose()
  }

  return (
    <Modal title="Add exercise to plan" onClose={onClose}>
      {exercises.length === 0 ? (
        <p className="text-sm text-slate-500">
          Add exercises to your library first (Exercise library button).
        </p>
      ) : (
        <div className="space-y-3">
          <select
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            value={exerciseId}
            onChange={(e) => setExerciseId(e.target.value)}
          >
            {exercises.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name} ({ex.category})
              </option>
            ))}
          </select>

          {selected?.category === 'strength' ? (
            <div className="grid grid-cols-3 gap-2">
              <label className="text-xs text-slate-500">
                Sets
                <input
                  type="number"
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                  value={sets}
                  onChange={(e) => setSets(Number(e.target.value))}
                />
              </label>
              <label className="text-xs text-slate-500">
                Reps
                <input
                  type="number"
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                  value={reps}
                  onChange={(e) => setReps(Number(e.target.value))}
                />
              </label>
              <label className="text-xs text-slate-500">
                Weight ({weightUnitLabel(unitSystem)})
                <input
                  type="number"
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                />
              </label>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <label className="text-xs text-slate-500">
                Distance ({distanceUnitLabel(unitSystem)})
                <input
                  type="number"
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                  value={distance}
                  onChange={(e) => setDistance(Number(e.target.value))}
                />
              </label>
              <label className="text-xs text-slate-500">
                Duration (min)
                <input
                  type="number"
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                  value={durationMin}
                  onChange={(e) => setDurationMin(Number(e.target.value))}
                />
              </label>
              <label className="text-xs text-slate-500">
                Pace
                <input
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                  value={pace}
                  onChange={(e) => setPace(e.target.value)}
                />
              </label>
            </div>
          )}

          <button
            onClick={add}
            className="w-full rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Add to plan
          </button>
        </div>
      )}
    </Modal>
  )
}
