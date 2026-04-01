import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Inbox,
  LayoutDashboard,
  FileText,
  LogIn,
  LogOut,
  Menu,
  X,
  Bell,
  Calendar,
  Eye,
  Settings,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { cn } from '../lib/utils'

interface NavItem {
  to: string
  label: string
  icon: typeof Inbox
  adminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/inbox', label: 'Inbox', icon: Inbox, adminOnly: true },
  { to: '/sprints', label: 'Sprints', icon: Calendar, adminOnly: true },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, adminOnly: true },
  { to: '/requests', label: 'Requests & Decisions', icon: FileText },
  { to: '/admin', label: 'Admin', icon: Settings, adminOnly: true },
]

export default function Layout() {
  const { user, isAdmin, isViewer, signOut, exitViewMode } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Viewers see all nav items (read-only access to everything)
  const visibleItems = NAV_ITEMS.filter((item) => isViewer || !item.adminOnly || isAdmin)

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-nha-blue flex flex-col transition-transform lg:translate-x-0 lg:static lg:z-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
          <div>
            <h1 className="text-white font-bold text-lg tracking-tight">Decision Hub</h1>
            <p className="text-white/50 text-xs">NHA App Development</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/60 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-white/15 text-white'
                      : 'text-white/60 hover:bg-white/10 hover:text-white',
                  )
                }
              >
                <Icon size={18} />
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        <div className="px-3 py-4 border-t border-white/10">
          {isViewer ? (
            <>
              <div className="px-3 mb-3 flex items-center gap-2">
                <Eye size={14} className="text-white/40" />
                <div>
                  <p className="text-white text-sm font-medium">View Only</p>
                  <p className="text-white/40 text-xs">Read-only access</p>
                </div>
              </div>
              <button
                onClick={() => {
                  exitViewMode()
                  navigate('/login')
                }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:bg-white/10 hover:text-white transition-colors w-full"
              >
                <LogIn size={18} />
                Sign In
              </button>
            </>
          ) : (
            <>
              <div className="px-3 mb-3">
                <p className="text-white text-sm font-medium truncate">{user?.email}</p>
                <p className="text-white/40 text-xs">{isAdmin ? 'Admin' : 'Member'}</p>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:bg-white/10 hover:text-white transition-colors w-full"
              >
                <LogOut size={18} />
                Sign Out
              </button>
            </>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-nha-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-nha-gray-500 hover:text-nha-gray-700"
          >
            <Menu size={24} />
          </button>
          <div className="lg:flex-1" />
          <div className="flex items-center gap-3">
            {isViewer ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-nha-gray-100 text-xs font-medium text-nha-gray-500">
                <Eye size={12} />
                View Only
              </span>
            ) : (
              <>
                <button className="relative text-nha-gray-400 hover:text-nha-gray-600 transition-colors">
                  <Bell size={20} />
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-nha-orange text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    0
                  </span>
                </button>
                <div className="hidden sm:flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-nha-blue flex items-center justify-center text-white text-xs font-bold">
                    {user?.email?.charAt(0).toUpperCase()}
                  </div>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
