import { ExternalLink, AlertTriangle } from 'lucide-react'
import StatusBadge from './StatusBadge'

interface RelatedItem {
  task_id: string
  task_name: string
  status: string
  assignee_name: string | null
  similarity: number
}

interface Analysis {
  summary?: string
  related_items?: RelatedItem[]
  duplicate_warning?: string
  category_suggestion?: string
  priority_suggestion?: string
}

interface AnalysisPanelProps {
  analysis: Analysis | null
  analyzedAt: string | null
}

export default function AnalysisPanel({ analysis, analyzedAt }: AnalysisPanelProps) {
  if (!analysis) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <p className="text-sm text-yellow-700 font-medium">AI analysis pending</p>
        <p className="text-xs text-yellow-600 mt-1">
          Analysis will run automatically and populate related items, duplicates, and suggestions.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-nha-blue-light border border-nha-blue/20 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-nha-blue text-sm">AI Analysis</h3>
        {analyzedAt && (
          <span className="text-xs text-nha-gray-400">
            Analyzed {new Date(analyzedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {analysis.summary && (
        <p className="text-sm text-nha-gray-700">{analysis.summary}</p>
      )}

      {analysis.duplicate_warning && (
        <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <AlertTriangle size={16} className="text-yellow-600 shrink-0 mt-0.5" />
          <p className="text-sm text-yellow-700">{analysis.duplicate_warning}</p>
        </div>
      )}

      {analysis.related_items && analysis.related_items.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-nha-gray-500 uppercase tracking-wider mb-2">
            Related ClickUp Items
          </h4>
          <div className="space-y-2">
            {analysis.related_items.map((item) => (
              <div
                key={item.task_id}
                className="flex items-center gap-3 bg-white rounded-lg border border-nha-gray-200 p-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-nha-gray-800 truncate">{item.task_name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusBadge value={item.status} />
                    {item.assignee_name && (
                      <span className="text-xs text-nha-gray-500">{item.assignee_name}</span>
                    )}
                  </div>
                </div>
                <div className="text-xs text-nha-gray-400">
                  {Math.round(item.similarity * 100)}% match
                </div>
                <a
                  href={`https://app.clickup.com/t/${item.task_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-nha-sky hover:text-nha-blue"
                >
                  <ExternalLink size={14} />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 text-xs text-nha-gray-500">
        {analysis.category_suggestion && (
          <span>Suggested category: <strong>{analysis.category_suggestion}</strong></span>
        )}
        {analysis.priority_suggestion && (
          <span>Suggested priority: <strong>{analysis.priority_suggestion}</strong></span>
        )}
      </div>
    </div>
  )
}
