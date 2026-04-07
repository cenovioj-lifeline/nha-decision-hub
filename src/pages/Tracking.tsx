import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, ExternalLink, Search, BarChart3, Clock, AlertTriangle } from 'lucide-react'
import { dhub } from '../lib/supabase'
import { cn } from '../lib/utils'
import { differenceInDays, format, parseISO } from 'date-fns'
import CategoryIcon from '../components/CategoryIcon'

// ClickUp status pipeline order — earlier = "less progress"
const STATUS_ORDER = ['backlog', 'ready for dev', 'in progress', 'po review', 'complete', 'unknown']

const STATUS_LABEL: Record<string, string> = {
  backlog: 'Backlog',
  'ready for dev': 'Ready for Dev',
  'in progress': 'In Progress',
  'po review': 'PO Review',
  complete: 'Complete',
  unknown: 'Unknown',
}

const STATUS_COLOR: Record<string, string> = {
  backlog: 'bg-nha-gray-100 text-nha-gray-700',
  'ready for dev': 'bg-blue-100 text-blue-700',
  'in progress': 'bg-amber-100 text-amber-800',
  'po review': 'bg-purple-100 text-purple-700',
  complete: 'bg-green-100 text-green-700',
  unknown: 'bg-nha-gray-100 text-nha-gray-500',
}

interface TrackingRow {
  request_id: string
  title: string
  category: string
  requester_name: string
  decision_id: string
  decided_at: string
  priority: string | null
  clickup_task_id: string
  clickup_task_url: string
  sprint_id: string | null
  sprint_label: string | null
  sprint_start_date: string | null
  sprint_end_date: string | null
  status: string
  assignee: string | null
  synced_at: string | null
  last_updated: string | null
}

interface SprintGroup {
  key: string
  label: string
  start_date: string | null
  end_date: string | null
  is_current: boolean
  is_next: boolean
  is_recently_closed: boolean
  has_open_items: boolean
  items: TrackingRow[]
  by_status: Record<string, TrackingRow[]>
  total: number
  done_count: number
}

function buildGroups(rows: TrackingRow[]): SprintGroup[] {
  const today = new Date()

  // Bucket items by sprint_id (or 'unassigned')
  const buckets = new Map<string, TrackingRow[]>()
  for (const r of rows) {
    const key = r.sprint_id ?? 'unassigned'
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push(r)
  }

  const groups: SprintGroup[] = []
  for (const [key, items] of buckets) {
    const first = items[0]
    const start = first.sprint_start_date ? parseISO(first.sprint_start_date) : null
    const end = first.sprint_end_date ? parseISO(first.sprint_end_date) : null

    const is_current = !!(start && end && today >= start && today <= end)

    const by_status: Record<string, TrackingRow[]> = {}
    for (const item of items) {
      const status = item.status || 'unknown'
      if (!by_status[status]) by_status[status] = []
      by_status[status].push(item)
    }

    const has_open_items = items.some((i) => i.status !== 'complete')
    const done_count = items.filter((i) => i.status === 'complete').length

    groups.push({
      key,
      label: first.sprint_label ?? 'Unassigned',
      start_date: first.sprint_start_date,
      end_date: first.sprint_end_date,
      is_current,
      is_next: false, // computed in second pass
      is_recently_closed: false, // computed in second pass
      has_open_items,
      items,
      by_status,
      total: items.length,
      done_count,
    })
  }

  // Sort by sprint start_date, unassigned at the bottom
  groups.sort((a, b) => {
    if (a.key === 'unassigned') return 1
    if (b.key === 'unassigned') return -1
    if (!a.start_date) return 1
    if (!b.start_date) return -1
    return a.start_date.localeCompare(b.start_date)
  })

  // Mark "next" = first sprint after the current that hasn't started yet
  let foundCurrent = false
  for (const g of groups) {
    if (g.is_current) { foundCurrent = true; continue }
    if (foundCurrent && g.start_date && parseISO(g.start_date) > today) {
      g.is_next = true
      break
    }
  }
  // If no current sprint, mark the next future sprint
  if (!groups.some((g) => g.is_current)) {
    for (const g of groups) {
      if (g.start_date && parseISO(g.start_date) > today) {
        g.is_next = true
        break
      }
    }
  }

  // Mark "most recently closed" — last past sprint (highest end_date that is <= today)
  let mostRecentClosed: SprintGroup | undefined
  for (const g of groups) {
    if (g.end_date && parseISO(g.end_date) < today) {
      if (!mostRecentClosed || (g.end_date > (mostRecentClosed.end_date ?? ''))) {
        mostRecentClosed = g
      }
    }
  }
  if (mostRecentClosed) mostRecentClosed.is_recently_closed = true

  return groups
}

function isVisibleByDefault(g: SprintGroup): boolean {
  return g.is_current || g.is_next || g.is_recently_closed || g.has_open_items || g.key === 'unassigned'
}

