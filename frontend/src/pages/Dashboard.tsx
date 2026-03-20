import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Users, MessageSquare, CheckCircle, Clock, TrendingUp,
  Lightbulb, Target, Activity, BarChart2, CheckCheck, XCircle, AlertTriangle,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getDashboardStats } from '../services/api'
import { StatCard } from '../components/common/StatCard'
import { StatusBadge } from '../components/common/StatusBadge'
import { useWebSocket } from '../hooks/useWebSocket'
import { formatDistanceToNow } from 'date-fns'
import type { DashboardStats, WSEvent } from '../types'

interface Props { setWsConnected: (v: boolean) => void; setPending: (n: number) => void }

// ── Helpers ──────────────────────────────────────────────────────────────────

function MiniBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(4, (value / max) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-400">{label}</span>
        <span className="text-white font-semibold">{value}</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

interface Insight { text: string; type: 'success' | 'info' | 'warning' }

function generateInsights(data: DashboardStats): Insight[] {
  const vc = data.vendor_counts
  const { outcomes, pipeline, efficiency } = data.analytics
  const best = data.best_ab_group
  const bestStat = data.rl_stats.find(s => s.group === best)
  const insights: Insight[] = []

  // Best RL group
  if (bestStat && bestStat.total_trials > 0) {
    insights.push({
      text: `Group ${best} leads with ${(bestStat.success_rate * 100).toFixed(0)}% success rate across ${bestStat.total_trials} trial${bestStat.total_trials !== 1 ? 's' : ''} — strategy is performing well`,
      type: 'success',
    })
  }

  // Close rate
  const concluded = outcomes.agreed + outcomes.rejected + outcomes.escalated
  if (concluded > 0) {
    const closeRate = (outcomes.agreed / concluded) * 100
    insights.push({
      text: `${closeRate.toFixed(0)}% close rate — ${outcomes.agreed} of ${concluded} concluded negotiations resulted in agreement`,
      type: closeRate >= 60 ? 'success' : closeRate >= 40 ? 'info' : 'warning',
    })
  }

  // Vendor coverage
  if (vc.eligible > 0) {
    const uncovered = vc.eligible - vc.in_progress - vc.completed
    if (uncovered > 0) {
      insights.push({
        text: `${uncovered} eligible vendor${uncovered !== 1 ? 's' : ''} have not entered negotiation yet — ${Math.round((vc.in_progress + vc.completed) / vc.eligible * 100)}% coverage achieved`,
        type: 'info',
      })
    } else if (vc.eligible > 0) {
      insights.push({ text: `Full pipeline coverage — all ${vc.eligible} eligible vendors are active or completed`, type: 'success' })
    }
  }

  // Pipeline bottleneck
  const phaseMax = Math.max(pipeline.contact, pipeline.proposal, pipeline.counter)
  if (phaseMax > 0) {
    const bottleneck = pipeline.contact >= pipeline.proposal && pipeline.contact >= pipeline.counter
      ? { name: 'contact confirmation', count: pipeline.contact }
      : pipeline.proposal >= pipeline.counter
        ? { name: 'initial proposal', count: pipeline.proposal }
        : { name: 'counter-offer', count: pipeline.counter }
    insights.push({
      text: `${bottleneck.count} negotiation${bottleneck.count !== 1 ? 's' : ''} are concentrated at the ${bottleneck.name} phase`,
      type: bottleneck.count > 10 ? 'warning' : 'info',
    })
  }

  // Efficiency
  if (efficiency.avg_rounds > 0) {
    const efficient = efficiency.avg_rounds <= 1.5
    insights.push({
      text: `Average ${efficiency.avg_rounds.toFixed(1)} rounds to close — ${efficient ? 'efficient pace suggests strong initial proposals' : 'multiple rounds may indicate room to sharpen opening offers'}`,
      type: efficient ? 'success' : 'warning',
    })
  }

  return insights.slice(0, 4)
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Dashboard({ setWsConnected, setPending }: Props) {
  const qc = useQueryClient()
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboardStats,
    refetchInterval: 30_000,
  })

  useWebSocket({
    onConnect: () => setWsConnected(true),
    onDisconnect: () => setWsConnected(false),
    onMessage: (evt: WSEvent) => {
      if (['negotiation_started', 'email_sent', 'reply_received', 'approval_needed', 'negotiation_escalated'].includes(evt.event)) {
        qc.invalidateQueries({ queryKey: ['dashboard'] })
        qc.invalidateQueries({ queryKey: ['negotiations'] })
        qc.invalidateQueries({ queryKey: ['pending-approvals'] })
      }
    },
  })

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Loading dashboard…</div>
  }

  const vc = data?.vendor_counts ?? { total: 0, eligible: 0, in_progress: 0, completed: 0 }
  const best = data?.best_ab_group
  const bestStat = data?.rl_stats.find(s => s.group === best)
  const analytics = data?.analytics ?? {
    outcomes: { agreed: 0, rejected: 0, escalated: 0 },
    pipeline: { contact: 0, proposal: 0, counter: 0 },
    efficiency: { avg_rounds: 0, avg_improvement_score: 0 },
  }
  const insights = data ? generateInsights(data) : []

  const concluded = analytics.outcomes.agreed + analytics.outcomes.rejected + analytics.outcomes.escalated
  const closeRate = concluded > 0 ? Math.round((analytics.outcomes.agreed / concluded) * 100) : null
  const coveragePct = vc.eligible > 0 ? Math.round((vc.in_progress + vc.completed) / vc.eligible * 100) : 0
  const pipelineTotal = analytics.pipeline.contact + analytics.pipeline.proposal + analytics.pipeline.counter

  const insightIcon = (type: Insight['type']) => {
    if (type === 'success') return <CheckCheck className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" />
    if (type === 'warning') return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
    return <Activity className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
  }
  const insightColor = (type: Insight['type']) => {
    if (type === 'success') return 'text-green-300'
    if (type === 'warning') return 'text-amber-300'
    return 'text-blue-300'
  }

  return (
    <div className="space-y-6">
      {/* ── Stat cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total Vendors"
          value={vc.total.toLocaleString()}
          subtitle={`${vc.eligible.toLocaleString()} eligible · ${coveragePct}% coverage`}
          icon={<Users className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          title="In Progress"
          value={vc.in_progress}
          subtitle={`${pipelineTotal} across ${[analytics.pipeline.contact > 0 && 'contact', analytics.pipeline.proposal > 0 && 'proposal', analytics.pipeline.counter > 0 && 'counter'].filter(Boolean).join(' / ')||'all phases'}`}
          icon={<MessageSquare className="w-5 h-5" />}
          color="yellow"
        />
        <StatCard
          title="Completed"
          value={vc.completed}
          subtitle={closeRate !== null ? `${closeRate}% close rate` : 'Terms agreed'}
          icon={<CheckCircle className="w-5 h-5" />}
          color="green"
        />
        <StatCard
          title="Pending Approval"
          value={data?.pending_approvals ?? 0}
          subtitle="Emails awaiting review"
          icon={<Clock className="w-5 h-5" />}
          color={data?.pending_approvals ? 'yellow' : 'blue'}
        />
      </div>

      {/* ── Analytics row ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">

        {/* Pipeline */}
        <div className="card xl:col-span-2 space-y-4">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-semibold text-white">Negotiation Pipeline</h2>
            <span className="ml-auto text-xs text-gray-500">{pipelineTotal} active</span>
          </div>
          <div className="space-y-3">
            <MiniBar label="Contact Phase" value={analytics.pipeline.contact} max={Math.max(pipelineTotal, 1)} color="bg-blue-500" />
            <MiniBar label="Proposal Phase" value={analytics.pipeline.proposal} max={Math.max(pipelineTotal, 1)} color="bg-indigo-500" />
            <MiniBar label="Counter-Offer Phase" value={analytics.pipeline.counter} max={Math.max(pipelineTotal, 1)} color="bg-purple-500" />
          </div>
          <div className="pt-1 border-t border-gray-800 flex gap-4 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /><span className="text-gray-400">Agreed: <span className="text-white font-medium">{analytics.outcomes.agreed}</span></span></span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /><span className="text-gray-400">Rejected: <span className="text-white font-medium">{analytics.outcomes.rejected}</span></span></span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /><span className="text-gray-400">Escalated: <span className="text-white font-medium">{analytics.outcomes.escalated}</span></span></span>
          </div>
        </div>

        {/* Outcome Distribution */}
        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-green-400" />
            <h2 className="text-sm font-semibold text-white">Outcomes</h2>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2.5 bg-green-900/20 border border-green-800/30 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-xs text-gray-300">Agreed</span>
              </div>
              <span className="text-lg font-bold text-green-400">{analytics.outcomes.agreed}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-red-900/20 border border-red-800/30 rounded-lg">
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-400" />
                <span className="text-xs text-gray-300">Rejected</span>
              </div>
              <span className="text-lg font-bold text-red-400">{analytics.outcomes.rejected}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-amber-900/20 border border-amber-800/30 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-gray-300">Escalated</span>
              </div>
              <span className="text-lg font-bold text-amber-400">{analytics.outcomes.escalated}</span>
            </div>
          </div>
          {closeRate !== null && (
            <div className="text-center pt-1 border-t border-gray-800">
              <span className="text-2xl font-bold text-white">{closeRate}%</span>
              <p className="text-xs text-gray-500 mt-0.5">Close Rate</p>
            </div>
          )}
        </div>

        {/* Efficiency */}
        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-white">Efficiency</h2>
          </div>
          <div className="space-y-3">
            <div className="bg-gray-800/60 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-purple-400">
                {analytics.efficiency.avg_rounds > 0 ? analytics.efficiency.avg_rounds.toFixed(1) : '—'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Avg rounds to close</p>
            </div>
            <div className="bg-gray-800/60 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-indigo-400">
                {analytics.efficiency.avg_improvement_score > 0
                  ? `${(analytics.efficiency.avg_improvement_score * 100).toFixed(0)}%`
                  : '—'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Avg improvement score</p>
            </div>
            <div className="bg-gray-800/60 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-blue-400">{coveragePct}%</p>
              <p className="text-xs text-gray-400 mt-0.5">Eligible vendor coverage</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Intelligence Insights ─────────────────────────────────────────── */}
      {insights.length > 0 && (
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-yellow-400" />
            <h2 className="text-sm font-semibold text-white">Intelligence Insights</h2>
            <span className="text-xs text-gray-500 ml-1">Auto-generated from live data</span>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
            {insights.map((ins, i) => (
              <div key={i} className="flex items-start gap-2.5 p-3 bg-gray-800/40 rounded-lg">
                {insightIcon(ins.type)}
                <p className={`text-xs leading-relaxed ${insightColor(ins.type)}`}>{ins.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── RL insight + recent ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* RL best strategy */}
        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-white">RL Best Strategy</h2>
          </div>
          {best && bestStat ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-blue-400">Group {best}</span>
                <StatusBadge type="group" value={best} />
              </div>
              <p className="text-xs text-gray-400">{bestStat.strategy}</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-800 rounded-lg p-2">
                  <p className="text-gray-400">Success Rate</p>
                  <p className="text-green-400 font-semibold">{(bestStat.success_rate * 100).toFixed(1)}%</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-2">
                  <p className="text-gray-400">Q-Value</p>
                  <p className="text-purple-400 font-semibold">{bestStat.q_value.toFixed(4)}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-2">
                  <p className="text-gray-400">Trials</p>
                  <p className="text-white font-semibold">{bestStat.total_trials}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-2">
                  <p className="text-gray-400">Avg Reward</p>
                  <p className="text-yellow-400 font-semibold">{(bestStat.avg_reward * 100).toFixed(1)}%</p>
                </div>
              </div>
              <button
                className="btn-secondary text-xs w-full"
                onClick={() => navigate('/ab-testing')}
              >
                View Full A/B Dashboard →
              </button>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No negotiations completed yet. Start some negotiations to collect RL data.</p>
          )}
        </div>

        {/* Recent negotiations */}
        <div className="card xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Recent Negotiations</h2>
            <button className="text-xs text-blue-400 hover:underline" onClick={() => navigate('/negotiations')}>
              View all →
            </button>
          </div>
          {data?.recent_negotiations?.length ? (
            <div className="space-y-2">
              {data.recent_negotiations.map(neg => (
                <div
                  key={neg.id}
                  className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
                  onClick={() => navigate(`/negotiations/${neg.id}`)}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{neg.vendor_long_name}</p>
                    <p className="text-xs text-gray-500">
                      {formatDistanceToNow(new Date(neg.updated_at), { addSuffix: true })}
                      {neg.ab_group && ` · Group ${neg.ab_group}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <StatusBadge type="stage" value={neg.stage} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No negotiations yet. Import vendors and start negotiating!</p>
          )}
        </div>
      </div>

      {/* ── Pending approvals CTA ─────────────────────────────────────────── */}
      {(data?.pending_approvals ?? 0) > 0 && (
        <div
          className="bg-amber-900/20 border border-amber-800/40 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:bg-amber-900/30 transition-colors"
          onClick={() => navigate('/negotiations?filter=pending_approval')}
        >
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-400" />
            <div>
              <p className="text-sm font-semibold text-amber-300">
                {data?.pending_approvals} email{data?.pending_approvals !== 1 ? 's' : ''} waiting for your approval
              </p>
              <p className="text-xs text-amber-500">Human-in-the-loop review required before sending</p>
            </div>
          </div>
          <span className="text-amber-400 text-sm">Review →</span>
        </div>
      )}
    </div>
  )
}
