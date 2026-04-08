import { useState, useEffect } from 'react'
import { Check, X, Pause, GitMerge, Circle } from 'lucide-react'
import { cn } from '../lib/utils'
import { dhub, supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

const EXECUTE_FUNCTION_URL = 'https://nhwdgstjhugezhqlktie.supabase.co/functions/v1/dhub-execute-decision'

type Action = 'approve' | 'decline' | 'on_hold' | 'merge'

interface Sprint {
  id: string
  label: string
  status: string
}

interface ExistingDecision {
  id: string
  action: string
  rationale: string | null
  priority: string | null
  sprint_id: string | null
  cenovio_estimate: number | null
}

interface DecisionFormProps {
  requestId: string
  currentStatus: string
  existingDecision?: ExistingDecision | null
  aiEstimate?: number | null
  onDecided: () => void
}

const ACTIONS: { value: Action; label: string; icon: typeof Check; color: string; activeBg: string }[] = [
  { value: 'approve', label: 'Approve', icon: Check, color: 'text-green-600', activeBg: 'bg-green-50 border-green-300 ring-green-200' },
  { value: 'decline', label: 'Decline', icon: X, color: 'text-red-600', activeBg: 'bg-red-50 border-red-300 ring-red-200' },
  { value: 'on_hold', label: 'On Hold', icon: Pause, color: 'text-amber-600', activeBg: 'bg-amber-50 border-amber-300 ring-amber-200' },
  { value: 'merge', label: 'Merge', icon: GitMerge, color: 'text-purple-600', activeBg: 'bg-purple-50 border-purple-300 ring-purple-200' },
]

const PRIORITIES = ['urgent', 'high', 'normal', 'low']

export default function DecisionForm({ requestId, currentStatus: _status, existingDecision, aiEstimate, onDecided }: DecisionFormProps) {
  const { user } = useAuth()

  // Derive the "saved" action from the existing decision
  const savedAction = (existingDecision?.action as Action) ?? null

  const [action, setAction] = useState<Action | null>(savedAction)
  const [rationale, setRationale] = useState(existingDecision?.rationale ?? '')
  const [priority, setPriority] = useState(existingDecision?.priority ?? 'normal')
  const [sprintId, setSprintId] = useState(existingDecision?.sprint_id ?? '')
  const [cenovioEstimate, setCenovioEstimate] = useState(
    existingDecision?.cenovio_estimate != null ? String(existingDecision.cenovio_estimate) : ''
  )
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [mergeTargets, setMergeTargets] = useState<{ id: string; title: string; requester_name: string }[]>([])
  const [mergeTargetId, setMergeTargetId] = useState('')
  const [dhubTask, setDhubTask] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showApproveBlockModal, setShowApproveBlockModal] = useState(false)

  // Whether the current form state matches what's saved
  const isNoneSelected = action === null
  const hasUnsavedChange = action !== savedAction

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

    async function fetchMergeTargets() {
      const { data } = await dhub
        .from('requests')
        .select('id, title, requester_name')
        .eq('status', 'new')
        .neq('id', requestId)
        .order('created_at', { ascending: false })
      if (data) setMergeTargets(data as { id: string; title: string; requester_name: string }[])
    }
    fetchMergeTargets()
  }, [requestId])

  // Sync state when existingDecision changes (e.g., after fetchData)
  useEffect(() => {
    setAction((existingDecision?.action as Action) ?? null)
    setRationale(existingDecision?.rationale ?? '')
    setPriority(existingDecision?.priority ?? 'normal')
    setSprintId(existingDecision?.sprint_id ?? '')
    setCenovioEstimate(
      existingDecision?.cenovio_estimate != null ? String(existingDecision.cenovio_estimate) : ''
    )
  }, [existingDecision?.id])

  async function handleClearDecision() {
    setSubmitting(true)
    setError('')
    try {
      const { error: deleteError } = await dhub.from('decisions').delete().eq('request_id', requestId)
      if (deleteError) throw deleteError

      const { error: updateError } = await dhub.from('requests').update({
        status: 'new',
        consolidated_into: null,
        ai_analyzed_at: null,
        updated_at: new Date().toISOString(),
      }).eq('id', requestId)
      if (updateError) throw updateError

      onDecided()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmit() {
    if (!action) return
    setSubmitting(true)
    setError('')

    try {
      const now = new Date().toISOString()

      // If there's an existing decision, delete it first
      if (existingDecision) {
        const { error: delErr } = await dhub.from('decisions').delete().eq('request_id', requestId)
        if (delErr) throw delErr
      }

      const autoExecute = action === 'decline' || action === 'on_hold' || action === 'merge'

      const decision: Record<string, unknown> = {
        request_id: requestId,
        action,
        rationale,
        decided_by: user?.id,
        decided_at: now,
        executed: autoExecute,
        ...(autoExecute && { executed_at: now }),
      }

      if (action === 'approve') {
        decision.priority = priority
        decision.dhub_task = dhubTask
        if (sprintId) decision.sprint_id = sprintId
        const estimate = cenovioEstimate ? parseFloat(cenovioEstimate) : aiEstimate ?? null
        if (estimate != null) decision.cenovio_estimate = estimate
      }

      if (action === 'merge' && mergeTargetId) {
        decision.merged_with_task_id = mergeTargetId
      }

      const { data: insertedDecision, error: insertError } = await dhub
        .from('decisions')
        .insert(decision)
        .select('id')
        .single()
      if (insertError) throw insertError

      // Fire-and-forget: trigger ClickUp task creation for approvals (if enabled)
      if (action === 'approve' && insertedDecision?.id) {
        const { data: setting } = await dhub
          .from('app_settings')
          .select('value')
          .eq('key', 'clickup_integration')
          .single()
        const clickupEnabled = (setting?.value as { enabled?: boolean })?.enabled === true
        if (clickupEnabled) {
          const { data: { session } } = await supabase.auth.getSession()
          fetch(EXECUTE_FUNCTION_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token ?? ''}`,
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5od2Rnc3RqaHVnZXpocWxrdGllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxOTUzMjMsImV4cCI6MjA2ODc3MTMyM30.dsN6HiFYtM1MXxOcyaI-O7vbJxN-si1V3Eth0oIY2JE',
            },
            body: JSON.stringify({ decision_id: insertedDecision.id }),
          }).catch((err) => console.error('ClickUp execution failed:', err))
        }
      }

      const statusMap: Record<Action, string> = {
        approve: 'approved',
        decline: 'declined',
        on_hold: 'on_hold',
        merge: 'merged',
      }

      const updatePayload: Record<string, unknown> = { status: statusMap[action], updated_at: now }
      if (action === 'merge' && mergeTargetId) {
        updatePayload.consolidated_into = mergeTargetId
      }

      const { error: updateError } = await dhub
        .from('requests')
        .update(updatePayload)
        .eq('id', requestId)
      if (updateError) throw updateError

      // Merge execution: absorb content into target
      if (action === 'merge' && mergeTargetId) {
        const [sourceRes, targetRes] = await Promise.all([
          dhub.from('requests').select('*').eq('id', requestId).single(),
          dhub.from('requests').select('*').eq('id', mergeTargetId).single(),
        ])

        if (sourceRes.data && targetRes.data) {
          const source = sourceRes.data as Record<string, unknown>
          const target = targetRes.data as Record<string, unknown>
          const targetMeta = (target.metadata || {}) as Record<string, unknown>
          const sourceMeta = (source.metadata || {}) as Record<string, unknown>
          const existingMessages = (targetMeta.source_messages || []) as unknown[]
          const sourceMessages = (sourceMeta.source_messages || []) as unknown[]

          const sourceEntry = sourceMessages.length > 0 ? sourceMessages : [{
            id: source.id,
            author: source.requester_name || 'Unknown',
            source: source.source || 'manual',
            date: source.created_at,
            original_text: source.description || source.title || '',
            has_attachment: Array.isArray(source.attachments) && (source.attachments as unknown[]).length > 0,
          }]

          const mergedMessages = [...existingMessages, ...sourceEntry]
          const targetAttachments = Array.isArray(target.attachments) ? target.attachments as unknown[] : []
          const sourceAttachments = Array.isArray(source.attachments) ? source.attachments as unknown[] : []
          const mergedAttachments = [...targetAttachments, ...sourceAttachments]
          const targetDesc = (target.description || '') as string
          const sourceDesc = (source.description || '') as string
          const mergedDesc = sourceDesc
            ? `${targetDesc}\n\n--- Merged from: ${source.title} (${source.requester_name}) ---\n${sourceDesc}`
            : targetDesc

          await dhub.from('requests').update({
            description: mergedDesc,
            attachments: mergedAttachments.length > 0 ? mergedAttachments : null,
            metadata: {
              ...targetMeta,
              is_consolidated: true,
              source_count: mergedMessages.length,
              source_messages: mergedMessages,
            },
            updated_at: now,
          }).eq('id', mergeTargetId)
        }
      }

      onDecided()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="space-y-4">
        <h3 className="font-semibold text-nha-gray-800">Status</h3>

        <div className="flex flex-wrap gap-2">
          {/* None / New button — always visible */}
          <button
            onClick={() => {
              if (savedAction && action !== null) {
                setAction(null)
              } else {
                setAction(null)
              }
            }}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all',
              isNoneSelected
                ? 'bg-nha-gray-100 border-nha-gray-400 ring-2 ring-nha-gray-200 text-nha-gray-700'
                : 'border-nha-gray-200 hover:border-nha-gray-300 bg-white',
            )}
          >
            <Circle size={16} className={isNoneSelected ? 'text-nha-gray-500' : 'text-nha-gray-400'} />
            None
          </button>

          {ACTIONS.map((a) => {
            const Icon = a.icon
            const isActive = action === a.value
            return (
              <button
                key={a.value}
                onClick={() => {
                  if (a.value === 'approve' && user?.email !== 'cjaimes@nhaschools.com') {
                    setShowApproveBlockModal(true)
                    return
                  }
                  setAction(a.value)
                }}
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

        {action === 'merge' && (
          <div>
            <label className="block text-sm font-medium text-nha-gray-700 mb-1">Merge into</label>
            <select
              value={mergeTargetId}
              onChange={e => setMergeTargetId(e.target.value)}
              className="w-full rounded-lg border border-nha-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
            >
              <option value="">Select a request to merge into...</option>
              {mergeTargets.map(t => (
                <option key={t.id} value={t.id}>
                  {t.title} — {t.requester_name}
                </option>
              ))}
            </select>
            {mergeTargets.length === 0 && (
              <p className="text-xs text-nha-gray-400 mt-1">No other requests available to merge with</p>
            )}
          </div>
        )}

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
                  placeholder={aiEstimate != null ? String(aiEstimate) : '0'}
                  className="w-full rounded-lg border border-nha-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nha-sky focus:border-nha-sky"
                />
              </div>
            </div>

          </div>
        )}

        <label className="flex items-center gap-2.5 cursor-pointer group">
          <input
            type="checkbox"
            checked={dhubTask}
            onChange={(e) => setDhubTask(e.target.checked)}
            className="w-4 h-4 rounded border-nha-gray-300 text-nha-blue focus:ring-nha-blue/20 cursor-pointer"
          />
          <span className="text-sm text-nha-gray-700 group-hover:text-nha-gray-900 transition-colors">
            Decision Hub task
          </span>
          {!dhubTask && (
            <span className="text-xs text-nha-gray-400">
              — ClickUp task will be created without sprint tag or custom fields
            </span>
          )}
        </label>

        <div>
          <label className="block text-sm font-medium text-nha-gray-700 mb-1">Notes</label>
          <textarea
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            rows={3}
            placeholder="Rationale or context..."
            className="w-full rounded-lg border border-nha-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nha-sky focus:border-nha-sky resize-none"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        {/* Show submit when changing to a new action, or clear when going back to None */}
        {hasUnsavedChange && (
          isNoneSelected && savedAction ? (
            <button
              onClick={handleClearDecision}
              disabled={submitting}
              className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all bg-nha-gray-600 text-white hover:bg-nha-gray-700"
            >
              {submitting ? 'Clearing...' : 'Clear Decision'}
            </button>
          ) : action ? (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all bg-nha-blue text-white hover:bg-nha-blue/90"
            >
              {submitting ? 'Submitting...' : savedAction ? 'Update Decision' : 'Submit'}
            </button>
          ) : null
        )}
      </div>

      {/* Approve gatekeeper modal — shown to non-Cenovio admins */}
      {showApproveBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl border border-nha-gray-200 p-6 max-w-sm mx-4 shadow-xl">
            <h3 className="font-semibold text-nha-gray-900 mb-2">Approval restricted</h3>
            <p className="text-sm text-nha-gray-600 mb-5">
              Tasks can only be sent to ClickUp from the Decision Hub by Cenovio Jaimes.
            </p>
            <button
              onClick={() => setShowApproveBlockModal(false)}
              className="w-full py-2 rounded-lg text-sm font-semibold bg-nha-blue text-white hover:bg-nha-blue/90 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  )
}
