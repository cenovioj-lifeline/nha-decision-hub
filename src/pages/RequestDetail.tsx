import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Clock, ExternalLink, Mail, MessageCircleQuestion, Pencil, Reply, Send } from 'lucide-react'
import { dhub, supabase } from '../lib/supabase'
import { timeAgo, formatDateTime } from '../lib/utils'
import { useAuth } from '../lib/auth'
import CategoryIcon from '../components/CategoryIcon'
import StatusBadge from '../components/StatusBadge'
import AnalysisPanel from '../components/AnalysisPanel'
import DecisionForm from '../components/DecisionForm'
import SourceMessages from '../components/request-detail/SourceMessages'
import AttachmentsGrid from '../components/request-detail/AttachmentsGrid'
import DuplicateCheckSection from '../components/request-detail/DuplicateCheckSection'
import DeleteRequestButton from '../components/request-detail/DeleteRequestButton'
import ClarificationSection from '../components/request-detail/ClarificationSection'
import type { DhubRequest } from '../types/request'

// Local Decision type — only used here for the decision sidebar block
interface Decision {
  id: string
  action: string
  rationale: string | null
  priority: string | null
  clickup_task_url: string | null
  decided_at: string
  sprint_id: string | null
  cenovio_estimate: number | null
  sprints: { label: string } | { label: string }[] | null
}

const CATEGORIES = ['bug', 'feature', 'ux', 'question', 'data']

