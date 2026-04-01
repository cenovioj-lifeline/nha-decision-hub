import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, ExternalLink, ChevronDown, Clock, CheckCircle, XCircle, ArrowRight, Filter, ArrowUpDown } from 'lucide-react'
import { dhub } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { formatDate } from '../lib/utils'

interface Decision {
  action: string
  rationale: string | null
  clickup_task_url: string | null
  decided_at: string | null
  priority: string | null
  sprints: { label: string }[] | null
}

interface Request {
  id: string
  title: string
  category: string
  status: string
  requester_name: string
  requester_email: string
  created_at: string
  decisions: Decision[]
}

interface PersonOption {
  name: string
  email: string
}

type OutcomeFilter = 'all' | 'pending' | 'approved' | 'declined' | 'deferred' | 'other'

function getOutcome(req: Request): { label: string; type: OutcomeFilter } {
  const decision = req.decisions?.[0]
  if (!decision) return { label: 'Pending review', type: 'pending' }
  switch (decision.action) {
    case 'approve': return { label: 'Approved', type: 'approved' }
    case 'decline': return { label: 'Declined', type: 'declined' }
    case 'on_hold': return { label: 'On Hold', type: 'pending' }
    default: return { label: decision.action, type: 'other' }
  }
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

const OUTCOME_ICON: Record<string, typeof Clock> = {
  pending: Clock,
  approved: CheckCircle,
  declined: XCircle,
  deferred: ArrowRight,
  other: ArrowRight,
}

const OUTCOME_STYLE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  declined: 'bg-nha-gray-100 text-nha-gray-600 border-nha-gray-200',
  deferred: 'bg-blue-50 text-blue-600 border-blue-200',
  other: 'bg-nha-gray-50 text-nha-gray-500 border-nha-gray-200',
}

function OutcomeBadge({ type, label }: { type: string; label: string }) {
  const Icon = OUTCOME_ICON[type] || ArrowRight
  const style = OUTCOME_STYLE[type] || OUTCOME_STYLE.other
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border whitespace-nowrap ${style}`}>
      <Icon size={12} />
      {label}
    </span>
  )
}

const FILTER_OPTIONS: { value: OutcomeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'declined', label: 'Declined' },
  { value: 'deferred', label: 'Deferred' },
]

export default function RequestsAndDecisions() {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const [requests, setRequests] = useState<Request[]>([])
  const [people, setPeople] = useState<PersonOption[]>([])
  const [selectedPerson, setSelectedPerson] = useState<string>('all')
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('all')
  const [sortNewest, setSortNewest] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAll() {
      const { data } = await dhub
        .from('requests')
        .select('id, title, category, status, requester_name, requester_email, created_at, decisions(action, rationale, clickup_task_url, decided_at, priority, sprints(label))')
        .order('created_at', { ascending: false })

      const all = (data as Request[]) ?? []
      setRequests(all)

      const seen = new Map<string, string>()
      for (const r of all) {
        if (r.requester_email && !seen.has(r.requester_email)) {
          seen.set(r.requester_email, r.requester_name || r.requester_email)
        }
      }
      setPeople(
        Array.from(seen.entries())
          .map(([email, name]) => ({ email, name }))
          .sort((a, b) => a.name.localeCompare(b.name))
      )
      setLoading(false)
    }
    fetchAll()
  }, [])

  const filtered = useMemo(() => {
    let result = requests

    if (selectedPerson !== 'all') {
      result = result.filter(r => r.requester_email === selectedPerson)
    }

    if (outcomeFilter !== 'all') {
      result = result.filter(r => getOutcome(r).type === outcomeFilter)
    }

    // Sort by submitted date
    result = [...result].sort((a, b) => {
      const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      return sortNewest ? -diff : diff
    })

    return result
  }, [requests, selectedPerson, outcomeFilter, sortNewest])

  // Counts for filter pills
  const counts = useMemo(() => {
    const base = selectedPerson === 'all'
      ? requests
      : requests.filter(r => r.requester_email === selectedPerson)
    const c: Record<string, number> = { all: base.length, pending: 0, approved: 0, declined: 0, deferred: 0 }
    for (const r of base) {
      const type = getOutcome(r).type
      if (type in c) c[type]++
    }
    return c
  }, [requests, selectedPerson])

  // Group: pending first when showing "all" or "pending"
  const { pending, decided } = useMemo(() => {
    if (outcomeFilter !== 'all') return { pending: [], decided: filtered }
    const p: Request[] = []
    const d: Request[] = []
    for (const req of filtered) {
      if (getOutcome(req).type === 'pending') p.push(req)
      else d.push(req)
    }
    return { pending: p, decided: d }
  }, [filtered, outcomeFilter])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nha-blue" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-nha-gray-900">Requests & Decisions</h1>
          <p className="text-sm text-nha-gray-500 mt-1">
            {filtered.length} of {requests.length} requests
            {counts.pending > 0 && outcomeFilter === 'all' && ` · ${counts.pending} awaiting review`}
          </p>
        </div>
        {isAdmin && (
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
        )}
      </div>

      {/* Filter pills + sort */}
      <div className="flex items-center gap-1 mb-6">
        <Filter size={14} className="text-nha-gray-400 mr-1" />
        {FILTER_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setOutcomeFilter(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              outcomeFilter === opt.value
                ? 'bg-nha-blue text-white'
                : 'bg-nha-gray-100 text-nha-gray-600 hover:bg-nha-gray-200'
            }`}
          >
            {opt.label}
            {counts[opt.value] > 0 && (
              <span className={`ml-1.5 ${outcomeFilter === opt.value ? 'text-white/70' : 'text-nha-gray-400'}`}>
                {counts[opt.value]}
              </span>
            )}
          </button>
        ))}
        <div className="ml-auto">
          <button
            onClick={() => setSortNewest(prev => !prev)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-nha-gray-500 bg-nha-gray-50 hover:bg-nha-gray-100 transition-colors"
          >
            <ArrowUpDown size={12} />
            {sortNewest ? 'Newest first' : 'Oldest first'}
          </button>
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-nha-gray-400">
          <FileText size={48} className="mb-3" />
          <p className="text-lg font-medium text-nha-gray-600">No requests found</p>
          <p className="text-sm mt-1">Try adjusting your filters</p>
        </div>
      ) : outcomeFilter === 'all' ? (
        /* Grouped view when showing all */
        <div className="space-y-8">
          {pending.length > 0 && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-amber-600 mb-3">
                Awaiting Review ({pending.length})
              </h2>
              <div className="space-y-2">
                {pending.map(req => <RequestCard key={req.id} request={req} onClick={() => navigate(`/requests/${req.id}`)} />)}
              </div>
            </div>
          )}
          {decided.length > 0 && (
            <div>
              {pending.length > 0 && (
                <h2 className="text-xs font-bold uppercase tracking-wider text-nha-gray-400 mb-3">
                  Decided ({decided.length})
                </h2>
              )}
              <div className="space-y-2">
                {decided.map(req => <RequestCard key={req.id} request={req} onClick={() => navigate(`/requests/${req.id}`)} />)}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Flat list when filtered to a specific outcome */
        <div className="space-y-2">
          {filtered.map(req => <RequestCard key={req.id} request={req} onClick={() => navigate(`/requests/${req.id}`)} />)}
        </div>
      )}
    </div>
  )
}

