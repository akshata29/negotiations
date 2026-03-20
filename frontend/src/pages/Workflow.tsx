import { useState } from 'react'
import { X, FileCode2, Layers2, BrainCircuit, Info } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type NodeType =
  | 'start' | 'end'
  | 'service' | 'agent' | 'gate' | 'variant'
  | 'outcome_success' | 'outcome_fail' | 'outcome_neutral' | 'outcome_warn'

interface NodeDetail {
  badge: string
  description: string
  files?: string[]
  responsibilities: string[]
  tech?: string[]
}

interface ArchNode {
  id: string
  label: string
  sublabel?: string
  type: NodeType
  cx: number
  cy: number
  w: number
  h: number
  detail?: NodeDetail | null
}

// ── Styles ────────────────────────────────────────────────────────────────────

const NODE_STYLES: Record<NodeType, { bg: string; border: string; pill?: boolean }> = {
  start:           { bg: 'bg-cyan-600',    border: 'border-cyan-400',    pill: true },
  end:             { bg: 'bg-emerald-600', border: 'border-emerald-400', pill: true },
  service:         { bg: 'bg-indigo-700',  border: 'border-indigo-500' },
  agent:           { bg: 'bg-purple-700',  border: 'border-purple-400' },
  gate:            { bg: 'bg-amber-700',   border: 'border-amber-400' },
  variant:         { bg: 'bg-blue-800',    border: 'border-blue-500' },
  outcome_success: { bg: 'bg-green-800',   border: 'border-green-500' },
  outcome_fail:    { bg: 'bg-red-800',     border: 'border-red-500' },
  outcome_neutral: { bg: 'bg-slate-700',   border: 'border-slate-500' },
  outcome_warn:    { bg: 'bg-amber-800',   border: 'border-amber-500' },
}

const BADGE_STYLES: Record<string, string> = {
  'Service':           'bg-indigo-900/60 text-indigo-300 border border-indigo-700',
  'Model':             'bg-blue-900/60 text-blue-300 border border-blue-700',
  'RL Algorithm':      'bg-violet-900/60 text-violet-300 border border-violet-700',
  'A/B Variant':       'bg-blue-900/60 text-blue-300 border border-blue-700',
  'Foundry Agent':     'bg-purple-900/60 text-purple-300 border border-purple-700',
  'Human-in-the-Loop': 'bg-amber-900/60 text-amber-300 border border-amber-700',
  'Orchestrator Step': 'bg-indigo-900/60 text-indigo-300 border border-indigo-700',
  'Outcome':           'bg-gray-800 text-gray-300 border border-gray-600',
  'RL Update':         'bg-violet-900/60 text-violet-300 border border-violet-700',
}

const LEGEND = [
  { type: 'service',   label: 'Service / Model',  style: NODE_STYLES.service },
  { type: 'agent',     label: 'Foundry AI Agent', style: NODE_STYLES.agent },
  { type: 'gate',      label: 'Human Gate',       style: NODE_STYLES.gate },
  { type: 'variant',   label: 'A/B Variant',      style: NODE_STYLES.variant },
  { type: 'outcome_success', label: 'Outcome',    style: NODE_STYLES.outcome_success },
]

// ── Node Data ─────────────────────────────────────────────────────────────────

