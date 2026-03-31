import { useState, useEffect } from 'react'
import { Check, X, GitMerge, MessageSquare, Clock } from 'lucide-react'
import { cn } from '../lib/utils'
import { dhub } from '../lib/supabase'
import { useAuth } from '../lib/auth'

type Action = 'approve' | 'decline' | 'merge' | 'discuss' | 'defer'

interface RelatedItem {
  task_id: string
  task_name: string
}

interface Sprint {
  id: string
  label: string
  status: string
}

interface DecisionFormProps {
  requestId: string
  relatedItems: RelatedItem[]
  onDecided: () => void
}

const ACTIONS: { value: Action; label: string; icon: typeof Check; color: string; activeBg: string }[] = [
  { value: 'approve', label: 'Approve', icon: Check, color: 'text-green-600', activeBg: 'bg-green-50 border-green-300 ring-green-200' },
  { value: 'decline', label: 'Decline', icon: X, color: 'text-red-600', activeBg: 'bg-red-50 border-red-300 ring-red-200' },
  { value: 'merge', label: 'Merge', icon: GitMerge, color: 'text-purple-600', activeBg: 'bg-purple-50 border-purple-300 ring-purple-200' },
  { value: 'discuss', label: 'Discuss', icon: MessageSquare, color: 'text-yellow-600', activeBg: 'bg-yellow-50 border-yellow-300 ring-yellow-200' },
  { value: 'defer', label: 'Defer', icon: Clock, color: 'text-nha-gray-500', activeBg: 'bg-nha-gray-50 border-nha-gray-300 ring-nha-gray-200' },
]

const PRIORITIES = ['urgent', 'high', 'normal', 'low']

export default function DecisionForm({ requestId, relatedItems, onDecided }: DecisionFormProps) {
  const { user } = useAuth()
  const [action, setAction] = useState<Action | null>(null)
  const [rationale, setRationale] = useState('')
  const [priority, setPriority] = useState('normal')
  const [mergedWithTaskId, setMergedWithTaskId] = useState('')
  const [discussWith, setDiscussWith] = useState('')
  const [sprintId, setSprintId] = useState('')
  const [cenovioEstimate, setCenovioEstimate] = useState('')
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchSprints() {
      const { data } = await dhub
        .from('sprints')
        .select('id, label, status')
        .in('status', ['active', 'planned'])
        .order('start_date', { ascending: true })
      if (data) setSprints(data as Sprint[])
    }
    fetchSprints()
  }, [])

  async function handleSubmit() {
    if (!action) return
    setSubmitting(true)
    setError('')

    try {
      const decision: Record<string, unknown> = {
        request_id: requestId,
        action,
        rationale,
        decided_by: user?.id,
        decided_at: new Date().toISOString(),
        executed: false,
      }

      if (action === 'approve') {
        decision.priority = priority
        if (sprintId) decision.sprint_id = sprintId
        if (cenovioEstimate) decision.cenovio_estimate = parseFloat(cenovioEstimate)
      }
      if (action === 'merge' && mergedWithTaskId) {
        decision.merged_with_task_id = mergedWithTaskId
      }
      if (action === 'discuss') {
        decision.discuss_with = discussWith
      }

      const { error: insertError } = await dhub.from('decisions').insert(decision)
      if (insertError) throw insertError

      const newStatus = action === 'decline' ? 'declined' : action === 'approve' ? 'tracking' : 'decided'
      const { error: updateError } = await dhub.from('requests').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', requestId)
      if (updateError) throw updateError

      onDecided()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit decision')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-nha-gray-800">Make a Decision</h3>

      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((a) => {
          const Icon = a.icon
          const isActive = action === a.value
          return (
            <button
              key={a.value}
              onClick={() => setAction(a.value)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all',
                isActive
                  ? cn(a.activeBg, 'ring-2')
                  : 'border-nha-gray-200 hover:border-nha-gray-300 bg-white',
              )}
            >
              <Icon size={16} className={isActive ? a.color : 'text-nha-gray-400'} />
              {a.label}
            </button>
          )
        })}
      </div>

      {action === 'approve' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-nha-gray-700 mb-1">Priority</label>
            <div className="flex gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg border text-sm capitalize transition-all',
                    priority === p
                      ? 'bg-nha-blue text-white border-nha-blue'
                      : 'border-nha-gray-200 hover:border-nha-gray-300 bg-white',
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-nha-gray-700 mb-1">Sprint</label>
              <select
                value={sprintId}
                onChange={(e) => setSprintId(e.target.value)}
                className="w-full rounded-lg border border-nha-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nha-sky focus:border-nha-sky"
              >
                <option value="">Unassigned</option>
                {sprints.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}{s.status === 'active' ? ' (active)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-32">
              <label className="block text-sm font-medium text-nha-gray-700 mb-1">Estimate (hrs)</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={cenovioEstimate}
                onChange={(e) => setCenovioEstimate(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-nha-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nha-sky focus:border-nha-sky"
              />
            </div>
          </div>
        </div>
      )}

      {action === 'merge' && relatedItems.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-nha-gray-700 mb-1">Merge with task</label>
          <select
            value={mergedWithTaskId}
            onChange={(e) => setMergedWithTaskId(e.target.value)}
            className="w-full rounded-lg border border-nha-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nha-sky focus:border-nha-sky"
          >
            <option value="">Select a task...</option>
            {relatedItems.map((item) => (
              <option key={item.task_id} value={item.task_id}>
                {item.task_name}
              </option>
            ))}
          </select>
        </div>
      )}

      {action === 'discuss' && (
        <div>
          <label className="block text-sm font-medium text-nha-gray-700 mb-1">Discuss with</label>
          <input
            type="text"
            value={discussWith}
            onChange={(e) => setDiscussWith(e.target.value)}
            placeholder="Name or team..."
            className="w-full rounded-lg border border-nha-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nha-sky focus:border-nha-sky"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-nha-gray-700 mb-1">Notes</label>
        <textarea
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          rows={3}
          placeholder="Rationale or context for this decision..."
          className="w-full rounded-lg border border-nha-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nha-sky focus:border-nha-sky resize-none"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={!action || submitting}
        className={cn(
          'w-full py-2.5 rounded-lg text-sm font-semibold transition-all',
          action
            ? 'bg-nha-blue text-white hover:bg-nha-blue/90'
            : 'bg-nha-gray-200 text-nha-gray-400 cursor-not-allowed',
        )}
      >
        {submitting ? 'Submitting...' : 'Submit Decision'}
      </button>
    </div>
  )
}
