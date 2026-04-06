import { useEffect, useState } from 'react'
import { Inbox as InboxIcon, RefreshCw, Clock, Sparkles, User } from 'lucide-react'
import { dhub } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import RequestCard from '../components/RequestCard'

interface Request {
  id: string
  category: string
  title: string
  requester_name: string
  source: string
  created_at: string
  ai_analysis: Record<string, unknown> | null
  ai_analyzed_at: string | null
  status: string
  dev_estimate_hours: number | null
  metadata: Record<string, unknown> | null
}

export default function Inbox() {
  const { isAdmin } = useAuth()
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)
  const [processResult, setProcessResult] = useState('')
  const [requesterFilter, setRequesterFilter] = useState<string>('All')

  async function fetchRequests() {
    setLoading(true)
    setError('')
    const { data, error: fetchError } = await dhub
      .from('requests')
      .select('*')
      .eq('status', 'new')
      .is('consolidated_into', null)
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setRequests((data as Request[]) ?? [])
    }
    setLoading(false)
  }

  async function runConsolidation() {
    setProcessing(true)
    setProcessResult('')
    try {
      const res = await fetch(
        'https://nhwdgstjhugezhqlktie.supabase.co/functions/v1/dhub-consolidate',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5od2Rnc3RqaHVnZXpocWxrdGllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxOTUzMjMsImV4cCI6MjA2ODc3MTMyM30.dsN6HiFYtM1MXxOcyaI-O7vbJxN-si1V3Eth0oIY2JE',
            'Content-Type': 'application/json',
          },
        }
      )
      const data = await res.json()
      if (data.error) {
        setProcessResult(`Error: ${data.error}`)
      } else if (data.processed === 0) {
        setProcessResult('No new items to process')
      } else {
        setProcessResult(`Processed ${data.raw_input_count} items: ${data.standalone} standalone, ${data.merged} merged, ${data.grouped} grouped, ${data.noise} noise`)
        fetchRequests()
      }
    } catch (err) {
      setProcessResult(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setProcessing(false)
      setTimeout(() => setProcessResult(''), 8000)
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-nha-gray-900">Inbox</h1>
          <p className="text-sm text-nha-gray-500 mt-1">
            {requests.length} request{requests.length !== 1 ? 's' : ''} awaiting decision
          </p>
        </div>
        {(() => {
          const countable = requests.filter(r => r.source !== 'manual')
          const totalHours = countable.reduce((sum, r) => sum + (r.dev_estimate_hours ?? 0), 0)
          const estimated = countable.filter(r => r.dev_estimate_hours != null).length
          if (totalHours === 0) return null
          const days = Math.floor(totalHours / 8)
          const hours = totalHours % 8
          const label = days > 0
            ? `${days}d ${hours > 0 ? `${hours}h` : ''}`
            : `${totalHours}h`
          return (
            <div className="flex items-center gap-2 px-4 py-2 bg-nha-gray-50 rounded-lg border border-nha-gray-200">
              <Clock size={16} className="text-nha-gray-400" />
              <div className="text-right">
                <p className="text-sm font-semibold text-nha-gray-700">{label.trim()} total</p>
                <p className="text-xs text-nha-gray-400">{estimated} of {countable.length} estimated</p>
              </div>
            </div>
          )
        })()}
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={runConsolidation}
              disabled={processing}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-purple-200 text-sm text-purple-600 hover:bg-purple-50 transition-colors"
            >
              <Sparkles size={14} className={processing ? 'animate-pulse' : ''} />
              {processing ? 'Processing...' : 'Process Now'}
            </button>
          )}
          <button
            onClick={fetchRequests}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-nha-gray-200 text-sm text-nha-gray-600 hover:bg-nha-gray-50 transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {processResult && (
        <div className={`rounded-xl p-3 mb-4 text-sm ${processResult.startsWith('Error') || processResult.startsWith('Failed') ? 'bg-red-50 border border-red-200 text-red-600' : 'bg-purple-50 border border-purple-200 text-purple-700'}`}>
          {processResult}
        </div>
      )}

      {requests.length > 0 && (() => {
        const counts = requests.reduce<Record<string, number>>((acc, r) => {
          acc[r.requester_name] = (acc[r.requester_name] || 0) + 1
          return acc
        }, {})
        const names = Object.keys(counts).sort((a, b) => a.localeCompare(b))
        if (names.length <= 1) return null
        return (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <User size={14} className="text-nha-gray-400 shrink-0" />
            <button
              onClick={() => setRequesterFilter('All')}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                requesterFilter === 'All'
                  ? 'bg-nha-blue-600 text-white'
                  : 'bg-nha-gray-100 text-nha-gray-600 hover:bg-nha-gray-200'
              }`}
            >
              All ({requests.length})
            </button>
            {names.map((name) => (
              <button
                key={name}
                onClick={() => setRequesterFilter(name)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  requesterFilter === name
                    ? 'bg-nha-blue-600 text-white'
                    : 'bg-nha-gray-100 text-nha-gray-600 hover:bg-nha-gray-200'
                }`}
              >
                {name} ({counts[name]})
              </button>
            ))}
          </div>
        )
      })()}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {(() => {
        const filtered = requesterFilter === 'All'
          ? requests
          : requests.filter((r) => r.requester_name === requesterFilter)
        if (loading && requests.length === 0) {
          return (
            <div className="flex flex-col items-center justify-center py-20 text-nha-gray-400">
              <RefreshCw size={24} className="animate-spin mb-3" />
              <p className="text-sm">Loading requests...</p>
            </div>
          )
        }
        if (requests.length === 0) {
          return (
            <div className="flex flex-col items-center justify-center py-20 text-nha-gray-400">
              <InboxIcon size={48} className="mb-3" />
              <p className="text-lg font-medium text-nha-gray-600">Inbox is empty</p>
              <p className="text-sm mt-1">All requests have been processed</p>
            </div>
          )
        }
        return (
          <div className="space-y-3">
            {filtered.map((request) => (
              <RequestCard key={request.id} request={request} />
            ))}
          </div>
        )
      })()}
    </div>
  )
}