function RequestCard({ request: req, onClick }: { request: Request; onClick: () => void }) {
  const decision = req.decisions?.[0]
  const outcome = getOutcome(req)
  const waiting = daysSince(req.created_at)

  return (
    <div
      className="bg-white rounded-xl border border-nha-gray-200 px-5 py-4 cursor-pointer hover:border-nha-gray-300 hover:shadow-sm transition-all"
      onClick={onClick}
    >
      {/* Row 1: Title + outcome badge */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-semibold text-nha-gray-900 text-[15px] leading-snug">{req.title || '(No title)'}</h3>
        <OutcomeBadge type={outcome.type} label={outcome.label} />
      </div>

      {/* Row 2: Meta line */}
      <div className="flex items-center gap-1.5 text-xs text-nha-gray-400 flex-wrap">
        <span>{req.requester_name}</span>
        {req.category && (
          <>
            <span>·</span>
            <span className="capitalize">{req.category}</span>
          </>
        )}
        <span>·</span>
        <span>Submitted {formatDate(req.created_at)}</span>
        {outcome.type === 'pending' && waiting >= 2 && (
          <>
            <span>·</span>
            <span className="text-amber-600 font-medium">{waiting}d ago</span>
          </>
        )}
      </div>

      {/* Row 3: Decision details (only if decided) */}
      {decision && (
        <div className="mt-3 pt-3 border-t border-nha-gray-100">
          <div className="flex items-center gap-1.5 text-xs text-nha-gray-400 flex-wrap">
            <span>Responded {decision.decided_at ? formatDate(decision.decided_at) : ''}</span>
            {decision.action === 'approve' && decision.priority && (
              <>
                <span>·</span>
                <span className="capitalize">{decision.priority} priority</span>
              </>
            )}
            {decision.action === 'approve' && decision.sprints?.[0]?.label && (
              <>
                <span>·</span>
                <span>Sprint {decision.sprints[0].label}</span>
              </>
            )}
          </div>

          {decision.rationale && (
            <p className="text-sm text-nha-gray-600 leading-relaxed mt-1">{decision.rationale}</p>
          )}

          {decision.action === 'approve' && decision.clickup_task_url && (
            <a
              href={decision.clickup_task_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-xs font-medium text-nha-sky hover:underline mt-2"
            >
              Track in ClickUp <ExternalLink size={11} />
            </a>
          )}
        </div>
      )}
    </div>
  )
}
