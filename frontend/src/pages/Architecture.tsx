import { useState } from 'react'
import { X, FileCode2, Layers2, BrainCircuit, Server, Globe, RefreshCw, GitBranch, Info } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type ComponentType =
  | 'azure-cosmos'
  | 'azure-foundry'
  | 'azure-identity'
  | 'fastapi'
  | 'orchestrator'
  | 'agent'
  | 'rl'
  | 'background'
  | 'react'
  | 'websocket'
  | 'cosmos-container'

interface ComponentDetail {
  title: string
  type: ComponentType
  tagline: string
  description: string
  dataFlow?: string[]
  keyFacts: string[]
  tech: string[]
  source?: string[]
  designDecision?: string
}

// ── Azure SVG Icons ───────────────────────────────────────────────────────────

function AzureCosmosIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <ellipse cx="9" cy="4.5" rx="6" ry="2.5" fill="#0078D4" opacity="0.9" />
      <path d="M3 4.5 C3 6 6 7.5 9 7.5 C12 7.5 15 6 15 4.5 L15 13.5 C15 15 12 16.5 9 16.5 C6 16.5 3 15 3 13.5 Z" fill="#0078D4" opacity="0.6" />
      <ellipse cx="9" cy="4.5" rx="6" ry="2.5" fill="none" stroke="#50E6FF" strokeWidth="0.8" />
      <path d="M3 9 C3 10.5 6 12 9 12 C12 12 15 10.5 15 9" stroke="#50E6FF" strokeWidth="0.7" fill="none" />
      <path d="M3 11.5 C3 13 6 14.5 9 14.5 C12 14.5 15 13 15 11.5" stroke="#50E6FF" strokeWidth="0.5" fill="none" strokeDasharray="1,1" />
    </svg>
  )
}

function AzureFoundryIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <rect x="2" y="2" width="14" height="14" rx="3" fill="#7B2FBE" opacity="0.9" />
      <circle cx="9" cy="9" r="3.5" fill="none" stroke="#C084FC" strokeWidth="1.2" />
      <circle cx="9" cy="9" r="1.5" fill="#C084FC" />
      <path d="M9 3 L9 5.5 M9 12.5 L9 15 M3 9 L5.5 9 M12.5 9 L15 9" stroke="#C084FC" strokeWidth="1" strokeLinecap="round" />
    </svg>
  )
}

function AzureIdentityIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <rect x="2" y="2" width="14" height="14" rx="3" fill="#0078D4" opacity="0.8" />
      <circle cx="9" cy="7" r="2.5" fill="#50E6FF" opacity="0.9" />
      <path d="M4 15 C4 11.5 14 11.5 14 15" fill="#50E6FF" opacity="0.9" />
      <path d="M12 5 L14 7 L12 9" stroke="#fff" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

function AzureLogoMark({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <path d="M2 14 L7 4 L10 9 L8 11 L13 14 Z" fill="#0078D4" opacity="0.9" />
      <path d="M10 4 L15 14 L10.5 14 L8.5 10 Z" fill="#50E6FF" opacity="0.9" />
    </svg>
  )
}

function ReactIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <ellipse cx="9" cy="9" rx="7" ry="3" stroke="#61DAFB" strokeWidth="1" fill="none" />
      <ellipse cx="9" cy="9" rx="7" ry="3" stroke="#61DAFB" strokeWidth="1" fill="none" transform="rotate(60 9 9)" />
      <ellipse cx="9" cy="9" rx="7" ry="3" stroke="#61DAFB" strokeWidth="1" fill="none" transform="rotate(120 9 9)" />
      <circle cx="9" cy="9" r="1.5" fill="#61DAFB" />
    </svg>
  )
}

function FastAPIIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <rect x="2" y="2" width="14" height="14" rx="3" fill="#059669" opacity="0.8" />
      <path d="M9 4 L9 10 M9 10 L5 14 M9 10 L13 14" stroke="#6EE7B7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="4" r="1.2" fill="#6EE7B7" />
    </svg>
  )
}

function OrchestratorIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <rect x="2" y="2" width="14" height="14" rx="3" fill="#4338CA" opacity="0.8" />
      <circle cx="9" cy="9" r="2" fill="#A5B4FC" />
      <circle cx="4.5" cy="5" r="1.2" fill="#A5B4FC" opacity="0.7" />
      <circle cx="13.5" cy="5" r="1.2" fill="#A5B4FC" opacity="0.7" />
      <circle cx="4.5" cy="13" r="1.2" fill="#A5B4FC" opacity="0.7" />
      <circle cx="13.5" cy="13" r="1.2" fill="#A5B4FC" opacity="0.7" />
      <path d="M7 9 L5.5 5.8 M11 9 L12.5 5.8 M7 9 L5.5 12.2 M11 9 L12.5 12.2" stroke="#A5B4FC" strokeWidth="0.8" />
    </svg>
  )
}

function AgentIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <rect x="2" y="2" width="14" height="14" rx="3" fill="#7C2D92" opacity="0.85" />
      <rect x="5" y="5" width="8" height="6" rx="1.5" fill="#E879F9" opacity="0.5" />
      <circle cx="7" cy="8" r="1" fill="#E879F9" />
      <circle cx="11" cy="8" r="1" fill="#E879F9" />
      <path d="M6 11 Q9 13.5 12 11" stroke="#E879F9" strokeWidth="0.9" fill="none" strokeLinecap="round" />
    </svg>
  )
}

function RLIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <rect x="2" y="2" width="14" height="14" rx="3" fill="#5B21B6" opacity="0.8" />
      <path d="M4 13 L6.5 9 L9 11 L11.5 6 L14 8" stroke="#A78BFA" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="6.5" cy="9" r="1.1" fill="#A78BFA" />
      <circle cx="9" cy="11" r="1.1" fill="#A78BFA" />
      <circle cx="11.5" cy="6" r="1.1" fill="#A78BFA" />
    </svg>
  )
}

function BackgroundIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <rect x="2" y="2" width="14" height="14" rx="3" fill="#0E7490" opacity="0.8" />
      <path d="M9 5 A4 4 0 0 1 13 9" stroke="#67E8F9" strokeWidth="1.3" strokeLinecap="round" fill="none" />
      <path d="M9 13 A4 4 0 0 1 5 9" stroke="#67E8F9" strokeWidth="1.3" strokeLinecap="round" fill="none" />
      <path d="M12.5 8.5 L13 9 L13.5 8.5" stroke="#67E8F9" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M5.5 9.5 L5 9 L4.5 9.5" stroke="#67E8F9" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

function WSIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <rect x="2" y="2" width="14" height="14" rx="3" fill="#B45309" opacity="0.8" />
      <path d="M5 9 Q7.5 5 9 9 Q10.5 13 13 9" stroke="#FCD34D" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      <circle cx="5" cy="9" r="1" fill="#FCD34D" />
      <circle cx="13" cy="9" r="1" fill="#FCD34D" />
    </svg>
  )
}

function CosmosContainerIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" className="shrink-0 mt-0.5">
      <ellipse cx="9" cy="5" rx="5.5" ry="2" fill="#0078D4" opacity="0.7" />
      <path d="M3.5 5 L3.5 13 Q3.5 15 9 15 Q14.5 15 14.5 13 L14.5 5" fill="#1E40AF" opacity="0.5" />
      <ellipse cx="9" cy="5" rx="5.5" ry="2" fill="none" stroke="#60A5FA" strokeWidth="0.8" />
      <path d="M3.5 8 Q3.5 10 9 10 Q14.5 10 14.5 8" stroke="#60A5FA" strokeWidth="0.6" fill="none" strokeDasharray="1.5,1" />
    </svg>
  )
}

// ── Component icon switch ─────────────────────────────────────────────────────

function ComponentIcon({ type, size = 28 }: { type: ComponentType; size?: number }) {
  switch (type) {
    case 'azure-cosmos':     return <AzureCosmosIcon size={size} />
    case 'azure-foundry':    return <AzureFoundryIcon size={size} />
    case 'azure-identity':   return <AzureIdentityIcon size={size} />
    case 'react':            return <ReactIcon size={size} />
    case 'fastapi':          return <FastAPIIcon size={size} />
    case 'orchestrator':     return <OrchestratorIcon size={size} />
    case 'agent':            return <AgentIcon size={size} />
    case 'rl':               return <RLIcon size={size} />
    case 'background':       return <BackgroundIcon size={size} />
    case 'websocket':        return <WSIcon size={size} />
    case 'cosmos-container': return <CosmosContainerIcon size={size} />
  }
}

// ── Detail Data ───────────────────────────────────────────────────────────────

