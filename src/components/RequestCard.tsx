import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Clock, Layers, Mail, MessageSquare } from 'lucide-react'
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
  dev_estimate_hours: number | null
  metadata: {
    is_consolidated?: boolean
    source_count?: number
    needs_clarification?: boolean
    clarification_answers?: { question: string; answer: string }[]
  } | null
}

interface RequestCardProps {
  request: Request
}

const SOURCE_ICONS: Record<string, typeof Mail> = {
  email: Mail,
  slack: MessageSquare,
}

export default function RequestCard({ request }: RequestCardProps) {
  const navigate = useNavigate()
  const analysis = request.ai_analysis as { summary?: string } | null
  const SourceIcon = SOURCE_ICONS[request.source]
  const meta = request.metadata as { is_consolidated?: boolean; source_count?: number; needs_clarification?: boolean; clarification_answers?: unknown[] } | null
  const isConsolidated = meta?.is_consolidated === true
  const sourceCount = meta?.source_count ?? 1

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
          <div className="flex items-center gap-2 text-sm text-nha-gray-500 mb-2 flex-wrap">
            <span>{request.requester_name}</span>
            <span className="text-nha-gray-300">|</span>
            <span className="flex items-center gap-1">
              {SourceIcon && <SourceIcon size={12} />}
              <StatusBadge value={request.source} type="source" />
            </span>
            <span className="text-nha-gray-300">|</span>
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {timeAgo(request.created_at)}
            </span>
            {request.dev_estimate_hours != null && request.dev_estimate_hours > 0 && (
              <>
                <span className="text-nha-gray-300">|</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                  {request.dev_estimate_hours}h est.
                </span>
              </>
            )}
            {isConsolidated && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-nha-gray-50 text-nha-gray-600 border border-nha-gray-200">
                <Layers size={10} />
                {sourceCount} messages
              </span>
            )}
            {meta?.needs_clarification && !meta?.clarification_answers?.length && (
              <>
                <span className="text-nha-gray-300">|</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                  <AlertTriangle size={10} />
                  Needs details
                </span>
              </>
            )}
          </div>
          {analysis?.summary ? (
            <p className="text-sm text-nha-gray-600 line-clamp-2">{analysis.summary}</p>
          ) : null}
        </div>
      </div>
    </button>
  )
}