const NODES: ArchNode[] = [
  {
    id: 'start', label: '🚀 Start Workflow', type: 'start',
    cx: 500, cy: 44, w: 190, h: 36,
  },
  {
    id: 'vendor', label: 'Vendor Onboarding', sublabel: 'service  ·  ingestion / synthetic',
    type: 'service', cx: 500, cy: 138, w: 245, h: 64,
    detail: {
      badge: 'Service',
      description: 'Imports vendor records from Excel (.xlsx) files or generates synthetic data with realistic distributions. Each vendor is parsed, validated, and upserted into the Cosmos DB vendors container.',
      files: [
        'backend/app/services/ingestion.py',
        'backend/app/services/synthetic.py',
        'backend/app/api/vendors.py',
      ],
      responsibilities: [
        'Parse Excel columns: comp, catg, vendor_id, status, ytd_purchase_amount, std_terms, term_days, net_days, email',
        'Generate synthetic vendors with realistic names, YTD amounts (Pareto-distributed), and payment terms',
        'Upsert each vendor into Cosmos DB vendors container (partition key: /vendor_id)',
        'Trigger eligibility assessment immediately post-ingestion',
        'Bulk operations supported: up to 2,000 synthetic vendors per API call',
      ],
      tech: ['openpyxl', 'Azure Cosmos DB', 'FastAPI', 'Pydantic'],
    },
  },
  {
    id: 'eligibility', label: 'Eligibility Assessment', sublabel: 'model  ·  vendor.py',
    type: 'service', cx: 500, cy: 248, w: 245, h: 64,
    detail: {
      badge: 'Model',
      description: 'Evaluates four deterministic hard rules against each vendor record to determine negotiation eligibility. Sets eligible_for_negotiation and writes an exclusion_reason for ineligible vendors.',
      files: ['backend/app/models/vendor.py → assess_eligibility()'],
      responsibilities: [
        'Rule 1: comp = "MPN" (McLane Private Network vendors only)',
        'Rule 2: catg ∉ {FRS, TOB, SEA} (excluded commodity categories)',
        'Rule 3: status = "ACT" (active vendors only)',
        'Rule 4: ytd_purchase_amount > $0 (must have purchase history)',
        'Sets negotiation_status = "eligible" or writes exclusion_reason string',
        'Background change-feed poller re-assesses newly-ingested vendors every 60s',
        'Custom filter presets (rule templates) can extend or override default eligibility',
      ],
      tech: ['Pydantic BaseModel', 'Python validators', 'Rule-based system'],
    },
  },
  {
    id: 'ucb1', label: 'UCB1 Group Selection', sublabel: 'service  ·  rl.py',
    type: 'service', cx: 500, cy: 358, w: 245, h: 64,
    detail: {
      badge: 'RL Algorithm',
      description: 'Implements the UCB1 (Upper Confidence Bound 1) multi-armed bandit algorithm to select the best negotiation strategy (A, B, or C). Balances exploration of less-tried arms vs. exploitation of proven winners.',
      files: ['backend/app/services/rl.py → select_group(), record_outcome()'],
      responsibilities: [
        'Formula: UCB1 = Q(a) + c × √(ln N / N(a)), where c = 2.0 (exploration constant)',
        'Returns ∞ for unvisited arms — always explores before exploiting',
        'Persists Q-values, trial counts, and cumulative rewards to Cosmos DB rl_state',
        'Reloads from Cosmos DB on restart for cross-deployment continuity',
        'Stats exposed via /api/ab-testing and the A/B Testing & RL dashboard page',
      ],
      tech: ['UCB1 Algorithm', 'Azure Cosmos DB', 'Python math', 'async/await'],
    },
  },
  // ── A/B Strategy Groups ───────────────────────────────────────────────────
  {
    id: 'group_a', label: 'Group A — Discount', sublabel: 'STD Terms ≥ 2%',
    type: 'variant', cx: 162, cy: 453, w: 188, h: 64,
    detail: {
      badge: 'A/B Variant',
      description: 'Strategy A focuses entirely on improving the cash discount percentage. Proposes raising vendor STD Terms to at least 2.0%, giving the company a meaningful early-payment discount on a large spend base.',
      files: ['backend/app/models/negotiation.py — ABGroup.A', 'backend/app/services/rl.py → compute_reward()'],
      responsibilities: [
        'Proposed terms: std_terms ≥ 2.0%',
        'Full reward (1.0) if new std_terms ≥ 2.0% AND > original',
        'Partial reward (0.5) if any improvement but still below 2%',
        '1.5× bonus multiplier for first-round acceptance (efficiency reward)',
      ],
      tech: ['RewardComputation', 'UCB1 arm: "A"'],
    },
  },
  {
    id: 'group_b', label: 'Group B — Terms', sublabel: '+10 Days Extension',
    type: 'variant', cx: 500, cy: 453, w: 188, h: 64,
    detail: {
      badge: 'A/B Variant',
      description: 'Strategy B requests extended payment terms (+10 days on both term_days and net_days), giving the company better working capital flexibility without requesting a cash discount change.',
      files: ['backend/app/models/negotiation.py — ABGroup.B', 'backend/app/services/rl.py → compute_reward()'],
      responsibilities: [
        'Proposed terms: term_days + 10, net_days + 10',
        'Full reward (max 1.0) if improvement ≥ +10 days on each term',
        'Partial reward for any positive improvement less than +10',
        '1.5× bonus multiplier for first-round acceptance',
      ],
      tech: ['RewardComputation', 'UCB1 arm: "B"'],
    },
  },
  {
    id: 'group_c', label: 'Group C — Both', sublabel: 'Discount + Terms',
    type: 'variant', cx: 838, cy: 453, w: 188, h: 64,
    detail: {
      badge: 'A/B Variant',
      description: 'Strategy C combines A and B: cash discount improvement AND payment term extension. Highest potential reward (up to 1.5) but also highest rejection risk — vendors must concede on two dimensions simultaneously.',
      files: ['backend/app/models/negotiation.py — ABGroup.C', 'backend/app/services/rl.py → compute_reward()'],
      responsibilities: [
        'Proposed terms: std_terms ≥ 2% AND term_days/net_days + 10',
        'Max reward: up to 1.5 (A + B components, with first-round bonus)',
        'UCB1 selects this arm more frequently as its Q-value rises with wins',
        'Orchestrator passes all proposed_terms fields to the email composer',
      ],
      tech: ['RewardComputation', 'UCB1 arm: "C"'],
    },
  },
  // ── Main Pipeline ──────────────────────────────────────────────────────────
  {
    id: 'email_comp', label: 'Email Composer Agent', sublabel: 'agent  ·  Azure AI Foundry',
    type: 'agent', cx: 500, cy: 568, w: 255, h: 72,
    detail: {
      badge: 'Foundry Agent',
      description: 'A GPT-4o powered agent deployed on Azure AI Foundry. Drafts professional, contextually-aware negotiation emails from the perspective of James Caldwell (VP of Vendor Relations), using the selected strategy\'s proposed terms and full conversation history.',
      files: [
        'backend/app/agents/email_composer.py',
        'backend/app/agents/orchestrator.py',
      ],
      responsibilities: [
        'Model: GPT-4o (chat4o) deployed via Azure AI Foundry Agent Service',
        'Input: vendor profile, strategy group, stage, prior exchange history',
        'Output: strict JSON → {subject, body, proposed_terms, tone}',
        'PERSONA: James Caldwell, VP of Vendor Relations & Merchandising, ABC',
        'Stateful — reuses Foundry thread_id per negotiation for multi-round context',
        'Bootstrapped with create_version() on backend startup for version control',
        'Mandatory JSON-only output enforced via OUTPUT RULES in system prompt',
      ],
      tech: ['Azure AI Foundry', 'GPT-4o (chat4o)', 'azure-ai-projects SDK v2', 'Responses API'],
    },
  },
  {
    id: 'approval', label: 'Human Approval Gate', sublabel: 'api  ·  negotiations.py',
    type: 'gate', cx: 500, cy: 678, w: 255, h: 64,
    detail: {
      badge: 'Human-in-the-Loop',
      description: 'A mandatory synchronization point where every AI-drafted email is held in "pending_approval" status until a human reviewer approves, edits, or rejects it. No email ever reaches a vendor without explicit human sign-off.',
      files: [
        'backend/app/api/negotiations.py → POST /approve',
        'frontend/src/components/negotiations/ApprovalModal.tsx',
      ],
      responsibilities: [
        'AI email set to status="pending_approval" immediately after drafting',
        'Pending Approval count shown on Dashboard with real-time WebSocket updates',
        'Reviewer can edit the email body inline before approving',
        'Records approved_by (reviewer name) and approved_at (ISO timestamp) for audit',
        'Rejection re-queues the draft for AI re-generation',
        'WebSocket broadcasts approval_needed event to all connected UI clients',
      ],
      tech: ['FastAPI REST', 'WebSocket broadcast', 'React ApprovalModal', 'Cosmos DB audit trail'],
    },
  },
  {
    id: 'email_sent', label: 'Email Sent to Vendor', sublabel: 'orchestrator  ·  ws.py',
    type: 'service', cx: 500, cy: 778, w: 255, h: 64,
    detail: {
      badge: 'Orchestrator Step',
      description: 'After human approval, the email status advances to "sent" and the negotiation state machine transitions to its next stage. A simulation service can inject scripted vendor replies for demo and testing.',
      files: [
        'backend/app/agents/orchestrator.py',
        'backend/app/services/simulation.py',
        'backend/app/api/ws.py',
      ],
      responsibilities: [
        'Marks EmailThread status = "sent", records sent_at timestamp',
        'Stage machine advances (e.g., proposal_approval → proposal_sent)',
        'WebSocket broadcasts email_sent event to all connected dashboard sessions',
        'Simulation scenarios available: quick_win, friendly_counter, hard_rejection, escalation, stall',
        'Real vendor replies injectable via POST /api/negotiations/{id}/inject-reply',
        'Background change-feed poller detects and processes reply events automatically',
      ],
      tech: ['WebSocket manager (ws.py)', 'Azure Cosmos DB', 'simulation.py scripted scenarios'],
    },
  },
  {
    id: 'resp_analyzer', label: 'Response Analyzer Agent', sublabel: 'agent  ·  Azure AI Foundry',
    type: 'agent', cx: 500, cy: 883, w: 255, h: 72,
    detail: {
      badge: 'Foundry Agent',
      description: 'A GPT-4o powered agent that classifies the vendor\'s reply and extracts any counter-proposed terms. Determines the response intent so the orchestrator can route the negotiation to the correct next workflow stage.',
      files: [
        'backend/app/agents/response_analyzer.py',
        'backend/app/agents/orchestrator.py',
      ],
      responsibilities: [
        'Input: vendor reply text + original proposed terms + negotiation stage context',
        'Output: strict JSON → {intent, counter_terms, confidence, reasoning}',
        'Intent classification: accepted | rejected | counter_offer | needs_clarification',
        'Extracts counter std_terms, term_days, net_days if vendor counter-proposes',
        'Confidence score (0–1) used to decide whether to escalate ambiguous replies',
        'Shares the same Foundry thread_id as email composer for full conversation context',
      ],
      tech: ['Azure AI Foundry', 'GPT-4o (chat4o)', 'azure-ai-projects SDK v2', 'Structured JSON output'],
    },
  },
  // ── Outcome nodes ──────────────────────────────────────────────────────────
  {
    id: 'agreed', label: 'Agreed', sublabel: 'stage: agreed',
    type: 'outcome_success', cx: 150, cy: 985, w: 138, h: 60,
    detail: {
      badge: 'Outcome',
      description: 'The vendor accepted the proposed terms. Agreed terms are persisted, the negotiation is marked complete, and a full reward (plus first-round bonus) is awarded to the UCB1 bandit arm.',
      files: ['backend/app/agents/orchestrator.py'],
      responsibilities: [
        'agreed_terms saved to negotiation document',
        'outcome = "accepted" or "counter_accepted"',
        'Reward range: 0.5–1.5 depending on improvement degree and round number',
        'negotiation_status updated to "completed" on vendor record',
      ],
      tech: [],
    },
  },
  {
    id: 'counter', label: 'Counter Offer', sublabel: 'stage: counter_offer',
    type: 'outcome_neutral', cx: 383, cy: 985, w: 145, h: 60,
    detail: {
      badge: 'Outcome',
      description: 'The vendor responded with alternative terms. Counter-terms are extracted and stored, the rounds counter is incremented, and the orchestrator loops back through email composition for a counter-proposal response.',
      files: ['backend/app/agents/orchestrator.py'],
      responsibilities: [
        'Counter-terms extracted and persisted from response analyzer output',
        'rounds counter incremented (max 3 before auto-escalation)',
        'Stage: counter_offer → counter_drafting → counter_approval → counter_sent',
        'Agent thread retains full negotiation history for accurate counter-proposal context',
        'After max rounds, automatically routed to Escalated outcome',
      ],
      tech: [],
    },
  },
  {
    id: 'rejected', label: 'Rejected', sublabel: 'stage: rejected',
    type: 'outcome_fail', cx: 617, cy: 985, w: 138, h: 60,
    detail: {
      badge: 'Outcome',
      description: 'The vendor declined all proposed terms. Reward = 0.0, which decrements the Q-value for this UCB1 strategy arm, reducing its probability of future selection.',
      files: ['backend/app/agents/orchestrator.py'],
      responsibilities: [
        'outcome = "rejected"',
        'Reward = 0.0 → Q-value decremented via incremental mean update',
        'negotiation_status updated to "rejected" on vendor record',
        'Full email thread preserved for audit and manual analysis',
      ],
      tech: [],
    },
  },
  {
    id: 'escalated', label: 'Escalated', sublabel: 'stage: escalated',
    type: 'outcome_warn', cx: 850, cy: 985, w: 145, h: 60,
    detail: {
      badge: 'Outcome',
      description: 'The negotiation is flagged for human review — due to complex counter-terms, low analyzer confidence, max rounds exceeded, or a manual override. Partial reward is still computed.',
      files: [
        'backend/app/agents/orchestrator.py',
        'backend/app/api/negotiations.py → POST /escalate',
      ],
      responsibilities: [
        'Triggered by: max rounds exceeded, confidence < threshold, or manual POST /escalate',
        'outcome = "escalated"',
        'Partial reward computed based on any improvement achieved so far',
        'Manual escalation endpoint available for human override at any stage',
        'Dashboard labels these negotiations with an Escalated badge',
      ],
      tech: [],
    },
  },
  // ── Post-outcome ──────────────────────────────────────────────────────────
  {
    id: 'reward', label: 'Reward Computation', sublabel: 'service  ·  rl.py → UCB1 update',
    type: 'service', cx: 500, cy: 1095, w: 255, h: 64,
    detail: {
      badge: 'RL Update',
      description: 'Computes a scaled reward (0–1.5) based on the improvement achieved versus original vendor terms, then applies an incremental mean update to the UCB1 arm\'s Q-value — reinforcing strategies that produce better outcomes over time.',
      files: ['backend/app/services/rl.py → compute_reward(), record_outcome()'],
      responsibilities: [
        'Reward scale: 0.0 (rejected) → 0.5 (partial) → 1.0 (full improvement) → 1.5 (first-round bonus)',
        'Incremental mean: Q(a) ← Q(a) + (1/N(a)) × (reward − Q(a))',
        'Group A reward: std_terms improvement weighted toward ≥ 2% target',
        'Group B reward: term_days and net_days improvement each weighted toward +10',
        'Group C reward: combined A + B reward components (max 1.0 base)',
        'Persists updated arm state to Cosmos DB rl_state immediately after each outcome',
        'UCB1 exploration constant c=2.0 ensures under-explored arms get selected periodically',
      ],
      tech: ['UCB1 incremental mean', 'Azure Cosmos DB', 'Python async/await'],
    },
  },
  {
    id: 'end', label: '✅ Complete', type: 'end',
    cx: 500, cy: 1193, w: 180, h: 36,
  },
]

