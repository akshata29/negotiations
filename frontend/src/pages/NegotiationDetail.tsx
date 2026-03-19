import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getNegotiation, getSimulationScenarios, simulateNegotiation } from '../services/api'
import { EmailThread } from '../components/negotiations/EmailThread'
import { WorkflowTimeline } from '../components/negotiations/WorkflowTimeline'
import { ApprovalModal } from '../components/negotiations/ApprovalModal'
import { StatusBadge } from '../components/common/StatusBadge'
import { ArrowLeft, Clock, FlaskConical, ChevronRight, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import type { EmailMessage } from '../types'

const ACTIONABLE_STAGES = new Set([
  'contact_sent', 'proposal_sent', 'counter_sent',
  'contact_approval', 'proposal_approval', 'counter_approval',
])

const COLOR_MAP: Record<string, string> = {
  green: 'border-green-700 bg-green-900/20 hover:bg-green-900/40',
  blue: 'border-blue-700 bg-blue-900/20 hover:bg-blue-900/40',
  orange: 'border-orange-700 bg-orange-900/20 hover:bg-orange-900/40',
  red: 'border-red-700 bg-red-900/20 hover:bg-red-900/40',
  gray: 'border-gray-700 bg-gray-800/40 hover:bg-gray-700/40',
}
const LABEL_COLOR: Record<string, string> = {
  green: 'text-green-300', blue: 'text-blue-300',
  orange: 'text-orange-300', red: 'text-red-400', gray: 'text-gray-400',
}

export function NegotiationDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [showSimulate, setShowSimulate] = useState(false)
  const [simResult, setSimResult] = useState<null | { final_stage: string; scenario_label: string; rounds: number; log: Array<{ action: string; detail: string; stage?: string }> }>(null)

  const { data: neg, isLoading } = useQuery({
    queryKey: ['negotiation', id],
    queryFn: () => getNegotiation(id!),
    enabled: !!id,
    refetchInterval: 10_000,
  })

  const { data: scenariosData } = useQuery({
    queryKey: ['sim-scenarios'],
    queryFn: getSimulationScenarios,
    staleTime: Infinity,
  })

  const simMut = useMutation({
    mutationFn: (scenario: string) => simulateNegotiation(id!, scenario),
    onSuccess: (data) => {
      setSimResult({ final_stage: data.final_stage, scenario_label: data.scenario_label, rounds: data.rounds, log: data.log })
      qc.invalidateQueries({ queryKey: ['negotiation', id] })
      qc.invalidateQueries({ queryKey: ['negotiations'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  if (isLoading) return <div className="text-gray-500 py-12 text-center">Loading…</div>
  if (!neg) return <div className="text-red-400 py-12 text-center">Negotiation not found</div>

  const emails = (neg.emails ?? []) as EmailMessage[]
  const canSimulate = ACTIONABLE_STAGES.has(neg.stage)
  const scenarios = scenariosData?.scenarios ?? []

  const terminalStages = new Set(['agreed', 'rejected', 'escalated', 'completed'])
  const isTerminal = terminalStages.has(neg.stage)

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Breadcrumb */}
      <button className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors" onClick={() => navigate(-1)}>
        <ArrowLeft className="w-4 h-4" /> Back to Negotiations
      </button>

      {/* Header card */}
      <div className="card space-y-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold text-white">{neg.vendor_long_name}</h2>
            <p className="text-sm text-gray-400 mt-0.5">Vendor ID {neg.vendor_id} · {neg.rounds} round{neg.rounds !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge type="stage" value={neg.stage} />
            {neg.ab_group && <StatusBadge type="group" value={neg.ab_group} />}
            {neg.pending_approval_email_id && (
              <button className="btn-primary text-xs flex items-center gap-1.5" onClick={() => setShowModal(true)}>
                <Clock className="w-3.5 h-3.5" /> Review Email
              </button>
            )}
            {(canSimulate || isTerminal === false) && !isTerminal && (
              <button
                className="flex items-center gap-1.5 text-xs bg-purple-800/60 hover:bg-purple-700/60 border border-purple-600 text-purple-200 rounded-lg px-3 py-1.5 transition-colors"
                onClick={() => { setShowSimulate(s => !s); setSimResult(null) }}
              >
                <FlaskConical className="w-3.5 h-3.5" />
                Simulate Vendor
              </button>
            )}
          </div>
        </div>

        {/* Workflow timeline */}
        <WorkflowTimeline currentStage={neg.stage} />

        {/* Term comparison */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          {[
            { label: 'Cash Discount (STD Terms)', original: `${neg.original_std_terms}%`, proposed: neg.proposed_terms?.std_terms != null ? `${neg.proposed_terms.std_terms}%` : null, agreed: neg.agreed_terms?.std_terms != null ? `${neg.agreed_terms.std_terms}%` : null },
            { label: 'Term Days', original: `${neg.original_term_days}d`, proposed: neg.proposed_terms?.term_days != null ? `${neg.proposed_terms.term_days}d` : null, agreed: neg.agreed_terms?.term_days != null ? `${neg.agreed_terms.term_days}d` : null },
            { label: 'Net Days', original: `${neg.original_net_days}d`, proposed: neg.proposed_terms?.net_days != null ? `${neg.proposed_terms.net_days}d` : null, agreed: neg.agreed_terms?.net_days != null ? `${neg.agreed_terms.net_days}d` : null },
          ].map(t => (
            <div key={t.label} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
              <p className="text-xs text-gray-400 mb-2">{t.label}</p>
              <div className="flex items-center gap-1.5 text-xs flex-wrap">
                <span className="text-gray-300">{t.original}</span>
                {t.proposed && <><span className="text-gray-600">→</span><span className="text-blue-400">{t.proposed}</span></>}
                {t.agreed && <><span className="text-gray-600">→</span><span className="text-green-400 font-bold">{t.agreed} ✓</span></>}
              </div>
            </div>
          ))}
        </div>

        {neg.strategy && (
          <div className="text-xs text-gray-400 bg-gray-800/30 rounded-lg px-3 py-2">
            <span className="font-medium text-gray-200">Strategy:</span> {neg.strategy}
          </div>
        )}
        {(neg as unknown as Record<string,number>).improvement_score > 0 && (
          <div className="text-xs text-green-400 bg-green-900/20 rounded-lg px-3 py-2">
            ✓ Improvement score: {((neg as unknown as Record<string,number>).improvement_score * 100).toFixed(0)}% — recorded for RL training
          </div>
        )}
      </div>

      {/* ── Simulate Panel ─────────────────────────────────────────────── */}
      {showSimulate && !isTerminal && (
        <div className="card space-y-4 border border-purple-800/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-white">Simulate Vendor Response</h3>
            </div>
            <span className="text-xs text-gray-500">
              {canSimulate
                ? `Waiting for vendor at stage: ${neg.stage.replace(/_/g, ' ')}`
                : 'Will auto-advance approval gates + inject vendor replies'}
            </span>
          </div>

          <p className="text-xs text-gray-400">
            Choose a scenario — the simulation will inject realistic vendor email replies,
            auto-approve any pending drafts, and run the full workflow to completion so you can see
            the UI update in real time.
          </p>

          {/* Scenario cards */}
          {simMut.isPending ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
              <p className="text-sm text-gray-300">Running simulation…</p>
              <p className="text-xs text-gray-500">AI is drafting emails, analyzing replies, and advancing stages</p>
            </div>
          ) : simResult ? (
            <div className="space-y-3">
              <div className={`flex items-center gap-2 rounded-lg px-4 py-3 ${simResult.final_stage === 'agreed' ? 'bg-green-900/30 border border-green-700' : simResult.final_stage === 'rejected' ? 'bg-red-900/20 border border-red-800' : 'bg-orange-900/20 border border-orange-800'}`}>
                {simResult.final_stage === 'agreed'
                  ? <CheckCircle2 className="w-5 h-5 text-green-400" />
                  : <XCircle className="w-5 h-5 text-red-400" />}
                <div>
                  <p className="text-sm font-semibold text-white">{simResult.scenario_label} — {simResult.final_stage.replace(/_/g, ' ').toUpperCase()}</p>
                  <p className="text-xs text-gray-400">{simResult.rounds} negotiation round{simResult.rounds !== 1 ? 's' : ''}</p>
                </div>
              </div>

              {/* Execution log */}
              <div className="space-y-1.5">
                {simResult.log.map((entry, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0 mt-1.5" />
                    <div>
                      <span className="text-gray-300">{entry.detail}</span>
                      {entry.stage && <span className="text-purple-400 ml-1.5">→ {entry.stage.replace(/_/g, ' ')}</span>}
                    </div>
                  </div>
                ))}
              </div>

              <button
                className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                onClick={() => { setSimResult(null) }}
              >
                ↺ Run another scenario
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {scenarios.map(sc => (
                <button
                  key={sc.id}
                  className={`text-left rounded-xl border p-4 transition-colors ${COLOR_MAP[sc.color] ?? COLOR_MAP.gray}`}
                  onClick={() => simMut.mutate(sc.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{sc.icon}</span>
                      <span className={`text-sm font-semibold ${LABEL_COLOR[sc.color]}`}>{sc.label}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      {sc.rounds} round{sc.rounds !== 1 ? 's' : ''}
                      <ChevronRight className="w-3 h-3" />
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">{sc.description}</p>
                </button>
              ))}
            </div>
          )}

          {simMut.isError && (
            <p className="text-xs text-red-400">Simulation failed — check backend logs.</p>
          )}
        </div>
      )}

      {/* Email thread */}
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-white">Process History ({emails.length} email{emails.length !== 1 ? 's' : ''})</h3>
        <EmailThread emails={emails} finalStage={neg.stage} />
      </div>

      {showModal && (
        <ApprovalModal
          negotiation={neg}
          onClose={() => { setShowModal(false); qc.invalidateQueries({ queryKey: ['negotiation', id] }) }}
        />
      )}
    </div>
  )
}


