# Data Flow

## Overview

Data in this system flows through five distinct paths:
1. Vendor data ingestion (Excel or synthetic generation)
2. Negotiation lifecycle (the primary workflow)
3. Real-time UI updates via WebSocket
4. Reinforcement learning feedback loop
5. Human-in-the-loop approval

---

## 1. Vendor Ingestion

### From Excel

```
data/Sample File.xlsx
  │  (sheet: "Autonomous Negotiation")
  ▼
ingestion.py  →  parse rows (openpyxl)
  │              skip invalid rows
  │              create VendorInDB per row
  ▼
assess_eligibility()
  │  Rules:
  │  • comp == "MPN"
  │  • catg NOT IN {FRS, TOB, SEA}
  │  • status == "ACT"
  │  • ytd_purchase_amount > 0
  ▼
CosmosService.upsert_vendor()
  │  (preserves existing negotiation_status if already present)
  ▼
Cosmos DB  →  vendors container  (partition key: /vendor_id)
```

### Synthetic Data

```
POST /api/vendors/generate-synthetic  {count: N}
  ▼
synthetic.py
  │  Faker distributions:
  │  • comp: 80% MPN, 10% WPN, 10% TPN
  │  • status: 90% ACT, 10% INA
  │  • ytd amounts: log-normal (realistic spend skew)
  │  • std_terms: biased 0–3%
  │  • email: ~70% present
  ▼
assess_eligibility()  →  CosmosService.upsert_vendor() (batches of 50)
  ▼
Cosmos DB  →  vendors container
```

---

## 2. Negotiation Lifecycle

### 2a. Auto-Start (Background Task, every 60 s)

```
background/tasks.py  (poll every 60 s)
  │
  ├── Query Cosmos: eligible_for_negotiation=true
  │                 negotiation_status='eligible'
  │                 no active_negotiation_id
  │   → up to 5 vendors per cycle
  │
  └── orchestrator.start_negotiation(vendor_id)
```

### 2b. Manual Start

```
POST /api/negotiations  {vendor_id, ab_group?}
  ▼
orchestrator.start_negotiation()
```

### Full Negotiation Flow

```
start_negotiation(vendor_id)
  │
  ├── Validate vendor exists + eligible
  ├── RLService.select_group()  →  AB group (A | B | C)
  ├── Build proposed_terms based on group strategy:
  │     A → std_terms = round(vendor_std + 1%, 2)  (target ≥2%)
  │     B → term_days +10, net_days +10
  │     C → both A and B improvements
  ├── Create NegotiationInDB  (stage: contact_drafting)
  ├── Update vendor  (negotiation_status: in_progress)
  ├── EmailComposer.draft_contact_email()  ──────────────┐
  │     Foundry API → GPT-4o → JSON {subject,body,rec.}  │
  ├── Create EmailThread  (status: pending_approval)      │  Azure AI
  ├── Update stage → contact_approval                     │  Foundry
  └── WS broadcast: "approval_needed"                    ─┘

  ════════════  HUMAN REVIEW  ════════════

POST /api/negotiations/{id}/approve  {approved_by, edited_body?}
  │
  ├── Load pending email
  ├── Apply human edits (if any), set human_edited=true
  ├── Update EmailThread: status → approved → sent
  ├── Update stage: contact_approval → contact_sent
  └── WS broadcast: "email_sent"

  ════════════  VENDOR REPLIES  ════════════

POST /api/negotiations/{id}/respond  {body, sender_name?}
  │
  ├── Store inbound EmailThread (direction: inbound, status: received)
  ├── ResponseAnalyzer.analyze_contact_reply(body)  ────────────────┐
  │     Foundry API → GPT-4o → JSON classification                  │  Azure AI
  │     {contact_status, sentiment, summary}                        │  Foundry
  └── _handle_contact_reply(analysis)                              ─┘
        │
        ├── contact_status == "confirmed"
        │     → stage: contact_confirmed
        │     → EmailComposer.draft_proposal_email()
        │     → stage: proposal_approval
        │     → WS broadcast: "approval_needed"
        │
        ├── contact_status == "rejected" | "redirected"
        │     → stage: contact_rejected  →  escalated
        │     → RLService.record_outcome(group, reward=0.0)
        │
        └── contact_status == "unclear"
              → stage: contact_replied  (await manual action)

  ════════════  PROPOSAL APPROVED & SENT  ════════════

  (same approve flow as contact email)
  stage → proposal_approval → proposal_sent

  ════════════  VENDOR PROPOSAL REPLY  ════════════

ResponseAnalyzer.analyze_proposal_reply(body)
  │  Output: {response_type, counter_terms, agreement_likelihood,
  │           recommended_action, sentiment, summary}
  └── _handle_proposal_reply(analysis)
        │
        ├── response_type == "accepted"
        │     → stage: agreed
        │     → agreed_terms = proposed_terms
        │     → improvement_score calculated
        │     → RLService.record_outcome(group, reward ≥ 1.0)
        │     → vendor: negotiation_status = completed
        │     → WS broadcast: reply_received
        │
        ├── response_type == "counter_offer"
        │     → Extract counter_terms from analysis
        │     → rounds += 1
        │     → EmailComposer.draft_counter_response()
        │     → stage: counter_approval
        │     → WS broadcast: "approval_needed"
        │
        ├── response_type == "rejected"
        │     → stage: rejected
        │     → RLService.record_outcome(group, reward=0.0)
        │     → vendor: negotiation_status = no_deal
        │
        └── response_type == "unclear"
              → stage: proposal_replied  (await manual action)

  ════════════  COUNTER-OFFER CYCLE  ════════════

  Mirrors proposal cycle:
  counter_approval → counter_sent → (vendor reply) → agreed | rejected | escalated
```

