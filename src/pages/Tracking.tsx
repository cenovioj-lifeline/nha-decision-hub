import { useEffect, useState } from 'react'
import { ExternalLink, BarChart3 } from 'lucide-react'
import { dhub } from '../lib/supabase'
import { cn } from '../lib/utils'
import { differenceInDays } from 'date-fns'
import CategoryIcon from '../components/CategoryIcon'

interface TrackingItem {
  id: string
  title: string
  category: string
  created_at: string
  decisions: {
    decided_at: string
    clickup_task_id: string | null
    clickup_task_url: string | null
  }[]
  // joined from clickup_snapshot
  snapshot_status?: string
  snapshot_assignee?: string
}

interface GroupedItems {
  [status: string]: TrackingItem[]
}

const STATUS_ORDER = ['open', 'in progress', 'review', 'testing', 'done', 'closed']

export default function Tracking() {
  const [grouped, setGrouped] = useState<GroupedItems>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      // Fetch approved requests that have a clickup_task_id
      const { data: decisions } = await dhub
        .from('decisions')
        .select('request_id, decided_at, clickup_task_id, clickup_task_url')
        .eq('action', 'approve')
        .not('clickup_task_id', 'is', null)

      if (!decisions || decisions.length === 0) {
        setLoading(false)
        return
      }

      const taskIds = (decisions as { clickup_task_id: string }[]).map((d) => d.clickup_task_id)
      const requestIds = (decisions as { request_id: string }[]).map((d) => d.request_id)

      // Fetch snapshots for those tasks
      const { data: snapshots } = await dhub
        .from('clickup_snapshot')
        .select('task_id, status, assignee_name')
        .in('task_id', taskIds)

      // Fetch the requests
      const { data: requests } = await dhub
        .from('requests')
        .select('id, title, category, created_at')
        .in('id', requestIds)

      if (!requests) {
        setLoading(false)
        return
      }

      const snapshotMap = new Map<string, { status: string; assignee_name: string | null }>()
      if (snapshots) {
        for (const s of snapshots as { task_id: string; status: string; assignee_name: string | null }[]) {
          snapshotMap.set(s.task_id, s)
        }
      }

      const decisionMap = new Map<string, { decided_at: string; clickup_task_id: string | null; clickup_task_url: string | null }>()
      for (const d of decisions as { request_id: string; decided_at: string; clickup_task_id: string | null; clickup_task_url: string | null }[]) {
        decisionMap.set(d.request_id, d)
      }

      const items: TrackingItem[] = (requests as { id: string; title: string; category: string; created_at: string }[]).map((r) => {
        const dec = decisionMap.get(r.id)
        const snap = dec?.clickup_task_id ? snapshotMap.get(dec.clickup_task_id) : undefined
        return {
          ...r,
          decisions: dec ? [{ decided_at: dec.decided_at, clickup_task_id: dec.clickup_task_id, clickup_task_url: dec.clickup_task_url }] : [],
          snapshot_status: snap?.status ?? 'unknown',
          snapshot_assignee: snap?.assignee_name ?? undefined,
        }
      })

      // Group by status
      const groups: GroupedItems = {}
      for (const item of items) {
        const status = item.snapshot_status ?? 'unknown'
        if (!groups[status]) groups[status] = []
        groups[status].push(item)
      }

      setGrouped(groups)
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

  const statuses = Object.keys(grouped).sort((a, b) => {
    const ai = STATUS_ORDER.indexOf(a.toLowerCase())
    const bi = STATUS_ORDER.indexOf(b.toLowerCase())
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })

  if (statuses.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-nha-gray-900 mb-6">Tracking</h1>
        <div className="flex flex-col items-center justify-center py-20 text-nha-gray-400">
          <BarChart3 size={48} className="mb-3" />
          <p className="text-lg font-medium text-nha-gray-600">Nothing to track</p>
          <p className="text-sm mt-1">Approved requests with ClickUp tasks will appear here</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-nha-gray-900 mb-6">Tracking</h1>

      <div className="space-y-8">
        {statuses.map((status) => (
          <div key={status}>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-semibold text-nha-gray-700 uppercase tracking-wider">{status}</h2>
              <span className="text-xs bg-nha-gray-200 text-nha-gray-600 px-2 py-0.5 rounded-full">
                {grouped[status].length}
              </span>
            </div>
            <div className="space-y-2">
              {grouped[status].map((item) => {
                const dec = item.decisions[0]
                const daysSince = dec?.decided_at
                  ? differenceInDays(new Date(), new Date(dec.decided_at))
                  : 0
                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-xl border border-nha-gray-200 p-4 flex items-center gap-4"
                  >
                    <CategoryIcon category={item.category} size="sm" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-nha-gray-800 truncate">{item.title}</h3>
                      <div className="flex items-center gap-2 text-sm text-nha-gray-500 mt-0.5">
                        {item.snapshot_assignee && <span>{item.snapshot_assignee}</span>}
                        <span className={cn(
                          daysSince > 14 ? 'text-red-500 font-medium' : daysSince > 7 ? 'text-yellow-600' : '',
                        )}>
                          {daysSince}d since approved
                        </span>
                      </div>
                    </div>
                    {dec?.clickup_task_url && (
                      <a
                        href={dec.clickup_task_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-nha-sky hover:text-nha-blue shrink-0"
                      >
                        <ExternalLink size={16} />
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