const DETAILS: Record<string, ComponentDetail> = {
  react: {
    title: 'React SPA',
    type: 'react',
    tagline: 'React 18 + TypeScript + Vite · port 5173',
    description: 'A single-page application providing the complete UI for the Autonomous Negotiations system. Uses TanStack React Query for server-state management, a custom useWebSocket hook for real-time events, and Recharts for A/B analytics visualisation.',
    dataFlow: [
      'REST calls to /api/* via axios typed wrappers (src/services/api.ts)',
      'WebSocket subscription to ws://host/ws for push events',
      'React Query cache invalidation on WebSocket event receipt',
      'Optimistic UI updates on approval and mutation actions',
    ],
    keyFacts: [
      'Pages: Dashboard · Vendors · Negotiations · A/B Testing · Workflow · Architecture · Settings',
      'React Query refetchInterval: 20s for pending-approval bell badge',
      'useWebSocket: auto-reconnect every 3s, 30s ping/pong keepalive',
      'ApprovalModal: editable email body textarea with 3 tabs (Approve / Reply / Escalate)',
      'WorkflowTimeline: renders 8 key milestones (Eligible → Counter → Agreed) with live active stage highlight',
      'NotificationBell: increments in real-time via WebSocket approval_needed events',
    ],
    tech: ['React 18', 'TypeScript', 'Vite', 'TanStack React Query', 'Tailwind CSS', 'Recharts', 'axios', 'react-router-dom'],
    source: ['frontend/src/App.tsx', 'frontend/src/hooks/useWebSocket.ts', 'frontend/src/services/api.ts'],
  },
  fastapi: {
    title: 'FastAPI Backend',
    type: 'fastapi',
    tagline: 'Python 3.11 · Uvicorn · port 8000',
    description: 'The central backend server built with FastAPI and Uvicorn. All business logic, agent invocations, and database operations run here. Exposes REST endpoints under /api and a WebSocket endpoint at /ws.',
    dataFlow: [
      'Receives HTTP requests from the React SPA',
      'Delegates to routers: vendors, negotiations, ab-testing, settings, rule-templates, ws',
      'Calls Orchestrator for negotiation lifecycle management',
      'Writes/reads all state to Cosmos DB via the CosmosService singleton',
      'Invokes Azure AI Foundry agents via azure-ai-projects SDK v2',
    ],
    keyFacts: [
      'All routers mounted under /api prefix — OpenAPI docs auto-generated at /docs',
      'CosmosService singleton initialized on startup with Service Principal credentials',
      'EmailComposer and ResponseAnalyzer agents created once at startup and reused',
      'Background task polling loop started on app startup (every 60 seconds)',
      'Agent settings seeded to Cosmos DB on first run with sensible defaults',
      'CORS configured to allow React dev server on port 5173',
    ],
    tech: ['FastAPI', 'Python 3.11', 'Uvicorn', 'Pydantic v2', 'azure-ai-projects', 'azure-cosmos', 'pydantic-settings'],
    source: ['backend/app/main.py', 'backend/app/config.py', 'backend/app/api/'],
    designDecision: 'Pydantic v2 models used throughout for ~5–10× validation speedup vs v1. model_dump() round-trips cleanly through Cosmos DB without custom serialisers.',
  },
  orchestrator: {
    title: 'Orchestrator',
    type: 'orchestrator',
    tagline: '18-stage state machine · agents/orchestrator.py',
    description: 'The central state machine that drives every negotiation from creation to outcome. Coordinates the email composer and response analyzer agents, calls the RL service for strategy selection, persists all state to Cosmos DB, and broadcasts WebSocket events after every stage transition.',
    dataFlow: [
      'POST /api/negotiations → orchestrator.start_negotiation(vendor_id)',
      'Assigns AB group via RLService.select_group() (UCB1)',
      'Calls EmailComposer.draft_contact_email() → stores EmailThread (pending_approval)',
      'Advances stage → contact_approval → WS broadcast: approval_needed',
      'On human approval: marks email sent, advances to contact_sent',
      'On vendor reply: calls ResponseAnalyzer → routes to next phase',
      'On outcome: calls RLService.record_outcome() with computed reward',
    ],
    keyFacts: [
      '18 named stages across 4 phases: Contact → Proposal → Counter → Outcome',
      'Stage transitions are named functions — fully auditable, no implicit logic',
      'Granular stages enable background recovery: failed drafts retried at exact stage',
      'Counter-proposal loop capped at 3 rounds before auto-escalation',
      'Escalation available at any stage via POST /api/negotiations/{id}/escalate',
      'Simulation service injects scripted vendor replies for demo/testing (5 scenarios)',
    ],
    tech: ['Python async/await', 'Azure Cosmos DB', 'Azure AI Foundry', 'WebSocket broadcast', 'UCB1 RL'],
    source: ['backend/app/agents/orchestrator.py'],
    designDecision: 'Explicit 18-stage model chosen over a simpler status field. Each stage has distinct UI presentation, backend action, and recovery point. The auditability and debuggability justify the extra branches.',
  },
  emailComposer: {
    title: 'Email Composer Agent',
    type: 'agent',
    tagline: 'GPT-4o · Azure AI Foundry · negotiation-email-composer',
    description: 'A named Foundry agent powered by GPT-4o that drafts professional negotiation emails in the voice of James Caldwell (VP of Vendor Relations & Merchandising). Invoked via the Conversations API v2 with a per-negotiation Foundry thread for full conversation memory.',
    dataFlow: [
      'Orchestrator calls draft_contact_email() / draft_proposal_email() / draft_counter_response()',
      'Opens a Foundry thread (or reuses existing thread_id per negotiation)',
      'Sends structured prompt: vendor profile + strategy + stage + prior history',
      'GPT-4o returns strict JSON: {subject, body, proposed_terms, tone}',
      'JSON stored as EmailThread (status: pending_approval) in Cosmos DB',
    ],
    keyFacts: [
      'Model: GPT-4o (chat4o deployment) via Azure AI Foundry Agent Service',
      'Persona: James Caldwell, VP Vendor Relations & Merchandising, ABC',
      'Mandatory JSON-only output enforced via OUTPUT RULES in system prompt',
      'Thread reuse across rounds preserves full conversation context in Foundry',
      'System prompt and persona loaded from agent_settings Cosmos container at runtime',
      'Bootstrapped with create_version() on startup — configurable without restarts',
      'Three draft functions: contact verification, proposal email, counter-response',
    ],
    tech: ['Azure AI Foundry', 'GPT-4o (chat4o)', 'azure-ai-projects SDK v2', 'Conversations API v2', 'Foundry Threads'],
    source: ['backend/app/agents/email_composer.py', 'backend/app/agents/client.py'],
    designDecision: 'Foundry agents chosen over direct OpenAI SDK calls for built-in tracing, versioning, and observability. The Conversations API thread model maps cleanly to per-negotiation email rounds.',
  },
  responseAnalyzer: {
    title: 'Response Analyzer Agent',
    type: 'agent',
    tagline: 'GPT-4o · Azure AI Foundry · negotiation-response-analyzer',
    description: 'A named Foundry agent that classifies vendor reply emails and extracts any counter-proposed payment terms. Its structured JSON output drives the orchestrator\'s next-stage routing — determining whether the negotiation succeeds, loops for a counter-offer, or escalates.',
    dataFlow: [
      'POST /api/negotiations/{id}/respond {body} → orchestrator._handle_*_reply()',
      'Inbound email stored as EmailThread (direction: inbound, status: received)',
      'analyze_contact_reply() → {contact_status, sentiment, summary}',
      'analyze_proposal_reply() → {response_type, counter_terms, confidence, reasoning}',
      'Orchestrator routes: accepted → agreed | counter_offer → loop | rejected → end',
    ],
    keyFacts: [
      'contact_status values: confirmed | rejected | redirected | unclear',
      'response_type values: accepted | rejected | counter_offer | needs_clarification',
      'Extracts counter std_terms, term_days, net_days from vendor reply text',
      'Confidence score (0–1) used to auto-escalate ambiguous replies',
      'Shares same Foundry thread_id as email composer for full conversation context',
      'Strict JSON output schema — no free-text in the structured tool response field',
    ],
    tech: ['Azure AI Foundry', 'GPT-4o (chat4o)', 'azure-ai-projects SDK v2', 'Structured JSON output'],
    source: ['backend/app/agents/response_analyzer.py', 'backend/app/agents/orchestrator.py'],
  },
  rlService: {
    title: 'RL Service (UCB1)',
    type: 'rl',
    tagline: 'Multi-armed bandit · UCB1 algorithm · services/rl.py',
    description: 'Implements the UCB1 (Upper Confidence Bound 1) multi-armed bandit algorithm to select the optimal negotiation strategy (A, B, or C) for each new negotiation. Persists Q-values and trial counts to Cosmos DB so learning survives restarts and deployments.',
    dataFlow: [
      'start_negotiation() → RLService.select_group() → arm with highest UCB1 score',
      'Outcome reached → RLService.record_outcome(group, reward)',
      'Q(a) ← Q(a) + (1/N(a)) × (reward − Q(a))  [incremental mean update]',
      'Updated arm state immediately saved to Cosmos DB rl_state container',
    ],
    keyFacts: [
      'Formula: UCB1(a) = Q(a) + c × √(ln N_total / N_a),  exploration constant c = 2.0',
      'Unvisited arms → ∞ score — all three arms explored before any exploitation',
      'Reward scale: 0.0 (rejected) → 0.5 (partial) → 1.0 (full) → 1.5 (first-round bonus)',
      'Group A reward: std_terms improvement weighted toward ≥ 2% target',
      'Group B reward: term_days + net_days improvement each weighted toward +10 days',
      'Group C reward: combined A + B components — highest ceiling, highest risk',
      'Stats exposed via GET /api/ab-testing for dashboard charting and UCB1 decomposition',
    ],
    tech: ['UCB1 Algorithm', 'Azure Cosmos DB', 'Python math', 'async/await', 'Incremental mean update'],
    source: ['backend/app/services/rl.py'],
    designDecision: 'UCB1 chosen over random or fixed A/B split: automatically balances exploration vs exploitation, needs no manual configuration, and has provable sub-linear regret bounds. Q-values persisted to Cosmos DB for cross-restart learning continuity.',
  },
  background: {
    title: 'Background Task',
    type: 'background',
    tagline: '60-second poll · auto-start · recovery · background/tasks.py',
    description: 'A background asyncio loop that runs every 60 seconds to automatically start new negotiations for eligible vendors and to recover stalled negotiations that failed mid-pipeline.',
    dataFlow: [
      'Every 60s: query Cosmos for eligible vendors not yet in a negotiation',
      'Up to 5 vendors selected per cycle to avoid burst load on Azure Foundry',
      'Calls orchestrator.start_negotiation(vendor_id) for each selected vendor',
      'Detects stalled negotiations (e.g., contact_drafting, no email) and retries from that stage',
    ],
    keyFacts: [
      'Fully autonomous: no human trigger needed once vendors are loaded',
      'Batch size limit (5/cycle) prevents accidental API floods to Azure AI Foundry',
      'Recovery logic: contact_drafting with no email → re-invokes EmailComposer agent',
      'agent_settings from Cosmos reloaded each cycle — hot config without restarts',
      'Simulation service available: POST /api/negotiations/{id}/simulate to run scripted scenarios',
      'Simulation scenarios: quick_win · friendly_counter · hard_rejection · escalation · stall',
    ],
    tech: ['Python asyncio', 'FastAPI lifespan background tasks', 'Azure Cosmos DB', 'simulation.py'],
    source: ['backend/app/background/tasks.py', 'backend/app/services/simulation.py'],
  },
  websocket: {
    title: 'WebSocket Hub',
    type: 'websocket',
    tagline: 'Real-time push events · /ws endpoint · api/ws.py',
    description: 'A single ConnectionManager maintains all active WebSocket connections. Every time the orchestrator advances a stage, a push event is broadcast to all connected browser sessions — driving immediate UI updates without polling.',
    dataFlow: [
      'Frontend useWebSocket hook connects to ws://host/ws on mount',
      'Frontend sends "ping" every 30s; server echoes "pong" for keepalive',
      'Backend broadcasts JSON event: {type, data} on each stage transition',
      'Frontend React Query invalidates matching cache keys on event receipt',
    ],
    keyFacts: [
      'Events: negotiation_started · approval_needed · email_sent · reply_received · negotiation_escalated',
      'approval_needed → immediately invalidates pending-approval count in bell badge',
      'email_sent / reply_received → invalidates negotiation detail + list queries',
      'Auto-reconnect: 3s delay after disconnect, ephemeral state preserved in React',
      'Connection list is in-memory — single process only (Redis needed for multi-worker)',
      'Dead connections removed automatically on broadcast failure',
    ],
    tech: ['FastAPI WebSocket', 'asyncio', 'React useWebSocket hook', 'TanStack React Query invalidation'],
    source: ['backend/app/api/ws.py', 'frontend/src/hooks/useWebSocket.ts'],
    designDecision: 'WebSocket chosen over REST polling: negotiation stages advance asynchronously (background task, vendor reply). WebSocket events trigger targeted cache invalidations, keeping UI fresh without full reloads or polling hammering the API.',
  },
  cosmos: {
    title: 'Azure Cosmos DB',
    type: 'azure-cosmos',
    tagline: 'NoSQL · 6 containers · negotiations database',
    description: 'Azure Cosmos DB NoSQL is the sole persistence layer. All vendor records, negotiation state, email threads, RL arm state, rule templates, and agent settings live here. Document-oriented design maps naturally to Pydantic models with no ORM or migration tooling.',
    dataFlow: [
      'CosmosService singleton wraps the async Cosmos DB SDK',
      'All hot reads: point reads by partition key (O(1) latency)',
      'Bulk vendor upserts: batches of 50 for synthetic generation',
      'RL state: loaded on startup + written after each negotiation outcome',
      'Email threads: append-only per negotiation_id partition',
    ],
    keyFacts: [
      'Container vendors (pk: /vendor_id) — master data, eligibility, negotiation status',
      'Container negotiations (pk: /vendor_id) — stage, AB group, proposed & agreed terms',
      'Container email_threads (pk: /negotiation_id) — all inbound + outbound emails',
      'Container rl_state (pk: /id) — UCB1 Q-values, trial counts, cumulative rewards',
      'Container rule_templates (pk: /id) — eligibility condition sets (CRUD, visual builder)',
      'Container agent_settings (pk: /id) — model name, system prompts, persona config',
      'Partition key design enables O(1) point reads for the most common access patterns',
    ],
    tech: ['Azure Cosmos DB NoSQL', 'azure-cosmos async SDK', 'Service Principal auth', 'Pydantic v2 round-trip'],
    source: ['backend/app/services/cosmos.py', 'backend/app/models/'],
    designDecision: 'Cosmos DB chosen over relational DB: document JSON maps naturally to Pydantic models, serverless/autoscale throughput suits bursty write patterns, and the same Azure identity authenticates to both Cosmos and AI Foundry.',
  },
  foundry: {
    title: 'Azure AI Foundry',
    type: 'azure-foundry',
    tagline: 'GPT-4o · chat4o deployment · Conversations API v2',
    description: 'Azure AI Foundry hosts the two GPT-4o agents used by the system. The Foundry Agent Service provides a managed execution environment with built-in tracing, versioning, and observability. Accessed via the azure-ai-projects SDK Conversations API v2.',
    dataFlow: [
      'On startup: AIProjectClient authenticated via Service Principal',
      'Agents created (or retrieved) by name: negotiation-email-composer, negotiation-response-analyzer',
      'Per-negotiation: create thread → create run → poll for completion → extract JSON output',
      'Response validated as strict JSON before being stored in Cosmos DB',
    ],
    keyFacts: [
      'Model: GPT-4o deployed as "chat4o" in the configured Foundry project',
      'Two agents: email-composer (drafts emails) + response-analyzer (classifies replies)',
      'Thread-per-negotiation: Foundry threads preserve full multi-round exchange context',
      'Agent system prompts loaded from Cosmos agent_settings — hot-configurable at runtime',
      'create_version() on startup enables prompt versioning without code deploys',
      'Foundry provides tracing and run logs for every agent invocation',
      'Swap model: change AZURE_AI_MODEL env var — no orchestration code changes required',
    ],
    tech: ['Azure AI Foundry', 'GPT-4o (chat4o)', 'azure-ai-projects SDK v2', 'Conversations API v2', 'Service Principal'],
    source: ['backend/app/agents/client.py', 'backend/app/agents/email_composer.py', 'backend/app/agents/response_analyzer.py'],
    designDecision: 'Foundry chosen over direct OpenAI calls for managed tracing, versioning, and the ability to extend agents with function tools (CRM lookup, approval tracking) without changing orchestration code.',
  },
  identity: {
    title: 'Azure Identity',
    type: 'azure-identity',
    tagline: 'Service Principal · ClientSecretCredential · azure-identity SDK',
    description: 'A single Azure Service Principal authenticates all outbound calls to Azure services — both Cosmos DB and AI Foundry. No end-user identity delegation is required; the backend uses its own application identity for all Azure SDK operations.',
    dataFlow: [
      'AZURE_TENANT_ID + AZURE_CLIENT_ID + AZURE_CLIENT_SECRET → ClientSecretCredential',
      'azure-cosmos SDK: credential used for Cosmos DB data-plane auth',
      'azure-ai-projects SDK: credential used for Foundry project auth',
      'Token refresh handled automatically by azure-identity SDK — no manual rotation',
    ],
    keyFacts: [
      'Credentials loaded via pydantic-settings from environment variables / .env file',
      'Same Service Principal grants access to both Cosmos DB and AI Foundry — minimal credential surface',
      'No API keys stored anywhere — all authentication via Azure AD token flows',
      'Future enhancement: per-user Azure AD auth for per-reviewer approval tracking',
    ],
    tech: ['Azure Identity', 'ClientSecretCredential', 'azure-identity SDK', 'Azure AD Service Principal'],
    source: ['backend/app/config.py', 'backend/app/services/cosmos.py', 'backend/app/agents/client.py'],
  },
}

