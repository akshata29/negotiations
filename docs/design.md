# Design Decisions & Rationale

## Core Design Principles

1. **Human-in-the-loop by default** — No AI-generated email is sent without explicit human approval.
2. **Stateless agents, stateful orchestrator** — Foundry agents are stateless functions; all workflow state lives in Cosmos DB.
3. **Incremental learning** — The RL engine learns from every negotiation outcome and continuously improves strategy allocation.
4. **Separation of concerns** — Agent logic, business orchestration, persistence, and transport are kept in distinct modules.

---

## Key Design Decisions

### 1. Azure AI Foundry Agents (not direct OpenAI calls)

**Decision:** Email drafting and response analysis are implemented as named Foundry agents invoked via the Conversations API v2, rather than direct `openai` SDK completion calls.

**Rationale:**
- Foundry provides a managed execution environment with built-in tracing, versioning, and observability.
- Agent identity is decoupled from model deployment — the `chat4o` deployment can be swapped without changing orchestration code.
- The Conversations API provides a natural thread-per-call model that maps cleanly to individual email drafts.
- Future enhancement: agents can be extended with function tools (e.g., CRM lookup, approval tracking) without changing the orchestrator.

**Trade-off:** Foundry agent creation at startup adds a few seconds of latency. This is acceptable for a server-side application.

---

### 2. UCB1 Multi-Armed Bandit for Strategy Selection

**Decision:** Use UCB1 (Upper Confidence Bound 1) rather than a simpler approach (e.g., random assignment or fixed A/B split).

**Rationale:**
- Random assignment wastes allocations on provably inferior strategies once enough data is collected.
- Fixed A/B splits require manual analysis and re-configuration to shift allocation.
- UCB1 automatically balances exploration (trying under-sampled strategies) and exploitation (favouring known winners) with a single mathematical formula.
- The algorithm is simple to implement, has no hyperparameters beyond the exploration constant, and has provable sub-linear regret bounds.
- Q-values are stored in Cosmos DB, so learning persists across restarts and deployments.

**Trade-off:** UCB1 assumes stationary reward distributions. In practice, vendor populations and market conditions shift over time. A more sophisticated approach (e.g., sliding-window UCB or Thompson sampling) could adapt faster to distributional shifts, but UCB1 is sufficient for the current scale.

---

### 3. Three Negotiation Strategies (A, B, C)

**Decision:** Three distinct strategies rather than a continuous parameter space.

**Rationale:**
- Real-world vendor negotiations involve discrete asks (cash discount vs. term days vs. both).
- Three arms are manageable with UCB1; the bandit needs enough trials per arm to produce reliable estimates.
- Each arm maps to a concrete email template prompt, making AI-generated content predictable and auditable.
- Group C (both improvements) has a higher ceiling but also higher resistance, making the exploration/exploitation trade-off genuinely interesting.

**Trade-off:** Course-grained strategies miss vendor-segment-specific optimisations (e.g., different term-day increments per category). This could be addressed in a future version with contextual bandits.

---

### 4. 18-Stage Explicit State Machine

**Decision:** Model the negotiation as an explicit enum of 18 named stages rather than a simpler status field (e.g., `in_progress`, `done`).

**Rationale:**
- Each stage has distinct business meaning and requires different UI presentation and backend actions.
- Explicit stages make the orchestrator code auditable — every transition is a named function call, not implicit logic.
- Granular stages allow the background recovery task to identify and restart specific failure points (e.g., `contact_drafting` means the email was never drafted — retry from that exact point).
- The 18-stage model maps directly to the frontend WorkflowTimeline component, providing users with precise visibility.

**Trade-off:** More stages mean more `if stage == ...` branches in the orchestrator. This is justified by the auditability and debugging benefit.

---

### 5. Human Approval as a First-Class Feature

**Decision:** Every outbound email requires explicit `POST /api/negotiations/{id}/approve` before it is marked as sent.

**Rationale:**
- Legal and reputational risk — AI-drafted emails go to external vendors on behalf of a named executive. Errors cannot be recalled.
- The human reviewer can edit the body before sending. The system records whether editing occurred (`human_edited=true`), enabling future analysis of how often AI drafts are modified.
- The approval gate also prevents runaway automation in case of AI model degradation or unexpected outputs.

