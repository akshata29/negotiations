import { formatDistanceToNow } from 'date-fns'
import { ArrowDownLeft, Clock, CheckCheck, Send, FileEdit, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { StatusBadge } from '../common/StatusBadge'
import type { EmailMessage } from '../../types'

interface Props {
  emails: EmailMessage[]
  finalStage?: string
}

// ── Stage metadata ──────────────────────────────────────────────────────
type Phase = 'contact' | 'proposal' | 'counter' | 'outcome'

const STAGE_META: Record<string, { label: string; phase: Phase; dot: string; border: string }> = {
  contact_drafting:  { label: 'Contact Verification — Draft',           phase: 'contact',  dot: 'bg-blue-500',   border: 'border-blue-800/40' },
  contact_approval:  { label: 'Contact Verification — Pending Approval', phase: 'contact',  dot: 'bg-amber-500',  border: 'border-amber-800/40' },
  contact_sent:      { label: 'Contact Verification — Sent',             phase: 'contact',  dot: 'bg-blue-400',   border: 'border-blue-800/40' },
  contact_replied:   { label: 'Vendor Replied — Contact',                phase: 'contact',  dot: 'bg-cyan-400',   border: 'border-cyan-800/40' },
  proposal_drafting: { label: 'Initial Proposal — Draft',                phase: 'proposal', dot: 'bg-purple-500', border: 'border-purple-800/40' },
  proposal_approval: { label: 'Initial Proposal — Pending Approval',     phase: 'proposal', dot: 'bg-amber-500',  border: 'border-amber-800/40' },
  proposal_sent:     { label: 'Initial Proposal — Sent',                 phase: 'proposal', dot: 'bg-purple-400', border: 'border-purple-800/40' },
  proposal_replied:  { label: 'Vendor Replied — Proposal',               phase: 'proposal', dot: 'bg-cyan-400',   border: 'border-cyan-800/40' },
  counter_drafting:  { label: 'Counter-Proposal — Draft',                phase: 'counter',  dot: 'bg-orange-500', border: 'border-orange-800/40' },
  counter_approval:  { label: 'Counter-Proposal — Pending Approval',     phase: 'counter',  dot: 'bg-amber-500',  border: 'border-amber-800/40' },
  counter_sent:      { label: 'Counter-Proposal — Sent',                 phase: 'counter',  dot: 'bg-orange-400', border: 'border-orange-800/40' },
  counter_replied:   { label: 'Vendor Replied — Counter',                phase: 'counter',  dot: 'bg-cyan-400',   border: 'border-cyan-800/40' },
  agreed:            { label: 'Agreed',    phase: 'outcome', dot: 'bg-green-500',  border: 'border-green-800/40' },
  rejected:          { label: 'Rejected',  phase: 'outcome', dot: 'bg-red-500',    border: 'border-red-800/40' },
  escalated:         { label: 'Escalated', phase: 'outcome', dot: 'bg-amber-500',  border: 'border-amber-800/40' },
  completed:         { label: 'Completed', phase: 'outcome', dot: 'bg-green-500',  border: 'border-green-800/40' },
}

const PHASE_LABEL: Record<Phase, string> = {
  contact: 'Phase 1 · Contact Verification',
  proposal: 'Phase 2 · Negotiation Proposal',
  counter: 'Phase 3 · Counter-Proposal',
  outcome: 'Outcome',
}

const OUTCOME_COLORS: Record<string, string> = {
  agreed:    'bg-green-900/30 border-green-700 text-green-300',
  completed: 'bg-green-900/30 border-green-700 text-green-300',
  rejected:  'bg-red-900/20 border-red-800 text-red-300',
  escalated: 'bg-amber-900/20 border-amber-800 text-amber-300',
}

const OUTCOME_ICONS: Record<string, React.ReactNode> = {
  agreed:    <CheckCircle2 className="w-4 h-4 text-green-400" />,
  completed: <CheckCircle2 className="w-4 h-4 text-green-400" />,
  rejected:  <XCircle className="w-4 h-4 text-red-400" />,
  escalated: <AlertTriangle className="w-4 h-4 text-amber-400" />,
}

const TERMINAL = new Set(['agreed', 'rejected', 'escalated', 'completed'])

// ── Component ───────────────────────────────────────────────────────────

export function EmailThread({ emails, finalStage }: Props) {
  if (emails.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <FileEdit className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No emails yet in this negotiation.</p>
      </div>
    )
  }

  // Group emails by stage, preserving first-appearance order
  const stageOrder: string[] = []
  const grouped: Record<string, EmailMessage[]> = {}
  for (const email of emails) {
    const s = email.stage ?? 'unknown'
    if (!grouped[s]) { grouped[s] = []; stageOrder.push(s) }
    grouped[s].push(email)
  }

  // Track which phases we've already shown a phase banner for
  const shownPhases = new Set<Phase>()

  return (
    <div className="relative space-y-0">
      {/* Vertical line */}
      <div className="absolute left-[11px] top-3 bottom-3 w-px bg-gray-700/60" />

      {stageOrder.map((stage, groupIdx) => {
        const meta = STAGE_META[stage]
        const stageDot   = meta?.dot   ?? 'bg-gray-500'
        const stageBorder = meta?.border ?? 'border-gray-700'
        const stageLabel = meta?.label  ?? stage.replace(/_/g, ' ')
        const phase      = meta?.phase  ?? 'contact'
        const showPhaseBanner = meta && !shownPhases.has(phase)
        if (showPhaseBanner) shownPhases.add(phase)
        const isLast = groupIdx === stageOrder.length - 1

        return (
          <div key={stage} className="relative pl-7">
            {/* Phase banner (shown once per phase) */}
            {showPhaseBanner && (
              <p className={`text-[10px] font-semibold tracking-widest uppercase text-gray-500 mb-2 ${groupIdx > 0 ? 'mt-5' : ''}`}>
                {PHASE_LABEL[phase]}
              </p>
            )}

            {/* Stage node */}
            <div className="flex items-center gap-2 mb-2.5">
              <div className={`absolute left-0 w-[23px] h-[23px] rounded-full border-2 border-gray-900 ${stageDot} flex items-center justify-center`} />
              <span className={`text-xs font-semibold ${meta?.dot.replace('bg-', 'text-').replace('-500', '-400').replace('-400', '-400') ?? 'text-gray-400'}`}>
                {stageLabel}
              </span>
            </div>

            {/* Emails in this stage */}
            <div className={`space-y-3 ${!isLast ? 'mb-5' : ''}`}>
              {grouped[stage].map((email) => (
                <EmailCard key={email.id} email={email} stageBorder={stageBorder} />
              ))}
            </div>
          </div>
        )
      })}

      {/* Outcome node — shown if negotiation is terminal and not already an email stage */}
      {finalStage && TERMINAL.has(finalStage) && !grouped[finalStage] && (
        <div className="relative pl-7 mt-5">
          <p className="text-[10px] font-semibold tracking-widest uppercase text-gray-500 mb-2">Outcome</p>
          <div className={`absolute left-0 w-[23px] h-[23px] rounded-full border-2 border-gray-900 ${STAGE_META[finalStage]?.dot ?? 'bg-gray-500'}`} />
          <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 ${OUTCOME_COLORS[finalStage] ?? 'bg-gray-800 border-gray-700 text-gray-300'}`}>
            {OUTCOME_ICONS[finalStage]}
            <span className="text-sm font-semibold capitalize">{finalStage}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Email card (extracted for clarity) ─────────────────────────────────

function EmailCard({ email, stageBorder }: { email: EmailMessage; stageBorder: string }) {
  const isOutbound = email.direction === 'outbound'
  const Icon = isOutbound ? Send : ArrowDownLeft
  return (
    <div className={`rounded-xl border p-4 ${
      isOutbound
        ? `bg-blue-900/10 border-blue-800/30 ml-2`
        : `bg-gray-800/50 ${stageBorder} mr-2`
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${isOutbound ? 'bg-blue-900/40' : 'bg-gray-700'}`}>
            <Icon className={`w-3.5 h-3.5 ${isOutbound ? 'text-blue-400' : 'text-gray-300'}`} />
          </div>
          <div>
            <p className="text-xs font-semibold text-white">From: {email.sender_name}</p>
            <p className="text-xs text-gray-500">To: {email.recipient_name} &lt;{email.recipient_email}&gt;</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {email.ai_suggested && <span className="badge bg-purple-900/40 text-purple-300 text-xs">AI Draft</span>}
          {email.human_edited && <span className="badge bg-amber-900/40 text-amber-300 text-xs">Edited</span>}
          <StatusBadge type="email" value={email.status} />
        </div>
      </div>
      {/* Subject */}
      <p className="text-xs font-semibold text-gray-300 mb-2">Subject: {email.subject}</p>
      {/* Body */}
      <div className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed bg-gray-900/40 rounded-lg p-3 border border-gray-800/50">
        {email.body}
      </div>
      {/* Footer */}
      <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
        <Clock className="w-3 h-3" />
        <span>{formatDistanceToNow(new Date(email.created_at), { addSuffix: true })}</span>
        {email.approved_by && (
          <>
            <CheckCheck className="w-3 h-3 text-green-500" />
            <span className="text-green-500">Approved by {email.approved_by}</span>
          </>
        )}
      </div>
    </div>
  )
}
