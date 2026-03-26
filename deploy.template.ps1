<#
.SYNOPSIS
    Deploy the Negotiations app (FastAPI + React SPA) to Azure App Service
    using a single Docker container image hosted in Azure Container Registry.

.DESCRIPTION
    This script:
      1. Creates a Resource Group (if it does not exist)
      2. Creates an Azure Container Registry (ACR)
      3. Builds the Docker image via ACR Tasks (cloud build - no local Docker required)
      4. Creates an App Service Plan (Linux)
      5. Creates an App Service (Web App for Containers)
      6. Configures all application settings (env vars / secrets)

.PREREQUISITES
    - Azure CLI installed: https://learn.microsoft.com/en-us/cli/azure/install-azure-cli
    - Already logged in to Azure CLI: az login
    - A Service Principal with Contributor rights on your subscription:
        az ad sp create-for-rbac --name negotiations-sp --role Contributor --scopes /subscriptions/<sub-id>
    - Copy this file to deploy.ps1 and fill in all REQUIRED values before running.

.EXAMPLE
    .\deploy.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ---------------------------------------------------------------------------
# CONFIGURATION - fill in every REQUIRED value before running
# ---------------------------------------------------------------------------

# Azure Resource Group
$ResourceGroup  = "rg-negotiations"         # change to your resource group name
$Location       = "eastus"                  # Azure region

# Azure Container Registry (globally unique, lowercase alphanumeric, 5-50 chars)
$AcrName        = ""                        # REQUIRED - e.g. "mycompanynegotiationsacr"

# App Service
$AppServicePlan = "asp-negotiations"
$WebAppName     = ""                        # REQUIRED - globally unique, e.g. "mycompany-negotiations"
                                            # becomes https://<WebAppName>.azurewebsites.net
$Sku            = "P1v3"                    # B1=dev/test  P1v3=production

# Docker image tag
$ImageTag = "negotiations:latest"

# ---------------------------------------------------------------------------
# Azure Identity (Service Principal)
# Get these from: az ad sp create-for-rbac --name negotiations-sp --role Contributor --scopes /subscriptions/<sub-id>
# ---------------------------------------------------------------------------
$AzureTenantId       = ""    # REQUIRED - Directory (tenant) ID
$AzureClientId       = ""    # REQUIRED - Application (client) ID
$AzureClientSecret   = ""    # REQUIRED - Client secret value
$AzureSubscriptionId = ""    # REQUIRED - Azure subscription ID

# ---------------------------------------------------------------------------
# Azure OpenAI
# Get from: Azure Portal > your OpenAI resource > Keys and Endpoint
# ---------------------------------------------------------------------------
$OpenAiEndpoint       = ""   # REQUIRED - e.g. https://<resource>.openai.azure.com/
$OpenAiApiKey         = ""   # REQUIRED
$OpenAiApiVersion     = "2024-10-21"
$OpenAiDeploymentName = "chat4o"            # your model deployment name

# ---------------------------------------------------------------------------
# Azure AI Foundry
# Get from: Azure AI Foundry portal > your project > Overview
# ---------------------------------------------------------------------------
$FoundryProjectEndpoint     = ""    # REQUIRED - e.g. https://<name>.services.ai.azure.com/api/projects/<project>
$FoundryModelDeploymentName = "chat4o"
$FoundryApiVersion          = "2025-05-15-preview"
$FoundryAgentName           = "negotiations"
$FoundryResponseTimeoutSecs = "180"

# ---------------------------------------------------------------------------
# Azure Cosmos DB (NoSQL)
# Get from: Azure Portal > your Cosmos DB account > Keys
# ---------------------------------------------------------------------------
$CosmosEndpoint         = ""    # REQUIRED - e.g. https://<account>.documents.azure.com:443/
$NegotiationsDb         = "negotiations"
$VendorsContainer       = "vendors"
$NegotiationsContainer  = "negotiations"
$EmailsContainer        = "email_threads"
$RlContainer            = "rl_state"
$RuleTemplatesContainer = "rule_templates"
$SettingsContainer      = "agent_settings"

