import { useState } from 'react'
import { Modal } from './Modal'
import { createExercise, deleteExercise } from '../lib/api'
import type { Exercise, ExerciseCategory } from '../types/database'

export function ExerciseLibraryModal({
  exercises,
  userId,
  onClose,
  onChange,
}: {
  exercises: Exercise[]
  userId: string
  onClose: () => void
  onChange: () => void
}) {
  const [form, setForm] = useState({
    name: '',
    category: 'strength' as ExerciseCategory,
    muscle_group: '',
    modality: '',
  })

  const add = async () => {
    if (!form.name.trim()) return
    await createExercise({
      user_id: userId,
      name: form.name,
      category: form.category,
      muscle_group: form.category === 'strength' ? form.muscle_group || null : null,
      modality: form.category === 'cardio' ? form.modality || null : null,
    })
    setForm({ name: '', category: form.category, muscle_group: '', modality: '' })
    onChange()
  }

  return (
    <Modal title="Exercise library" onClose={onClose}>
      <div className="mb-4 max-h-56 space-y-1 overflow-y-auto">
        {exercises.length === 0 && (
          <p className="text-sm text-slate-400">No exercises yet — add your first below.</p>
        )}
        {exercises.map((ex) => (
          <div key={ex.id} className="flex items-center justify-between text-sm">
            <span className="text-slate-700 dark:text-slate-300">
              {ex.name}{' '}
              <span className="text-slate-400">
                ({ex.category === 'strength' ? ex.muscle_group || 'strength' : ex.modality || 'cardio'})
              </span>
            </span>
            <button
              onClick={async () => {
                await deleteExercise(ex.id)
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
          placeholder="Exercise name"
          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <div className="flex gap-2">
          {(['strength', 'cardio'] as ExerciseCategory[]).map((c) => (
            <button
              key={c}
              onClick={() => setForm((f) => ({ ...f, category: c }))}
              className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize ${
                form.category === c
                  ? 'bg-indigo-600 text-white'
                  : 'border border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        {form.category === 'strength' ? (
          <input
            placeholder="Muscle group (e.g. chest, legs)"
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            value={form.muscle_group}
            onChange={(e) => setForm((f) => ({ ...f, muscle_group: e.target.value }))}
          />
        ) : (
          <input
            placeholder="Modality (run, bike, row...)"
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            value={form.modality}
            onChange={(e) => setForm((f) => ({ ...f, modality: e.target.value }))}
          />
        )}
        <button
          onClick={add}
          className="w-full rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Add exercise
        </button>
      </div>
    </Modal>
  )
}
