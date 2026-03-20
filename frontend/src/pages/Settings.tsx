import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import {
  Bot, Cpu, Wand2, RefreshCw, Check, AlertCircle, Save,
  ChevronDown, ChevronUp, Users, Shield, Zap, Heart, BarChart2,
  Info, FlaskConical,
} from 'lucide-react'
import {
  getAgentSettings,
  updateAgentSettings,
  applyAgentSettings,
  getPersonalityPresets,
  getAvailableModels,
  getDefaultSettings,
  getPersonaInfo,
} from '../services/api'
import type { AgentSettings, PersonalityPreset } from '../types'

// ── Personality icon map ──────────────────────────────────────────────────────

const PRESET_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  collaborative: Users,
  firm: Shield,
  assertive: Zap,
  diplomatic: Heart,
  data_driven: BarChart2,
}

const PRESET_COLORS: Record<string, string> = {
  collaborative: 'text-blue-400',
  firm: 'text-amber-400',
  assertive: 'text-purple-400',
  diplomatic: 'text-pink-400',
  data_driven: 'text-emerald-400',
}

const PRESET_BORDER: Record<string, string> = {
  collaborative: 'border-blue-500 bg-blue-600/10',
  firm: 'border-amber-500 bg-amber-600/10',
  assertive: 'border-purple-500 bg-purple-600/10',
  diplomatic: 'border-pink-500 bg-pink-600/10',
  data_driven: 'border-emerald-500 bg-emerald-600/10',
}

// ── Alert banner component ────────────────────────────────────────────────────

