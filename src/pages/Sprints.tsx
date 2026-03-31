import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, ChevronDown, ChevronRight, Clock, Target } from 'lucide-react'
import { dhub } from '../lib/supabase'
import { cn } from '../lib/utils'
import StatusBadge from '../components/StatusBadge'
import CategoryIcon from '../components/CategoryIcon'

interface Sprint {
  id: string
  label: string
  start_date: string
  end_date: string
  status: string
}

interface SprintTask {
  request_id: string
  title: string
  category: string
  priority: string | null
  cenovio_estimate: number | null
  decided_at: string
  clickup_task_url: string | null
  status: string
}

const CAPACITY_HOURS = 40

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700 border-green-200',
  planned: 'bg-nha-sky-light text-nha-sky border-nha-sky/20',
  completed: 'bg-nha-gray-100 text-nha-gray-600 border-nha-gray-200',
}

export default function Sprints() {
  const navigate = useNavigate()
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [tasksBySprint, setTasksBySprint] = useState<Record<string, SprintTask[]>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const { data: sprintData } = await dhub
        .from('sprints')
        .select('*')
        .order('start_date', { ascending: true })

      if (!sprintData) {
        setLoading(false)
        return
      }
      setSprints(sprintData as Sprint[])

      // Auto-expand active sprints
      const activeIds = new Set(
        (sprintData as Sprint[]).filter((s) => s.status === 'active').map((s) => s.id),
      )
      setExpanded(activeIds)

      // Fetch decisions with sprint assignments
      const { data: decisions } = await dhub
        .from('decisions')
        .select('request_id, sprint_id, cenovio_estimate, priority, decided_at, clickup_task_url, requests(title, category, status)')
        .eq('action', 'approve')
        .not('sprint_id', 'is', null)

      if (decisions) {
        const grouped: Record<string, SprintTask[]> = {}
        for (const d of decisions as any[]) {
          const sprintId = d.sprint_id
          if (!sprintId) continue
          const req = Array.isArray(d.requests) ? d.requests[0] : d.requests
          if (!req) continue
          if (!grouped[sprintId]) grouped[sprintId] = []
          grouped[sprintId].push({
            request_id: d.request_id,
            title: req.title,
            category: req.category,
            priority: d.priority,
            cenovio_estimate: d.cenovio_estimate,
            decided_at: d.decided_at,
            clickup_task_url: d.clickup_task_url,
            status: req.status,
          })
        }
        setTasksBySprint(grouped)
      }

      setLoading(false)
    }
    fetch()
  }, [])

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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
          <h1 className="text-2xl font-bold text-nha-gray-900">Sprints</h1>
          <p className="text-sm text-nha-gray-500 mt-1">
            Weekly development cycles (Wed–Wed) &middot; {CAPACITY_HOURS}h capacity
          </p>
        </div>
      </div>

      {sprints.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-nha-gray-400">
          <Calendar size={48} className="mb-3" />
          <p className="text-lg font-medium text-nha-gray-600">No sprints configured</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sprints.map((sprint) => {
            const tasks = tasksBySprint[sprint.id] ?? []
            const totalHours = tasks.reduce((sum, t) => sum + (t.cenovio_estimate ?? 0), 0)
            const pct = Math.min((totalHours / CAPACITY_HOURS) * 100, 100)
            const isExpanded = expanded.has(sprint.id)
            const isOver = totalHours > CAPACITY_HOURS

            return (
              <div
                key={sprint.id}
                className="bg-white rounded-xl border border-nha-gray-200 overflow-hidden"
              >
                {/* Sprint header */}
                <button
                  onClick={() => toggleExpanded(sprint.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-nha-gray-50 transition-colors text-left"
                >
                  <div className="shrink-0 text-nha-gray-400">
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-semibold text-nha-gray-900 text-base">
                        {sprint.label}
                      </span>
                      <span
                        className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize border',
                          STATUS_COLORS[sprint.status] ?? STATUS_COLORS.planned,
                        )}
                      >
                        {sprint.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-nha-gray-500">
                      <span className="flex items-center gap-1">
                        <Target size={13} />
                        {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={13} />
                        <span className={cn(isOver && 'text-red-600 font-semibold')}>
                          {totalHours}h
                        </span>
                        <span className="text-nha-gray-400">/ {CAPACITY_HOURS}h</span>
                      </span>
                    </div>
                  </div>

                  {/* Capacity bar */}
                  <div className="hidden sm:block w-32 shrink-0">
                    <div className="h-2 bg-nha-gray-100 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          isOver
                            ? 'bg-red-500'
                            : pct > 75
                              ? 'bg-nha-orange'
                              : 'bg-green-500',
                        )}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-nha-gray-400 mt-0.5 text-right">
                      {Math.round(pct)}%
                    </p>
                  </div>
                </button>

                {/* Expanded task list */}
                {isExpanded && (
                  <div className="border-t border-nha-gray-100">
                    {tasks.length === 0 ? (
                      <div className="px-5 py-6 text-center text-sm text-nha-gray-400">
                        No tasks assigned to this sprint yet
                      </div>
                    ) : (
                      <div className="divide-y divide-nha-gray-100">
                        {tasks.map((task) => (
                          <div
                            key={task.request_id}
                            className="flex items-center gap-3 px-5 py-3 hover:bg-nha-gray-50 transition-colors cursor-pointer"
                            onClick={() => navigate(`/requests/${task.request_id}`)}
                          >
                            <CategoryIcon category={task.category} size="sm" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-nha-gray-800 truncate text-sm">
                                {task.title}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <StatusBadge value={task.status} />
                                {task.priority && (
                                  <span className="text-xs text-nha-gray-400 capitalize">
                                    {task.priority}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              {task.cenovio_estimate != null ? (
                                <span className="text-sm font-semibold text-nha-gray-700">
                                  {task.cenovio_estimate}h
                                </span>
                              ) : (
                                <span className="text-xs text-nha-gray-400">No est.</span>
                              )}
                            </div>
                          </div>
                        ))}
                        {/* Total row */}
                        <div className="flex items-center justify-between px-5 py-3 bg-nha-gray-50">
                          <span className="text-sm font-medium text-nha-gray-600">
                            Sprint Total
                          </span>
                          <span
                            className={cn(
                              'text-sm font-bold',
                              isOver ? 'text-red-600' : 'text-nha-gray-800',
                            )}
                          >
                            {totalHours}h / {CAPACITY_HOURS}h
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
