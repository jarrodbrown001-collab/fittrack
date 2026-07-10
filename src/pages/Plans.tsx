import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '../components/Modal'
import { ExerciseLibraryModal } from '../components/ExerciseLibraryModal'
import {
  createWorkoutPlan,
  deleteWorkoutPlan,
  listExercises,
  listWorkoutPlans,
} from '../lib/api'
import type { Exercise, PlanType, WorkoutPlan } from '../types/database'

export function Plans() {
  const navigate = useNavigate()
  const [plans, setPlans] = useState<WorkoutPlan[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewPlan, setShowNewPlan] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [planList, exerciseList] = await Promise.all([listWorkoutPlans(), listExercises()])
      setPlans(planList)
      setExercises(exerciseList)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
          Workout plans
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowLibrary(true)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Exercise library
          </button>
          <button
            onClick={() => setShowNewPlan(true)}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
          >
            + New plan
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : plans.length === 0 ? (
        <p className="text-sm text-slate-400">No plans yet. Create one to get started.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {plans.map((plan) => (
            <li
              key={plan.id}
              className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between">
                <button
                  onClick={() => navigate(`/plans/${plan.id}`)}
                  className="text-left text-sm font-semibold text-slate-800 hover:text-indigo-600 dark:text-slate-200"
                >
                  {plan.name}
                </button>
                <button
                  onClick={async () => {
                    await deleteWorkoutPlan(plan.id)
                    load()
                  }}
                  className="text-slate-300 hover:text-red-500"
                >
                  ✕
                </button>
              </div>
              <p className="mt-1 text-xs capitalize text-slate-400">{plan.type}</p>
              {plan.schedule_notes && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {plan.schedule_notes}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {showNewPlan && <NewPlanModal onClose={() => setShowNewPlan(false)} onCreated={load} />}
      {showLibrary && (
        <ExerciseLibraryModal
          exercises={exercises}
          onClose={() => setShowLibrary(false)}
          onChange={load}
        />
      )}
    </div>
  )
}

function NewPlanModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [type, setType] = useState<PlanType>('strength')
  const [notes, setNotes] = useState('')

  const create = async () => {
    if (!name.trim()) return
    const plan = await createWorkoutPlan({
      name,
      type,
      schedule_notes: notes || null,
    })
    onCreated()
    onClose()
    navigate(`/plans/${plan.id}`)
  }

  return (
    <Modal title="New plan" onClose={onClose}>
      <div className="space-y-3">
        <input
          placeholder="Plan name (e.g. Push day)"
          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex gap-2">
          {(['strength', 'cardio', 'mixed'] as PlanType[]).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize ${
                type === t
                  ? 'bg-indigo-600 text-white'
                  : 'border border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <input
          placeholder="Schedule notes (e.g. Mon/Wed/Fri)"
          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <button
          onClick={create}
          className="w-full rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Create plan
        </button>
      </div>
    </Modal>
  )
}
