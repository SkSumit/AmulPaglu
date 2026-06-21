import { Outlet } from 'react-router-dom'
import { Navbar } from './Navbar'

/** Main layout for all user-facing pages. */
export function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-[hsl(var(--background))]">
      <Navbar />
      <main className="flex-1 page-transition">
        <Outlet />
      </main>
    </div>
  )
}
