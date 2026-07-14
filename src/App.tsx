import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ProfileProvider } from './hooks/useProfile'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Nutrition } from './pages/Nutrition'
import { TrainingPlan } from './pages/TrainingPlan'
import { Plans } from './pages/Plans'
import { PlanDetail } from './pages/PlanDetail'
import { Workouts } from './pages/Workouts'
import { WorkoutSession } from './pages/WorkoutSession'
import { Settings } from './pages/Settings'

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ProfileProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/nutrition" element={<Nutrition />} />
            <Route path="/training-plan" element={<TrainingPlan />} />
            <Route path="/plans" element={<Plans />} />
            <Route path="/plans/:planId" element={<PlanDetail />} />
            <Route path="/workouts" element={<Workouts />} />
            <Route path="/workouts/:workoutLogId" element={<WorkoutSession />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </ProfileProvider>
    </BrowserRouter>
  )
}
