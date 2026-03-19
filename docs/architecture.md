# Technical Architecture

## System Overview

Autonomous Negotiations is a full-stack AI application composed of three layers: a React single-page application, a FastAPI backend, and Azure cloud services. The backend orchestrates two Azure AI Foundry agents, persists all state in Azure Cosmos DB, and exposes REST and WebSocket endpoints to the frontend.

```
┌────────────────────────────────────────────────────────────────────┐
│                        Browser (React SPA)                         │
│  ┌──────────┐ ┌─────────────┐ ┌────────────┐ ┌────────────────┐  │
│  │Dashboard │ │  Vendors    │ │Negotiations│ │  A/B Testing   │  │
│  └──────────┘ └─────────────┘ └────────────┘ └────────────────┘  │
│              TanStack React Query · WebSocket (useWebSocket)        │
└───────────────────────────────┬────────────────────────────────────┘
                                │ HTTP / WebSocket
┌───────────────────────────────▼────────────────────────────────────┐
│                    FastAPI Backend (Python 3.11)                    │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  API Routers                                                   │ │
│  │  /api/vendors  /api/negotiations  /api/ab-testing  /ws        │ │
│  └────────────────────────────┬──────────────────────────────────┘ │
│  ┌─────────────────────────────▼────────────────────────────────┐  │
│  │  Orchestrator (state machine — 18 stages)                     │  │
│  └──────┬──────────────────────────────────┬────────────────────┘  │
│  ┌──────▼──────┐  ┌────────────────┐  ┌───▼──────────────────────┐│
│  │Email Composer│  │Response Analyzer│  │  RL Service (UCB1)      ││
│  │(Foundry Agent)│ │(Foundry Agent) │  │  Group selection & learn ││
│  └──────┬──────┘  └────────┬───────┘  └──────────────────────────┘│
│  ┌──────▼──────────────────▼───────────────────────────────────────┐│
│  │  Background Task (60 s poll) · Simulation Service · Ingestion   ││
│  └─────────────────────────────────────────────────────────────────┘│
└────────────┬───────────────────────────────┬───────────────────────┘
             │                               │
     ┌───────▼──────┐               ┌────────▼──────────────────┐
     │Azure Cosmos DB│               │  Azure AI Foundry          │
     │  NoSQL        │               │  (GPT-4o · chat4o deploy.) │
     │  4 containers │               │  Conversations API v2      │
     └───────────────┘               └───────────────────────────┘
             │
     ┌───────▼──────┐
     │Azure Identity │
     │(Service Princ)│
     └───────────────┘
```

---

## Component Breakdown

### Frontend

| Component | Technology | Responsibility |
|---|---|---|
| React SPA | React 18 + TypeScript + Vite | UI rendering and routing |
| TanStack React Query | `@tanstack/react-query` | Server state caching, background refetch, mutations |
| Axios API client | `src/services/api.ts` | Typed wrappers for every backend endpoint |
| WebSocket hook | `src/hooks/useWebSocket.ts` | Real-time event subscription with auto-reconnect |
| Recharts | `recharts` | Bar and radar charts for A/B testing metrics |
| Tailwind CSS | PostCSS + tailwind | Utility-first styling |

**Pages:**

| Page | Route | Purpose |
|---|---|---|
| Dashboard | `/` | KPIs, RL best strategy, pending approvals CTA |
| Vendors | `/vendors` | Vendor table, import Excel, generate synthetic data |
| Negotiations | `/negotiations` | Paginated list, pending-approval filter |
| Negotiation Detail | `/negotiations/:id` | Full workflow timeline, email thread, simulation panel |
| A/B Testing | `/ab-testing` | RL stats charts, UCB1 explanation, strategy cards |

---

### Backend — API Layer

All routers are mounted under the `/api` prefix. The FastAPI app is started with Uvicorn.

| Router | Module | Key Endpoints |
|---|---|---|
| Vendors | `api/vendors.py` | `GET /vendors`, `POST /vendors/import`, `POST /vendors/generate-synthetic` |
| Negotiations | `api/negotiations.py` | `GET /negotiations`, `POST /negotiations`, `POST /{id}/approve`, `POST /{id}/respond`, `POST /{id}/simulate` |
| A/B Testing | `api/ab_testing.py` | `GET /ab-testing/stats`, `GET /ab-testing/simulate` |
| WebSocket | `api/ws.py` | `WS /ws` (broadcast hub) |
| Dashboard | `main.py` | `GET /api/dashboard/stats` |

