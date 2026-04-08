import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { dhub } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import type { DhubRequest } from '../../types/request'

interface DeleteRequestButtonProps {
  request: DhubRequest
}

/**
 * Admin-only delete button + confirm modal. Self-contained.
 * Soft-deletes via the new `deleted` status, cascades to underlying raw
 * children (so re-consolidation won't bring them back). Stores who/when/why
 * in metadata.
 */
export default function DeleteRequestButton({ request }: DeleteRequestButtonProps) {
  const { isAdmin, user } = useAuth()
  const navigate = useNavigate()
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteReason, setDeleteReason] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  if (!isAdmin) return null

  async function handleDelete() {
    if (!request?.id) return
    setDeleting(true)
    setDeleteError('')

    try {
      const deletedAt = new Date().toISOString()
      const deletedBy = user?.email ?? 'unknown'
      const reason = deleteReason.trim() || null

      // Cascade: mark any underlying raw children (consolidated_into = this id) as deleted too
      const { error: childErr } = await dhub
        .from('requests')
        .update({ status: 'deleted', updated_at: deletedAt })
        .eq('consolidated_into', request.id)
      if (childErr) throw childErr

      // Soft-delete the card itself
      const updatedMetadata = {
        ...request.metadata,
        deleted_at: deletedAt,
        deleted_by: deletedBy,
        deleted_reason: reason,
      }
      const { error: cardErr } = await dhub
        .from('requests')
        .update({
          status: 'deleted',
          metadata: updatedMetadata,
          updated_at: deletedAt,
        })
        .eq('id', request.id)
      if (cardErr) throw cardErr

      navigate('/')
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete request')
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="pt-4 border-t border-nha-gray-200">
        <button
          onClick={() => { setDeleteReason(''); setDeleteError(''); setShowDeleteModal(true) }}
          className="inline-flex items-center gap-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Trash2 size={14} />
          Delete request
        </button>
      </div>

      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => !deleting && setShowDeleteModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-nha-gray-900">Delete this request?</h3>
                <p className="text-sm text-nha-gray-600 mt-1">"{request?.title}"</p>
              </div>
            </div>

            <p className="text-sm text-nha-gray-700 mb-3">
              The request will be hidden from all views and won't be reprocessed by the consolidation engine.
              {request?.metadata?.source_count && request.metadata.source_count > 1 ? (
                <> All <strong>{request.metadata.source_count}</strong> underlying source messages will also be removed.</>
              ) : null}
              {' '}The original Slack/email message stays in its source system.
            </p>

            <label className="block text-xs font-medium text-nha-gray-600 mb-1">
              Reason (optional)
            </label>
            <textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="e.g. duplicate, junk, requester withdrew"
              rows={2}
              className="w-full text-sm border border-nha-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-300 resize-none"
              disabled={deleting}
            />

            {deleteError && (
              <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {deleteError}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-nha-gray-700 hover:bg-nha-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                {deleting ? 'Deleting...' : (<><Trash2 size={14} /> Delete</>)}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
