import { Info, MessageSquare, GitBranch, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react'

interface Decision {
  title: string
  description: string
  date: string
}

const DECISIONS: Decision[] = [
  {
    title: 'Thread replies attach to the parent card',
    description:
      'When someone replies to a Slack thread, the reply is added to the existing Decision Hub card — not created as a new request. This keeps all context about one topic in one place. If the parent message was already approved and sent to ClickUp, the DH card still updates, and the ClickUp task gets a comment alerting the dev that new context was added.',
    date: '2026-04-09',
  },
  {
    title: 'New ideas don\'t belong in threads',
    description:
      'If you have a completely new idea or request, post it as a new top-level message in the channel — don\'t bury it in an existing thread. Thread replies are treated as context for the parent topic. A new ask posted inside an unrelated thread may get attached to the wrong card or missed entirely. Top-level posts always get their own card.',
    date: '2026-04-09',
  },
  {
    title: 'Cenovio\'s posts are consultations, not submissions',
    description:
      'When Cenovio posts in the channel tagging Jessica or Kerry, he\'s asking for buy-in before formally submitting. If they confirm ("yes, do it"), the request flows into the inbox normally. If no one responds or the response is ambiguous, the card gets a visible note: "Cenovio consultation — waiting for confirmation." Jessica and Kerry\'s posts always go straight to the inbox.',
    date: '2026-04-09',
  },
  {
    title: 'Duplicate detection flags related ClickUp tasks',
    description:
      'Every new inbox item is automatically checked against the active NHA App ClickUp workspace. If a match is found, the card gets an orange "Possible duplicate" badge. Admins can dismiss the flag with a usefulness rating and training notes — this feedback is logged to help the system improve over time. The requester also gets an email alerting them to the possible overlap.',
    date: '2026-04-08',
  },
  {
    title: 'Approved tasks include a Decision Hub link in ClickUp',
    description:
      'When a request is approved, the ClickUp task description includes a link back to the Decision Hub card. Developers can click through to see the full Slack thread, all attachments, clarification Q&A, and Cenovio\'s notes — even without a Decision Hub account (view-only mode).',
    date: '2026-04-09',
  },
]

export default function HowItWorks() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-nha-gray-900">How the Decision Hub Works</h1>
        <p className="text-nha-gray-600 mt-2">
          Operational conventions and decisions that shape how requests flow through the system.
        </p>
      </div>

      {/* Flow overview */}
      <div className="bg-white rounded-2xl border border-nha-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Info size={18} className="text-nha-blue-600" />
          <h2 className="text-lg font-semibold text-nha-gray-900">The Pipeline</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Step icon={<MessageSquare size={14} />} label="Slack / Email" />
          <ArrowRight size={14} className="text-nha-gray-300" />
          <Step icon={<GitBranch size={14} />} label="AI Consolidation" />
          <ArrowRight size={14} className="text-nha-gray-300" />
          <Step icon={<AlertTriangle size={14} />} label="Duplicate Check" />
          <ArrowRight size={14} className="text-nha-gray-300" />
          <Step icon={<CheckCircle size={14} />} label="Review & Decide" />
          <ArrowRight size={14} className="text-nha-gray-300" />
          <Step icon={<CheckCircle size={14} />} label="ClickUp Task" />
        </div>
        <ul className="mt-4 space-y-2 text-sm text-nha-gray-600">
          <li>• Messages from <strong>#ia-nhaapp-jck</strong> are captured every 15 minutes</li>
          <li>• AI groups related messages, names them, estimates dev hours, and flags vague requests</li>
          <li>• Thread replies are automatically attached to the parent card — even after approval</li>
          <li>• Approved items become ClickUp tasks with all context, attachments, and a link back here</li>
        </ul>
      </div>

      {/* Decisions */}
      <div>
        <h2 className="text-lg font-semibold text-nha-gray-900 mb-4">Operational Decisions</h2>
        <div className="space-y-4">
          {DECISIONS.map((d, i) => (
            <div key={i} className="bg-white rounded-2xl border border-nha-gray-200 p-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-nha-gray-800">{d.title}</h3>
                <span className="text-xs text-nha-gray-400 whitespace-nowrap">{d.date}</span>
              </div>
              <p className="text-sm text-nha-gray-600 mt-2 leading-relaxed">{d.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Step({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-nha-gray-50 text-nha-gray-700 font-medium">
      {icon}
      {label}
    </span>
  )
}