---

### Backend — Agent Layer

Two purpose-built Foundry agents are created on application startup and reused across all negotiations.

#### Email Composer (`negotiation-email-composer`)

- **Model:** GPT-4o (`chat4o` deployment)
- **Identity:** James Caldwell, VP of Vendor Relations & Merchandising
- **Inputs:** vendor data, negotiation context, AB group strategy, proposed terms
- **Output:** raw JSON `{ subject, body, recommendation }` — no markdown fences
- **Functions:**
  - `draft_contact_email()` — Initial verification of the right contact person
  - `draft_proposal_email()` — Present payment-term improvement proposal
  - `draft_counter_response()` — Reply to a vendor counter-offer

#### Response Analyzer (`negotiation-response-analyzer`)

- **Model:** GPT-4o (`chat4o` deployment)
- **Inputs:** vendor reply email text, negotiation context
- **Output:** structured JSON classification
- **Functions:**
  - `analyze_contact_reply()` — Was this the right person? `confirmed | rejected | redirected | unclear`
  - `analyze_proposal_reply()` — `accepted | rejected | counter_offer | unclear` + extracted counter-terms

---

### Backend — Orchestrator

`agents/orchestrator.py` is the central state machine. It:

- Creates and advances `NegotiationInDB` documents through 18 stages
- Calls the email composer and response analyzer at the appropriate stages
- Asks the RL service which AB group to assign (on negotiation start)
- Updates the RL service with outcome rewards (on deal close or rejection)
- Persists all changes to Cosmos DB via `CosmosService`
- Broadcasts WebSocket events via `ws_manager.broadcast()`

Stages are grouped into four phases:

| Phase | Stages |
|---|---|
| Contact | `contact_drafting → contact_approval → contact_sent → contact_replied → contact_confirmed / contact_rejected` |
| Proposal | `proposal_drafting → proposal_approval → proposal_sent → proposal_replied` |
| Counter | `counter_drafting → counter_approval → counter_sent → counter_replied` |
| Outcome | `agreed · rejected · escalated · completed` |

---

### Backend — Services

| Service | Module | Role |
|---|---|---|
| Cosmos DB | `services/cosmos.py` | Async Cosmos DB SDK wrapper; all DB I/O |
| Reinforcement Learning | `services/rl.py` | UCB1 bandit — group selection and Q-value updates |
| Simulation | `services/simulation.py` | Scripted end-to-end scenarios for demo/testing |
| Synthetic Data | `services/synthetic.py` | Random vendor generation with realistic distributions |
| Excel Ingestion | `services/ingestion.py` | Parse `data/Sample File.xlsx` into vendor records |

---

### Azure Services

| Service | Usage |
|---|---|
| **Azure AI Foundry** | Hosts two GPT-4o agents; accessed via Conversations API v2 (`azure-ai-projects` SDK) |
| **Azure Cosmos DB NoSQL** | Persists vendors, negotiations, email threads, RL state |
| **Azure Identity** | `ClientSecretCredential` (Service Principal) authenticates all Azure SDK calls |

---

## Database Schema

Four Cosmos DB containers, all in the `negotiations` database:

| Container | Partition Key | Description |
|---|---|---|
| `vendors` | `/vendor_id` | Vendor master data + eligibility + negotiation status |
| `negotiations` | `/vendor_id` | Negotiation documents with stage, AB group, terms |
| `email_threads` | `/negotiation_id` | All inbound and outbound emails per negotiation |
| `rl_state` | `/id` | UCB1 arm state for groups A, B, C |

---

## Deployment Topology

```
Local dev / on-prem server
├── run_backend.bat  →  uvicorn  :8000
├── run_frontend.bat →  vite dev  :5173
└── .env             →  Azure credentials

Azure
├── Foundry Project  →  chat4o GPT-4o deployment
└── Cosmos DB        →  negotiations database
```

Authentication uses a Service Principal (`AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`). No end-user identity delegation is required for the backend.
