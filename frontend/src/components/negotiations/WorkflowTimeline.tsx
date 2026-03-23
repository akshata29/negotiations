import { NegotiationStage } from '../../types'

const STAGES: { key: NegotiationStage; label: string }[] = [
  { key: 'eligible', label: 'Eligible' },
  { key: 'contact_approval', label: 'Contact Draft' },
  { key: 'contact_sent', label: 'Contact Sent' },
  { key: 'contact_confirmed', label: 'Confirmed' },
  { key: 'proposal_approval', label: 'Proposal Draft' },
  { key: 'proposal_sent', label: 'Proposal Sent' },
  { key: 'counter_approval', label: 'Counter' },
  { key: 'agreed', label: 'Agreed' },
]

const TERMINAL: Record<string, string> = {
  agreed: 'bg-green-500',
  rejected: 'bg-red-500',
  escalated: 'bg-orange-500',
  completed: 'bg-emerald-500',
}

function stageIndex(current: string): number {
  if (current in TERMINAL) return STAGES.length
  return STAGES.findIndex(s => s.key === current || current.startsWith(s.key.split('_')[0]))
}

interface Props {
  currentStage: string
}

export function WorkflowTimeline({ currentStage }: Props) {
  const idx = stageIndex(currentStage)
  const terminal = TERMINAL[currentStage]

  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1">
      {STAGES.map((stage, i) => {
        const done = i < idx
        const active = i === idx
        return (
          <div key={stage.key} className="flex items-center">
            <div className="flex flex-col items-center gap-1 min-w-0">
              <div
                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  done
                    ? 'bg-blue-600 border-blue-600'
                    : active
                    ? terminal
                      ? `${terminal} border-transparent`
                      : 'bg-yellow-500 border-yellow-500'
                    : 'bg-gray-800 border-gray-700'
                }`}
              >
                {done && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {active && !terminal && (
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                )}
              </div>
              <span className={`text-xs whitespace-nowrap ${active ? 'text-white font-medium' : 'text-gray-500'}`}>
                {stage.label}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div className={`h-0.5 w-8 flex-shrink-0 mb-4 ${i < idx ? 'bg-blue-600' : 'bg-gray-800'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
