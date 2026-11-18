import { createBrowserRouter } from 'react-router-dom'
import AppLayout from './components/AppLayout.jsx'
import Home from './pages/Home.jsx'
import NotFound from './pages/NotFound.jsx'

// Rute fitur (masuk, navigasi, trip, admin, ...) ditambahkan di tugas berikutnya.
export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    errorElement: <NotFound />,
    children: [
      { index: true, element: <Home /> },
      // Pratinjau komponen bersama, hanya saat dev (tidak ikut build produksi).
      ...(import.meta.env.DEV
        ? [{ path: 'komponen', lazy: async () => ({ Component: (await import('./pages/Komponen.jsx')).default }) }]
        : []),
      { path: '*', element: <NotFound /> },
    ],
  },
])
