import { Layers, Mail, MessageSquare, Paperclip } from 'lucide-react'
import type { RequestMetadata } from '../../types/request'

interface SourceMessagesProps {
  metadata: RequestMetadata | null
  source: string
}

/**
 * Original Slack/email content + thread replies (and the reasoning if this
 * card was AI-consolidated from multiple raw messages). Pure display.
 */
export default function SourceMessages({ metadata, source }: SourceMessagesProps) {
  const messages = metadata?.source_messages
  if (!messages || messages.length === 0) return null

  const isConsolidated = metadata?.is_consolidated
  const sourceCount = metadata?.source_count
  const reasoning = metadata?.consolidation_reasoning

  return (
    <div className="bg-white rounded-2xl border border-nha-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        {isConsolidated ? (
          <>
            <Layers size={16} className="text-purple-600" />
            <h3 className="font-semibold text-nha-gray-800">
              Consolidated from {sourceCount} messages
            </h3>
          </>
        ) : (
          <>
            {source === 'email' ? (
              <Mail size={16} className="text-blue-600" />
            ) : (
              <MessageSquare size={16} className="text-green-600" />
            )}
            <h3 className="font-semibold text-nha-gray-800">
              Original {source === 'email' ? 'Email' : 'Slack Message'}
            </h3>
          </>
        )}
      </div>
      {reasoning && (
        <p className="text-sm text-nha-gray-500 mb-4 italic">{reasoning}</p>
      )}
      <div className="space-y-3">
        {messages.map((msg, i) => (
          <div
            key={msg.id || i}
            className="bg-nha-gray-50 rounded-lg border border-nha-gray-100 p-3"
          >
            <div className="flex items-center gap-2 text-xs text-nha-gray-500 mb-1.5">
              <span className="font-medium text-nha-gray-700">{msg.author}</span>
              <span className="text-nha-gray-300">·</span>
              <span className="capitalize">{msg.source}</span>
              <span className="text-nha-gray-300">·</span>
              <span>{msg.date}</span>
              {msg.has_attachment && (
                <>
                  <span className="text-nha-gray-300">·</span>
                  <Paperclip size={10} />
                </>
              )}
            </div>
            <p className="text-sm text-nha-gray-700 whitespace-pre-wrap">
              {msg.original_text}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