// ── SVG Edge Helpers ──────────────────────────────────────────────────────────

function straight(x1: number, y1: number, x2: number, y2: number): string {
  return `M ${x1},${y1} L ${x2},${y2}`
}

function curve(x1: number, y1: number, x2: number, y2: number): string {
  const mid = (y1 + y2) / 2
  return `M ${x1},${y1} C ${x1},${mid} ${x2},${mid} ${x2},${y2}`
}

// Node geometry helpers
function top(n: ArchNode)    { return n.cy - n.h / 2 }
function bottom(n: ArchNode) { return n.cy + n.h / 2 }

function buildEdges(nodes: ArchNode[]): string[] {
  const m: Record<string, ArchNode> = {}
  nodes.forEach(n => { m[n.id] = n })
  const n = m

  return [
    straight(500, bottom(n.start),          500, top(n.vendor)  - 2),
    straight(500, bottom(n.vendor),          500, top(n.eligibility) - 2),
    straight(500, bottom(n.eligibility),     500, top(n.ucb1) - 2),
    // UCB1 fan-out to 3 groups
    curve(500, bottom(n.ucb1), n.group_a.cx, top(n.group_a) - 2),
    straight(500, bottom(n.ucb1), 500, top(n.group_b) - 2),
    curve(500, bottom(n.ucb1), n.group_c.cx, top(n.group_c) - 2),
    // Group fan-in to email composer
    curve(n.group_a.cx, bottom(n.group_a), 500, top(n.email_comp) - 2),
    straight(500, bottom(n.group_b), 500, top(n.email_comp) - 2),
    curve(n.group_c.cx, bottom(n.group_c), 500, top(n.email_comp) - 2),
    // Main spine
    straight(500, bottom(n.email_comp),      500, top(n.approval) - 2),
    straight(500, bottom(n.approval),        500, top(n.email_sent) - 2),
    straight(500, bottom(n.email_sent),      500, top(n.resp_analyzer) - 2),
    // Response analyzer fan-out to outcomes
    curve(500, bottom(n.resp_analyzer), n.agreed.cx,    top(n.agreed) - 2),
    curve(500, bottom(n.resp_analyzer), n.counter.cx,   top(n.counter) - 2),
    curve(500, bottom(n.resp_analyzer), n.rejected.cx,  top(n.rejected) - 2),
    curve(500, bottom(n.resp_analyzer), n.escalated.cx, top(n.escalated) - 2),
    // Outcome fan-in to reward
    curve(n.agreed.cx,    bottom(n.agreed),    500, top(n.reward) - 2),
    curve(n.counter.cx,   bottom(n.counter),   500, top(n.reward) - 2),
    curve(n.rejected.cx,  bottom(n.rejected),  500, top(n.reward) - 2),
    curve(n.escalated.cx, bottom(n.escalated), 500, top(n.reward) - 2),
    straight(500, bottom(n.reward), 500, top(n.end) - 2),
  ]
}