**Trade-off:** Approval requirements slow down the pipeline. For fully automated demo runs, the simulation service bypasses approval (auto-approves), making it clear that the human gate is a business choice, not a technical constraint.

---

### 6. Azure Cosmos DB NoSQL (over relational DB)

**Decision:** Use Cosmos DB NoSQL for all persistence rather than PostgreSQL or Azure SQL.

**Rationale:**
- Vendor and negotiation data is document-oriented; JSON documents map naturally to Pydantic models without an ORM or migration tooling.
- Partition key design (vendors by `/vendor_id`, negotiations by `/vendor_id`, emails by `/negotiation_id`) enables O(1) point reads for the most common access patterns.
- Cosmos DB's serverless or autoscale throughput model suits the variable, bursty write patterns of an autonomous negotiation pipeline.
- The same Azure identity (Service Principal) authenticates to both Cosmos DB and AI Foundry, simplifying credential management.

**Trade-off:** Cosmos DB NoSQL does not support multi-document transactions or joins. This is managed by careful document design (each negotiation is self-contained) and eventual-consistency patterns in the orchestrator.

---

### 7. WebSocket for Real-Time Updates (not polling)

**Decision:** Use a WebSocket connection from the frontend to receive push events rather than polling the REST API.

**Rationale:**
- Negotiation stages advance asynchronously (vendor reply analysed, background task starts a negotiation). Polling would either miss events or hammer the API.
- WebSocket events trigger targeted React Query cache invalidations, keeping UI fresh without a full page reload.
- Implementation is lightweight — a single `ConnectionManager` broadcasts to all connected clients; no pub/sub infrastructure is required.

**Trade-off:** The current implementation is single-process (in-memory connection list). A multi-process deployment (e.g., multiple Uvicorn workers) would require a shared pub/sub layer (e.g., Redis). This is acceptable for the current single-server deployment model.

---

### 8. Synthetic Data Generation

**Decision:** Include a built-in synthetic vendor generator rather than relying solely on the production Excel file.

**Rationale:**
- Development and testing should not depend on access to real vendor data.
- Realistic statistical distributions (log-normal YTD amounts, biased STD terms) mean the synthetic data exercises the eligibility rules and RL engine in a representative way.
- The UI exposes this directly (Vendors → Generate Synthetic Data slider), making it easy to populate a fresh environment.

---

### 9. Pydantic v2 for All Data Models

**Decision:** All backend models use Pydantic v2 `BaseModel` and `pydantic-settings`.

**Rationale:**
- Pydantic v2 provides ~5–10× validation performance improvement over v1.
- `model_dump()` and `model_validate()` produce clean JSON serialisable dicts that round-trip through Cosmos DB without custom serialisers.
- `pydantic-settings` eliminates boilerplate environment variable parsing and provides type-safe access to all config.

---

### 10. Separation of Agent Prompts from Orchestration Logic

**Decision:** Agent system prompts and output schemas are defined inside the agent modules (`agents/email_composer.py`, `agents/response_analyzer.py`), not in the orchestrator.

**Rationale:**
- Prompt engineering is iterative and should be versioned independently of business logic.
- The orchestrator calls `email_composer.draft_proposal_email(vendor, neg)` — it does not know or care about the prompt text.
- This makes it straightforward to A/B test prompt variants or upgrade models by changing the agent module only.

---

## Known Limitations & Future Work

| Area | Current Limitation | Potential Enhancement |
|---|---|---|
| Multi-process WebSocket | Single Uvicorn process | Add Redis pub/sub for horizontal scaling |
| RL stationarity | UCB1 assumes stable reward distribution | Sliding-window UCB or Thompson sampling |
| Strategy granularity | Three static groups | Contextual bandits using vendor features |
| Authentication | Service Principal only | Add per-user Azure AD auth for approval tracking |
| Email transport | Simulated (no SMTP) | Integrate Microsoft Graph API for real email send |
| Error recovery | Basic stage-based retry | Dead-letter queue + explicit retry counts |
| Observability | Python `logging` | Azure Monitor / Application Insights traces |
