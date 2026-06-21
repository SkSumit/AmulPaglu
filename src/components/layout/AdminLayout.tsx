import { NavLink, Outlet, Link } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  Users,
  Lightbulb,
  Bot,
  Award,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const ADMIN_NAV = [
  { to: '/admin',              label: 'Overview',    icon: LayoutDashboard, end: true },
  { to: '/admin/products',     label: 'Products',    icon: Package         },
  { to: '/admin/users',        label: 'Users',       icon: Users           },
  { to: '/admin/badges',       label: 'Badges',      icon: Award           },
  { to: '/admin/suggestions',  label: 'Suggestions', icon: Lightbulb       },
  { to: '/admin/scraper',      label: 'Scraper',     icon: Bot             },
]

export function AdminLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden w-56 shrink-0 border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] md:flex md:flex-col">
        <div className="flex h-14 items-center gap-2 border-b border-[hsl(var(--border))] px-4 font-display font-bold text-amul-red">
          <span>⚙️</span>
          <span>Admin</span>
        </div>
        <nav className="flex-1 p-2">
          {ADMIN_NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors mb-0.5',
                  isActive
                    ? 'bg-amul-red/10 text-amul-red'
                    : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'
                )
              }
            >
              <Icon size={16} />
              <span className="flex-1">{label}</span>
              <ChevronRight size={13} className="opacity-40" />
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-[hsl(var(--border))] p-2">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
          >
            <ArrowLeft size={15} />
            Back to app
          </Link>
        </div>
      </aside>

      {/* Content */}
      <div className="flex flex-1 flex-col">
        {/* Mobile top bar */}
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3 md:hidden">
          <span className="font-display font-bold text-amul-red">⚙️ Admin</span>
          <Link to="/dashboard" className="flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
            <ArrowLeft size={13} /> Back to app
          </Link>
        </div>
        <main className="flex-1 overflow-y-auto page-transition">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
