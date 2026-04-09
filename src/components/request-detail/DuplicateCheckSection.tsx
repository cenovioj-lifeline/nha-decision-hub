import { useState } from 'react'
import { Copy, ExternalLink, RefreshCw } from 'lucide-react'
import { dhub, supabase } from '../../lib/supabase'
import { formatDateTime } from '../../lib/utils'
import { useAuth } from '../../lib/auth'
import type { DhubRequest } from '../../types/request'

interface DuplicateCheckSectionProps {
  request: DhubRequest
  onChange: () => void
}

const SUPABASE_URL = 'https://nhwdgstjhugezhqlktie.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5od2Rnc3RqaHVnZXpocWxrdGllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxOTUzMjMsImV4cCI6MjA2ODc3MTMyM30.dsN6HiFYtM1MXxOcyaI-O7vbJxN-si1V3Eth0oIY2JE'

/**
 * Possible-duplicate flag display + admin actions (re-check, dismiss).
 * Owns its own UI state. Calls onChange() after any mutation so the parent
 * can refetch the request.
 */
export default function DuplicateCheckSection({ request, onChange }: DuplicateCheckSectionProps) {
  const { isViewer, isAdmin, user } = useAuth()
  const [recheckingDup, setRecheckingDup] = useState(false)
  const [dupActionMsg, setDupActionMsg] = useState('')
  const [showDismissModal, setShowDismissModal] = useState(false)
  const [dismissReason, setDismissReason] = useState('')
  const [dismissUsefulness, setDismissUsefulness] = useState<'yes' | 'no' | 'partially' | ''>('')
  const [dismissing, setDismissing] = useState(false)

  const dup = request.metadata?.duplicate_check
  if (!dup) return null

  const isDismissed = !!dup.dismissed_at
  const isActive = request.metadata?.possible_duplicate === true
  const candidates = dup.candidates ?? []
  if (candidates.length === 0 && !isDismissed) return null

  async function handleRecheckDuplicate() {
    if (!request.id) return
    setRecheckingDup(true)
    setDupActionMsg('')
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/dhub-duplicate-check`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? ''}`,
          'apikey': ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ request_id: request.id }),
      })
      const data = await res.json()
      if (data.error) {
        setDupActionMsg(`Error: ${data.error}`)
      } else if (data.candidate_count === 0) {
        setDupActionMsg('No matches found')
      } else {
        setDupActionMsg(`Found ${data.candidate_count} possible match${data.candidate_count === 1 ? '' : 'es'}`)
      }
      onChange()
    } catch (err) {
      setDupActionMsg(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`)
    } finally {
      setRecheckingDup(false)
      setTimeout(() => setDupActionMsg(''), 6000)
    }
  }

  async function handleDismissDuplicate() {
    if (!request.id || !dup || !dismissUsefulness) return
    setDismissing(true)
    try {
      const updatedDup = {
        ...dup,
        dismissed_at: new Date().toISOString(),
        dismissed_by: user?.email ?? 'unknown',
        dismissed_reason: dismissReason.trim() || null,
        dismissed_usefulness: dismissUsefulness,
      }
      const newMeta = {
        ...request.metadata,
        duplicate_check: updatedDup,
        possible_duplicate: false,
      }
      const { error: err } = await dhub.from('requests').update({
        metadata: newMeta,
        updated_at: new Date().toISOString(),
      }).eq('id', request.id)
      if (err) throw err

      // Log feedback to duplicate_feedback table for each candidate
      for (const c of candidates) {
        await dhub.from('duplicate_feedback').insert({
          request_id: request.id,
          matched_task_id: c.clickup_task_id,
          matched_task_title: c.title,
          matched_task_status: c.status,
          matched_task_url: c.clickup_task_url,
          verdict: c.verdict,
          usefulness: dismissUsefulness,
          training_notes: dismissReason.trim() || null,
          dismissed_by: user?.email ?? 'unknown',
        })
      }

      setShowDismissModal(false)
      setDismissReason('')
      setDismissUsefulness('')
      setDupActionMsg('Flag dismissed — feedback logged')
      setTimeout(() => setDupActionMsg(''), 4000)
      onChange()
    } catch (err) {
      setDupActionMsg(`Error: ${err instanceof Error ? err.message : 'Unknown'}`)
    } finally {
      setDismissing(false)
    }
  }

  return (
    <>
      <div className={`bg-white rounded-2xl border p-6 ${isActive ? 'border-orange-300' : 'border-nha-gray-200'}`}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Copy size={16} className={isActive ? 'text-orange-600' : 'text-nha-gray-400'} />
            <h3 className={`font-semibold ${isActive ? 'text-orange-700' : 'text-nha-gray-500'}`}>
              {isActive ? 'Possible duplicate' : 'Possible duplicate (dismissed)'}
            </h3>
            {dup.verdict && isActive && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 capitalize">
                {dup.verdict}
              </span>
            )}
          </div>
          {!isViewer && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleRecheckDuplicate}
                disabled={recheckingDup}
                className="inline-flex items-center gap-1 text-xs text-nha-gray-500 hover:text-nha-gray-700 px-2 py-1 rounded hover:bg-nha-gray-50"
                title="Re-run duplicate check"
              >
                <RefreshCw size={12} className={recheckingDup ? 'animate-spin' : ''} />
                Re-check
              </button>
              {isActive && isAdmin && (
                <button
                  onClick={() => { setDismissReason(''); setDismissUsefulness(''); setShowDismissModal(true) }}
                  className="inline-flex items-center gap-1 text-xs text-nha-gray-600 hover:text-nha-gray-800 px-2 py-1 rounded border border-nha-gray-200 hover:bg-nha-gray-50"
                >
                  Dismiss flag
                </button>
              )}
            </div>
          )}
        </div>

        {dupActionMsg && (
          <div className="mb-3 text-xs text-nha-gray-500 bg-nha-gray-50 px-3 py-2 rounded">{dupActionMsg}</div>
        )}

        {isDismissed && (
          <div className="mb-4 text-sm text-nha-gray-500 italic">
            Dismissed by {dup.dismissed_by} on {formatDateTime(dup.dismissed_at!)}
            {dup.dismissed_usefulness && (
              <span className={`ml-2 text-xs px-2 py-0.5 rounded-full not-italic font-medium ${
                dup.dismissed_usefulness === 'yes' ? 'bg-green-100 text-green-700'
                  : dup.dismissed_usefulness === 'partially' ? 'bg-amber-100 text-amber-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                {dup.dismissed_usefulness === 'yes' ? 'Useful' : dup.dismissed_usefulness === 'partially' ? 'Partially useful' : 'Not useful'}
              </span>
            )}
            {dup.dismissed_reason && (
              <div className="mt-1 text-nha-gray-600 not-italic">"{dup.dismissed_reason}"</div>
            )}
          </div>
        )}

        {candidates.length > 0 ? (
          <div className="space-y-3">
            {candidates.map((c) => (
              <div
                key={c.clickup_task_id}
                className={`rounded-xl border p-3 ${isActive ? 'border-orange-100 bg-orange-50/30' : 'border-nha-gray-100 bg-nha-gray-50/30'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.verdict === 'same' ? 'bg-orange-100 text-orange-700' : 'bg-amber-50 text-amber-700'}`}>
                        {c.verdict === 'same' ? 'Likely same' : 'Related'}
                      </span>
                      <span className="text-xs text-nha-gray-500">{c.status}</span>
                      {c.list_name && <span className="text-xs text-nha-gray-400">· {c.list_name}</span>}
                    </div>
                    <h4 className="font-medium text-nha-gray-800 text-sm">{c.title}</h4>
                    <p className="text-sm text-nha-gray-600 mt-1.5 leading-relaxed">{c.reasoning}</p>
                  </div>
                  <a
                    href={c.clickup_task_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-nha-sky hover:text-nha-blue shrink-0 mt-1"
                    title="Open in ClickUp"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-nha-gray-400 italic">No matches found in the most recent check.</p>
        )}

        {dup.email_sent_at && (
          <p className="text-xs text-nha-gray-400 mt-4">
            Email sent to requester {formatDateTime(dup.email_sent_at)}
          </p>
        )}
        {dup.email_error && (
          <p className="text-xs text-red-500 mt-4">Email failed: {dup.email_error}</p>
        )}
      </div>

      {/* Dismiss flag modal */}
      {showDismissModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => !dismissing && setShowDismissModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="shrink-0 w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <Copy size={18} className="text-orange-600" />
              </div>
              <div>
                <h3 className="font-semibold text-nha-gray-900">Dismiss possible-duplicate flag?</h3>
                <p className="text-sm text-nha-gray-600 mt-1">
                  The flag will be cleared so this request can move forward normally. The original match details stay on the card for reference.
                </p>
              </div>
            </div>
            <label className="block text-xs font-medium text-nha-gray-600 mb-2">
              Was this flag useful?
            </label>
            <div className="flex gap-2 mb-4">
              {(['no', 'partially', 'yes'] as const).map((val) => (
                <button
                  key={val}
                  onClick={() => setDismissUsefulness(val)}
                  disabled={dismissing}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    dismissUsefulness === val
                      ? val === 'yes' ? 'border-green-400 bg-green-50 text-green-700'
                        : val === 'partially' ? 'border-amber-400 bg-amber-50 text-amber-700'
                        : 'border-red-400 bg-red-50 text-red-700'
                      : 'border-nha-gray-200 text-nha-gray-600 hover:bg-nha-gray-50'
                  }`}
                >
                  {val === 'yes' ? 'Yes' : val === 'partially' ? 'Partially' : 'No'}
                </button>
              ))}
            </div>
            <label className="block text-xs font-medium text-nha-gray-600 mb-1">
              Training notes (optional)
            </label>
            <textarea
              value={dismissReason}
              onChange={(e) => setDismissReason(e.target.value)}
              placeholder="e.g. Already in PO Review so it's done. If still in dev, linking the requests would've been useful."
              rows={3}
              className="w-full text-sm border border-nha-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-300 resize-none"
              disabled={dismissing}
            />
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setShowDismissModal(false)}
                disabled={dismissing}
                className="px-4 py-2 text-sm font-medium text-nha-gray-700 hover:bg-nha-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDismissDuplicate}
                disabled={dismissing || !dismissUsefulness}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {dismissing ? 'Dismissing...' : 'Dismiss flag'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