function Alert({ type, message, onClose }: { type: 'success' | 'error'; message: string; onClose: () => void }) {
  return (
    <div
      className={clsx(
        'flex items-center gap-3 px-4 py-3 rounded-lg border text-sm',
        type === 'success'
          ? 'bg-emerald-900/40 border-emerald-600 text-emerald-300'
          : 'bg-red-900/40 border-red-600 text-red-300',
      )}
    >
      {type === 'success' ? <Check className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
      <span className="flex-1">{message}</span>
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100">✕</button>
    </div>
  )
}

// ── Settings page ─────────────────────────────────────────────────────────────

export function Settings() {
  const qc = useQueryClient()
  const [draft, setDraft] = useState<AgentSettings | null>(null)
  const [promptTab, setPromptTab] = useState<'email' | 'analyzer'>('email')
  const [modelOpen, setModelOpen] = useState(false)
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: current, isLoading } = useQuery({
    queryKey: ['agent-settings'],
    queryFn: getAgentSettings,
  })

  // Initialise draft from loaded data (once)
  useEffect(() => {
    if (current && !draft) setDraft(current)
  }, [current]) // eslint-disable-line react-hooks/exhaustive-deps

  const { data: presetsData } = useQuery({
    queryKey: ['personality-presets'],
    queryFn: getPersonalityPresets,
  })

  const { data: modelsData } = useQuery({
    queryKey: ['available-models'],
    queryFn: getAvailableModels,
  })

  const { data: personaData } = useQuery({
    queryKey: ['persona-info'],
    queryFn: getPersonaInfo,
  })

  const { data: defaults } = useQuery({
    queryKey: ['settings-defaults'],
    queryFn: getDefaultSettings,
  })

  // Sync draft when data first loads
  const activeDraft: AgentSettings | null = draft ?? current ?? null

  // ── Mutations ─────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: (data: Partial<AgentSettings>) => updateAgentSettings(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-settings'] })
      setAlert({ type: 'success', message: 'Settings saved successfully. Click "Apply to Agents" to push changes to live agents.' })
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      setAlert({ type: 'error', message: `Failed to save settings: ${msg}` })
    },
  })

  const applyMutation = useMutation({
    mutationFn: applyAgentSettings,
    onSuccess: (res) => {
      const versions = res.agents.map((a) => `${a.agent.split('-').pop()} v${a.version}`).join(', ')
      setAlert({ type: 'success', message: `Agents re-bootstrapped with model "${res.model}": ${versions}` })
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      setAlert({ type: 'error', message: `Failed to apply to agents: ${msg}` })
    },
  })

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handlePresetClick = useCallback(
    (preset: PersonalityPreset) => {
      setDraft((prev) => prev ? {
        ...prev,
        personality: preset.id,
        email_system_prompt: preset.generated_prompt,
      } : null)
    },
    [],
  )

  const handleSave = () => {
    if (!activeDraft) return
    saveMutation.mutate(activeDraft)
  }

  const handleSaveAndApply = async () => {
    if (!activeDraft) return
    try {
      await updateAgentSettings(activeDraft)
      qc.invalidateQueries({ queryKey: ['agent-settings'] })
      await applyAgentSettings()
      const fallbackVersions = 'email-composer & response-analyzer'
      setAlert({ type: 'success', message: `Settings saved and applied to live agents (${fallbackVersions}).` })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setAlert({ type: 'error', message: `Error during save & apply: ${msg}` })
    }
  }

  const handleReset = () => {
    if (defaults) {
      setDraft(defaults)
      setAlert({ type: 'success', message: 'Draft reset to factory defaults. Save to persist.' })
    }
  }

  if (isLoading || !activeDraft) {
    return (
      <div className="flex items-center justify-center h-48">
        <RefreshCw className="w-6 h-6 text-gray-500 animate-spin" />
        <span className="ml-2 text-gray-400">Loading settings…</span>
      </div>
    )
  }

  const presets: PersonalityPreset[] = presetsData?.presets ?? []
  const models = modelsData?.models ?? []
  const isBusy = saveMutation.isPending || applyMutation.isPending

  return (
    <div className="max-w-4xl space-y-5">
      {/* Alert */}
      {alert && (
        <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />
      )}

      {/* ── Section 1: AI Model ──────────────────────────────────────────── */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600/20 flex items-center justify-center">
            <Cpu className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">AI Model Configuration</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Azure AI Foundry deployment used for email drafting and response analysis
            </p>
          </div>
        </div>

        <div className="relative">
          <label className="block text-xs font-medium text-gray-400 mb-1.5">
            Deployment Name
          </label>
          <div className="relative">
            <input
              type="text"
              value={activeDraft.model_deployment_name}
              onChange={(e) => setDraft((d) => d ? { ...d, model_deployment_name: e.target.value } : null)}
              list="model-list"
              placeholder="e.g. chat4o"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <datalist id="model-list">
              {models.map((m) => (
                <option key={m.id} value={m.id} label={m.label} />
              ))}
            </datalist>
          </div>
          <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />
            Changes require "Save &amp; Apply" to take effect on live agents
          </p>
        </div>

        {/* Common model chips */}
        <div className="flex flex-wrap gap-2">
          {models.slice(0, 5).map((m) => (
            <button
              key={m.id}
              onClick={() => setDraft((d) => d ? { ...d, model_deployment_name: m.id } : null)}
              className={clsx(
                'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                activeDraft.model_deployment_name === m.id
                  ? 'border-blue-500 bg-blue-600/20 text-blue-300'
                  : 'border-gray-600 text-gray-400 hover:border-gray-500 hover:text-gray-300',
              )}
            >
              {m.id}
            </button>
          ))}
        </div>
      </div>

      {/* ── Section 2: Personality Presets ──────────────────────────────── */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-600/20 flex items-center justify-center">
            <Wand2 className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Email Personality</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Choose a negotiation style to auto-generate the email composer's persona
            </p>
          </div>
        </div>

        {presets.length === 0 ? (
          <p className="text-sm text-gray-500">Loading presets…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {presets.map((preset) => {
              const Icon = PRESET_ICONS[preset.id] ?? Bot
              const isActive = activeDraft.personality === preset.id
              return (
                <button
                  key={preset.id}
                  onClick={() => handlePresetClick(preset)}
                  className={clsx(
                    'text-left rounded-xl border p-4 transition-all hover:scale-[1.01]',
                    isActive
                      ? PRESET_BORDER[preset.id] ?? 'border-blue-500 bg-blue-600/10'
                      : 'border-gray-700 hover:border-gray-600 bg-gray-900/40',
                  )}
                >
                  <div className="flex items-center gap-2.5 mb-2">
                    <Icon
                      className={clsx(
                        'w-5 h-5',
                        isActive
                          ? PRESET_COLORS[preset.id] ?? 'text-blue-400'
                          : 'text-gray-500',
                      )}
                    />
                    <span className={clsx('text-sm font-semibold', isActive ? 'text-white' : 'text-gray-300')}>
                      {preset.label}
                    </span>
                    {isActive && (
                      <Check className="w-3.5 h-3.5 text-emerald-400 ml-auto" />
                    )}
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">{preset.description}</p>
                </button>
              )
            })}
          </div>
        )}

        {activeDraft.personality && (
          <p className="text-xs text-gray-500 flex items-center gap-1.5">
            <Wand2 className="w-3.5 h-3.5" />
            Selecting a personality replaces the Email Composer prompt below — you can still edit it manually
          </p>
        )}
      </div>

      {/* ── Section 3: System Prompts ───────────────────────────────────── */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-600/20 flex items-center justify-center">
            <Bot className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">System Prompts</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Advanced: directly edit each agent's persona and instructions
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-900 rounded-lg p-1 w-fit">
          {[
            { id: 'email' as const, label: 'Email Composer', icon: FlaskConical },
            { id: 'analyzer' as const, label: 'Response Analyzer', icon: BarChart2 },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setPromptTab(id)}
              className={clsx(
                'flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                promptTab === id
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-gray-300',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {promptTab === 'email' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-400">Email Composer Persona</label>
              <span className="text-xs text-gray-600">{activeDraft.email_system_prompt.length} chars</span>
            </div>
            <p className="text-xs text-amber-500/80 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 flex-shrink-0" />
              The <strong>OUTPUT RULES</strong> section at the bottom is required for structured JSON responses — keep it intact
            </p>
            <textarea
              value={activeDraft.email_system_prompt}
              onChange={(e) => setDraft((d) => d ? { ...d, email_system_prompt: e.target.value } : null)}
              rows={14}
              spellCheck={false}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 font-mono leading-relaxed placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-y"
            />
          </div>
        )}

        {promptTab === 'analyzer' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-400">Response Analyzer Instructions</label>
              <span className="text-xs text-gray-600">{activeDraft.analyzer_system_prompt.length} chars</span>
            </div>
            <textarea
              value={activeDraft.analyzer_system_prompt}
              onChange={(e) => setDraft((d) => d ? { ...d, analyzer_system_prompt: e.target.value } : null)}
              rows={14}
              spellCheck={false}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 font-mono leading-relaxed placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-y"
            />
          </div>
        )}
      </div>

      {/* ── Section 4: Persona Info (read-only) ─────────────────────────── */}
      {personaData && (
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/60 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-medium text-gray-400">Email Persona (from .env)</h3>
            <span className="ml-auto text-xs text-gray-600 bg-gray-700/50 px-2 py-0.5 rounded">Read-only</span>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
            {[
              { label: 'Name', value: personaData.name },
              { label: 'Title', value: personaData.title },
              { label: 'Company', value: personaData.company },
              { label: 'Phone', value: personaData.phone },
              { label: 'Email', value: personaData.email },
            ].map(({ label, value }) => (
              <div key={label} className="flex gap-2">
                <span className="text-gray-500 w-14 flex-shrink-0">{label}</span>
                <span className="text-gray-300 font-mono text-xs leading-5">{value}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-600 mt-3">
            Edit <code className="bg-gray-700/60 px-1 rounded">.env</code> to change persona fields, then restart the backend.
          </p>
        </div>
      )}

      {/* ── Action Bar ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between bg-gray-800/60 rounded-xl border border-gray-700 px-5 py-4">
        <button
          onClick={handleReset}
          disabled={isBusy}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 disabled:opacity-40 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Reset to Defaults
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={isBusy}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-medium text-white disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            {saveMutation.isPending ? 'Saving…' : 'Save Settings'}
          </button>

          <button
            onClick={handleSaveAndApply}
            disabled={isBusy}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold text-white disabled:opacity-50 transition-colors shadow-lg shadow-emerald-900/30"
          >
            {applyMutation.isPending ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Applying…
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Save &amp; Apply to Agents
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Info callout ─────────────────────────────────────────────────── */}
      <div className="bg-blue-900/20 border border-blue-800/50 rounded-xl px-5 py-4 flex gap-3">
        <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-300/80 space-y-1">
          <p><strong className="text-blue-200">Save Settings</strong> — persists your configuration to Cosmos DB. The backend will use it on next restart.</p>
          <p><strong className="text-blue-200">Save &amp; Apply to Agents</strong> — saves AND immediately re-bootstraps live Foundry agent versions with the new model and prompts. Active negotiations draft their next email using the updated personality.</p>
        </div>
      </div>
    </div>
  )
}
