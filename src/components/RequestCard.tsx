import { useNavigate } from 'react-router-dom'
import { Clock } from 'lucide-react'
import CategoryIcon from './CategoryIcon'
import StatusBadge from './StatusBadge'
import { timeAgo } from '../lib/utils'

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
}

interface RequestCardProps {
  request: Request
}

export default function RequestCard({ request }: RequestCardProps) {
  const navigate = useNavigate()
  const analysis = request.ai_analysis as { summary?: string } | null

  return (
    <button
      onClick={() => navigate(`/requests/${request.id}`)}
      className="w-full text-left bg-white rounded-xl border border-nha-gray-200 p-4 hover:border-nha-sky hover:shadow-md transition-all group"
    >
      <div className="flex items-start gap-3">
        <CategoryIcon category={request.category} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-nha-gray-900 truncate group-hover:text-nha-blue transition-colors">
              {request.title}
            </h3>
          </div>
          <div className="flex items-center gap-2 text-sm text-nha-gray-500 mb-2">
            <span>{request.requester_name}</span>
            <span className="text-nha-gray-300">|</span>
            <StatusBadge value={request.source} type="source" />
            <span className="text-nha-gray-300">|</span>
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {timeAgo(request.created_at)}
            </span>
          </div>
          {analysis?.summary ? (
            <p className="text-sm text-nha-gray-600 line-clamp-2">{analysis.summary}</p>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
              Awaiting analysis
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
