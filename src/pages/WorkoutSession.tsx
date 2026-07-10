import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Modal } from '../components/Modal'
import {
  addWorkoutLogSet,
  deleteWorkoutLogSet,
  getWorkoutLog,
  getWorkoutPlan,
  listExercises,
  listPlanExercises,
  listWorkoutLogSets,
  updateWorkoutLog,
  updateWorkoutLogSet,
  type PlanExerciseWithExercise,
  type WorkoutLogSetWithExercise,
} from '../lib/api'
import { formatDateLabel } from '../lib/date'
import {
  displayToKg,
  displayToKm,
  distanceUnitLabel,
  kgToDisplay,
  kmToDisplay,
  weightUnitLabel,
} from '../lib/units'
import type { Exercise, WorkoutLog, WorkoutPlan } from '../types/database'

export function WorkoutSession() {
  const { workoutLogId } = useParams<{ workoutLogId: string }>()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [log, setLog] = useState<WorkoutLog | null>(null)
  const [plan, setPlan] = useState<WorkoutPlan | null>(null)
  const [planExercises, setPlanExercises] = useState<PlanExerciseWithExercise[]>([])
  const [sets, setSets] = useState<WorkoutLogSetWithExercise[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [showAddExercise, setShowAddExercise] = useState(false)

  const load = async () => {
    if (!workoutLogId || !user) return
    const l = await getWorkoutLog(workoutLogId)
    setLog(l)
    const [s, exs] = await Promise.all([listWorkoutLogSets(workoutLogId), listExercises(user.id)])
    setSets(s)
    setExercises(exs)
    if (l.plan_id) {
      const [p, pes] = await Promise.all([getWorkoutPlan(l.plan_id), listPlanExercises(l.plan_id)])
      setPlan(p)
      setPlanExercises(pes)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutLogId, user])

  const setsByExercise = useMemo(() => {
    const map: Record<string, WorkoutLogSetWithExercise[]> = {}
    for (const s of sets) {
      map[s.exercise_id] = map[s.exercise_id] || []
      map[s.exercise_id].push(s)
    }
    return map
  }, [sets])

  if (!log || !profile || !user) return <p className="text-sm text-slate-500">Loading…</p>

  const system = profile.unit_system

  const freeformExerciseIds = Object.keys(setsByExercise).filter(
    (id) => !planExercises.some((pe) => pe.exercise_id === id)
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
            {plan ? plan.name : 'Freeform session'}
          </h1>
          <p className="text-xs text-slate-400">{formatDateLabel(log.logged_date)}</p>
        </div>
        <button
          onClick={() => navigate('/workouts')}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Done
        </button>
      </div>

      <section className="flex gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <label className="text-sm">
          <span className="mb-1 block text-slate-500 dark:text-slate-400">Duration (min)</span>
          <input
            type="number"
            className="w-28 rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
            value={log.duration_min ?? ''}
            onChange={async (e) => {
              const duration_min = e.target.value ? Number(e.target.value) : null
              setLog({ ...log, duration_min })
              await updateWorkoutLog(log.id, { duration_min })
            }}
          />
        </label>
        <label className="flex-1 text-sm">
          <span className="mb-1 block text-slate-500 dark:text-slate-400">Notes</span>
          <input
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
            value={log.notes ?? ''}
            onChange={async (e) => {
              const notes = e.target.value
              setLog({ ...log, notes })
              await updateWorkoutLog(log.id, { notes })
            }}
          />
        </label>
      </section>

      {planExercises.map((pe) => (
        <ExerciseBlock
          key={pe.id}
          exercise={pe.exercise}
          planExercise={pe}
          workoutLogId={log.id}
          existingSets={setsByExercise[pe.exercise_id] ?? []}
          unitSystem={system}
          onChange={load}
        />
      ))}

      {freeformExerciseIds.map((exId) => {
        const exSets = setsByExercise[exId]
        return (
          <ExerciseBlock
            key={exId}
            exercise={exSets[0].exercise}
            planExercise={null}
            workoutLogId={log.id}
            existingSets={exSets}
            unitSystem={system}
            onChange={load}
          />
        )
      })}

      <button
        onClick={() => setShowAddExercise(true)}
        className="w-full rounded-md border border-dashed border-slate-300 py-3 text-sm font-medium text-slate-500 hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700"
      >
        + Add exercise
      </button>

      {showAddExercise && (
        <Modal title="Add exercise" onClose={() => setShowAddExercise(false)}>
          {exercises.length === 0 ? (
            <p className="text-sm text-slate-500">Add exercises to your library first.</p>
          ) : (
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {exercises.map((ex) => (
                <button
                  key={ex.id}
                  onClick={async () => {
                    await addWorkoutLogSet({
                      workout_log_id: log.id,
                      exercise_id: ex.id,
                      set_number: 1,
                      reps: null,
                      weight: null,
                      distance: null,
                      duration_sec: null,
                      pace: null,
                    })
                    setShowAddExercise(false)
                    load()
                  }}
                  className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  {ex.name}{' '}
                  <span className="text-slate-400">({ex.category})</span>
                </button>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

function ExerciseBlock({
  exercise,
  planExercise,
  workoutLogId,
  existingSets,
  unitSystem,
  onChange,
}: {
  exercise: Exercise
  planExercise: PlanExerciseWithExercise | null
  workoutLogId: string
  existingSets: WorkoutLogSetWithExercise[]
  unitSystem: 'imperial' | 'metric'
  onChange: () => void
}) {
  const isStrength = exercise.category === 'strength'

  const addRow = async () => {
    const setNumber = existingSets.length + 1
    await addWorkoutLogSet({
      workout_log_id: workoutLogId,
      exercise_id: exercise.id,
      set_number: setNumber,
      reps: isStrength ? planExercise?.target_reps ?? null : null,
      weight: isStrength ? planExercise?.target_weight ?? null : null,
      distance: !isStrength ? planExercise?.target_distance ?? null : null,
      duration_sec: !isStrength ? planExercise?.target_duration_sec ?? null : null,
      pace: !isStrength ? planExercise?.target_pace ?? null : null,
    })
    onChange()
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          {exercise.name}
        </h2>
        <button
          onClick={addRow}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          + {isStrength ? 'Add set' : 'Add segment'}
        </button>
      </div>

      {existingSets.length === 0 ? (
        <p className="text-sm text-slate-400">
          {planExercise
            ? `Target: ${
                isStrength
                  ? `${planExercise.target_sets ?? '–'}×${planExercise.target_reps ?? '–'} @ ${
                      planExercise.target_weight != null
                        ? kgToDisplay(planExercise.target_weight, unitSystem).toFixed(0)
                        : '–'
                    } ${weightUnitLabel(unitSystem)}`
                  : `${
                      planExercise.target_distance != null
                        ? kmToDisplay(planExercise.target_distance, unitSystem).toFixed(2)
                        : '–'
                    } ${distanceUnitLabel(unitSystem)}`
              }`
            : 'No sets logged yet.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {existingSets.map((s, i) => (
            <li key={s.id} className="flex items-center gap-2 text-sm">
              <span className="w-6 text-slate-400">{s.set_number ?? i + 1}</span>
              {isStrength ? (
                <>
                  <input
                    type="number"
                    placeholder="reps"
                    className="w-20 rounded-md border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-800"
                    value={s.reps ?? ''}
                    onChange={async (e) => {
                      const reps = e.target.value ? Number(e.target.value) : null
                      await updateWorkoutLogSet(s.id, { reps })
                      onChange()
                    }}
                  />
                  <span className="text-slate-400">reps ×</span>
                  <input
                    type="number"
                    placeholder="weight"
                    className="w-24 rounded-md border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-800"
                    value={s.weight != null ? kgToDisplay(s.weight, unitSystem).toFixed(1) : ''}
                    onChange={async (e) => {
                      const weight = e.target.value
                        ? displayToKg(Number(e.target.value), unitSystem)
                        : null
                      await updateWorkoutLogSet(s.id, { weight })
                      onChange()
                    }}
                  />
                  <span className="text-slate-400">{weightUnitLabel(unitSystem)}</span>
                </>
              ) : (
                <>
                  <input
                    type="number"
                    placeholder="distance"
                    className="w-24 rounded-md border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-800"
                    value={s.distance != null ? kmToDisplay(s.distance, unitSystem).toFixed(2) : ''}
                    onChange={async (e) => {
                      const distance = e.target.value
                        ? displayToKm(Number(e.target.value), unitSystem)
                        : null
                      await updateWorkoutLogSet(s.id, { distance })
                      onChange()
                    }}
                  />
                  <span className="text-slate-400">{distanceUnitLabel(unitSystem)}</span>
                  <input
                    type="number"
                    placeholder="min"
                    className="w-20 rounded-md border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-800"
                    value={s.duration_sec != null ? Math.round(s.duration_sec / 60) : ''}
                    onChange={async (e) => {
                      const duration_sec = e.target.value ? Number(e.target.value) * 60 : null
                      await updateWorkoutLogSet(s.id, { duration_sec })
                      onChange()
                    }}
                  />
                  <span className="text-slate-400">min</span>
                  <input
                    placeholder="pace"
                    className="w-20 rounded-md border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-800"
                    value={s.pace ?? ''}
                    onChange={async (e) => {
                      await updateWorkoutLogSet(s.id, { pace: e.target.value })
                      onChange()
                    }}
                  />
                </>
              )}
              <button
                onClick={async () => {
                  await deleteWorkoutLogSet(s.id)
                  onChange()
                }}
                className="ml-auto text-slate-300 hover:text-red-500"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
