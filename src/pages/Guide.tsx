import {
  Lightbulb,
  XCircle,
  CheckCircle,
  AlertTriangle,
  ClipboardCheck,
  ArrowRight,
  HelpCircle,
  MessageSquareWarning,
} from 'lucide-react'

interface ExamplePair {
  vague: string
  good: string
}

const EXAMPLES: ExamplePair[] = [
  {
    vague: 'Communication preferences are confusing',
    good: "The 'Phone' toggle under Communication Preferences only disables robodial calls, but the label implies it controls all phone communication. Rename the label to 'Robodial Calls' and add helper text: 'When off, you will not receive automated phone calls. Emails and texts are always enabled.'",
  },
  {
    vague: 'The formatting is not intuitive',
    good: 'In the message composer, users must type text first, then select it, then find the formatting buttons. Move the bold/italic/strikethrough toolbar to always be visible above the text input, matching the Posts editor pattern.',
  },
  {
    vague: 'Calendar needs to be better',
    good: "The calendar does not highlight the current date. Add a blue circle around today's date and show a dot indicator on dates that have events, so users know where to tap.",
  },
  {
    vague: 'Home screen needs work',
    good: "The 'Unhide Apps' link on the home screen is styled as plain text and users don't realize it's tappable. Change it to a button with the standard NHA blue outline style, matching the 'New Post' button pattern.",
  },
]

const CHECKLIST = [
  'What is the current behavior? (what\'s happening now)',
  'What should the new behavior be? (what you want instead)',
  'If it\'s a visual change, what should it look like?',
  'If there are multiple options, which one do you prefer and why?',
  'Is there an existing pattern in the app we should match?',
]

export default function Guide() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-nha-gray-900">
          How to Submit Great Requests
        </h1>
        <p className="mt-1 text-nha-gray-500">
          Help your requests move faster from idea to development
        </p>
      </div>

      {/* Key Principle Callout */}
      <div className="bg-nha-blue-light border border-nha-blue/20 rounded-2xl p-6 flex gap-4">
        <div className="shrink-0 mt-0.5">
          <Lightbulb size={22} className="text-nha-blue" />
        </div>
        <div>
          <h2 className="font-semibold text-nha-gray-900 mb-1">
            The Key Principle
          </h2>
          <p className="text-nha-gray-700 leading-relaxed">
            A good request tells a developer both <strong>what the problem is</strong> and{' '}
            <strong>what you want the solution to look like</strong>. If a developer has to
            guess what you want, the request isn't ready.
          </p>
        </div>
      </div>

      {/* Good vs. Vague Examples */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-nha-gray-900 flex items-center gap-2">
          <HelpCircle size={20} className="text-nha-gray-400" />
          Good vs. Vague Examples
        </h2>

        <div className="space-y-4">
          {EXAMPLES.map((ex, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-nha-gray-200 overflow-hidden"
            >
              {/* Vague row */}
              <div className="flex items-start gap-3 p-4 border-b border-nha-gray-100 bg-red-50/50">
                <XCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-red-500">
                    Vague
                  </span>
                  <p className="text-nha-gray-700 mt-0.5">"{ex.vague}"</p>
                </div>
              </div>
              {/* Arrow separator */}
              <div className="flex justify-center -my-2.5 relative z-10">
                <div className="bg-nha-gray-100 rounded-full p-1">
                  <ArrowRight size={14} className="text-nha-gray-400 rotate-90" />
                </div>
              </div>
              {/* Good row */}
              <div className="flex items-start gap-3 p-4 bg-green-50/50">
                <CheckCircle size={18} className="text-green-600 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-green-600">
                    Good
                  </span>
                  <p className="text-nha-gray-700 mt-0.5">"{ex.good}"</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* What Happens When Requests Are Incomplete */}
      <div className="bg-white rounded-2xl border border-nha-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-nha-gray-900 flex items-center gap-2">
          <MessageSquareWarning size={20} className="text-amber-500" />
          What Happens When Requests Are Incomplete
        </h2>
        <ul className="space-y-3 text-nha-gray-700">
          <li className="flex items-start gap-3">
            <span className="shrink-0 mt-1 w-5 h-5 rounded-full bg-nha-blue-light text-nha-blue flex items-center justify-center text-xs font-bold">
              1
            </span>
            <span>AI reviews every incoming request for completeness and clarity.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="shrink-0 mt-1 w-5 h-5 rounded-full bg-nha-blue-light text-nha-blue flex items-center justify-center text-xs font-bold">
              2
            </span>
            <span>
              Vague requests get flagged with specific questions you need to answer.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="shrink-0 mt-1 w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
              <AlertTriangle size={12} />
            </span>
            <span>
              You'll see an amber <strong>"Needs details"</strong> badge on your request.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="shrink-0 mt-1 w-5 h-5 rounded-full bg-nha-blue-light text-nha-blue flex items-center justify-center text-xs font-bold">
              4
            </span>
            <span>Answer the questions directly on the request page.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="shrink-0 mt-1 w-5 h-5 rounded-full bg-green-100 text-green-700 flex items-center justify-center">
              <CheckCircle size={12} />
            </span>
            <span>
              Complete requests get decided faster — vague ones wait.
            </span>
          </li>
        </ul>
      </div>

      {/* Quick Checklist */}
      <div className="bg-white rounded-2xl border border-nha-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-nha-gray-900 flex items-center gap-2">
          <ClipboardCheck size={20} className="text-nha-blue" />
          Quick Checklist
        </h2>
        <p className="text-nha-gray-500 text-sm">
          Before submitting, make sure your request answers:
        </p>
        <ul className="space-y-2.5">
          {CHECKLIST.map((item, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="shrink-0 mt-0.5 w-5 h-5 rounded border-2 border-nha-gray-300" />
              <span className="text-nha-gray-700">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
