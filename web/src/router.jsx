import { createBrowserRouter } from 'react-router-dom'
import AppLayout from './components/AppLayout.jsx'
import { GuestOnly } from './lib/auth.jsx'
import Index from './pages/Index.jsx'
import NotFound from './pages/NotFound.jsx'
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
