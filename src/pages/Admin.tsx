import { useEffect, useState } from 'react'
import { Zap, ZapOff, Play, RefreshCw } from 'lucide-react'
import { dhub, supabase } from '../lib/supabase'

const EXECUTE_FUNCTION_URL = 'https://nhwdgstjhugezhqlktie.supabase.co/functions/v1/dhub-execute-decision'

export default function Admin() {
  const [clickupEnabled, setClickupEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState('')

  async function fetchSettings() {
    setLoading(true)
    const { data } = await dhub
      .from('app_settings')
      .select('value')
      .eq('key', 'clickup_integration')
      .single()
    if (data?.value) {
      setClickupEnabled((data.value as { enabled: boolean }).enabled)
    }

    // Count unexecuted approved decisions
    const { count } = await dhub
      .from('decisions')
      .select('id', { count: 'exact', head: true })
      .eq('action', 'approve')
      .eq('executed', false)
    setPendingCount(count ?? 0)

    setLoading(false)
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  async function toggleClickup() {
    setToggling(true)
    const newValue = !clickupEnabled
    await dhub
      .from('app_settings')
      .update({ value: { enabled: newValue }, updated_at: new Date().toISOString() })
      .eq('key', 'clickup_integration')
    setClickupEnabled(newValue)
    setToggling(false)
  }

  async function syncPending() {
    setSyncing(true)
    setSyncResult('')

    // Get all unexecuted approved decisions
    const { data: pending } = await dhub
      .from('decisions')
      .select('id')
      .eq('action', 'approve')
      .eq('executed', false)

    if (!pending || pending.length === 0) {
      setSyncResult('No pending approvals to sync')
      setSyncing(false)
      return
    }

    const { data: { session } } = await supabase.auth.getSession()
    let succeeded = 0
    let failed = 0

    for (const decision of pending) {
      try {
        const res = await fetch(EXECUTE_FUNCTION_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token ?? ''}`,
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5od2Rnc3RqaHVnZXpocWxrdGllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxOTUzMjMsImV4cCI6MjA2ODc3MTMyM30.dsN6HiFYtM1MXxOcyaI-O7vbJxN-si1V3Eth0oIY2JE',
          },
          body: JSON.stringify({ decision_id: decision.id }),
        })
        const result = await res.json()
        if (result.status === 'executed') {
          succeeded++
        } else {
          failed++
        }
      } catch {
        failed++
      }
    }

    setSyncResult(`Synced ${succeeded} task${succeeded !== 1 ? 's' : ''} to ClickUp${failed > 0 ? `, ${failed} failed` : ''}`)
    fetchSettings() // Refresh pending count
    setSyncing(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={24} className="animate-spin text-nha-gray-400" />
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-nha-gray-900 mb-6">Admin</h1>

      <div className="space-y-4 max-w-xl">
        {/* ClickUp Integration Toggle */}
        <div className="bg-white rounded-xl border border-nha-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {clickupEnabled ? (
                <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                  <Zap size={20} className="text-green-600" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-lg bg-nha-gray-100 flex items-center justify-center">
                  <ZapOff size={20} className="text-nha-gray-400" />
                </div>
              )}
              <div>
                <h3 className="font-semibold text-nha-gray-800">ClickUp Integration</h3>
                <p className="text-sm text-nha-gray-500">
                  {clickupEnabled
                    ? 'Approved items automatically create ClickUp tasks'
                    : 'Approvals save locally only — no ClickUp tasks created'}
                </p>
              </div>
            </div>
            <button
              onClick={toggleClickup}
              disabled={toggling}
              className={`relative w-12 h-7 rounded-full transition-colors ${
                clickupEnabled ? 'bg-green-500' : 'bg-nha-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                  clickupEnabled ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Sync Pending */}
        {pendingCount > 0 && (
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-amber-800">
                  {pendingCount} pending approval{pendingCount !== 1 ? 's' : ''}
                </h3>
                <p className="text-sm text-amber-600">
                  Approved items not yet sent to ClickUp
                </p>
              </div>
              <button
                onClick={syncPending}
                disabled={syncing || !clickupEnabled}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  clickupEnabled
                    ? 'bg-amber-600 text-white hover:bg-amber-700'
                    : 'bg-nha-gray-200 text-nha-gray-400 cursor-not-allowed'
                }`}
                title={!clickupEnabled ? 'Enable ClickUp integration first' : ''}
              >
                <Play size={14} className={syncing ? 'animate-pulse' : ''} />
                {syncing ? 'Syncing...' : 'Sync to ClickUp'}
              </button>
            </div>
            {!clickupEnabled && (
              <p className="text-xs text-amber-500 mt-2">
                Enable ClickUp integration above to sync these items
              </p>
            )}
          </div>
        )}

        {syncResult && (
          <div className={`rounded-xl p-4 text-sm ${
            syncResult.includes('failed')
              ? 'bg-red-50 border border-red-200 text-red-600'
              : 'bg-green-50 border border-green-200 text-green-700'
          }`}>
            {syncResult}
          </div>
        )}
      </div>
    </div>
  )
}
