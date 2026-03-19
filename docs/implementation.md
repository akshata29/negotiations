# Implementation Details

## Backend — Python / FastAPI

### Application Bootstrap (`app/main.py`)

On startup, the application runs a `lifespan` context manager that:

1. Loads `.env` via `pydantic-settings` (`config.py`)
2. Bootstraps Cosmos DB containers (creates them if absent)
3. Loads RL arm state from Cosmos DB
4. Creates two Foundry agents (idempotent — skips if already exist):
   - `negotiation-email-composer`
   - `negotiation-response-analyzer`
5. Wires the WebSocket broadcast callback into the orchestrator
6. Launches the background polling task

```python
# Simplified startup sequence
async with lifespan(app):
    cosmos = CosmosService.get_instance()
    await cosmos.bootstrap()
    rl = RLService(cosmos)
    await rl.load()
    await bootstrap_agents()        # create Foundry agents
    asyncio.create_task(run_background_loop())
```

The orchestrator is a module-level singleton — a shared instance that holds references to both agents and the Cosmos service.

---

### Configuration (`app/config.py`)

All settings are `pydantic-settings` `BaseSettings` fields, loaded from `.env` at the repository root:

```python
class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )
    AZURE_TENANT_ID: str = ""
    AZURE_OPENAI_ENDPOINT: str = ""
    COSMOSDB_ENDPOINT: str = ""
    # ... etc.
```

Settings are cached via `@lru_cache` so the `.env` file is read exactly once. Access via `get_settings()`.

---

### Foundry Agent Integration (`agents/client.py`)

All agents share a single `AIProjectClient` instance authenticated with `ClientSecretCredential`:

```python
from azure.ai.projects import AIProjectClient
from azure.identity import ClientSecretCredential

_client: AIProjectClient | None = None

def get_client() -> AIProjectClient:
    global _client
    if _client is None:
        cred = ClientSecretCredential(
            tenant_id=settings.AZURE_TENANT_ID,
            client_id=settings.AZURE_CLIENT_ID,
            client_secret=settings.AZURE_CLIENT_SECRET,
        )
        _client = AIProjectClient(
            endpoint=settings.FOUNDRY_PROJECT_ENDPOINT,
            credential=cred,
        )
    return _client
```

Agents are invoked via the Conversations (Responses) API v2. A new conversation thread is created per call; responses are extracted from the `output_text` of the first output item.

#### Email Response Parsing

The email composer is instructed to reply with raw JSON (no markdown). However, GPT-4o occasionally wraps output in ` ```json ``` ` fences. The agents strip these defensively:

```python
text = text.strip()
if text.startswith("```"):
    text = re.sub(r"^```[a-z]*\n?", "", text)
    text = re.sub(r"\n?```$", "", text)
