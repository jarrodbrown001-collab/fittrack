import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { RequireAuth } from './components/RequireAuth'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Nutrition } from './pages/Nutrition'
import { Plans } from './pages/Plans'
import { PlanDetail } from './pages/PlanDetail'
import { Workouts } from './pages/Workouts'
import { WorkoutSession } from './pages/WorkoutSession'
import { Settings } from './pages/Settings'

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/nutrition" element={<Nutrition />} />
            <Route path="/plans" element={<Plans />} />
            <Route path="/plans/:planId" element={<PlanDetail />} />
            <Route path="/workouts" element={<Workouts />} />
            <Route path="/workouts/:workoutLogId" element={<WorkoutSession />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
