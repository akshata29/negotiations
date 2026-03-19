// Central type definitions

export type NegotiationStatus = 
  | 'not_started' | 'eligible' | 'ineligible' | 'in_progress' | 'agreed' | 'rejected' | 'completed'

export type NegotiationStage =
  | 'eligible' | 'contact_drafting' | 'contact_approval' | 'contact_sent'
  | 'contact_replied' | 'contact_confirmed' | 'contact_rejected'
  | 'proposal_drafting' | 'proposal_approval' | 'proposal_sent' | 'proposal_replied'
  | 'counter_offer' | 'counter_drafting' | 'counter_approval' | 'counter_sent'
  | 'agreed' | 'rejected' | 'escalated' | 'completed'

export type ABGroup = 'A' | 'B' | 'C'
export type EmailDirection = 'outbound' | 'inbound'
export type EmailStatus = 'draft' | 'pending_approval' | 'approved' | 'sent' | 'received'

export interface Vendor {
  id: string
  vendor_id: number
  dcs_vendor: number
  comp: string
  class_of_trade: string | null
  catg: string
  buyer: string | null
  status: string
  vendor_long_name: string
  vendor_short_name: string | null
  active_items: number
  all_items: number
  ytd_purchase_amount: number
  ytd_rcvd_amount: number
  std_terms: number
  term_days: number
  net_days: number
  email: string | null
  eligible_for_negotiation: boolean
  exclusion_reason: string | null
  negotiation_status: NegotiationStatus
  ab_group: ABGroup | null
  active_negotiation_id: string | null
  created_at: string
  updated_at: string
}

export interface ProposedTerms {
  std_terms?: number | null
  term_days?: number | null
  net_days?: number | null
}

export interface Negotiation {
  id: string
  vendor_id: number
  vendor_long_name: string
  vendor_short_name: string | null
  vendor_email: string | null
  original_std_terms: number
  original_term_days: number
  original_net_days: number
  proposed_terms: ProposedTerms | null
  agreed_terms: ProposedTerms | null
  stage: NegotiationStage
  ab_group: ABGroup | null
  strategy: string | null
  agent_thread_id: string | null
  pending_approval_email_id: string | null
  human_notes: string | null
  rounds: number
  outcome: string | null
  improvement_score: number
  created_at: string
  updated_at: string
  emails?: EmailMessage[]
}

export interface EmailMessage {
  id: string
  negotiation_id: string
  vendor_id: number
  sender_name: string
  sender_email: string
  recipient_name: string
  recipient_email: string
  subject: string
  body: string
  direction: EmailDirection
  status: EmailStatus
  stage: NegotiationStage
  approved_by: string | null
  approved_at: string | null
  ai_suggested: boolean
  human_edited: boolean
  created_at: string
  sent_at: string | null
}

export interface ABTestStat {
  group: string
  strategy: string
  total_trials: number
  successes: number
  success_rate: number
  avg_reward: number
  q_value: number
  ucb1_score: number
}

export interface DashboardStats {
  vendor_counts: {
    total: number
    eligible: number
    in_progress: number
    completed: number
  }
  rl_stats: ABTestStat[]
  best_ab_group: ABGroup | null
  pending_approvals: number
  recent_negotiations: Negotiation[]
}

export interface WSEvent {
  event: string
  data: Record<string, unknown>
}