---

## 3. WebSocket Event Flow

```
Backend event                    Event name              Frontend action
─────────────────────────────────────────────────────────────────────
start_negotiation()              negotiation_started     Invalidate negotiations & dashboard queries
approval stage reached           approval_needed         Invalidate pending-approval count in Header
email approved & sent            email_sent              Invalidate negotiation detail & list
vendor reply analysed            reply_received          Invalidate negotiation detail & list
escalate endpoint called         negotiation_escalated   Invalidate negotiations & dashboard queries
```

**Connection lifecycle:**

```
Frontend (useWebSocket hook)
  │
  ├── Connect to ws://{host}/ws
  ├── Every 30 s: send "ping"  →  server responds "pong"
  ├── On disconnect: wait 3 s, reconnect
  └── On message: parse JSON, call registered callback

Backend (ConnectionManager)
  │
  ├── Accept connection, add to active list
  ├── On broadcast: send JSON to all active connections
  └── On send failure: remove dead connections
```

---

## 4. Reinforcement Learning Feedback Loop

```
start_negotiation()
  │
  ├── RLService.select_group()
  │     Load arm states from Cosmos DB (rl_state container)
  │     Compute UCB1 score for each arm:
  │       UCB1(a) = Q(a) + 2.0 × √(ln N_total / N_a)
  │     Return arm with highest score
  │     (unvisited arms → ∞ score, forced exploration first)
  │
  └── Assign AB group to negotiation

  ... (negotiation runs) ...

agreed | rejected | escalated
  │
  └── RLService.record_outcome(group, reward)
        Reward scale:
          0.0  → rejected on first contact or proposal
          0.5  → partial improvement (counter accepted, multi-round)
          1.0  → full improvement accepted
          1.5  → first-round acceptance (efficiency bonus)
          
        Incremental Q-value update:
          Q(a) ← Q(a) + (1 / N(a)) × (reward − Q(a))
        
        Save updated state → Cosmos DB (rl_state container)
```

**RL State Document (per arm, stored in Cosmos `rl_state`):**

```json
{
  "id": "arm_A",
  "group": "A",
  "strategy": "Request cash discount improvement (STD Terms ≥ 2%)",
  "total_trials": 42,
  "successes": 28,
  "total_reward": 31.5,
  "q_value": 0.75,
  "ucb1_score": 0.91,
  "last_reward": 1.0
}
```

---

## 5. Human-in-the-Loop Approval Flow

Every outbound email is gated behind human approval. No email transitions to `sent` without an explicit `POST /api/negotiations/{id}/approve` call.

```
EmailThread created (status: pending_approval)
  │
  │  Human opens Negotiation Detail page
  │  → "Review Email" button visible
  │  OR
  │  Header Approval Badge shows count > 0
  │  → click → filter Negotiations to pending-approval
  │
  ▼
ApprovalModal opens (3 tabs)
  │
  ├── Tab 1: Approve Email
  │     Display subject + body
  │     Optional edit → textarea
  │     "Approve & Send"
  │       → POST /api/negotiations/{id}/approve
  │          {approved_by: "...", edited_body?: "..."}
  │       → EmailThread.status: approved → sent
  │       → EmailThread.human_edited = true (if edited)
  │       → EmailThread.approved_by + approved_at recorded
  │
  ├── Tab 2: Submit Vendor Reply
  │     Paste vendor reply text
  │     "Submit"
  │       → POST /api/negotiations/{id}/respond
  │          {body: "..."}
  │       → triggers AI analysis → stage advance
  │
  └── Tab 3: Escalate
        Notes textarea
        "Escalate"
          → POST /api/negotiations/{id}/escalate
             {notes: "..."}
          → stage: escalated
```

---

## Data Model Relationships

```
Vendor (vendors container)
  │  vendor_id → FK
  │
  └── Negotiation (negotiations container)
        │  id (negotiation_id) → FK
        │  vendor_id → partition key
        │
        └── EmailThread[] (email_threads container)
              negotiation_id → partition key
              direction: outbound | inbound
              status: draft | pending_approval | approved | sent | received

RLArmState (rl_state container)
  id: "arm_A" | "arm_B" | "arm_C"
  (independent of vendor/negotiation hierarchy)
```
