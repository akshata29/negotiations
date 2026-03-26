# Deployment Guide — New Subscription / Tenant

This guide walks through deploying the Autonomous Negotiations solution from scratch into a **new Azure subscription or tenant**. All steps are performed manually via the Azure Portal and a local terminal. No automation scripts are required.

---

## Prerequisites

| Requirement | Version / Notes |
|---|---|
| Python | 3.11 or later |
| Node.js | 18 or later |
| Azure CLI | Latest (`az --version`) — used to verify access only |
| Azure subscription | Contributor or Owner on the target subscription |

---

## Overview of Azure Services Required

| Service | Purpose | Authentication needed |
|---|---|---|
| **Microsoft Entra ID App Registration** (Service Principal) | Application identity used by the backend | Tenant ID, Client ID, Client Secret |
| **Azure AI Foundry** (AI Services + Hub + Project) | Hosts the two negotiation agents (email_composer, response_analyzer) backed by GPT-4o | Service Principal must have **Azure AI Developer** role on the Foundry project |
| **Azure OpenAI** | GPT-4o model deployed inside Foundry | Accessed through Foundry — no separate key needed when using the Service Principal |
| **Azure Cosmos DB (NoSQL)** | Persists all vendors, negotiations, email threads, RL state, templates, and settings | Service Principal must have **Cosmos DB Built-in Data Contributor** role on the account |

---

## Step 1 — Create a Service Principal (App Registration)

The backend process authenticates to both Foundry and Cosmos DB using a **single Service Principal** (Client Credentials flow). This is the most important step because every subsequent RBAC assignment targets this identity.