export default function RequestDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isViewer } = useAuth()
  const [request, setRequest] = useState<DhubRequest | null>(null)
  const [decision, setDecision] = useState<Decision | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Editable fields (header — title, name, email, description)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [editingEmail, setEditingEmail] = useState(false)
  const [emailDraft, setEmailDraft] = useState('')
  const [editingDesc, setEditingDesc] = useState(false)
  const [descDraft, setDescDraft] = useState('')
  const [poNotes, setPoNotes] = useState('')
  const [poNotesSaved, setPoNotesSaved] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const emailInputRef = useRef<HTMLInputElement>(null)
  const descTextareaRef = useRef<HTMLTextAreaElement>(null)
  const poNotesTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Manual "Ask for clarification" Slack DM (separate from the AI clarification Q&A)
  const [clarificationMsg, setClarificationMsg] = useState('')
  const [clarificationSending, setClarificationSending] = useState(false)
  const [clarificationResult, setClarificationResult] = useState('')
  const [clarifications, setClarifications] = useState<{ message_text: string; created_at: string }[]>([])

  async function updateField(field: string, value: string | null) {
    if (!id) return
    await dhub.from('requests').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', id)
  }

  function handleTitleEdit() {
    if (!request) return
    setTitleDraft(request.title)
    setEditingTitle(true)
    setTimeout(() => titleInputRef.current?.focus(), 50)
  }
  async function handleTitleSave() {
    if (!request || !titleDraft.trim()) return
    setEditingTitle(false)
    await updateField('title', titleDraft.trim())
    setRequest({ ...request, title: titleDraft.trim() })
  }

  function handleNameEdit() {
    if (!request) return
    setNameDraft(request.requester_name)
    setEditingName(true)
    setTimeout(() => nameInputRef.current?.focus(), 50)
  }
  async function handleNameSave() {
    if (!request || !nameDraft.trim()) return
    setEditingName(false)
    await updateField('requester_name', nameDraft.trim())
    setRequest({ ...request, requester_name: nameDraft.trim() })
  }

  function handleEmailEdit() {
    if (!request) return
    setEmailDraft(request.requester_email || '')
    setEditingEmail(true)
    setTimeout(() => emailInputRef.current?.focus(), 50)
  }
  async function handleEmailSave() {
    if (!request) return
    setEditingEmail(false)
    const val = emailDraft.trim() || null
    await updateField('requester_email', val)
    setRequest({ ...request, requester_email: val })
  }

  function handleDescEdit() {
    if (!request) return
    setDescDraft(request.description || '')
    setEditingDesc(true)
    setTimeout(() => descTextareaRef.current?.focus(), 50)
  }
  async function handleDescSave() {
    if (!request) return
    setEditingDesc(false)
    await updateField('description', descDraft)
    setRequest({ ...request, description: descDraft })
  }

  async function handleCategoryChange(newCat: string) {
    if (!request) return
    await updateField('category', newCat)
    setRequest({ ...request, category: newCat })
  }

  function handlePoNotesChange(value: string) {
    setPoNotes(value)
    setPoNotesSaved(false)
    if (poNotesTimerRef.current) clearTimeout(poNotesTimerRef.current)
    poNotesTimerRef.current = setTimeout(async () => {
      await updateField('po_notes', value || null)
      setPoNotesSaved(true)
      setTimeout(() => setPoNotesSaved(false), 2000)
    }, 1000)
  }

  async function fetchClarifications() {
    if (!id) return
    const { data } = await dhub
      .from('communications')
      .select('message_text, created_at')
      .eq('request_id', id)
      .eq('message_type', 'clarification')
      .order('created_at', { ascending: true })
    setClarifications((data as { message_text: string; created_at: string }[]) ?? [])
  }

  async function sendClarification() {
    if (!clarificationMsg.trim() || !id) return
    setClarificationSending(true)
    setClarificationResult('')
    try {
      const res = await fetch(
        'https://nhwdgstjhugezhqlktie.supabase.co/functions/v1/dhub-send-clarification',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? ''}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ request_id: id, message: clarificationMsg }),
        }
      )
      const data = await res.json()
      if (data.error) {
        setClarificationResult(`Failed: ${data.error}`)
      } else {
        setClarificationResult(`Sent to ${data.recipient} via Slack`)
        setClarificationMsg('')
        fetchClarifications()
      }
    } catch (err) {
      setClarificationResult(`Error: ${err instanceof Error ? err.message : 'Unknown'}`)
    } finally {
      setClarificationSending(false)
      setTimeout(() => setClarificationResult(''), 5000)
    }
  }

  async function fetchData() {
    if (!id) return
    setLoading(true)
    setError('')

    try {
      const reqRes = await dhub.from('requests').select('*').eq('id', id).maybeSingle()

      if (reqRes.error) {
        setError(`Failed to load request: ${reqRes.error.message}`)
        setLoading(false)
        return
      }

      if (reqRes.data) {
        setRequest(reqRes.data as DhubRequest)
        setPoNotes((reqRes.data as DhubRequest).po_notes || '')
      }

      const decRes = await dhub.from('decisions').select('*, sprints(label)').eq('request_id', id).order('decided_at', { ascending: false }).limit(1)
      if (decRes.data && (decRes.data as Decision[]).length > 0) {
        setDecision((decRes.data as Decision[])[0])
      } else {
        setDecision(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error loading request')
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
    fetchClarifications()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nha-blue" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <p className="text-red-600 font-medium mb-2">Error loading request</p>
        <p className="text-sm text-nha-gray-500 mb-4">{error}</p>
        <button onClick={() => navigate('/inbox')} className="text-nha-sky hover:underline text-sm">
          Back to Inbox
        </button>
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
    related?: { task_id: string; task_name: string; status: string; assignee?: string | null; similarity: number; relationship?: string }[]
    related_items?: { task_id: string; task_name: string; status: string; assignee_name: string | null; similarity: number }[]
    duplicate_of?: { task_id: string; task_name: string; status: string; assignee?: string | null } | null
    duplicate_warning?: string
    category?: string
    priority_suggestion?: string
  } | null

  // attachments may come back as a JSON string from PostgREST
  if (request.attachments && typeof request.attachments === 'string') {
    try { request.attachments = JSON.parse(request.attachments) } catch { request.attachments = null }
  }

  const isEmail = request.source === 'email'
  const emailSubject = request.metadata?.subject_full || request.title
  const emailCc = request.metadata?.cc

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
          {/* Header card */}
          <div className="bg-white rounded-2xl border border-nha-gray-200 p-6">
            <div className="flex items-start gap-3 mb-4">
              <CategoryIcon category={request.category} />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {isViewer ? (
                    <h1 className="text-xl font-bold text-nha-gray-900">{request.title}</h1>
                  ) : editingTitle ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        ref={titleInputRef}
                        value={titleDraft}
                        onChange={e => setTitleDraft(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') setEditingTitle(false) }}
                        onBlur={handleTitleSave}
                        className="text-xl font-bold text-nha-gray-900 bg-transparent border-b-2 border-nha-blue outline-none flex-1 min-w-0"
                      />
                      <button onClick={handleTitleSave} className="text-nha-blue hover:text-nha-blue/80">
                        <Check size={18} />
                      </button>
                    </div>
                  ) : (
                    <h1
                      className="text-xl font-bold text-nha-gray-900 cursor-pointer hover:text-nha-blue transition-colors group/title flex items-center gap-2"
                      onClick={handleTitleEdit}
                    >
                      {request.title}
                      <Pencil size={14} className="text-nha-gray-300 opacity-0 group-hover/title:opacity-100 transition-opacity" />
                    </h1>
                  )}
                  <StatusBadge value={request.status} />
                </div>
                <div className="flex items-center gap-2 text-sm text-nha-gray-500 flex-wrap">
                  {!isViewer && editingName ? (
                    <input
                      ref={nameInputRef}
                      value={nameDraft}
                      onChange={e => setNameDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleNameSave(); if (e.key === 'Escape') setEditingName(false) }}
                      onBlur={handleNameSave}
                      className="text-sm text-nha-gray-500 bg-transparent border-b-2 border-nha-blue outline-none"
                    />
                  ) : (
                    <span
                      className={!isViewer ? 'cursor-pointer hover:text-nha-blue transition-colors' : ''}
                      onClick={!isViewer ? handleNameEdit : undefined}
                    >
                      {request.requester_name}
                    </span>
                  )}
                  <span className="text-nha-gray-300">|</span>
                  {!isViewer && editingEmail ? (
                    <input
                      ref={emailInputRef}
                      value={emailDraft}
                      onChange={e => setEmailDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleEmailSave(); if (e.key === 'Escape') setEditingEmail(false) }}
                      onBlur={handleEmailSave}
                      placeholder="email@example.com"
                      className="text-sm text-nha-gray-500 bg-transparent border-b-2 border-nha-blue outline-none"
                    />
                  ) : (
                    <span
                      className={!isViewer ? 'cursor-pointer hover:text-nha-blue transition-colors' : ''}
                      onClick={!isViewer ? handleEmailEdit : undefined}
                    >
                      {request.requester_email || (isViewer ? '' : 'Add email')}
                    </span>
                  )}
                  <span className="text-nha-gray-300">|</span>
                  <span>{timeAgo(request.created_at)}</span>
                </div>
              </div>
            </div>

            {/* Source info */}
            <div className="flex items-center gap-2 mb-4 text-sm">
              <StatusBadge value={request.source} type="source" />
              {!isEmail && request.source_channel && (
                <span className="text-nha-gray-500">#{request.source_channel}</span>
              )}
              {!isEmail && request.source_ref && (
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

            {/* Email metadata */}
            {isEmail && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Mail size={14} className="text-blue-600 shrink-0" />
                  <span className="text-nha-gray-500">From:</span>
                  <span className="text-nha-gray-800 font-medium">
                    {request.requester_name} &lt;{request.requester_email || request.source_channel}&gt;
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="ml-5 text-nha-gray-500">Subject:</span>
                  <span className="text-nha-gray-800">{emailSubject}</span>
                </div>
                {emailCc && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="ml-5 text-nha-gray-500">CC:</span>
                    <span className="text-nha-gray-700">{emailCc}</span>
                  </div>
                )}
              </div>
            )}

            {/* Cenovio's Notes */}
            {!isViewer ? (
              <div className="mb-4">
                <label className="block text-xs font-bold uppercase tracking-wider text-nha-gray-400 mb-2">
                  Cenovio's Notes
                  {poNotesSaved && <span className="ml-2 text-green-600 normal-case font-medium">Saved</span>}
                </label>
                <textarea
                  value={poNotes}
                  onChange={e => handlePoNotesChange(e.target.value)}
                  rows={2}
                  placeholder="Add clarification, context, or instructions for the dev team..."
                  className="w-full rounded-lg border border-nha-gray-200 px-3 py-2 text-sm text-nha-gray-700 focus:outline-none focus:ring-2 focus:ring-nha-blue/20 focus:border-nha-blue resize-none"
                />
              </div>
            ) : poNotes ? (
              <div className="mb-4">
                <label className="block text-xs font-bold uppercase tracking-wider text-nha-gray-400 mb-2">Notes</label>
                <p className="text-sm text-nha-gray-700 whitespace-pre-wrap">{poNotes}</p>
              </div>
            ) : null}

            {/* AI Clarification Q&A — extracted to its own component */}
            <ClarificationSection request={request} onChange={fetchData} />

            {/* Manual Ask for Clarification (Slack DM) */}
            {!isViewer && (
              <div className="mb-4">
                <label className="block text-xs font-bold uppercase tracking-wider text-nha-gray-400 mb-2 flex items-center gap-1.5">
                  <MessageCircleQuestion size={12} />
                  Ask for Clarification
                </label>
                {clarifications.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {clarifications.map((c, i) => (
                      <div key={i} className="flex gap-2 text-sm">
                        <span className="text-nha-gray-400 whitespace-nowrap text-xs mt-0.5">{formatDateTime(c.created_at)}</span>
                        <p className="text-nha-gray-600 bg-nha-gray-50 rounded-lg px-3 py-1.5 border border-nha-gray-100">{c.message_text}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <textarea
                    value={clarificationMsg}
                    onChange={e => setClarificationMsg(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendClarification() }}
                    rows={2}
                    placeholder={`Ask ${request.requester_name.split(' ')[0]} a question via Slack DM...`}
                    className="flex-1 rounded-lg border border-nha-gray-200 px-3 py-2 text-sm text-nha-gray-700 focus:outline-none focus:ring-2 focus:ring-nha-blue/20 focus:border-nha-blue resize-none"
                  />
                  <button
                    onClick={sendClarification}
                    disabled={clarificationSending || !clarificationMsg.trim()}
                    className="self-end px-3 py-2 bg-nha-blue text-white rounded-lg text-sm font-medium hover:bg-nha-blue/90 transition-colors disabled:opacity-40 flex items-center gap-1.5"
                  >
                    <Send size={14} />
                    {clarificationSending ? 'Sending...' : 'Send'}
                  </button>
                </div>
                {clarificationResult && (
                  <p className={`text-xs mt-1.5 ${clarificationResult.startsWith('Failed') || clarificationResult.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
                    {clarificationResult}
                  </p>
                )}
              </div>
            )}

            {/* Description */}
            {!isViewer && editingDesc ? (
              <div>
                <textarea
                  ref={descTextareaRef}
                  value={descDraft}
                  onChange={e => setDescDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') setEditingDesc(false) }}
                  rows={10}
                  className="w-full text-sm text-nha-gray-700 bg-transparent border-2 border-nha-blue rounded-lg px-3 py-2 outline-none resize-y"
                />
                <div className="flex gap-2 mt-2">
                  <button onClick={handleDescSave} className="text-sm text-white bg-nha-blue px-3 py-1 rounded-lg hover:bg-nha-blue/90">Save</button>
                  <button onClick={() => setEditingDesc(false)} className="text-sm text-nha-gray-500 px-3 py-1 rounded-lg hover:bg-nha-gray-100">Cancel</button>
                </div>
              </div>
            ) : request.description ? (
              <div
                className={`prose prose-sm max-w-none text-nha-gray-700 whitespace-pre-wrap ${!isViewer ? 'cursor-pointer hover:bg-nha-gray-50 rounded-lg transition-colors -mx-2 px-2 py-1' : ''}`}
                onClick={!isViewer ? handleDescEdit : undefined}
              >
                {request.description}
              </div>
            ) : (
              <div
                className={`text-sm text-nha-gray-400 italic ${!isViewer ? 'cursor-pointer hover:text-nha-blue' : ''}`}
                onClick={!isViewer ? handleDescEdit : undefined}
              >
                {isViewer ? 'No text content — this message may have been an image or attachment only.' : 'Click to add description...'}
              </div>
            )}

            {/* Attachments — extracted to its own component (owns lightbox state) */}
            <AttachmentsGrid attachments={request.attachments} />
          </div>

          {/* Possible Duplicate — extracted */}
          <DuplicateCheckSection request={request} onChange={fetchData} />

          {/* Sources — extracted */}
          <SourceMessages metadata={request.metadata} source={request.source} />

          {/* Decision */}
          {!isViewer && request.status !== 'completed' ? (
            <div className="bg-white rounded-2xl border border-nha-gray-200 p-6">
              {isEmail && request.requester_email && request.status === 'new' && (
                <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200 text-sm text-blue-700">
                  <Reply size={14} className="shrink-0" />
                  Decision reply will be sent to <strong>{request.requester_email}</strong>
                </div>
              )}
              <DecisionForm
                requestId={request.id}
                currentStatus={request.status}
                existingDecision={decision ? {
                  id: decision.id,
                  action: decision.action,
                  rationale: decision.rationale,
                  priority: decision.priority,
                  sprint_id: decision.sprint_id,
                  cenovio_estimate: decision.cenovio_estimate,
                } : null}
                aiEstimate={request.dev_estimate_hours}
                onDecided={fetchData}
              />
              {decision?.clickup_task_url && (
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
          ) : decision ? (
            <div className="bg-white rounded-2xl border border-nha-gray-200 p-6">
              <h3 className="font-semibold text-nha-gray-800 mb-3">Decision</h3>
              <div className="flex items-center gap-3 flex-wrap">
                <StatusBadge value={decision.action} type="action" />
                {decision.priority && <span className="text-sm text-nha-gray-500">Priority: {decision.priority}</span>}
                <span className="text-sm text-nha-gray-400">{formatDateTime(decision.decided_at)}</span>
              </div>
              {decision.rationale && <p className="text-sm text-nha-gray-700 whitespace-pre-wrap mt-3">{decision.rationale}</p>}
            </div>
          ) : null}

          {/* Admin: Delete request — extracted */}
          <DeleteRequestButton request={request} />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <AnalysisPanel analysis={analysis} analyzedAt={request.ai_analyzed_at} />

          {/* Meta */}
          <div className="bg-white rounded-2xl border border-nha-gray-200 p-4 space-y-3 text-sm">
            <h3 className="font-semibold text-nha-gray-800">Details</h3>
            <div className="flex justify-between items-center">
              <span className="text-nha-gray-500">Category</span>
              {isViewer ? (
                <span className="text-sm font-medium text-nha-gray-700 capitalize">{request.category}</span>
              ) : (
                <select
                  value={request.category}
                  onChange={e => handleCategoryChange(e.target.value)}
                  className="text-sm font-medium text-nha-gray-700 bg-transparent border border-nha-gray-200 rounded-lg px-2 py-1 cursor-pointer hover:border-nha-gray-300 focus:outline-none focus:ring-2 focus:ring-nha-blue/20 capitalize"
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c} className="capitalize">{c}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-nha-gray-500">Dev Estimate</span>
              {isViewer ? (
                <span className="inline-flex items-center gap-1 text-nha-gray-700">
                  <Clock size={12} />
                  {request.dev_estimate_hours == null ? '—' : request.dev_estimate_hours === 0 ? 'N/A' : `${request.dev_estimate_hours}h`}
                </span>
              ) : (
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={request.dev_estimate_hours ?? ''}
                  onChange={async (e) => {
                    const val = e.target.value === '' ? null : parseFloat(e.target.value)
                    await updateField('dev_estimate_hours', val as unknown as string)
                    setRequest({ ...request, dev_estimate_hours: val })
                  }}
                  className="w-16 text-right text-sm text-nha-gray-700 border border-nha-gray-200 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-nha-sky"
                  placeholder="0"
                />
              )}
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
