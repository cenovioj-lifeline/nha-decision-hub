import { useEffect, useState } from 'react'
import { Inbox, CheckSquare, BarChart3, CheckCircle, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { dhub } from '../lib/supabase'
import { timeAgo } from '../lib/utils'
import { cn } from '../lib/utils'
import { subDays } from 'date-fns'
import StatusBadge from '../components/StatusBadge'
import CategoryIcon from '../components/CategoryIcon'

interface Stats {
  inboxCount: number
  decisionsThisWeek: number
  inProgressCount: number
  completedCount: number
}

interface CategoryCount {
  category: string
  count: number
}

interface RecentActivity {
  id: string
  title: string
  category: string
  status: string
  updated_at: string
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats>({ inboxCount: 0, decisionsThisWeek: 0, inProgressCount: 0, completedCount: 0 })
  const [categories, setCategories] = useState<CategoryCount[]>([])
  const [recent, setRecent] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const weekAgo = subDays(new Date(), 7).toISOString()

      const [inboxRes, decisionsRes, trackingRes, completedRes, allReqs, recentRes] = await Promise.all([
        dhub.from('requests').select('id', { count: 'exact', head: true }).eq('status', 'new').is('consolidated_into', null),
        dhub.from('decisions').select('id', { count: 'exact', head: true }).gte('decided_at', weekAgo),
        dhub.from('requests').select('id', { count: 'exact', head: true }).eq('status', 'tracking'),
        dhub.from('requests').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
        dhub.from('requests').select('category').neq('status', 'consolidated'),
        dhub.from('requests').select('id, title, category, status, updated_at').neq('status', 'consolidated').order('updated_at', { ascending: false }).limit(8),
      ])

      setStats({
        inboxCount: inboxRes.count ?? 0,
        decisionsThisWeek: decisionsRes.count ?? 0,
        inProgressCount: trackingRes.count ?? 0,
        completedCount: completedRes.count ?? 0,
      })

      // Category breakdown
      if (allReqs.data) {
        const counts: Record<string, number> = {}
        for (const r of allReqs.data as { category: string }[]) {
          counts[r.category] = (counts[r.category] ?? 0) + 1
        }
        setCategories(
          Object.entries(counts)
            .map(([category, count]) => ({ category, count }))
            .sort((a, b) => b.count - a.count),
        )
      }

      setRecent((recentRes.data as RecentActivity[]) ?? [])
      setLoading(false)
    }
    fetch()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nha-blue" />
      </div>
    )
  }

  const statCards = [
    { label: 'Inbox', value: stats.inboxCount, icon: Inbox, color: 'text-nha-sky', bg: 'bg-nha-sky-light', to: '/inbox' },
    { label: 'Decisions (7d)', value: stats.decisionsThisWeek, icon: CheckSquare, color: 'text-nha-blue', bg: 'bg-nha-blue-light', to: '/decisions' },
    { label: 'In Progress', value: stats.inProgressCount, icon: BarChart3, color: 'text-nha-orange', bg: 'bg-nha-orange-light', to: '/tracking' },
    { label: 'Completed', value: stats.completedCount, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100', to: null },
  ]

  const maxCategoryCount = Math.max(...categories.map((c) => c.count), 1)

  return (
    <div>
      <h1 className="text-2xl font-bold text-nha-gray-900 mb-6">Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <button
              key={card.label}
              onClick={() => card.to && navigate(card.to)}
              className={cn(
                'bg-white rounded-2xl border border-nha-gray-200 p-5 text-left transition-all',
                card.to ? 'hover:shadow-md hover:border-nha-sky cursor-pointer' : 'cursor-default',
              )}
            >
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-3', card.bg)}>
                <Icon size={20} className={card.color} />
              </div>
              <p className="text-3xl font-bold text-nha-gray-900">{card.value}</p>
              <p className="text-sm text-nha-gray-500 mt-0.5">{card.label}</p>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category breakdown */}
        <div className="bg-white rounded-2xl border border-nha-gray-200 p-6">
          <h2 className="font-semibold text-nha-gray-800 mb-4">By Category</h2>
          {categories.length === 0 ? (
            <p className="text-sm text-nha-gray-400">No data yet</p>
          ) : (
            <div className="space-y-3">
              {categories.map((cat) => (
                <div key={cat.category} className="flex items-center gap-3">
                  <CategoryIcon category={cat.category} size="sm" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-nha-gray-700 capitalize">{cat.category}</span>
                      <span className="text-sm text-nha-gray-500">{cat.count}</span>
                    </div>
                    <div className="w-full bg-nha-gray-100 rounded-full h-2">
                      <div
                        className="bg-nha-sky rounded-full h-2 transition-all"
                        style={{ width: `${(cat.count / maxCategoryCount) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="bg-white rounded-2xl border border-nha-gray-200 p-6">
          <h2 className="font-semibold text-nha-gray-800 mb-4">Recent Activity</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-nha-gray-400">No activity yet</p>
          ) : (
            <div className="space-y-3">
              {recent.map((r) => (
                <button
                  key={r.id}
                  onClick={() => navigate(`/requests/${r.id}`)}
                  className="w-full flex items-center gap-3 text-left hover:bg-nha-gray-50 rounded-lg p-2 -mx-2 transition-colors"
                >
                  <CategoryIcon category={r.category} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-nha-gray-800 truncate">{r.title}</p>
                    <p className="text-xs text-nha-gray-400">{timeAgo(r.updated_at)}</p>
                  </div>
                  <StatusBadge value={r.status} />
                  <ArrowRight size={14} className="text-nha-gray-300" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
