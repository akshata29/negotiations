# Customer Autonomous Negotiations

An AI-powered system that automates vendor payment-terms negotiations for Customer Company. The platform conducts multi-round email negotiations with vendors on behalf of James Caldwell (VP of Vendor Relations & Merchandising), optimising three financial metrics — cash discount percentage, term days, and net days — while keeping humans in the loop at every key decision point.

---

## What It Does

Customer manages thousands of vendor payment agreements. Improving these terms at scale requires systematically contacting each vendor, presenting proposals, interpreting replies, handling counter-offers, and closing agreements. This system automates that entire workflow:

1. **Vendor ingestion** — Import real vendor data from Excel or generate realistic synthetic data.
2. **Eligibility assessment** — Automatically determine which vendors qualify for re-negotiation based on comp type, category, activity, and YTD spend.
3. **AI-drafted emails** — Azure AI Foundry agents (backed by GPT-4o) draft outbound emails in the voice of the Customer negotiator persona.
4. **Human-in-the-loop approval** — Every outbound email is held for human review before sending; reviewers can edit the draft.
5. **Intelligent strategy selection** — A UCB1 multi-armed bandit (reinforcement learning) continuously identifies which of three negotiation strategies performs best and assigns that strategy to new negotiations.
6. **Automated response analysis** — Incoming vendor replies are analysed by a second Foundry agent which classifies the response and extracts any counter-terms.
7. **Workflow orchestration** — An 18-stage state machine drives each negotiation from first contact through to an agreed deal, rejection, or escalation.
8. **Real-time dashboard** — A React/TypeScript frontend shows live status via WebSockets, displays RL learning progress, and provides an email-thread viewer.

---

## Key Features

| Feature | Description |
|---|---|
| **Foundry Agent Integration** | Two purpose-built Azure AI Foundry agents: one for composing emails, one for analysing replies |
| **Reinforcement Learning** | UCB1 multi-armed bandit dynamically allocates vendors to the best-performing negotiation strategy |
| **A/B Testing** | Three strategies (A: cash discount, B: term days, C: both) measured across the vendor population |
| **Human Approval Workflow** | No email is sent without explicit human review; edits are recorded |
| **Simulation Mode** | Five scripted scenarios (quick win, counter-offer, tough negotiation, rejection, wrong contact) for demo and testing |
| **WebSocket Events** | Real-time UI updates for new negotiations, approvals needed, emails sent, and replies received |
| **Background Automation** | Poller auto-starts negotiations for eligible vendors and recovers stuck workflows every 60 s |

---

## Negotiation Strategies

| Group | Strategy | Target |
|---|---|---|
| **A** | Cash discount improvement | STD Terms ≥ 2% |
| **B** | Term days extension | +10 Term Days & Net Days |
| **C** | Combined | Both A and B improvements |

The RL engine learns which group delivers the highest reward per vendor segment and biases future assignments accordingly.

---

## Technology Stack

**Backend**
- Python 3.11 · FastAPI · Uvicorn
- Azure AI Foundry (GPT-4o agents via `azure-ai-projects` SDK v2)
- Azure Cosmos DB NoSQL (4 containers)
- Azure Identity (Service Principal auth)
- Pydantic v2 · pydantic-settings

**Frontend**
- React 18 · TypeScript · Vite
- TanStack React Query · React Router v6
- Tailwind CSS · Recharts · Lucide React

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- An Azure subscription with:
  - Azure AI Foundry project (GPT-4o deployment named `chat4o`)
  - Azure Cosmos DB NoSQL account
  - Service Principal with access to both

### Setup

```bash
# 1. Clone
git clone <repo-url>
cd negotiations

# 2. Configure environment
cp .env.example .env
# Edit .env with your Azure credentials

# 3. Install backend dependencies
setup_venv.bat

# 4. Run everything
run_all.bat
```

Or run services individually:

```bash
run_backend.bat   # FastAPI on http://localhost:8000
run_frontend.bat  # Vite dev server on http://localhost:5173
```

### Generate Test Data

```bash
generate_data.bat         # Import from data/Sample File.xlsx
# or use the UI: Vendors → Generate Synthetic Data
```

---

## Project Layout

```
backend/
  app/
    agents/       # Foundry agent wrappers (composer, analyzer, orchestrator)
    api/          # FastAPI routers (vendors, negotiations, ab_testing, ws)
    background/   # Auto-start & recovery polling task
    models/       # Pydantic data models (Vendor, Negotiation, EmailThread)
    services/     # Cosmos DB, RL, simulation, synthetic data, ingestion
  scripts/        # CLI data generation helper
frontend/
  src/
    components/   # Reusable UI components
    hooks/        # WebSocket hook
    pages/        # Dashboard, Vendors, Negotiations, NegotiationDetail, ABTesting
    services/     # Axios API client
    types/        # TypeScript interfaces
docs/
  architecture.md  # System architecture & component diagram
  data-flow.md     # End-to-end data flow & state transitions
  implementation.md # Implementation details & key algorithms
  design.md        # Design decisions & trade-offs
```

---

## Documentation

| Document | Contents |
|---|---|
| [docs/architecture.md](docs/architecture.md) | System architecture, component diagram, Azure service topology |
| [docs/data-flow.md](docs/data-flow.md) | End-to-end data flow, negotiation state machine, WebSocket events |
| [docs/implementation.md](docs/implementation.md) | Implementation details, RL algorithm, agent prompting, Cosmos DB schema |
| [docs/design.md](docs/design.md) | Design decisions, trade-offs, human-in-the-loop rationale |

---

## API Reference

With the backend running, interactive API docs are available at:

- **Swagger UI:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`
