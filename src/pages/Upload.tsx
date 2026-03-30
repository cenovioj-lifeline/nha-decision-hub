import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle } from 'lucide-react'
import { dhub } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import UploadZone from '../components/UploadZone'

export default function Upload() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [files, setFiles] = useState<File[]>([])
  const [context, setContext] = useState('')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('feature')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  function handleFilesSelected(newFiles: File[]) {
    setFiles((prev) => [...prev, ...newFiles])
  }

  function handleRemoveFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (files.length === 0) {
      setError('Please select at least one screenshot')
      return
    }
    if (!title.trim()) {
      setError('Please enter a title')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      // Upload files to storage
      const attachments: { url: string; name: string; type: string }[] = []

      for (const file of files) {
        const ext = file.name.split('.').pop()
        const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

        const { error: uploadError } = await dhub.storage
          .from('dhub-screenshots')
          .upload(path, file, { contentType: file.type })

        if (uploadError) throw uploadError

        const { data: urlData } = dhub.storage
          .from('dhub-screenshots')
          .getPublicUrl(path)

        attachments.push({
          url: urlData.publicUrl,
          name: file.name,
          type: file.type,
        })
      }

      // Create request
      const { error: insertError } = await dhub.from('requests').insert({
        source: 'screenshot',
        requester_name: user?.email?.split('@')[0] ?? 'Unknown',
        requester_email: user?.email,
        category,
        title: title.trim(),
        description: context.trim() || null,
        attachments,
        status: 'inbox',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      if (insertError) throw insertError

      setSuccess(true)
      setTimeout(() => navigate('/inbox'), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <CheckCircle size={48} className="text-green-500 mb-4" />
        <h2 className="text-xl font-bold text-nha-gray-900">Upload Successful</h2>
        <p className="text-sm text-nha-gray-500 mt-1">Redirecting to inbox...</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-nha-gray-900 mb-1">Upload Screenshot</h1>
      <p className="text-sm text-nha-gray-500 mb-6">
        Capture a bug, feature idea, or UX issue from a screenshot
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <UploadZone
          files={files}
          onFilesSelected={handleFilesSelected}
          onRemoveFile={handleRemoveFile}
        />

        <div>
          <label htmlFor="title" className="block text-sm font-medium text-nha-gray-700 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Brief description of the issue or idea"
            className="w-full rounded-lg border border-nha-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-nha-sky focus:border-nha-sky"
          />
        </div>

        <div>
          <label htmlFor="category" className="block text-sm font-medium text-nha-gray-700 mb-1">
            Category
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-nha-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-nha-sky focus:border-nha-sky"
          >
            <option value="bug">Bug</option>
            <option value="feature">Feature Request</option>
            <option value="ux">UX Improvement</option>
            <option value="question">Question</option>
          </select>
        </div>

        <div>
          <label htmlFor="context" className="block text-sm font-medium text-nha-gray-700 mb-1">
            Context (optional)
          </label>
          <textarea
            id="context"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={4}
            placeholder="What were you doing when you noticed this? Any steps to reproduce?"
            className="w-full rounded-lg border border-nha-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-nha-sky focus:border-nha-sky resize-none"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 bg-nha-blue text-white rounded-lg text-sm font-semibold hover:bg-nha-blue/90 transition-colors disabled:opacity-50"
        >
          {submitting ? 'Uploading...' : 'Submit Screenshot'}
        </button>
      </form>
    </div>
  )
}