const EDGES = buildEdges(NODES)

// Counter-offer loop-back arrow (dashed, left side)
// Goes from counter bottom → loops left → back up to email_comp left edge
const nodeMap: Record<string, ArchNode> = {}
NODES.forEach(n => { nodeMap[n.id] = n })
const LOOP_BACK =
  `M ${nodeMap.counter.cx},${bottom(nodeMap.counter)}` +
  ` C ${nodeMap.counter.cx},${bottom(nodeMap.counter) + 30}` +
  ` 35,${bottom(nodeMap.counter) + 30}` +
  ` 35,${nodeMap.email_comp.cy}` +
  ` C 35,${top(nodeMap.email_comp) - 10}` +
  ` ${nodeMap.email_comp.cx - nodeMap.email_comp.w / 2 - 10},${nodeMap.email_comp.cy}` +
  ` ${nodeMap.email_comp.cx - nodeMap.email_comp.w / 2},${nodeMap.email_comp.cy}`

// ── Component ─────────────────────────────────────────────────────────────────

export function Workflow() {
  const [selected, setSelected] = useState<ArchNode | null>(null)

  function handleClick(node: ArchNode) {
    if (!node.detail) return
    setSelected(prev => prev?.id === node.id ? null : node)
  }

  const SVG_W = 1000
  const SVG_H = 1240

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div>
        <h1 className="text-lg font-bold text-white">System Architecture</h1>
        <p className="text-sm text-gray-400">
          End-to-end negotiation workflow — click any component to see rich details
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs">
        {LEGEND.map(l => (
          <div key={l.type} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-sm ${l.style.bg} border ${l.style.border}`} />
            <span className="text-gray-400">{l.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <svg width="20" height="10"><line x1="0" y1="5" x2="16" y2="5" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3,2" /></svg>
          <span className="text-gray-400">Counter-offer loop back</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-gray-500">
          <Info className="w-3.5 h-3.5" />
          <span>Click any component node for details</span>
        </div>
      </div>

      {/* Main layout: diagram + detail panel */}
      <div className="flex gap-4 items-start">

        {/* Diagram */}
        <div className="flex-1 min-w-0 overflow-x-auto rounded-xl border border-gray-800 bg-gray-950 p-4">
          <div className="relative" style={{ width: SVG_W, height: SVG_H }}>

            {/* SVG arrows layer */}
            <svg
              className="absolute inset-0 pointer-events-none"
              width={SVG_W} height={SVG_H}
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            >
              <defs>
                <marker id="arr" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#6366f1" />
                </marker>
                <marker id="arr-amber" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#f59e0b" />
                </marker>
              </defs>

              {/* Dashed group brackets */}
              <rect
                x="68" y="410" width="864" height="82"
                rx="10" fill="none"
                stroke="#374151" strokeWidth="1" strokeDasharray="6,4"
              />
              <text x="80" y="406" fill="#4b5563" fontSize="10" fontFamily="monospace">
                Parallel A/B Strategy Selection
              </text>

              <rect
                x="68" y="944" width="864" height="78"
                rx="10" fill="none"
                stroke="#374151" strokeWidth="1" strokeDasharray="6,4"
              />
              <text x="80" y="940" fill="#4b5563" fontSize="10" fontFamily="monospace">
                Outcome Resolution
              </text>

              {/* Main flow edges */}
              {EDGES.map((d, i) => (
                <path
                  key={i} d={d}
                  stroke="#6366f1" strokeWidth="1.5"
                  fill="none"
                  markerEnd="url(#arr)"
                />
              ))}

              {/* Counter-offer loop-back (dashed amber) */}
              <path
                d={LOOP_BACK}
                stroke="#f59e0b" strokeWidth="1.5"
                fill="none"
                strokeDasharray="5,3"
                markerEnd="url(#arr-amber)"
              />
              <text x="6" y={nodeMap.email_comp.cy - 8} fill="#f59e0b" fontSize="9" fontFamily="monospace" transform={`rotate(-90, 6, ${nodeMap.email_comp.cy})`}>
                counter loop
              </text>
            </svg>

            {/* Node divs */}
            {NODES.map(node => {
              const s = NODE_STYLES[node.type]
              const isSelected = selected?.id === node.id
              return (
                <div
                  key={node.id}
                  onClick={() => handleClick(node)}
                  style={{
                    position: 'absolute',
                    left: node.cx - node.w / 2,
                    top: node.cy - node.h / 2,
                    width: node.w,
                    height: node.h,
                  }}
                  className={[
                    s.bg, `border ${s.border}`,
                    s.pill ? 'rounded-full' : 'rounded-xl',
                    'flex flex-col items-center justify-center px-3 select-none',
                    node.detail
                      ? 'cursor-pointer hover:brightness-125 hover:scale-105 transition-all duration-150 shadow-lg'
                      : '',
                    isSelected ? 'ring-2 ring-white/60 scale-105 brightness-125' : '',
                  ].join(' ')}
                >
                  <span className="text-white text-[11px] font-semibold text-center leading-tight">
                    {node.label}
                  </span>
                  {node.sublabel && (
                    <span className="text-white/45 text-[9px] text-center leading-tight mt-0.5">
                      {node.sublabel}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Detail panel */}
        {selected?.detail && (
          <div className="w-[380px] flex-shrink-0 sticky top-0 card space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-white font-semibold text-base leading-tight">{selected.label}</h2>
                {selected.sublabel && (
                  <p className="text-gray-500 text-xs mt-0.5 font-mono">{selected.sublabel}</p>
                )}
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-gray-600 hover:text-white transition-colors flex-shrink-0 mt-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Badge */}
            <span className={`inline-block text-xs px-2.5 py-1 rounded-md font-medium ${BADGE_STYLES[selected.detail.badge] ?? 'bg-gray-800 text-gray-300'}`}>
              {selected.detail.badge}
            </span>

            {/* Description */}
            <p className="text-sm text-gray-300 leading-relaxed">
              {selected.detail.description}
            </p>

            {/* Source files */}
            {(selected.detail.files?.length ?? 0) > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileCode2 className="w-3.5 h-3.5" /> Source Files
                </p>
                <div className="space-y-1">
                  {selected.detail.files!.map((f, i) => (
                    <div key={i} className="text-[11px] text-indigo-400 font-mono bg-gray-800/70 rounded px-2.5 py-1.5 break-all">
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Responsibilities */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers2 className="w-3.5 h-3.5" /> Responsibilities
              </p>
              <ul className="space-y-2">
                {selected.detail.responsibilities.map((r, i) => (
                  <li key={i} className="text-xs text-gray-300 flex items-start gap-2 leading-relaxed">
                    <span className="text-indigo-400 shrink-0 mt-0.5">›</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Tech stack */}
            {(selected.detail.tech?.length ?? 0) > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <BrainCircuit className="w-3.5 h-3.5" /> Technology
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.detail.tech!.map((t, i) => (
                    <span key={i} className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full border border-gray-700">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
