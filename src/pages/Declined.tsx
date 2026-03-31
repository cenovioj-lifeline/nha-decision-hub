import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { XCircle } from 'lucide-react'
import { dhub } from '../lib/supabase'
import { formatDate } from '../lib/utils'
import CategoryIcon from '../components/CategoryIcon'

interface DeclinedRequest {
  id: string
  title: string
  category: string
  requester_name: string
  source: string
  created_at: string
  rationale: string | null
  decided_at: string
}

export default function Declined() {
  const navigate = useNavigate()
  const [items, setItems] = useState<DeclinedRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const { data } = await dhub
        .from('decisions')
        .select('request_id, rationale, decided_at, requests(id, title, category, requester_name, source, created_at)')
        .eq('action', 'decline')
        .order('decided_at', { ascending: false })

      if (data) {
        const mapped = (data as any[])
          .map((d) => {
            const req = Array.isArray(d.requests) ? d.requests[0] : d.requests
            if (!req) return null
            return {
              id: req.id,
              title: req.title,
              category: req.category,
              requester_name: req.requester_name,
              source: req.source,
              created_at: req.created_at,
              rationale: d.rationale,
              decided_at: d.decided_at,
            }
          })
          .filter(Boolean) as DeclinedRequest[]
        setItems(mapped)
      }
      setLoading(false)
    }
    fetch()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nha-blue" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-nha-gray-900">Declined</h1>
        <p className="text-sm text-nha-gray-500 mt-1">
          {items.length} request{items.length !== 1 ? 's' : ''} declined with explanation
        </p>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-nha-gray-400">
          <XCircle size={48} className="mb-3" />
          <p className="text-lg font-medium text-nha-gray-600">Nothing declined yet</p>
          <p className="text-sm mt-1">Declined requests will appear here with your notes</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl border border-nha-gray-200 p-4 hover:border-nha-gray-300 transition-colors cursor-pointer"
              onClick={() => navigate(`/requests/${item.id}`)}
            >
              <div className="flex items-start gap-3">
                <CategoryIcon category={item.category} size="sm" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-nha-gray-900 truncate">{item.title}</h3>
                  <div className="flex items-center gap-3 text-sm text-nha-gray-500 mt-0.5">
                    <span>{item.requester_name}</span>
                    <span>Declined {formatDate(item.decided_at)}</span>
                  </div>
                  {item.rationale && (
                    <div className="mt-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                      <p className="text-sm text-red-800">{item.rationale}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
