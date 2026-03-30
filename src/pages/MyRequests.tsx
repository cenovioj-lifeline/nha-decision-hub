import { useEffect, useState } from 'react'
import { FileText, ExternalLink } from 'lucide-react'
import { dhub } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { formatDate } from '../lib/utils'
import StatusBadge from '../components/StatusBadge'
import CategoryIcon from '../components/CategoryIcon'

interface Request {
  id: string
  title: string
  category: string
  status: string
  created_at: string
  decisions: {
    action: string
    rationale: string | null
    clickup_task_url: string | null
  }[]
}

export default function MyRequests() {
  const { user } = useAuth()
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      if (!user?.email) return
      const { data } = await dhub
        .from('requests')
        .select('id, title, category, status, created_at, decisions(action, rationale, clickup_task_url)')
        .eq('requester_email', user.email)
        .order('created_at', { ascending: false })

      setRequests((data as Request[]) ?? [])
      setLoading(false)
    }
    fetch()
  }, [user?.email])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nha-blue" />
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-nha-gray-900 mb-1">My Requests</h1>
      <p className="text-sm text-nha-gray-500 mb-6">
        Track the status of your submitted requests
      </p>

      {requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-nha-gray-400">
          <FileText size={48} className="mb-3" />
          <p className="text-lg font-medium text-nha-gray-600">No requests yet</p>
          <p className="text-sm mt-1">Requests submitted by you will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
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
                    <p className="text-sm text-nha-gray-500">{formatDate(req.created_at)}</p>

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
