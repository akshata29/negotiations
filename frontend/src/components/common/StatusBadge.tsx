import { type NegotiationStatus, type NegotiationStage, type EmailStatus } from '../../types'
import { clsx } from 'clsx'

const stageLabels: Record<NegotiationStage, string> = {
  eligible: 'Eligible',
  contact_drafting: 'Drafting Contact',
  contact_approval: 'Awaiting Approval',
  contact_sent: 'Contact Sent',
  contact_replied: 'Reply Received',
  contact_confirmed: 'Contact Confirmed',
  contact_rejected: 'Wrong Contact',
  proposal_drafting: 'Drafting Proposal',
  proposal_approval: 'Awaiting Approval',
  proposal_sent: 'Proposal Sent',
  proposal_replied: 'Reply Received',
  counter_offer: 'Counter Offer',
  counter_drafting: 'Drafting Counter',
  counter_approval: 'Awaiting Approval',
  counter_sent: 'Counter Sent',
  agreed: 'Agreed ✓',
  rejected: 'Rejected',
  escalated: 'Escalated',
  completed: 'Completed',
}

const stageColors: Partial<Record<NegotiationStage, string>> = {
  eligible: 'bg-blue-900 text-blue-300',
  contact_drafting: 'bg-yellow-900 text-yellow-300',
  contact_approval: 'bg-amber-900 text-amber-300',
  contact_sent: 'bg-cyan-900 text-cyan-300',
  proposal_drafting: 'bg-yellow-900 text-yellow-300',
  proposal_approval: 'bg-amber-900 text-amber-300',
  proposal_sent: 'bg-cyan-900 text-cyan-300',
  counter_approval: 'bg-amber-900 text-amber-300',
  counter_sent: 'bg-cyan-900 text-cyan-300',
  agreed: 'bg-green-900 text-green-300',
  rejected: 'bg-red-900 text-red-300',
  escalated: 'bg-orange-900 text-orange-300',
  completed: 'bg-gray-700 text-gray-300',
  contact_confirmed: 'bg-teal-900 text-teal-300',
  contact_rejected: 'bg-red-900 text-red-300',
}

const statusColors: Record<string, string> = {
  not_started: 'bg-gray-800 text-gray-400',
  eligible: 'bg-blue-900 text-blue-300',
  ineligible: 'bg-gray-800 text-gray-500',
  in_progress: 'bg-yellow-900 text-yellow-300',
  agreed: 'bg-green-900 text-green-300',
  rejected: 'bg-red-900 text-red-300',
  completed: 'bg-emerald-900 text-emerald-300',
}

const groupColors: Record<string, string> = {
  A: 'bg-purple-900 text-purple-300',
  B: 'bg-indigo-900 text-indigo-300',
  C: 'bg-pink-900 text-pink-300',
}

const emailStatusColors: Record<EmailStatus, string> = {
  draft: 'bg-gray-800 text-gray-400',
  pending_approval: 'bg-amber-900 text-amber-300',
  approved: 'bg-teal-900 text-teal-300',
  sent: 'bg-blue-900 text-blue-300',
  received: 'bg-green-900 text-green-300',
}

interface Props {
  type: 'stage' | 'status' | 'group' | 'email'
  value: string
}

export function StatusBadge({ type, value }: Props) {
  let label = value
  let colorClass = 'bg-gray-800 text-gray-300'

  if (type === 'stage') {
    label = stageLabels[value as NegotiationStage] ?? value
    colorClass = stageColors[value as NegotiationStage] ?? 'bg-gray-800 text-gray-300'
  } else if (type === 'status') {
    label = value.replace(/_/g, ' ')
    colorClass = statusColors[value] ?? 'bg-gray-800 text-gray-300'
  } else if (type === 'group') {
    label = `Group ${value}`
    colorClass = groupColors[value] ?? 'bg-gray-800 text-gray-300'
  } else if (type === 'email') {
    label = value.replace(/_/g, ' ')
    colorClass = emailStatusColors[value as EmailStatus] ?? 'bg-gray-800 text-gray-300'
  }

  return (
    <span className={clsx('badge capitalize', colorClass)}>
      {label}
    </span>
  )
}
