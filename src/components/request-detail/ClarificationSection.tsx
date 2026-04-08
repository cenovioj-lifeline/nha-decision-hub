import { useState } from 'react'
import { AlertTriangle, Check } from 'lucide-react'
import { dhub } from '../../lib/supabase'
import type { DhubRequest, ClarificationQuestion, ClarificationAnswer } from '../../types/request'

interface ClarificationSectionProps {
  request: DhubRequest
  onChange: () => void
}

/**
 * Per-person AI clarification Q&A.
 *
 * Shows answered sections (green, read-only) on top, unanswered sections
 * (amber, editable) below. Each person has their own Save Answers / Skip
 * buttons. The needs_clarification flag clears only when ALL persons have
 * either saved answers or been bypassed.
 */
export default function ClarificationSection({ request, onChange }: ClarificationSectionProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [saveResult, setSaveResult] = useState('')

  function getQuestions(): ClarificationQuestion[] {
    const raw = request?.metadata?.clarification_questions
    if (!Array.isArray(raw)) return []
    return raw.map((q: unknown) => {
      if (typeof q === 'string') {
        return { question: q, for: request?.requester_name ?? 'Unknown', for_email: request?.requester_email ?? '' }
      }
      return q as ClarificationQuestion
    })
  }

  function getAnswers(): ClarificationAnswer[] {
    return (request?.metadata?.clarification_answers ?? []) as ClarificationAnswer[]
  }

  function getUnansweredPersons(): string[] {
    const questions = getQuestions()
    const answers = getAnswers()
    const answeredKeys = new Set(answers.map((a) => `${a.for}::${a.question}`))
    const persons = new Set<string>()
    for (const q of questions) {
      if (!answeredKeys.has(`${q.for}::${q.question}`)) persons.add(q.for)
    }
    return [...persons].sort()
  }

  async function handleSaveForPerson(personName: string) {
    if (!request?.id) return
    setSaving(personName)
    setSaveResult('')

    const allQuestions = getQuestions()
    const existingAnswers = getAnswers()
    const personQuestions = allQuestions.filter((q) => q.for === personName)

    const newAnswers: ClarificationAnswer[] = personQuestions.map((q, i) => ({
      ...q,
      answer: (drafts[`${personName}::${i}`] ?? '').trim(),
    }))

    const unanswered = newAnswers.filter((a) => !a.answer)
    if (unanswered.length > 0) {
      setSaveResult(`Please answer all questions before saving.`)
      setSaving(null)
      return
    }

    const otherAnswers = existingAnswers.filter((a) => a.for !== personName)
    const allAnswers = [...otherAnswers, ...newAnswers]

    const allPersons = [...new Set(allQuestions.map((q) => q.for))]
    const answeredPersons = new Set(allAnswers.map((a) => a.for))
    const allDone = allPersons.every((p) => answeredPersons.has(p))

    const updatedMetadata = {
      ...request.metadata,
      needs_clarification: !allDone,
      clarification_answers: allAnswers,
    }

    const { error: saveErr } = await dhub.from('requests').update({
      metadata: updatedMetadata,
      updated_at: new Date().toISOString(),
    }).eq('id', request.id)

    if (saveErr) {
      setSaveResult(`Error: ${saveErr.message}`)
    } else {
      setSaveResult(allDone ? 'All answers saved — request is complete.' : `${personName.split(' ')[0]}'s answers saved.`)
      setTimeout(() => setSaveResult(''), 5000)
      onChange()
    }
    setSaving(null)
  }

  async function handleBypassForPerson(personName: string) {
    if (!request?.id) return
    setSaving(personName)

    const allQuestions = getQuestions()
    const existingAnswers = getAnswers()
    const personQuestions = allQuestions.filter((q) => q.for === personName)

    const bypassedAnswers: ClarificationAnswer[] = personQuestions.map((q) => ({
      ...q,
      answer: '',
      bypassed: true,
    }))

    const otherAnswers = existingAnswers.filter((a) => a.for !== personName)
    const allAnswers = [...otherAnswers, ...bypassedAnswers]

    const allPersons = [...new Set(allQuestions.map((q) => q.for))]
    const answeredPersons = new Set(allAnswers.map((a) => a.for))
    const allDone = allPersons.every((p) => answeredPersons.has(p))

    const updatedMetadata = {
      ...request.metadata,
      needs_clarification: !allDone,
      clarification_answers: allAnswers,
    }

    const { error: saveErr } = await dhub.from('requests').update({
      metadata: updatedMetadata,
      updated_at: new Date().toISOString(),
    }).eq('id', request.id)

    if (saveErr) {
      setSaveResult(`Error: ${saveErr.message}`)
    } else {
      setSaveResult(`Skipped for ${personName.split(' ')[0]}.`)
      setTimeout(() => setSaveResult(''), 5000)
      onChange()
    }
    setSaving(null)
  }

  const allQuestions = getQuestions()
  if (allQuestions.length === 0) return null

  const allAnswers = getAnswers()
  const unansweredPersons = getUnansweredPersons()
  const answeredPersons = [...new Set(allAnswers.map((a) => a.for))]
  const needsWork = request.metadata?.needs_clarification === true

  return (
    <div className={`rounded-xl border p-4 mb-4 ${needsWork ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
      <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-3">
        {needsWork ? (
          <>
            <AlertTriangle size={12} className="text-amber-600" />
            <span className="text-amber-700">More Details Needed</span>
          </>
        ) : (
          <>
            <Check size={14} className="text-green-600" />
            <span className="text-green-700">Details Provided</span>
          </>
        )}
      </h3>

      {/* Answered sections (green, read-only) */}
      {answeredPersons.map((person) => {
        const personAnswers = allAnswers.filter((a) => a.for === person)
        return (
          <div key={person} className="mb-4">
            <p className="text-xs font-semibold text-nha-gray-500 mb-2">{person}</p>
            <div className="space-y-2">
              {personAnswers.map((qa, i) => (
                <div key={i} className="bg-white rounded-lg border border-green-100 p-3">
                  <p className="text-xs font-medium text-nha-gray-500 mb-1">Q: {qa.question}</p>
                  {qa.bypassed ? (
                    <p className="text-sm text-nha-gray-400 italic">Skipped</p>
                  ) : (
                    <p className="text-sm text-nha-gray-700">{qa.answer}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Unanswered sections (amber, editable) */}
      {unansweredPersons.map((person) => {
        const personQuestions = allQuestions.filter((q) => q.for === person)
        return (
          <div key={person} className="mb-4">
            <p className="text-xs font-semibold text-amber-700 mb-2">{person}</p>
            <div className="space-y-3">
              {personQuestions.map((q, i) => (
                <div key={i}>
                  <label className="block text-sm font-medium text-nha-gray-700 mb-1">
                    {i + 1}. {q.question}
                  </label>
                  <textarea
                    value={drafts[`${person}::${i}`] ?? ''}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [`${person}::${i}`]: e.target.value }))}
                    rows={2}
                    placeholder="Type your answer..."
                    className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-nha-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 resize-none"
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => handleSaveForPerson(person)}
                disabled={saving !== null}
                className="px-4 py-2 bg-nha-blue text-white rounded-lg text-sm font-medium hover:bg-nha-blue/90 transition-colors disabled:opacity-40"
              >
                {saving === person ? 'Saving...' : 'Save Answers'}
              </button>
              <button
                onClick={() => handleBypassForPerson(person)}
                disabled={saving !== null}
                className="px-4 py-2 border border-nha-gray-300 text-nha-gray-600 rounded-lg text-sm font-medium hover:bg-nha-gray-50 transition-colors disabled:opacity-40"
              >
                Skip
              </button>
            </div>
          </div>
        )
      })}

      {saveResult && (
        <p className={`text-xs mt-2 ${saveResult.startsWith('Error') ? 'text-red-600' : saveResult.startsWith('Please') ? 'text-amber-600' : 'text-green-600'}`}>
          {saveResult}
        </p>
      )}
    </div>
  )
}