# ---------------------------------------------------------------------------
# Merchandising Leader Persona
# ---------------------------------------------------------------------------
$MerchLeaderName    = "Jane Doe"
$MerchLeaderTitle   = "VP of Vendor Relations"
$MerchLeaderEmail   = "jane.doe@yourcompany.com"
$MerchLeaderCompany = "Your Company"
$MerchLeaderPhone   = "(555) 000-0000"

# ---------------------------------------------------------------------------
# VALIDATION
# ---------------------------------------------------------------------------
$Required = @{
    "AcrName"                = $AcrName
    "WebAppName"             = $WebAppName
    "AzureTenantId"          = $AzureTenantId
    "AzureClientId"          = $AzureClientId
    "AzureClientSecret"      = $AzureClientSecret
    "AzureSubscriptionId"    = $AzureSubscriptionId
    "OpenAiEndpoint"         = $OpenAiEndpoint
    "OpenAiApiKey"           = $OpenAiApiKey
    "CosmosEndpoint"         = $CosmosEndpoint
    "FoundryProjectEndpoint" = $FoundryProjectEndpoint
}
foreach ($key in $Required.Keys) {
    if ([string]::IsNullOrWhiteSpace($Required[$key])) {
        Write-Error "Missing required value: $key - edit deploy.ps1 and fill it in."
    }
}

# ---------------------------------------------------------------------------
# DEPLOYMENT
# ---------------------------------------------------------------------------

Write-Host "`n==> Setting active subscription..." -ForegroundColor Cyan
az account set --subscription $AzureSubscriptionId

Write-Host "`n==> Creating Resource Group: $ResourceGroup ($Location)..." -ForegroundColor Cyan
az group create --name $ResourceGroup --location $Location --output none

# Container Registry
Write-Host "`n==> Creating Azure Container Registry: $AcrName..." -ForegroundColor Cyan
az acr create `
    --name           $AcrName `
    --resource-group $ResourceGroup `
    --sku            Basic `
    --admin-enabled  true `
    --output         none

# Cloud build - no local Docker needed
Write-Host "`n==> Building and pushing image via ACR Tasks (cloud build)..." -ForegroundColor Cyan
Write-Host "    This uploads the repo context to Azure and builds there."
az acr build `
    --registry $AcrName `
    --image    $ImageTag `
    --file     Dockerfile `
    .

$AcrLoginServer = az acr show --name $AcrName --query loginServer --output tsv
$AcrPassword    = az acr credential show --name $AcrName --query "passwords[0].value" --output tsv

# App Service Plan
Write-Host "`n==> Creating App Service Plan: $AppServicePlan (SKU=$Sku)..." -ForegroundColor Cyan
az appservice plan create `
    --name           $AppServicePlan `
    --resource-group $ResourceGroup `
    --location       $Location `
    --is-linux `
    --sku            $Sku `
    --output         none

# Web App for Containers
Write-Host "`n==> Creating Web App: $WebAppName..." -ForegroundColor Cyan
az webapp create `
    --name           $WebAppName `
    --resource-group $ResourceGroup `
    --plan           $AppServicePlan `
    --runtime        "DOCKER|$AcrLoginServer/$ImageTag" `
    --output         none

# Registry credentials
Write-Host "`n==> Configuring container registry credentials..." -ForegroundColor Cyan
az webapp config container set `
    --name                            $WebAppName `
    --resource-group                  $ResourceGroup `
    --docker-custom-image-name        "$AcrLoginServer/$ImageTag" `
    --docker-registry-server-url      "https://$AcrLoginServer" `
    --docker-registry-server-user     $AcrName `
    --docker-registry-server-password $AcrPassword `
    --output                          none

# App Settings - these replace the .env file in production
Write-Host "`n==> Setting application configuration (env vars)..." -ForegroundColor Cyan