1. Open the [Azure Portal](https://portal.azure.com) and navigate to **Microsoft Entra ID → App registrations → New registration**.
2. Name it something meaningful, e.g. `negotiations-backend`.
3. Leave **Supported account types** as *Accounts in this organizational directory only (Single tenant)*.
4. Click **Register**.
5. On the app overview page, copy and save:
   - **Application (client) ID** → this is `AZURE_CLIENT_ID`
   - **Directory (tenant) ID** → this is `AZURE_TENANT_ID`
6. Navigate to **Certificates & secrets → Client secrets → New client secret**.
7. Set a description and an expiry that fits your security policy, then click **Add**.
8. Copy the **Value** immediately — it is only shown once. This is `AZURE_CLIENT_SECRET`.

> **Security note:** Store the client secret in a secrets manager (Azure Key Vault, or your CI/CD secret store). Never commit it to source control.

---

## Step 2 — Provision Azure Cosmos DB (NoSQL)

### 2a. Create the account

1. In the Portal, go to **Create a resource → Azure Cosmos DB → Azure Cosmos DB for NoSQL**.
2. Choose your **subscription**, **resource group**, and a globally unique **account name**.
3. Select your preferred region. Capacity mode can be **Serverless** (good for dev/demo) or **Provisioned throughput** (production).
4. Complete the wizard and click **Review + Create → Create**.
5. When deployment finishes, open the account and copy the **URI** from the *Overview* pane.  
   This is `COSMOSDB_ENDPOINT` (format: `https://<account-name>.documents.azure.com:443/`).

### 2b. Grant the Service Principal access

The backend uses `azure-identity` **without a Cosmos DB key** — it relies entirely on the Service Principal credential via Microsoft Entra ID.

> **Important:** The **Cosmos DB Built-in Data Contributor** role is a Cosmos DB **data-plane** role and is **not visible in the Azure Portal IAM blade**. It must be assigned using the Azure CLI.

Collect the following values first:

| Value | Where to find it |
|---|---|
| `<cosmos-account-name>` | Cosmos DB account → Overview → Account Name |
| `<resource-group>` | Cosmos DB account → Overview → Resource group |
| `<spn-object-id>` | Microsoft Entra ID → App registrations → `negotiations-backend` → Overview → **Object ID** |

Then run:

```bash
az cosmosdb sql role assignment create \
  --account-name <cosmos-account-name> \
  --resource-group <resource-group> \
  --role-definition-name "Cosmos DB Built-in Data Contributor" \
  --principal-id <spn-object-id> \
  --scope "/"
```

> Use the app registration's **Object ID**, not the Application (client) ID. The `--scope "/"` covers all databases and containers on the account.

### 2c. Database and containers

The application **creates the database and all containers automatically** on first startup via the `CosmosService.bootstrap()` method. You do **not** need to create them manually. The containers that will be created are:

| Container | Partition key | Purpose |
|---|---|---|
| `vendors` | `/vendor_id` | Vendor master data |
| `negotiations` | `/negotiation_id` | Negotiation workflow state |
| `email_threads` | `/negotiation_id` | All email threads |
| `rl_state` | `/id` | UCB1 reinforcement learning state |
| `rule_templates` | `/id` | Filtering rule templates |
| `agent_settings` | `/id` | Agent system prompts and model settings |

---

## Step 3 — Provision Azure AI Foundry

Azure AI Foundry is the platform that hosts the two AI agents. It requires an **AI Services resource**, an **AI Hub**, and a **Project** inside that hub.

### 3a. Create an AI Services resource (Azure OpenAI)

1. Go to **Create a resource → Azure AI Services → Azure OpenAI**.
2. Select your subscription and resource group.
3. Choose a region that supports **GPT-4o** (e.g., East US, Sweden Central, or Australia East).
4. Complete the wizard and create the resource.

### 3b. Deploy the GPT-4o model

1. Open the newly created Azure OpenAI resource.
2. Click **Go to Azure AI Foundry portal** (or navigate to [ai.azure.com](https://ai.azure.com)).
3. In the Foundry portal, select the resource and go to **Deployments → Deploy model → Deploy base model**.
4. Search for **gpt-4o**, select it, and click **Confirm**.
5. For **Deployment name**, enter exactly `chat4o` (this matches `FOUNDRY_MODEL_DEPLOYMENT_NAME` and `AZURE_OPENAI_CHAT_DEPLOYMENT_NAME` in the config).
6. Set your tokens-per-minute quota and click **Deploy**.

### 3c. Create an AI Hub and Project

1. In [ai.azure.com](https://ai.azure.com), click **+ New project**.
2. If prompted, create a **new hub** first (hubs group projects and billing).  
   - Link the Azure OpenAI resource you created above as a connected resource.
3. Give the project a name, e.g. `negotiations-project`.
4. After creation, go to **Project settings → Overview** and copy the **Project endpoint**.  
   This is `FOUNDRY_PROJECT_ENDPOINT` (format: `https://<project-name>.<region>.api.azureml.ms`).

### 3d. Grant the Service Principal access to the Foundry project

1. In the [Azure Portal](https://portal.azure.com), locate the **AI Hub** resource (not the project — the hub is the ARM resource).
2. Go to **Access control (IAM) → Add role assignment**.
3. Select the **Azure AI Developer** role.
4. Assign it to the `negotiations-backend` service principal.
5. Click **Review + assign**.

> The **Azure AI Developer** role grants the Service Principal permission to create and run agents, create threads, and submit messages within any project under that hub.

### 3e. Agent bootstrapping (automatic)

You do **not** need to manually create agents in the Foundry portal. On every backend startup, `main.py` calls `project.agents.create_version()` for both:

- `negotiation-email-composer` — drafts outbound negotiation emails as James Caldwell
- `negotiation-response-analyzer` — classifies vendor replies and extracts counter-terms

The agents are created (or a new version is created if settings have changed) using the system prompts stored in Cosmos DB.

---

## Step 4 — Configure the Backend Environment

1. In the `backend/` folder, copy the example env file (or create `backend/.env` from scratch):
   ```
   backend/.env
   ```

2. Populate every variable — see the table below for what each value maps to:

```ini
# ── Azure Identity ────────────────────────────────────────────────────────────
AZURE_TENANT_ID=<Directory (tenant) ID from Step 1>
AZURE_CLIENT_ID=<Application (client) ID from Step 1>
AZURE_CLIENT_SECRET=<Client secret value from Step 1>
AZURE_SUBSCRIPTION_ID=<Your Azure subscription ID>

# ── Azure OpenAI (used for reference; actual calls go through Foundry) ────────
AZURE_OPENAI_ENDPOINT=<Azure OpenAI resource endpoint, e.g. https://<name>.openai.azure.com/>
AZURE_OPENAI_API_KEY=<Azure OpenAI key (optional if using Foundry credential)>
AZURE_OPENAI_API_VERSION=2024-10-21
AZURE_OPENAI_CHAT_DEPLOYMENT_NAME=chat4o

# ── Azure AI Foundry ──────────────────────────────────────────────────────────
FOUNDRY_PROJECT_ENDPOINT=<Project endpoint from Step 3c>
FOUNDRY_MODEL_DEPLOYMENT_NAME=chat4o
FOUNDRY_API_VERSION=2025-05-15-preview
FOUNDRY_AGENT_NAME=negotiation_orchestrator
FOUNDRY_RESPONSE_TIMEOUT_SECONDS=180

# ── Cosmos DB ─────────────────────────────────────────────────────────────────
COSMOSDB_ENDPOINT=<Cosmos DB URI from Step 2a>
NEGOTIATIONS_DB=negotiations
NEGOTIATIONS_VENDORS_CONTAINER=vendors
NEGOTIATIONS_CONTAINER=negotiations
NEGOTIATIONS_EMAILS_CONTAINER=email_threads
NEGOTIATIONS_RL_CONTAINER=rl_state
NEGOTIATIONS_RULE_TEMPLATES_CONTAINER=rule_templates
NEGOTIATIONS_SETTINGS_CONTAINER=agent_settings

# ── Merchandising Leader Persona ──────────────────────────────────────────────
MERCH_LEADER_NAME=James Caldwell
MERCH_LEADER_TITLE=VP of Vendor Relations & Merchandising
MERCH_LEADER_EMAIL=james.caldwell@abc.com
MERCH_LEADER_COMPANY=Company
MERCH_LEADER_PHONE=(254) 771-7500

# ── App ───────────────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
BACKEND_PORT=8000
FRONTEND_URL=http://localhost:5173
```

> If you are hosting the frontend at a different URL (e.g. a production domain), update `CORS_ALLOWED_ORIGINS` and `FRONTEND_URL` accordingly.

---

## Step 5 — Install Backend Dependencies and Start the Backend

```powershell
# From the repo root
setup_venv.bat         # Creates backend\.venv and installs requirements.txt

# Activate the virtual environment
backend\.venv\Scripts\Activate.ps1

# Start the API server (port 8000)
run_backend.bat
```

On first launch, watch the startup logs. You should see:

```
Starting Autonomous Negotiations Agent API
[CosmosService] bootstrapping database/containers...
[RLService] loaded RL state
Created agent negotiation-email-composer (version ...)
Created agent negotiation-response-analyzer (version ...)
Application startup complete.
```

If you see authentication errors here, verify the RBAC assignments from Steps 2b and 3d have had time to propagate (Azure RBAC can take 2–5 minutes).

---

## Step 6 — Install Frontend Dependencies and Start the Frontend

```powershell
# From the repo root
run_frontend.bat
```

Or manually:

```powershell
cd frontend
npm install
npm run dev
```

The Vite dev server starts on `http://localhost:5173`. It proxies `/api/*` and `/ws` to `http://localhost:8000`, so no additional CORS configuration is needed for local development.

Open a browser and navigate to `http://localhost:5173`.

---

## Step 7 — Generate Test Data (Optional)

```powershell
generate_data.bat
```

This runs the synthetic vendor generation script and seeds the Cosmos DB `vendors` container with realistic test data. Vendors will be assigned eligibility scores and can immediately be used to start negotiations.

---

## Authentication Flow Summary

```
Backend Process
     │
     │  ClientSecretCredential(tenant_id, client_id, client_secret)
     │         (azure-identity library — no user interaction)
     ↓
Microsoft Entra ID
     │
     ├─→ Token scoped to Cosmos DB (https://cosmos.azure.com/.default)
     │        Used by: CosmosService  →  azure-cosmos SDK
     │
     └─→ Token scoped to Azure AI (https://ml.azure.com/.default)
              Used by: AIProjectClient  →  azure-ai-projects SDK
                         ├─ Foundry Agents API (create, run, message)
                         └─ Azure OpenAI (GPT-4o via Foundry endpoint)
```

The frontend has **no Azure credentials** — it communicates only with the FastAPI backend via HTTP and WebSocket. All Azure calls are backend-only.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `ClientAuthenticationError` on startup | Wrong tenant/client ID or secret | Double-check `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` in `.env` |
| `403 Forbidden` on Cosmos DB calls | Missing RBAC role | Re-check Step 2b — ensure **Cosmos DB Built-in Data Contributor** is assigned to the correct service principal |
| `403 Forbidden` on Foundry calls | Missing RBAC role | Re-check Step 3d — ensure **Azure AI Developer** is assigned on the AI Hub resource |
| `ResourceNotFound` on agent creation | Wrong `FOUNDRY_PROJECT_ENDPOINT` | Verify the endpoint URL from Step 3c; it must include the full path |
| GPT-4o model not found | Deployment name mismatch | Confirm the deployment is named `chat4o` and that `FOUNDRY_MODEL_DEPLOYMENT_NAME=chat4o` |
| Frontend shows network error | Backend not running or wrong port | Confirm `run_backend.bat` is running and the Vite proxy target matches `BACKEND_PORT` |
| CORS error in browser | Origin not in allowed list | Add the frontend origin to `CORS_ALLOWED_ORIGINS` in `.env` and restart the backend |
| `RBAC propagation delay` | New role assignments take time | Wait 2–5 minutes after assigning roles before starting the backend |

---

## Cross-Tenant Considerations

If you are deploying into a **different Entra ID tenant** (not just a different subscription):

1. The App Registration in Step 1 must be created in the **target tenant** — you cannot reuse a service principal from the source tenant.
2. Your Azure admin account must have sufficient permissions in the target tenant to create app registrations and assign roles.
3. If the source tenant used **Conditional Access Policies** (e.g. requiring MFA for service principals), check whether the target tenant has similar policies that could block token issuance for client credentials flows.
4. The Foundry project endpoint URL will be different — always copy it from the target tenant's AI Hub/Project.
5. Cosmos DB connection string and keys are tenant-agnostic (they live in the subscription), but the RBAC data-plane roles must be re-assigned in the new subscription.

---

## Alternative Authentication — Managed Identity

Instead of a Service Principal with a client secret, this solution can authenticate to both **Azure Cosmos DB** and **Azure AI Foundry** using a Managed Identity — an Azure-managed credential attached to the compute resource running the backend. There is no secret to create, rotate, or accidentally leak.

> **Prerequisite:** Managed Identity requires the backend process to run on Azure-hosted compute (the identity token is injected by the Azure environment). It does **not** work for a plain local workstation. For local development, continue using a Service Principal (Step 1) or use `DefaultAzureCredential` with `az login` — details at the end of this section.

---

### Step MI-1 — Create a User-Assigned Managed Identity

A **User-Assigned** identity is independent of any single compute resource — it can be reattached after a redeployment without re-doing RBAC assignments.

1. In the Portal, go to **Create a resource → Managed Identity**.
2. Select your subscription and resource group, and give it a name, e.g. `negotiations-backend-mi`.
3. Click **Review + Create → Create**.
4. On the *Overview* page, copy the **Client ID** — you'll need it if you opt to target this identity explicitly in code.

---

### Step MI-2 — Grant the Managed Identity Access to Cosmos DB

> **Important:** The **Cosmos DB Built-in Data Contributor** role is a Cosmos DB **data-plane** role and is **not visible in the Azure Portal IAM blade**. It must be assigned using the Azure CLI.

First, collect the three values you'll need:

| Value | Where to find it |
|---|---|
| `<cosmos-account-name>` | Cosmos DB account → Overview → Account Name |
| `<resource-group>` | Cosmos DB account → Overview → Resource group |
| `<mi-principal-id>` | Managed Identity (`negotiations-backend-mi`) → Overview → **Principal ID** (not the Client ID) |

Then run the following Azure CLI command:

```bash
az cosmosdb sql role assignment create \
  --account-name <cosmos-account-name> \
  --resource-group <resource-group> \
  --role-definition-name "Cosmos DB Built-in Data Contributor" \
  --principal-id <mi-principal-id> \
  --scope "/"
```

The `--scope "/"` assigns the role at the account level, covering all databases and containers.

Verify the assignment was created:

```bash
az cosmosdb sql role assignment list \
  --account-name <cosmos-account-name> \
  --resource-group <resource-group> \
  --query "[].{Principal:principalId, Role:roleDefinitionId}" \
  --output table
```

---

### Step MI-3 — Grant the Managed Identity Access to Azure AI Foundry

Replace the SPN role assignment from Step 3d with the Managed Identity:

1. Open the AI Hub resource → **Access control (IAM) → Add role assignment**.
2. Select **Azure AI Developer**.
3. Set *Assign access to* → **Managed identity**.
4. Click **+ Select members**, filter by *User-assigned managed identity*, and select `negotiations-backend-mi`.
5. Click **Review + assign**.

---

### Code Changes Required (3 files)

The only authentication code in this solution lives in two files (`agents/client.py` and `services/cosmos.py`). Switching credential class is the entire change. No business logic, no SDK calls, and no other files need to change — `azure-cosmos` and `azure-ai-projects` both accept any credential that implements the `azure-identity` token protocol.

#### `backend/app/agents/client.py`

Authenticates to **Azure AI Foundry** (agent creation, thread execution, GPT-4o calls).

**Current code:**
```python
from azure.identity import ClientSecretCredential

credential = ClientSecretCredential(
    tenant_id=settings.AZURE_TENANT_ID,
    client_id=settings.AZURE_CLIENT_ID,
    client_secret=settings.AZURE_CLIENT_SECRET,
)
```

**Change to:**
```python
from azure.identity import ManagedIdentityCredential

# System-assigned MI:
credential = ManagedIdentityCredential()

# User-assigned MI (use the Client ID from Step MI-1):
# credential = ManagedIdentityCredential(client_id="<managed-identity-client-id>")
```

---

#### `backend/app/services/cosmos.py`

Authenticates to **Azure Cosmos DB**. This file uses the **async** variant from `azure.identity.aio`.

**Current code:**
```python
from azure.identity.aio import ClientSecretCredential

self._credential = ClientSecretCredential(
    tenant_id=settings.AZURE_TENANT_ID,
    client_id=settings.AZURE_CLIENT_ID,
    client_secret=settings.AZURE_CLIENT_SECRET,
)
```

**Change to:**
```python
from azure.identity.aio import ManagedIdentityCredential  # async variant

# System-assigned MI:
self._credential = ManagedIdentityCredential()

# User-assigned MI (use the Client ID from Step MI-1):
# self._credential = ManagedIdentityCredential(client_id="<managed-identity-client-id>")
```

> The existing `await self._credential.close()` call in `CosmosService` remains valid — `ManagedIdentityCredential` supports it.

---

#### `backend/app/config.py`

`AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, and `AZURE_CLIENT_SECRET` are no longer read at runtime. You can either remove them from the `Settings` class entirely, or leave the fields with empty defaults and simply omit them from `.env`. If using a user-assigned MI, you can repurpose `AZURE_CLIENT_ID` to hold the managed identity's client ID.

---

### Updated `.env` for Managed Identity

```ini
# ── Azure Identity (Managed Identity — no secret required) ───────────────────
# AZURE_TENANT_ID      ← remove or leave blank
# AZURE_CLIENT_ID      ← set to the managed identity Client ID only if passing it explicitly
# AZURE_CLIENT_SECRET  ← remove entirely
AZURE_SUBSCRIPTION_ID=<your subscription ID>

# All other settings (Foundry endpoint, Cosmos endpoint, persona, app) unchanged
```

---

### Authentication Flow (Managed Identity)

```
Backend Process (running on Azure-hosted compute)
     │
     │  ManagedIdentityCredential()
     │  azure-identity queries the Azure Instance Metadata Service
     │  — no tenant ID, client ID, or secret in code or .env
     ↓
Microsoft Entra ID  ←  Azure issues token for the MI identity
     │
     ├─→ Token scoped to Cosmos DB  (https://cosmos.azure.com/.default)
     │        CosmosService  →  azure-cosmos SDK (async)
     │
     └─→ Token scoped to Azure AI   (https://ml.azure.com/.default)
              AIProjectClient  →  azure-ai-projects SDK
                   ├─ Foundry Agents API (email_composer, response_analyzer)
                   └─ Azure OpenAI GPT-4o via Foundry endpoint
```

---

### Local Development Fallback

Managed Identity tokens are only available inside the Azure environment. For local development, use `DefaultAzureCredential` in place of `ManagedIdentityCredential` in both files:

```python
# agents/client.py  (sync)
from azure.identity import DefaultAzureCredential
credential = DefaultAzureCredential()

# services/cosmos.py  (async)
from azure.identity.aio import DefaultAzureCredential
self._credential = DefaultAzureCredential()
```

`DefaultAzureCredential` attempts credentials in order. The two relevant cases for this project are:

```
1. Managed Identity     ← when running on Azure-hosted compute
2. Azure CLI (az login) ← when running locally on a developer workstation
```

With this approach the same code runs in both environments — no `.env` swap needed. Developers run `az login` once and the credential resolves automatically.
