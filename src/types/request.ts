// Shared types for the request detail page and its sub-components.

export interface SourceMessage {
  id: string
  author: string
  source: string
  date: string
  original_text: string
  has_attachment: boolean
}

export interface ClarificationQuestion {
  question: string
  for: string
  for_email: string
}

export interface ClarificationAnswer {
  question: string
  for: string
  for_email: string
  answer: string
  bypassed?: boolean
}

export interface DuplicateCandidate {
  clickup_task_id: string
  clickup_task_url: string
  title: string
  status: string
  list_name: string | null
  verdict: 'same' | 'related'
  reasoning: string
}

export interface DuplicateCheck {
  checked_at: string
  verdict: 'same' | 'related' | 'none'
  candidates: DuplicateCandidate[]
  dismissed_at: string | null
  dismissed_by: string | null
  dismissed_reason: string | null
  email_sent_at: string | null
  email_error: string | null
}

export interface RequestMetadata {
  cc?: string | null
  subject_full?: string | null
  message_id?: string | null
  is_consolidated?: boolean
  source_count?: number
  source_messages?: SourceMessage[]
  consolidation_reasoning?: string
  consolidation_note?: string
  needs_clarification?: boolean
  clarification_questions?: (string | ClarificationQuestion)[]
  clarification_answers?: ClarificationAnswer[]
  possible_duplicate?: boolean
  duplicate_check?: DuplicateCheck
}

export interface RequestAttachment {
  url: string
  name: string
  type: string
}

export interface DhubRequest {
  id: string
  source: string
  source_ref: string | null
  source_channel: string | null
  requester_name: string
  requester_email: string | null
  category: string
  title: string
  description: string | null
  attachments: RequestAttachment[] | null
  ai_analysis: Record<string, unknown> | null
  ai_analyzed_at: string | null
  status: string
  po_notes: string | null
  created_at: string
  updated_at: string
  dev_estimate_hours: number | null
  metadata: RequestMetadata | null
}