$AppUrl = "https://${WebAppName}.azurewebsites.net"

az webapp config appsettings set `
    --name           $WebAppName `
    --resource-group $ResourceGroup `
    --settings `
        AZURE_TENANT_ID="$AzureTenantId" `
        AZURE_CLIENT_ID="$AzureClientId" `
        AZURE_CLIENT_SECRET="$AzureClientSecret" `
        AZURE_SUBSCRIPTION_ID="$AzureSubscriptionId" `
        AZURE_OPENAI_ENDPOINT="$OpenAiEndpoint" `
        AZURE_OPENAI_API_KEY="$OpenAiApiKey" `
        AZURE_OPENAI_API_VERSION="$OpenAiApiVersion" `
        AZURE_OPENAI_CHAT_DEPLOYMENT_NAME="$OpenAiDeploymentName" `
        FOUNDRY_PROJECT_ENDPOINT="$FoundryProjectEndpoint" `
        FOUNDRY_MODEL_DEPLOYMENT_NAME="$FoundryModelDeploymentName" `
        FOUNDRY_API_VERSION="$FoundryApiVersion" `
        FOUNDRY_AGENT_NAME="$FoundryAgentName" `
        FOUNDRY_RESPONSE_TIMEOUT_SECONDS="$FoundryResponseTimeoutSecs" `
        COSMOSDB_ENDPOINT="$CosmosEndpoint" `
        NEGOTIATIONS_DB="$NegotiationsDb" `
        NEGOTIATIONS_VENDORS_CONTAINER="$VendorsContainer" `
        NEGOTIATIONS_CONTAINER="$NegotiationsContainer" `
        NEGOTIATIONS_EMAILS_CONTAINER="$EmailsContainer" `
        NEGOTIATIONS_RL_CONTAINER="$RlContainer" `
        NEGOTIATIONS_RULE_TEMPLATES_CONTAINER="$RuleTemplatesContainer" `
        NEGOTIATIONS_SETTINGS_CONTAINER="$SettingsContainer" `
        MERCH_LEADER_NAME="$MerchLeaderName" `
        MERCH_LEADER_TITLE="$MerchLeaderTitle" `
        MERCH_LEADER_EMAIL="$MerchLeaderEmail" `
        MERCH_LEADER_COMPANY="$MerchLeaderCompany" `
        MERCH_LEADER_PHONE="$MerchLeaderPhone" `
        CORS_ALLOWED_ORIGINS="$AppUrl" `
        FRONTEND_URL="$AppUrl" `
        WEBSITES_PORT="80" `
    --output none

# Cosmos DB firewall - allow access from Azure services (covers App Service outbound IPs)
Write-Host "`n==> Enabling Cosmos DB access from Azure services..." -ForegroundColor Cyan
$CosmosAccountName = ($CosmosEndpoint -replace "https://", "" -replace ".documents.azure.com.*", "")
az cosmosdb update `
    --name                   $CosmosAccountName `
    --resource-group         $ResourceGroup `
    --enable-virtual-network false `
    --output                 none

# Logging
Write-Host "`n==> Enabling application logging..." -ForegroundColor Cyan
az webapp log config `
    --name                     $WebAppName `
    --resource-group           $ResourceGroup `
    --docker-container-logging filesystem `
    --output                   none

# ---------------------------------------------------------------------------
# DONE
# ---------------------------------------------------------------------------
Write-Host "`nDeployment complete!" -ForegroundColor Green
Write-Host "    App URL   : $AppUrl" -ForegroundColor Yellow
Write-Host "    API health: $AppUrl/health" -ForegroundColor Yellow
Write-Host "    Logs      : az webapp log tail --name $WebAppName --resource-group $ResourceGroup"
Write-Host ""
Write-Host "To redeploy after a code change:" -ForegroundColor Cyan
Write-Host "    az acr build --registry $AcrName --image $ImageTag --file Dockerfile ."
Write-Host "    az webapp restart --name $WebAppName --resource-group $ResourceGroup"