result = json.loads(text)
```

---

### Orchestrator State Machine (`agents/orchestrator.py`)

The orchestrator implements a deterministic state machine over the `NegotiationStage` enum. Transitions are explicit — no automatic progression except via defined handler functions.

**Stage→Handler mapping:**

| Incoming event | Current stage | Handler | Next stage |
|---|---|---|---|
| `submit_vendor_reply` | `contact_sent` | `_handle_contact_reply` | `contact_confirmed` or `contact_rejected` or `contact_replied` |
| `contact_confirmed` | — | auto-advance | `proposal_drafting → proposal_approval` |
| `submit_vendor_reply` | `proposal_sent` | `_handle_proposal_reply` | `agreed` or `rejected` or `counter_drafting` |
| `submit_vendor_reply` | `counter_sent` | `_handle_proposal_reply` | `agreed` or `rejected` or `escalated` |
| `approve_email` | `contact_approval` | approve handler | `contact_sent` |
| `approve_email` | `proposal_approval` | approve handler | `proposal_sent` |
| `approve_email` | `counter_approval` | approve handler | `counter_sent` |

**Concurrency note:** Each `NegotiationInDB` is fetched from Cosmos DB at the start of every operation, ensuring the handler always acts on the current state even if multiple background tasks are running.

---

### Reinforcement Learning (`services/rl.py`)

#### UCB1 Multi-Armed Bandit

The UCB1 algorithm balances exploration (trying under-sampled strategies) and exploitation (favouring known high-reward strategies).

**Score for arm `a`:**

$$\text{UCB1}(a) = Q(a) + 2.0 \times \sqrt{\frac{\ln N}{N_a}}$$

Where:
- $Q(a)$ — estimated mean reward for arm `a` (running average)
- $N$ — total trials across all arms
- $N_a$ — trials for arm `a`
- `2.0` — exploration constant (configured in code)

Unvisited arms receive `∞`, ensuring all three strategies are tried at least once before exploitation begins.

**Q-value update (incremental mean):**

$$Q(a) \leftarrow Q(a) + \frac{1}{N_a}(r - Q(a))$$

This is equivalent to a running mean without storing all historical rewards.

**Reward scale:**

| Outcome | Reward |
|---|---|
| Rejected on contact or first proposal | 0.0 |
| Partial improvement (counter, multi-round) | 0.5 |
| Full improvement accepted | 1.0 |
| First-round acceptance (efficiency bonus) | 1.5 |

For Group C (both metrics), partial success (one dimension achieved) yields ~0.5.

**State persistence:** Arm states are loaded from Cosmos `rl_state` on startup and saved after every `record_outcome()` call. Each arm is stored as a separate document (`id: arm_A`, `arm_B`, `arm_C`) with `/id` as the partition key.

---

### Cosmos DB Service (`services/cosmos.py`)

The service uses the async `azure-cosmos` SDK v4.9. All reads and writes are `async`/`await`. A module-level singleton is used to avoid creating multiple SDK clients.

**Container bootstrap:**

```python
await db.create_container_if_not_exists(
    id="vendors",
    partition_key=PartitionKey(path="/vendor_id"),
)
```

**Query patterns:**

All list queries use `enable_cross_partition_query=True` where the partition key is not known in advance (e.g., listing all negotiations in a stage). Point reads (by id + partition key) are used where possible for O(1) cost.

```python
# Point read (preferred)
item = await container.read_item(item=id, partition_key=vendor_id)

# Cross-partition query (used for dashboard/list views)
query = "SELECT * FROM c WHERE c.stage = @stage"
params = [{"name": "@stage", "value": stage}]
```

**Upsert pattern:** All write operations use `upsert_item()` so the same function handles both create and update without extra reads.

---

### Background Task (`background/tasks.py`)

The poller runs as an `asyncio` task (not a thread). It uses `asyncio.sleep(60)` between cycles and handles exceptions per vendor so a single failure doesn't stop the loop.

```python
async def run_background_loop():
    await asyncio.sleep(30)  # startup grace period
    while True:
        try:
            await _auto_start_negotiations()  # up to 5 per cycle
            await _recover_stuck_negotiations()  # up to 10 per cycle
        except Exception as e:
            logger.warning("Background loop error: %s", e)
        await asyncio.sleep(60)
