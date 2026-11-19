import { createBrowserRouter } from 'react-router-dom'
import AppLayout from './components/AppLayout.jsx'
import { GuestOnly, RequireAuth } from './lib/auth.jsx'
import Index from './pages/Index.jsx'
import Kampanye from './pages/Kampanye.jsx'
import EventAlert from './pages/kampanye/EventAlert.jsx'
import Poster from './pages/kampanye/Poster.jsx'
import Tips from './pages/kampanye/Tips.jsx'
import UmpanBalik from './pages/kampanye/UmpanBalik.jsx'
import LaluLintas from './pages/LaluLintas.jsx'
import Navigasi from './pages/Navigasi.jsx'
import NotFound from './pages/NotFound.jsx'
import Segera from './pages/Segera.jsx'
import Splash from './pages/Splash.jsx'
import TripPlanner from './pages/TripPlanner.jsx'
import Daftar from './pages/auth/Daftar.jsx'
import LupaPassword from './pages/auth/LupaPassword.jsx'
import Masuk from './pages/auth/Masuk.jsx'
import ResetPassword from './pages/auth/ResetPassword.jsx'

export const router = createBrowserRouter([
  { index: true, element: <Index />, errorElement: <NotFound /> },
  {
    element: <GuestOnly />,
    children: [
      { path: 'masuk', element: <Masuk /> },
      { path: 'daftar', element: <Daftar /> },
      { path: 'lupa-password', element: <LupaPassword /> },
    ],
  },
  { path: 'reset-password', element: <ResetPassword /> },
  // Splash sambutan, otomatis sekali untuk tamu baru (lihat Index.jsx).
  { path: 'selamat-datang', element: <Splash /> },
  // Tujuan menu Beranda; yang belum jadi memakai Segera.
  // Terbuka untuk tamu (ARCHITECTURE §4) …
  { path: 'navigasi', element: <Navigasi />, errorElement: <NotFound /> },
  { path: 'lalu-lintas', element: <LaluLintas />, errorElement: <NotFound /> },
  { path: 'pembayaran', element: <Segera title="Digital Payment" /> },
  { path: 'kampanye', element: <Kampanye />, errorElement: <NotFound /> },
  { path: 'kampanye/tips', element: <Tips /> },
  { path: 'kampanye/poster', element: <Poster /> },
  { path: 'kampanye/event', element: <EventAlert />, errorElement: <NotFound /> },
  { path: 'kampanye/umpan-balik', element: <UmpanBalik /> },
  {
    // … kecuali yang menyimpan data pribadi: tamu diarahkan ke /masuk lalu kembali.
    element: <RequireAuth />,
    errorElement: <NotFound />,
    children: [
      { path: 'trip-planner', element: <TripPlanner /> },
      { path: 'rewards', element: <Segera title="Rewards" /> },
      { path: 'akun', element: <Segera title="Akun" account /> },
    ],
  },
  {
    element: <AppLayout />,
    errorElement: <NotFound />,
    children: [
      // Pratinjau komponen bersama, hanya saat dev (tidak ikut build produksi).
      ...(import.meta.env.DEV
        ? [{ path: 'komponen', lazy: async () => ({ Component: (await import('./pages/Komponen.jsx')).default }) }]
        : []),
      { path: '*', element: <NotFound /> },
    ],
  },
])