// ── Cosmos containers table data ──────────────────────────────────────────────

const COSMOS_CONTAINERS = [
  { name: 'vendors',        pk: '/vendor_id',      purpose: 'Master data, eligibility, negotiation status' },
  { name: 'negotiations',   pk: '/vendor_id',      purpose: 'Stage, AB group, proposed & agreed terms' },
  { name: 'email_threads',  pk: '/negotiation_id', purpose: 'All inbound + outbound emails per negotiation' },
  { name: 'rl_state',       pk: '/id',             purpose: 'UCB1 Q-values, trial counts, cumulative rewards' },
  { name: 'rule_templates', pk: '/id',             purpose: 'Eligibility condition sets (CRUD, visual builder)' },
  { name: 'agent_settings', pk: '/id',             purpose: 'Model name, system prompts, persona config' },
]

// ── Arrow SVG helpers ─────────────────────────────────────────────────────────

function VerticalArrow({ label, color = '#6366f1', dashed = false }: { label: string; color?: string; dashed?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-0.5 py-0.5 select-none">
      <span className="text-[9px] font-mono" style={{ color }}>{label}</span>
      <svg width="2" height="28" className="overflow-visible">
        <line x1="1" y1="0" x2="1" y2="24" stroke={color} strokeWidth="1.5" strokeDasharray={dashed ? '4,3' : undefined} />
        <polygon points="-3,19 1,25 5,19" fill={color} />
      </svg>
    </div>
  )
}