```

---

### Simulation Service (`services/simulation.py`)

Five hard-coded scenarios drive negotiations to a deterministic outcome for demos and testing. Each scenario specifies:
- `vendor_reply_contact`: text for the contact verification reply
- `vendor_reply_proposal`: text for the proposal reply (optional)
- `vendor_reply_counter`: text for the counter-offer reply (optional)
- `outcome`: expected final stage

The simulation auto-approves all AI draft emails (skipping the human approval step) so a full round-trip can be demonstrated without manual intervention. All actions are logged to a structured `log` array returned in the response.

---

## Frontend — React / TypeScript

### State Management

All server state is managed by **TanStack React Query**. There is no global client-side state store (no Redux/Zustand). Each page component calls typed query hooks:

```typescript
const { data: vendors, isLoading } = useQuery({
  queryKey: ['vendors', { eligible }],
  queryFn: () => listVendors({ eligible_only: eligible }),
  staleTime: 30_000,
})
```

Mutations invalidate the relevant query keys on success:

```typescript
const approveMutation = useMutation({
  mutationFn: ({ id, body }) => approveEmail(id, body),
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ['negotiation', id] })
    qc.invalidateQueries({ queryKey: ['negotiations'] })
  },
})
```

### WebSocket Integration (`hooks/useWebSocket.ts`)

The hook registers a single WebSocket connection per browser session and distributes events via a callback. Page components register callbacks that invalidate specific query keys.

```typescript
useWebSocket((evt: WSEvent) => {
  const refresh = ['negotiation_started','email_sent','reply_received']
  if (refresh.includes(evt.event)) {
    qc.invalidateQueries({ queryKey: ['negotiations'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }
  if (evt.event === 'approval_needed') {
    qc.invalidateQueries({ queryKey: ['pending-approvals'] })
  }
})
```

Ping/pong keep-alive runs every 30 s to prevent proxy/load-balancer timeouts. On disconnect, the hook waits 3 s then reconnects.

### Email Thread Rendering (`components/negotiations/EmailThread.tsx`)

The email thread is rendered as a vertical timeline with two types of nodes:
- **Stage nodes** — coloured dots marking workflow stage transitions
- **Email cards** — outbound (blue) and inbound (gray) email messages

Phase banners divide the thread into logical sections:
- Phase 1: Contact Verification
- Phase 2: Negotiation Proposal
- Phase 3: Counter-Proposal
- Outcome

Outbound drafts show "AI Draft" and "Edited" badges. All timestamps are rendered in local time.

### A/B Testing Charts (`components/analytics/ABTestChart.tsx`)

Two Recharts visualisations:
- **Bar chart:** Success Rate (%) and Q-Value (%) side-by-side per group
- **Radar chart:** Five-axis comparison — Success Rate, Avg Reward, Q-Value, Trials (normalised), UCB1 Score

The recommended group (highest Q-value) receives a star badge. Charts re-render on each `getABStats()` query refresh.

---

## API Service (`frontend/src/services/api.ts`)

All API calls use a single Axios instance. The base URL defaults to `http://localhost:8000` for local development. All functions are typed with the interfaces from `src/types/index.ts`.

```typescript
const api = axios.create({ baseURL: 'http://localhost:8000' })

export const approveEmail = (
  id: string,
  body: { approved_by: string; edited_body?: string }
): Promise<Negotiation> =>
  api.post(`/api/negotiations/${id}/approve`, body).then(r => r.data)
```

---

## Type System (`frontend/src/types/index.ts`)

TypeScript interfaces mirror the backend Pydantic models exactly. Key types:

```typescript
type NegotiationStage =
  | 'contact_drafting' | 'contact_approval' | 'contact_sent'
  | 'contact_replied' | 'contact_confirmed' | 'contact_rejected'
  | 'proposal_drafting' | 'proposal_approval' | 'proposal_sent'
  | 'proposal_replied'
  | 'counter_drafting' | 'counter_approval' | 'counter_sent'
  | 'counter_replied'
  | 'agreed' | 'rejected' | 'escalated' | 'completed'

type ABGroup = 'A' | 'B' | 'C'

interface ProposedTerms {
  std_terms?: number
  term_days?: number
  net_days?: number
}

interface Negotiation {
  id: string
  vendor_id: number
  stage: NegotiationStage
  ab_group: ABGroup
  strategy: string
  original_std_terms: number
  proposed_terms: ProposedTerms
  agreed_terms?: ProposedTerms
  rounds: number
  improvement_score?: number
  emails?: EmailMessage[]
}
```

---

## Scripts

### `generate_synthetic_data.py` (`backend/scripts/`)

CLI script that calls `SyntheticService.generate_synthetic_vendors(count)`. Used by `generate_data.bat`.

```bash
python -m scripts.generate_synthetic_data --count 200
```

### Batch Files (Windows)

| Script | Purpose |
|---|---|
| `setup_venv.bat` | Create `.venv`, install `requirements.txt` |
| `run_backend.bat` | Activate `.venv`, run `uvicorn app.main:app --reload --port 8000` |
| `run_frontend.bat` | `npm install` (if needed), `npm run dev` |
| `run_all.bat` | Start backend and frontend in separate windows |
| `generate_data.bat` | Run synthetic data generation script |
