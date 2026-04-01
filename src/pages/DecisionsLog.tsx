import { useEffect, useState } from 'react'
import { ExternalLink, Filter, CheckSquare } from 'lucide-react'
import { dhub } from '../lib/supabase'
import { formatDate } from '../lib/utils'
import { cn } from '../lib/utils'
import StatusBadge from '../components/StatusBadge'
import CategoryIcon from '../components/CategoryIcon'

interface RequestInfo {
  title: string
  category: string
  requester_name: string
}

interface DecisionRow {
  id: string
  action: string
  rationale: string | null
  priority: string | null
  clickup_task_url: string | null
  decided_at: string
  requests: RequestInfo | RequestInfo[] | null
}

const ACTION_FILTERS = ['all', 'approve', 'decline', 'on_hold']

function getRequest(d: DecisionRow): RequestInfo | null {
  if (!d.requests) return null
  if (Array.isArray(d.requests)) return d.requests[0] ?? null
  return d.requests
}

export default function DecisionsLog() {
  const [decisions, setDecisions] = useState<DecisionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState('all')

  useEffect(() => {
    async function fetch() {
      let query = dhub
        .from('decisions')
        .select('id, action, rationale, priority, clickup_task_url, decided_at, requests(title, category, requester_name)')
        .order('decided_at', { ascending: false })

      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter)
      }

      const { data } = await query
      setDecisions((data as DecisionRow[]) ?? [])
      setLoading(false)
    }
    fetch()
  }, [actionFilter])

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-nha-gray-900">Decisions Log</h1>
          <p className="text-sm text-nha-gray-500 mt-1">
            {decisions.length} decision{decisions.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-nha-gray-400" />
          <div className="flex gap-1">
            {ACTION_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => { setLoading(true); setActionFilter(f) }}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all',
                  actionFilter === f
                    ? 'bg-nha-blue text-white'
                    : 'bg-nha-gray-100 text-nha-gray-600 hover:bg-nha-gray-200',
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nha-blue" />
        </div>
      ) : decisions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-nha-gray-400">
          <CheckSquare size={48} className="mb-3" />
          <p className="text-lg font-medium text-nha-gray-600">No decisions yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-nha-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-nha-gray-50 border-b border-nha-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-nha-gray-500">Request</th>
                  <th className="text-left px-4 py-3 font-medium text-nha-gray-500">Requester</th>
                  <th className="text-left px-4 py-3 font-medium text-nha-gray-500">Action</th>
                  <th className="text-left px-4 py-3 font-medium text-nha-gray-500">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-nha-gray-500">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nha-gray-100">
                {decisions.map((d) => {
                  const req = getRequest(d)
                  return (
                  <tr key={d.id} className="hover:bg-nha-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <CategoryIcon category={req?.category ?? 'feature'} size="sm" />
                        <span className="font-medium text-nha-gray-800 truncate max-w-[250px]">
                          {req?.title ?? 'Unknown'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-nha-gray-600">
                      {req?.requester_name ?? 'Unknown'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={d.action} type="action" />
                    </td>
                    <td className="px-4 py-3 text-nha-gray-500 whitespace-nowrap">
                      {formatDate(d.decided_at)}
                    </td>
                    <td className="px-4 py-3">
                      {d.clickup_task_url && (
                        <a
                          href={d.clickup_task_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-nha-sky hover:text-nha-blue"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