// ── Clickable arch card ───────────────────────────────────────────────────────

function ArchCard({
  id, title, sublabel, icon, selected, onClick, className = '',
}: {
  id: string; title: string; sublabel?: string; icon: React.ReactNode
  selected: boolean; onClick: (id: string) => void; className?: string
}) {
  return (
    <button
      onClick={() => onClick(id)}
      className={[
        'flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border text-center w-full',
        'cursor-pointer hover:brightness-125 hover:scale-[1.04] transition-all duration-150 shadow-md',
        selected ? 'ring-2 ring-white/50 scale-[1.04] brightness-125' : '',
        className,
      ].join(' ')}
    >
      {icon}
      <div>
        <div className="text-[11px] font-semibold text-white leading-tight">{title}</div>
        {sublabel && <div className="text-[9px] text-white/50 leading-tight mt-0.5">{sublabel}</div>}
      </div>
    </button>
  )
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

function DetailPanel({ detail, onClose }: { detail: ComponentDetail; onClose: () => void }) {
  return (
    <div className="w-[370px] flex-shrink-0 sticky top-0 rounded-xl border border-gray-700 bg-gray-900 p-5 space-y-4 max-h-[calc(100vh-8rem)] overflow-y-auto">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <ComponentIcon type={detail.type} size={26} />
          <div>
            <h2 className="text-white font-semibold text-sm leading-tight">{detail.title}</h2>
            <p className="text-gray-500 text-[10px] mt-0.5 font-mono leading-tight">{detail.tagline}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-600 hover:text-white transition-colors flex-shrink-0 mt-0.5">
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-xs text-gray-300 leading-relaxed">{detail.description}</p>

      {detail.dataFlow && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <GitBranch className="w-3 h-3" /> Data Flow
          </p>
          <ol className="space-y-1.5">
            {detail.dataFlow.map((f, i) => (
              <li key={i} className="text-xs text-gray-300 flex items-start gap-2 leading-relaxed">
                <span className="text-sky-500 font-mono shrink-0 mt-0.5 text-[10px]">{i + 1}.</span>
                <span>{f}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <Layers2 className="w-3 h-3" /> Key Facts
        </p>
        <ul className="space-y-1.5">
          {detail.keyFacts.map((f, i) => (
            <li key={i} className="text-xs text-gray-300 flex items-start gap-2 leading-relaxed">
              <span className="text-indigo-400 shrink-0 mt-0.5">›</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>

      {detail.designDecision && (
        <div className="rounded-lg bg-amber-950/40 border border-amber-800/50 p-3 space-y-1">
          <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Design Decision</p>
          <p className="text-xs text-amber-200/80 leading-relaxed">{detail.designDecision}</p>
        </div>
      )}

      {detail.source && detail.source.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <FileCode2 className="w-3 h-3" /> Source Files
          </p>
          {detail.source.map((f, i) => (
            <div key={i} className="text-[11px] text-indigo-400 font-mono bg-gray-800/70 rounded px-2.5 py-1.5 break-all">
              {f}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <BrainCircuit className="w-3 h-3" /> Technology
        </p>
        <div className="flex flex-wrap gap-1.5">
          {detail.tech.map((t, i) => (
            <span key={i} className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full border border-gray-700">
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main exported component ───────────────────────────────────────────────────

export function Architecture() {
  const [selected, setSelected] = useState<string | null>(null)

  function handleClick(id: string) {
    setSelected(prev => prev === id ? null : id)
  }

  const detail = selected ? DETAILS[selected] : null

  return (
    <div className="space-y-4">

      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">System Architecture</h1>
          <p className="text-sm text-gray-400">
            Azure services, data flows & design decisions — click any component for full details
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-gray-500 text-xs">
          <Info className="w-3.5 h-3.5" />
          <span>Click any component</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] px-1">
        {[
          { icon: <ReactIcon size={11} />,          label: 'React SPA',        color: 'text-sky-400' },
          { icon: <FastAPIIcon size={11} />,         label: 'FastAPI',          color: 'text-emerald-400' },
          { icon: <OrchestratorIcon size={11} />,    label: 'Orchestrator',     color: 'text-indigo-400' },
          { icon: <AgentIcon size={11} />,           label: 'Foundry Agent',    color: 'text-purple-400' },
          { icon: <RLIcon size={11} />,              label: 'UCB1 RL',          color: 'text-violet-400' },
          { icon: <WSIcon size={11} />,              label: 'WebSocket',        color: 'text-amber-400' },
          { icon: <AzureCosmosIcon size={11} />,     label: 'Azure Cosmos DB',  color: 'text-blue-400' },
          { icon: <AzureFoundryIcon size={11} />,    label: 'Azure AI Foundry', color: 'text-purple-300' },
          { icon: <AzureIdentityIcon size={11} />,   label: 'Azure Identity',   color: 'text-sky-300' },
        ].map(({ icon, label, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            {icon}
            <span className={color}>{label}</span>
          </div>
        ))}
      </div>

      {/* Main layout: diagram + detail panel */}
      <div className="flex gap-4 items-start">

        {/* ── Architecture Diagram ─────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-3">

          {/* ── BROWSER ZONE ────────────────────────────────────── */}
          <div className="rounded-2xl border border-sky-700/40 bg-sky-950/15 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-sky-500" />
              <span className="text-xs font-semibold text-sky-400 font-mono">Browser  ·  React 18 + TypeScript + Vite</span>
            </div>

            {/* Pages strip */}
            <div className="grid grid-cols-5 gap-2">
              {[
                { label: 'Dashboard',   sub: 'KPIs · RL strategy' },
                { label: 'Vendors',     sub: 'Eligibility · Rules' },
                { label: 'Negotiations',sub: 'List · Approvals' },
                { label: 'A/B Testing', sub: 'UCB1 stats · Charts' },
                { label: 'Settings',    sub: 'Agent config · Prompts' },
              ].map(p => (
                <div key={p.label} className="rounded-lg border border-sky-800/40 bg-sky-900/20 px-2 py-2 text-center">
                  <div className="text-[11px] font-medium text-sky-300">{p.label}</div>
                  <div className="text-[9px] text-sky-500/70 mt-0.5">{p.sub}</div>
                </div>
              ))}
            </div>

            {/* React SPA card + sub-components */}
            <div className="grid grid-cols-3 gap-3">
              <ArchCard
                id="react" title="React SPA" sublabel="TanStack Query · useWebSocket · Recharts"
                icon={<ReactIcon size={24} />}
                selected={selected === 'react'} onClick={handleClick}
                className="bg-sky-900/30 border-sky-700/60"
              />
              <div className="col-span-2 rounded-xl border border-sky-800/30 bg-sky-900/10 p-3 flex items-center justify-around gap-2">
                {[
                  { label: 'TanStack Query', sub: 'Cache · refetchInterval' },
                  { label: 'useWebSocket',   sub: 'Push · reconnect · ping' },
                  { label: 'Recharts',       sub: 'UCB1 · Outcome bars' },
                  { label: 'axios',          sub: 'Typed API client' },
                ].map((c, i, arr) => (
                  <div key={c.label} className="flex items-center gap-2">
                    <div className="text-center">
                      <div className="text-[10px] text-gray-400 font-mono">{c.label}</div>
                      <div className="text-[9px] text-sky-400">{c.sub}</div>
                    </div>
                    {i < arr.length - 1 && <div className="w-px h-8 bg-sky-800/40 shrink-0" />}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Zone arrows: REST + WS */}
          <div className="flex justify-around px-16">
            <VerticalArrow label="REST / JSON" color="#6366f1" />
            <VerticalArrow label="WebSocket (live push)" color="#f59e0b" dashed />
          </div>

          {/* ── BACKEND ZONE ────────────────────────────────────── */}
          <div className="rounded-2xl border border-indigo-700/40 bg-indigo-950/15 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Server className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-xs font-semibold text-indigo-400 font-mono">FastAPI Backend  ·  Python 3.11 + Uvicorn  ·  port 8000</span>
            </div>

            {/* Routers */}
            <div className="rounded-xl border border-indigo-800/40 bg-indigo-900/20 p-2.5">
              <div className="text-[10px] text-indigo-400 font-mono mb-2">API Routers  ·  /api prefix  ·  OpenAPI /docs</div>
              <div className="flex flex-wrap gap-1.5">
                {['/vendors', '/negotiations', '/ab-testing', '/settings', '/rule-templates', '/ws  (WebSocket)'].map(r => (
                  <span key={r} className="text-[11px] font-mono bg-indigo-900/50 border border-indigo-700/60 text-indigo-300 px-2 py-0.5 rounded">
                    {r}
                  </span>
                ))}
              </div>
            </div>

            {/* Services grid */}
            <div className="grid grid-cols-5 gap-2">
              <ArchCard
                id="fastapi" title="FastAPI" sublabel="Pydantic v2 · Uvicorn"
                icon={<FastAPIIcon size={20} />}
                selected={selected === 'fastapi'} onClick={handleClick}
                className="bg-emerald-900/30 border-emerald-700/60"
              />
              <ArchCard
                id="orchestrator" title="Orchestrator" sublabel="18-stage machine"
                icon={<OrchestratorIcon size={20} />}
                selected={selected === 'orchestrator'} onClick={handleClick}
                className="bg-indigo-900/30 border-indigo-600/60"
              />
              <ArchCard
                id="emailComposer" title="Email Composer" sublabel="Foundry · GPT-4o"
                icon={<AgentIcon size={20} />}
                selected={selected === 'emailComposer'} onClick={handleClick}
                className="bg-purple-900/30 border-purple-600/60"
              />
              <ArchCard
                id="responseAnalyzer" title="Resp. Analyzer" sublabel="Foundry · GPT-4o"
                icon={<AgentIcon size={20} />}
                selected={selected === 'responseAnalyzer'} onClick={handleClick}
                className="bg-purple-900/30 border-purple-600/60"
              />
              <div className="space-y-2">
                <ArchCard
                  id="rlService" title="RL / UCB1" sublabel="Group select"
                  icon={<RLIcon size={16} />}
                  selected={selected === 'rlService'} onClick={handleClick}
                  className="bg-violet-900/30 border-violet-600/60"
                />
                <ArchCard
                  id="background" title="Background" sublabel="60s poll"
                  icon={<BackgroundIcon size={16} />}
                  selected={selected === 'background'} onClick={handleClick}
                  className="bg-cyan-900/30 border-cyan-700/60"
                />
              </div>
            </div>

            {/* WebSocket */}
            <ArchCard
              id="websocket" title="WebSocket Hub  ·  /ws endpoint" sublabel="Real-time push: approval_needed · email_sent · reply_received · negotiation_started"
              icon={<WSIcon size={18} />}
              selected={selected === 'websocket'} onClick={handleClick}
              className="bg-amber-900/20 border-amber-700/50 flex-row gap-3"
            />
          </div>

          {/* Zone arrows: SDK calls + auth */}
          <div className="flex justify-around px-8">
            <VerticalArrow label="azure-cosmos async SDK" color="#6366f1" />
            <VerticalArrow label="azure-ai-projects SDK v2" color="#a855f7" />
            <VerticalArrow label="ClientSecretCredential" color="#0284c7" />
          </div>

          {/* ── AZURE ZONE ──────────────────────────────────────── */}
          <div className="rounded-2xl border border-blue-700/35 bg-blue-950/12 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AzureLogoMark size={14} />
              <span className="text-xs font-semibold text-blue-400 font-mono">Azure Cloud Services</span>
            </div>

            <div className="grid grid-cols-3 gap-3">

              {/* Cosmos DB */}
              <div className="space-y-2">
                <ArchCard
                  id="cosmos" title="Azure Cosmos DB" sublabel="NoSQL · 6 containers"
                  icon={<AzureCosmosIcon size={26} />}
                  selected={selected === 'cosmos'} onClick={handleClick}
                  className="bg-blue-900/30 border-blue-600/60"
                />
                <div className="rounded-xl border border-blue-800/40 bg-blue-950/30 p-2.5 space-y-1.5">
                  <div className="text-[9px] text-blue-400 font-mono mb-1">6 Containers  ·  negotiations database</div>
                  {COSMOS_CONTAINERS.map(c => (
                    <div key={c.name} className="flex items-start gap-1.5">
                      <CosmosContainerIcon size={12} />
                      <div className="min-w-0">
                        <div className="text-[10px] font-mono text-blue-300 leading-tight">{c.name}</div>
                        <div className="text-[9px] text-gray-500 leading-tight">{c.purpose}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Foundry */}
              <div className="space-y-2">
                <ArchCard
                  id="foundry" title="Azure AI Foundry" sublabel="GPT-4o · chat4o"
                  icon={<AzureFoundryIcon size={26} />}
                  selected={selected === 'foundry'} onClick={handleClick}
                  className="bg-purple-900/30 border-purple-600/60"
                />
                <div className="rounded-xl border border-purple-800/40 bg-purple-950/30 p-2.5 space-y-2">
                  <div className="text-[9px] text-purple-400 font-mono mb-1">Agents  &amp;  Model</div>
                  {[
                    { name: 'negotiation-email-composer',    desc: 'Drafts outbound emails (3 functions)' },
                    { name: 'negotiation-response-analyzer', desc: 'Classifies vendor reply intent' },
                  ].map(a => (
                    <div key={a.name} className="flex items-start gap-1.5">
                      <AgentIcon size={11} />
                      <div>
                        <div className="text-[10px] font-mono text-purple-300 leading-tight">{a.name}</div>
                        <div className="text-[9px] text-gray-500 leading-tight">{a.desc}</div>
                      </div>
                    </div>
                  ))}
                  <div className="rounded-lg bg-purple-900/40 px-2 py-1.5 space-y-0.5">
                    <div className="text-[9px] text-purple-300 font-mono">GPT-4o  ·  chat4o deployment</div>
                    <div className="text-[9px] text-gray-500">Conversations API v2 · thread-per-negotiation</div>
                  </div>
                </div>
              </div>

              {/* Identity */}
              <div className="space-y-2">
                <ArchCard
                  id="identity" title="Azure Identity" sublabel="Service Principal"
                  icon={<AzureIdentityIcon size={26} />}
                  selected={selected === 'identity'} onClick={handleClick}
                  className="bg-sky-900/30 border-sky-600/60"
                />
                <div className="rounded-xl border border-sky-800/40 bg-sky-950/30 p-2.5 space-y-1.5">
                  <div className="text-[9px] text-sky-400 font-mono mb-1">Auth Flow  ·  .env variables</div>
                  {['AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET'].map(env => (
                    <div key={env} className="text-[10px] font-mono text-sky-300 bg-sky-900/40 rounded px-2 py-0.5">
                      {env}
                    </div>
                  ))}
                  <div className="text-[9px] text-gray-500 leading-relaxed pt-1">
                    Single SP authenticates to both Cosmos DB and AI Foundry. Token refresh automatic.
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* ── Data flows summary ────────────────────────────── */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <RefreshCw className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-xs font-semibold text-gray-300">Key Data Flows</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <div className="text-[10px] text-indigo-400 font-semibold">Negotiation Lifecycle</div>
                <div className="text-gray-400 leading-relaxed">
                  POST /api/negotiations → Orchestrator → UCB1 selects group → EmailComposer drafts →
                  Cosmos stores → WS broadcasts <code className="text-amber-400">approval_needed</code> →
                  Human approves → stage advances → ResponseAnalyzer classifies reply → UCB1 reward updated
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] text-violet-400 font-semibold">RL Feedback Loop</div>
                <div className="text-gray-400 leading-relaxed">
                  UCB1 selects arm A/B/C → negotiation runs → outcome (accepted/rejected/counter) →
                  reward computed (0.0–1.5) → Q(a) ← Q(a) + (1/N) × (r − Q(a)) →
                  persisted to <code className="text-blue-400">rl_state</code> → winning arms selected more frequently
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] text-sky-400 font-semibold">Real-Time Push</div>
                <div className="text-gray-400 leading-relaxed">
                  Backend WS broadcast → Frontend useWebSocket callback →
                  React Query <code className="text-sky-400">invalidateQueries</code> →
                  bell badge, negotiation list, and detail panel all refresh live — no polling required
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] text-emerald-400 font-semibold">Eligibility Engine</div>
                <div className="text-gray-400 leading-relaxed">
                  Rule templates stored as JSON in Cosmos → backend compiles dynamic Cosmos SQL WHERE clause →
                  vendors filtered at query time → eligible vendors auto-started by 60s background task.
                  Rules changeable by business users — no code deploys.
                </div>
              </div>
            </div>
          </div>

        </div>{/* end diagram column */}

        {/* Detail panel */}
        {detail && (
          <DetailPanel detail={detail} onClose={() => setSelected(null)} />
        )}

      </div>
    </div>
  )
}
