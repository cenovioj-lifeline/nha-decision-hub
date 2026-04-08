import { useState } from 'react'
import { Image, Paperclip, X } from 'lucide-react'
import type { RequestAttachment } from '../../types/request'

interface AttachmentsGridProps {
  attachments: RequestAttachment[] | null
}

/**
 * Renders the attachment grid plus its own lightbox modal.
 * Self-contained — owns the lightbox state internally.
 */
export default function AttachmentsGrid({ attachments }: AttachmentsGridProps) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  if (!attachments || attachments.length === 0) return null

  return (
    <>
      <div className="mt-6">
        <h3 className="text-sm font-medium text-nha-gray-700 mb-2 flex items-center gap-1">
          <Paperclip size={14} />
          Attachments
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {attachments.map((att, i) => {
            const isSlackPrivate = att.url?.includes('files.slack.com/files-pri')
            const isImage = att.type?.startsWith('image/')
            return (
              <div key={i}>
                {isImage && !isSlackPrivate ? (
                  <button
                    onClick={() => setLightboxUrl(att.url)}
                    className="w-full text-left"
                  >
                    <img
                      src={att.url}
                      alt={att.name}
                      className="rounded-lg border border-nha-gray-200 w-full object-cover max-h-64 hover:opacity-90 transition-opacity cursor-pointer"
                    />
                  </button>
                ) : (
                  <button
                    onClick={() => setLightboxUrl(att.url)}
                    className="w-full flex items-center gap-2 bg-nha-gray-50 rounded-lg border border-nha-gray-200 p-3 hover:bg-nha-gray-100 transition-colors"
                  >
                    {isImage ? <Image size={14} className="text-nha-gray-400" /> : <Paperclip size={14} className="text-nha-gray-400" />}
                    <span className="text-sm text-nha-gray-700 truncate">{att.name || 'Attachment'}</span>
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Lightbox modal */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
          >
            <X size={28} />
          </button>
          <iframe
            src={lightboxUrl}
            className="max-w-full max-h-full w-full h-full rounded-lg bg-white"
            title="Attachment preview"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
