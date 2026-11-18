import { Outlet } from 'react-router-dom'

export default function AppLayout() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-screen-sm flex-col bg-white">
      <Outlet />
    </div>
  )
}
