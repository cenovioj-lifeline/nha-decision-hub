import { useEffect, useState } from 'react'
import { Inbox as InboxIcon, RefreshCw } from 'lucide-react'
import { dhub } from '../lib/supabase'
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
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function fetchRequests() {
    setLoading(true)
    setError('')
    const { data, error: fetchError } = await dhub
      .from('requests')
      .select('*')
      .eq('status', 'inbox')
      .is('consolidated_into', null)
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setRequests((data as Request[]) ?? [])
    }
    setLoading(false)
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
        <button
          onClick={fetchRequests}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-nha-gray-200 text-sm text-nha-gray-600 hover:bg-nha-gray-50 transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {loading && requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-nha-gray-400">
          <RefreshCw size={24} className="animate-spin mb-3" />
          <p className="text-sm">Loading requests...</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-nha-gray-400">
          <InboxIcon size={48} className="mb-3" />
          <p className="text-lg font-medium text-nha-gray-600">Inbox is empty</p>
          <p className="text-sm mt-1">All requests have been processed</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <RequestCard key={request.id} request={request} />
          ))}
        </div>
      )}
    </div>
  )
}
