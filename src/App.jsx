import { Routes, Route } from 'react-router-dom'
import RegistroPage from './pages/RegistroPage'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import AdminEnviar from './pages/AdminEnviar'
import GuestView from './pages/GuestView'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RegistroPage />} />
      <Route path="/registrar/:token" element={<RegistroPage />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin/enviar" element={<AdminEnviar />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/convidado/:token" element={<GuestView />} />
      <Route path="*" element={<RegistroPage />} />
    </Routes>
  )
}
