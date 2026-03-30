import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Paperclip } from 'lucide-react'
import { dhub } from '../lib/supabase'
import { timeAgo, formatDateTime } from '../lib/utils'
import CategoryIcon from '../components/CategoryIcon'
import StatusBadge from '../components/StatusBadge'
import AnalysisPanel from '../components/AnalysisPanel'
import DecisionForm from '../components/DecisionForm'

interface Request {
  id: string
  source: string
  source_ref: string | null
  source_channel: string | null
  requester_name: string
  requester_email: string | null
  category: string
  title: string
  description: string | null
  attachments: { url: string; name: string; type: string }[] | null
  ai_analysis: Record<string, unknown> | null
  ai_analyzed_at: string | null
  status: string
  created_at: string
  updated_at: string
}

interface Decision {
  id: string
  action: string
  rationale: string | null
  priority: string | null
  clickup_task_url: string | null
  decided_at: string
}

export default function RequestDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [request, setRequest] = useState<Request | null>(null)
  const [decision, setDecision] = useState<Decision | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchData() {
    if (!id) return
    setLoading(true)

    const [reqRes, decRes] = await Promise.all([
      dhub.from('requests').select('*').eq('id', id).single(),
      dhub.from('decisions').select('*').eq('request_id', id).order('decided_at', { ascending: false }).limit(1),
    ])

    if (reqRes.data) setRequest(reqRes.data as Request)
    if (decRes.data && (decRes.data as Decision[]).length > 0) {
      setDecision((decRes.data as Decision[])[0])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nha-blue" />
      </div>
    )
  }

  if (!request) {
    return (
      <div className="text-center py-20">
        <p className="text-nha-gray-500">Request not found</p>
        <button onClick={() => navigate('/inbox')} className="text-nha-sky hover:underline text-sm mt-2">
          Back to Inbox
        </button>
      </div>
    )
  }

  const analysis = request.ai_analysis as {
    summary?: string
    related_items?: { task_id: string; task_name: string; status: string; assignee_name: string | null; similarity: number }[]
    duplicate_warning?: string
    category_suggestion?: string
    priority_suggestion?: string
  } | null

  const relatedItems = analysis?.related_items ?? []

  return (
    <div className="max-w-4xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-nha-gray-500 hover:text-nha-gray-700 mb-4 transition-colors"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <div className="bg-white rounded-2xl border border-nha-gray-200 p-6">
            <div className="flex items-start gap-3 mb-4">
              <CategoryIcon category={request.category} />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h1 className="text-xl font-bold text-nha-gray-900">{request.title}</h1>
                  <StatusBadge value={request.status} />
                </div>
                <div className="flex items-center gap-2 text-sm text-nha-gray-500 flex-wrap">
                  <span>{request.requester_name}</span>
                  {request.requester_email && (
                    <>
                      <span className="text-nha-gray-300">|</span>
                      <span>{request.requester_email}</span>
                    </>
                  )}
                  <span className="text-nha-gray-300">|</span>
                  <span>{timeAgo(request.created_at)}</span>
                </div>
              </div>
            </div>

            {/* Source info */}
            <div className="flex items-center gap-2 mb-4 text-sm">
              <StatusBadge value={request.source} type="source" />
              {request.source_channel && (
                <span className="text-nha-gray-500">#{request.source_channel}</span>
              )}
              {request.source_ref && (
                <a
                  href={request.source_ref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-nha-sky hover:underline flex items-center gap-1"
                >
                  View source <ExternalLink size={12} />
                </a>
              )}
            </div>

            {/* Description */}
            {request.description && (
              <div className="prose prose-sm max-w-none text-nha-gray-700 whitespace-pre-wrap">
                {request.description}
              </div>
            )}

            {/* Attachments */}
            {request.attachments && request.attachments.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-nha-gray-700 mb-2 flex items-center gap-1">
                  <Paperclip size={14} />
                  Attachments
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {request.attachments.map((att, i) => (
                    <div key={i}>
                      {att.type?.startsWith('image/') ? (
                        <a href={att.url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={att.url}
                            alt={att.name}
                            className="rounded-lg border border-nha-gray-200 w-full object-cover max-h-64"
                          />
                        </a>
                      ) : (
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 bg-nha-gray-50 rounded-lg border border-nha-gray-200 p-3 hover:bg-nha-gray-100 transition-colors"
                        >
                          <Paperclip size={14} className="text-nha-gray-400" />
                          <span className="text-sm text-nha-gray-700 truncate">{att.name}</span>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Decision */}
          {decision ? (
            <div className="bg-white rounded-2xl border border-nha-gray-200 p-6">
              <h3 className="font-semibold text-nha-gray-800 mb-3">Decision</h3>
              <div className="flex items-center gap-3 mb-3">
                <StatusBadge value={decision.action} type="action" />
                {decision.priority && (
                  <span className="text-sm text-nha-gray-500">Priority: {decision.priority}</span>
                )}
                <span className="text-sm text-nha-gray-400">{formatDateTime(decision.decided_at)}</span>
              </div>
              {decision.rationale && (
                <p className="text-sm text-nha-gray-700 whitespace-pre-wrap">{decision.rationale}</p>
              )}
              {decision.clickup_task_url && (
                <a
                  href={decision.clickup_task_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-nha-sky hover:underline mt-3"
                >
                  View in ClickUp <ExternalLink size={12} />
                </a>
              )}
            </div>
          ) : request.status === 'inbox' ? (
            <div className="bg-white rounded-2xl border border-nha-gray-200 p-6">
              <DecisionForm
                requestId={request.id}
                relatedItems={relatedItems.map((r) => ({ task_id: r.task_id, task_name: r.task_name }))}
                onDecided={fetchData}
              />
            </div>
          ) : null}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <AnalysisPanel analysis={analysis} analyzedAt={request.ai_analyzed_at} />

          {/* Meta */}
          <div className="bg-white rounded-2xl border border-nha-gray-200 p-4 space-y-3 text-sm">
            <h3 className="font-semibold text-nha-gray-800">Details</h3>
            <div className="flex justify-between">
              <span className="text-nha-gray-500">Category</span>
              <span className="capitalize text-nha-gray-700">{request.category}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-nha-gray-500">Source</span>
              <span className="capitalize text-nha-gray-700">{request.source}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-nha-gray-500">Created</span>
              <span className="text-nha-gray-700">{formatDateTime(request.created_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-nha-gray-500">Updated</span>
              <span className="text-nha-gray-700">{formatDateTime(request.updated_at)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