export default function Tracking() {
  const [rows, setRows] = useState<TrackingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setError('')
      try {
        // Pull all approved+executed decisions with clickup_task_ids
        const { data: decisions, error: dErr } = await dhub
          .from('decisions')
          .select(`
            id, decided_at, priority, sprint_id, clickup_task_id, clickup_task_url, request_id,
            requests(id, title, category, requester_name),
            sprints(id, label, start_date, end_date)
          `)
          .eq('action', 'approve')
          .eq('executed', true)
          .not('clickup_task_id', 'is', null)
        if (dErr) throw dErr

        const decRows = (decisions as unknown as Array<{
          id: string
          decided_at: string
          priority: string | null
          sprint_id: string | null
          clickup_task_id: string
          clickup_task_url: string
          request_id: string
          requests: { id: string; title: string; category: string; requester_name: string } | null
          sprints: { id: string; label: string; start_date: string; end_date: string } | null
        }>) ?? []

        if (decRows.length === 0) {
          setRows([])
          setLoading(false)
          return
        }

        const taskIds = decRows.map((d) => d.clickup_task_id)
        const { data: snapshots } = await dhub
          .from('clickup_snapshot')
          .select('task_id, status, assignee_name, synced_at, last_updated')
          .in('task_id', taskIds)
        const snapMap = new Map<string, { status: string; assignee_name: string | null; synced_at: string | null; last_updated: string | null }>()
        for (const s of (snapshots ?? [])) {
          snapMap.set((s as { task_id: string }).task_id, s as { status: string; assignee_name: string | null; synced_at: string | null; last_updated: string | null })
        }

        const out: TrackingRow[] = decRows
          .filter((d) => d.requests)
          .map((d) => {
            const snap = snapMap.get(d.clickup_task_id)
            return {
              request_id: d.requests!.id,
              title: d.requests!.title,
              category: d.requests!.category,
              requester_name: d.requests!.requester_name,
              decision_id: d.id,
              decided_at: d.decided_at,
              priority: d.priority,
              clickup_task_id: d.clickup_task_id,
              clickup_task_url: d.clickup_task_url,
              sprint_id: d.sprint_id,
              sprint_label: d.sprints?.label ?? null,
              sprint_start_date: d.sprints?.start_date ?? null,
              sprint_end_date: d.sprints?.end_date ?? null,
              status: (snap?.status ?? 'unknown').toLowerCase(),
              assignee: snap?.assignee_name ?? null,
              synced_at: snap?.synced_at ?? null,
              last_updated: snap?.last_updated ?? null,
            }
          })

        setRows(out)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tracking data')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const groups = useMemo(() => buildGroups(rows), [rows])

  // Apply search filter (matches title, requester, assignee, sprint label)
  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groups
    const q = search.trim().toLowerCase()
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (i) =>
            i.title.toLowerCase().includes(q) ||
            i.requester_name.toLowerCase().includes(q) ||
            (i.assignee ?? '').toLowerCase().includes(q) ||
            (i.sprint_label ?? '').toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.items.length > 0)
      .map((g) => ({
        ...g,
        by_status: Object.fromEntries(
          Object.entries(
            g.items.reduce<Record<string, TrackingRow[]>>((acc, item) => {
              const s = item.status || 'unknown'
              if (!acc[s]) acc[s] = []
              acc[s].push(item)
              return acc
            }, {}),
          ),
        ),
        total: g.items.length,
        done_count: g.items.filter((i) => i.status === 'complete').length,
      }))
  }, [groups, search])

  // Visibility: when showAll is on, show everything; otherwise apply default rule.
  // When searching, show every group that has matching items.
  const visibleGroups = useMemo(() => {
    if (search.trim()) return filteredGroups
    if (showAll) return filteredGroups
    return filteredGroups.filter(isVisibleByDefault)
  }, [filteredGroups, showAll, search])

  // Initialize collapsed state — current sprint expanded, others collapsed
  useEffect(() => {
    if (groups.length === 0) return
    const init: Record<string, boolean> = {}
    for (const g of groups) {
      // Expanded: current sprint, plus the only-1 case
      init[g.key] = !(g.is_current || groups.length === 1)
    }
    setCollapsed((prev) => {
      // Don't override anything the user has already toggled
      const merged = { ...init, ...prev }
      return merged
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups.length])

  function toggleCollapsed(key: string) {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nha-blue" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-nha-gray-900 mb-6">Tracking</h1>
        <div className="flex flex-col items-center justify-center py-20 text-nha-gray-400">
          <BarChart3 size={48} className="mb-3" />
          <p className="text-lg font-medium text-nha-gray-600">Nothing to track yet</p>
          <p className="text-sm mt-1">Approved requests with ClickUp tasks will appear here.</p>
        </div>
      </div>
    )
  }

  // Latest snapshot sync time across all rows (for "last updated" indicator)
  const latestSync = rows.reduce<string | null>((acc, r) => {
    if (!r.synced_at) return acc
    if (!acc || r.synced_at > acc) return r.synced_at
    return acc
  }, null)

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-nha-gray-900">Tracking</h1>
          <p className="text-sm text-nha-gray-500 mt-0.5">
            Decision Hub items in flight on ClickUp
            {latestSync && (
              <>
                {' · '}
                <span className="text-nha-gray-400">last sync {format(parseISO(latestSync), 'MMM d, h:mm a')}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nha-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, requester, assignee, sprint"
              className="pl-9 pr-4 py-2 text-sm border border-nha-gray-200 rounded-lg w-72 focus:outline-none focus:ring-2 focus:ring-nha-blue/20 focus:border-nha-blue/40"
            />
          </div>
          <button
            onClick={() => setShowAll((v) => !v)}
            className={cn(
              'text-sm px-3 py-2 rounded-lg border transition-colors',
              showAll
                ? 'bg-nha-blue text-white border-nha-blue'
                : 'border-nha-gray-200 text-nha-gray-700 hover:bg-nha-gray-50',
            )}
          >
            {showAll ? 'Hide older' : 'Show older sprints'}
          </button>
        </div>
      </div>

      {visibleGroups.length === 0 && (
        <div className="text-center text-nha-gray-400 py-12">
          {search.trim() ? `No matches for "${search}"` : 'No active sprints with items right now.'}
        </div>
      )}

      <div className="space-y-4">
        {visibleGroups.map((g) => {
          const isCollapsed = collapsed[g.key] ?? !g.is_current
          const allDone = g.total > 0 && g.done_count === g.total
          return (
            <div key={g.key} className="bg-white rounded-2xl border border-nha-gray-200 overflow-hidden">
              <button
                onClick={() => toggleCollapsed(g.key)}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-nha-gray-50 transition-colors text-left"
              >
                {isCollapsed ? <ChevronRight size={18} className="text-nha-gray-400 shrink-0" /> : <ChevronDown size={18} className="text-nha-gray-400 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-semibold text-nha-gray-800">{g.label}</h2>
                    {g.is_current && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Current</span>}
                    {g.is_next && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Next</span>}
                    {g.is_recently_closed && <span className="text-xs bg-nha-gray-100 text-nha-gray-600 px-2 py-0.5 rounded-full font-medium">Just closed</span>}
                    {!g.is_current && !g.is_next && !g.is_recently_closed && g.has_open_items && g.end_date && parseISO(g.end_date) < new Date() && (
                      <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1">
                        <AlertTriangle size={10} />
                        Slipped
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm text-nha-gray-500 shrink-0">
                  <span>{g.done_count}/{g.total} done</span>
                  {allDone && <span className="text-green-600 font-medium">✓</span>}
                </div>
              </button>

              {!isCollapsed && (
                <div className="border-t border-nha-gray-100 p-5 space-y-5">
                  {STATUS_ORDER.filter((s) => g.by_status[s]?.length).map((status) => (
                    <div key={status}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', STATUS_COLOR[status])}>
                          {STATUS_LABEL[status]}
                        </span>
                        <span className="text-xs text-nha-gray-400">{g.by_status[status].length}</span>
                      </div>
                      <div className="space-y-2">
                        {g.by_status[status].map((item) => {
                          const daysSince = differenceInDays(new Date(), parseISO(item.decided_at))
                          const isStale = item.status !== 'complete' && daysSince > 14
                          const isWarning = item.status !== 'complete' && daysSince > 7 && daysSince <= 14
                          return (
                            <div
                              key={item.decision_id}
                              className="flex items-center gap-3 p-3 rounded-xl border border-nha-gray-100 hover:border-nha-gray-200 hover:bg-nha-gray-50/50 transition-colors"
                            >
                              <CategoryIcon category={item.category} size="sm" />
                              <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-medium text-nha-gray-800 truncate">{item.title}</h3>
                                <div className="flex items-center gap-2 text-xs text-nha-gray-500 mt-0.5 flex-wrap">
                                  <span>{item.requester_name}</span>
                                  {item.assignee && (
                                    <>
                                      <span>·</span>
                                      <span>→ {item.assignee}</span>
                                    </>
                                  )}
                                  <span>·</span>
                                  <span className={cn('inline-flex items-center gap-1', isStale ? 'text-red-600 font-medium' : isWarning ? 'text-amber-600' : '')}>
                                    <Clock size={10} />
                                    {daysSince}d
                                  </span>
                                </div>
                              </div>
                              <a
                                href={item.clickup_task_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-nha-sky hover:text-nha-blue shrink-0"
                                title="Open in ClickUp"
                              >
                                <ExternalLink size={14} />
                              </a>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
