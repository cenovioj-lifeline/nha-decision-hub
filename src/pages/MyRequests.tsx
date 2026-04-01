import { useEffect, useState } from 'react'
import { FileText, ExternalLink, ChevronDown } from 'lucide-react'
import { dhub } from '../lib/supabase'
import { formatDate } from '../lib/utils'
import StatusBadge from '../components/StatusBadge'
import CategoryIcon from '../components/CategoryIcon'

interface Request {
  id: string
  title: string
  category: string
  status: string
  requester_name: string
  requester_email: string
  created_at: string
  decisions: {
    action: string
    rationale: string | null
    clickup_task_url: string | null
  }[]
}

interface PersonOption {
  name: string
  email: string
}

export default function MyRequests() {
  const [requests, setRequests] = useState<Request[]>([])
  const [people, setPeople] = useState<PersonOption[]>([])
  const [selectedPerson, setSelectedPerson] = useState<string>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAll() {
      const { data } = await dhub
        .from('requests')
        .select('id, title, category, status, requester_name, requester_email, created_at, decisions(action, rationale, clickup_task_url)')
        .order('created_at', { ascending: false })

      const all = (data as Request[]) ?? []
      setRequests(all)

      // Build unique person list from data
      const seen = new Map<string, string>()
      for (const r of all) {
        if (r.requester_email && !seen.has(r.requester_email)) {
          seen.set(r.requester_email, r.requester_name || r.requester_email)
        }
      }
      const sorted = Array.from(seen.entries())
        .map(([email, name]) => ({ email, name }))
        .sort((a, b) => a.name.localeCompare(b.name))
      setPeople(sorted)
      setLoading(false)
    }
    fetchAll()
  }, [])

  const filtered = selectedPerson === 'all'
    ? requests
    : requests.filter(r => r.requester_email === selectedPerson)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nha-blue" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-nha-gray-900">Requests</h1>
          <p className="text-sm text-nha-gray-500 mt-1">
            {filtered.length} request{filtered.length !== 1 ? 's' : ''}{selectedPerson !== 'all' ? ` from ${people.find(p => p.email === selectedPerson)?.name}` : ''}
          </p>
        </div>
        <div className="relative">
          <select
            value={selectedPerson}
            onChange={e => setSelectedPerson(e.target.value)}
            className="appearance-none bg-white border border-nha-gray-200 rounded-lg px-4 py-2 pr-9 text-sm font-medium text-nha-gray-700 cursor-pointer hover:border-nha-gray-300 focus:outline-none focus:ring-2 focus:ring-nha-blue/20 focus:border-nha-blue"
          >
            <option value="all">All People</option>
            {people.map(p => (
              <option key={p.email} value={p.email}>{p.name}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-nha-gray-400 pointer-events-none" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-nha-gray-400">
          <FileText size={48} className="mb-3" />
          <p className="text-lg font-medium text-nha-gray-600">No requests found</p>
          <p className="text-sm mt-1">
            {selectedPerson !== 'all' ? 'No requests from this person' : 'No requests have been submitted yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((req) => {
            const decision = req.decisions?.[0]
            return (
              <div
                key={req.id}
                className="bg-white rounded-xl border border-nha-gray-200 p-4"
              >
                <div className="flex items-start gap-3">
                  <CategoryIcon category={req.category} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-nha-gray-900">{req.title}</h3>
                      <StatusBadge value={req.status} />
                    </div>
                    <p className="text-sm text-nha-gray-500">
                      {req.requester_name} &middot; {formatDate(req.created_at)}
                    </p>

                    {decision && (
                      <div className="mt-3 bg-nha-gray-50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <StatusBadge value={decision.action} type="action" />
                        </div>
                        {decision.rationale && (
                          <p className="text-sm text-nha-gray-600 mt-1">{decision.rationale}</p>
                        )}
                        {decision.action === 'approve' && decision.clickup_task_url && (
                          <a
                            href={decision.clickup_task_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-nha-sky hover:underline mt-2"
                          >
                            Track in ClickUp <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
