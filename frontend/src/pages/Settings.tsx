import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import {
  Bot, Cpu, Wand2, RefreshCw, Check, AlertCircle, Save,
  ChevronDown, ChevronUp, Users, Shield, Zap, Heart, BarChart2,
  Info, FlaskConical, SlidersHorizontal, Lock, Unlock,
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
import type { AgentSettings, PersonalityPreset, SimulationApprovalGates } from '../types'

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

// ── Simulation approval gates helpers/component ──────────────────────────────

function defaultGates(): SimulationApprovalGates {
  return {
    fully_automated: false,
    contact_draft: true,
    proposal_draft: true,
    counter_draft: true,
    contact_reply: false,
    proposal_reply: false,
    counter_reply: false,
  }
}

interface GateToggleProps {
  label: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
}
function GateToggle({ label, description, checked, disabled, onChange }: GateToggleProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={clsx(
        'flex items-start gap-3 w-full text-left rounded-xl border p-3.5 transition-all',
        disabled
          ? 'opacity-40 cursor-not-allowed border-gray-700 bg-gray-900/20'
          : checked
            ? 'border-amber-600/70 bg-amber-900/20 hover:bg-amber-900/30'
            : 'border-gray-700 bg-gray-900/30 hover:border-gray-600',
      )}
    >
      <div
        className={clsx(
          'mt-0.5 flex-shrink-0 w-4 h-4 rounded flex items-center justify-center transition-colors border',
          checked && !disabled ? 'bg-amber-600 border-amber-500' : 'border-gray-600 bg-gray-800',
        )}
      >
        {checked && !disabled && <Check className="w-2.5 h-2.5 text-white" />}
      </div>
      <div>
        <p className={clsx('text-xs font-medium', checked && !disabled ? 'text-amber-200' : 'text-gray-300')}>
          {label}
        </p>
        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{description}</p>
      </div>
    </button>
  )
}

interface SimApprovalGatesSectionProps {
  gates: SimulationApprovalGates
  onChange: (g: SimulationApprovalGates) => void
}
function SimApprovalGatesSection({ gates, onChange }: SimApprovalGatesSectionProps) {
  const set = (key: keyof SimulationApprovalGates, value: boolean) =>
    onChange({ ...gates, [key]: value })

  const allDraftGatesOn =
    !gates.fully_automated &&
    gates.contact_draft &&
    gates.proposal_draft &&
    gates.counter_draft

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-amber-600/20 flex items-center justify-center">
          <SlidersHorizontal className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">Simulation Approval Gates</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Control which workflow stages pause for human review during a vendor simulation run
          </p>
        </div>
      </div>

      {/* Master automation switch */}
      <div
        className={clsx(
          'flex items-center justify-between rounded-xl border px-4 py-3.5 cursor-pointer transition-all',
          gates.fully_automated
            ? 'border-emerald-600/70 bg-emerald-900/20'
            : 'border-amber-600/70 bg-amber-900/10',
        )}
        onClick={() => set('fully_automated', !gates.fully_automated)}
      >
        <div className="flex items-center gap-3">
          {gates.fully_automated
            ? <Unlock className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            : <Lock className="w-4 h-4 text-amber-400 flex-shrink-0" />}
          <div>
            <p className={clsx('text-sm font-semibold', gates.fully_automated ? 'text-emerald-300' : 'text-amber-200')}>
              {gates.fully_automated ? 'Fully Automated' : 'Human-in-the-Loop (HITL) Active'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {gates.fully_automated
                ? 'Simulation runs end-to-end without pausing — all gates bypassed'
                : 'Simulation pauses at enabled gates below and waits for manual review'}
            </p>
          </div>
        </div>
        {/* Visual toggle pill */}
        <div
          className={clsx(
            'relative w-11 h-6 rounded-full border transition-colors flex-shrink-0',
            gates.fully_automated
              ? 'bg-emerald-600 border-emerald-500'
              : 'bg-gray-700 border-gray-600',
          )}
        >
          <span
            className={clsx(
              'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
              gates.fully_automated ? 'left-5' : 'left-0.5',
            )}
          />
        </div>
      </div>

      {/* Status callout */}
      {!gates.fully_automated && allDraftGatesOn && (
        <div className="flex items-start gap-2 bg-amber-900/10 border border-amber-800/40 rounded-lg px-3 py-2.5">
          <Info className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300/80 leading-relaxed">
            All email draft gates are active — the simulation will pause at each
            AI-drafted email and wait for your approval before continuing. This is the
            recommended default for realistic, auditable runs.
          </p>
        </div>
      )}
      {gates.fully_automated && (
        <div className="flex items-start gap-2 bg-emerald-900/10 border border-emerald-800/40 rounded-lg px-3 py-2.5">
          <Info className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-emerald-300/80 leading-relaxed">
            Fully automated mode is on — simulations will run to completion in one
            shot without any human approval steps. Individual gate settings below are
            ignored while this mode is active.
          </p>
        </div>
      )}

      {/* Per-gate toggles */}
      <div className="space-y-4">
        {/* Our AI-drafted email gates */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
            Our Outbound Email Drafts
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <GateToggle
              label="Contact Draft"
              description="Review the AI-drafted contact-verification email before it is sent"
              checked={gates.contact_draft}
              disabled={gates.fully_automated}
              onChange={(v) => set('contact_draft', v)}
            />
            <GateToggle
              label="Proposal Draft"
              description="Review the AI-drafted proposal email before it is sent"
              checked={gates.proposal_draft}
              disabled={gates.fully_automated}
              onChange={(v) => set('proposal_draft', v)}
            />
            <GateToggle
              label="Counter-Offer Draft"
              description="Review the AI-drafted counter-offer email before it is sent"
              checked={gates.counter_draft}
              disabled={gates.fully_automated}
              onChange={(v) => set('counter_draft', v)}
            />
          </div>
        </div>

        {/* Vendor reply injection gates */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
            Simulated Vendor Replies
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <GateToggle
              label="Contact Reply"
              description="Preview the simulated vendor contact reply before it is injected"
              checked={gates.contact_reply}
              disabled={gates.fully_automated}
              onChange={(v) => set('contact_reply', v)}
            />
            <GateToggle
              label="Proposal Reply"
              description="Preview the simulated vendor proposal reply before it is injected"
              checked={gates.proposal_reply}
              disabled={gates.fully_automated}
              onChange={(v) => set('proposal_reply', v)}
            />
            <GateToggle
              label="Counter Reply"
              description="Preview the simulated vendor final reply before it is injected"
              checked={gates.counter_reply}
              disabled={gates.fully_automated}
              onChange={(v) => set('counter_reply', v)}
            />
          </div>
        </div>
      </div>
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

      {/* ── Section 5: Simulation Approval Gates ───────────────────────── */}
      <SimApprovalGatesSection
        gates={activeDraft.simulation_approval_gates ?? defaultGates()}
        onChange={(g) => setDraft((d) => d ? { ...d, simulation_approval_gates: g } : null)}
      />

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
