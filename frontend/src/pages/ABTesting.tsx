import { useQuery } from '@tanstack/react-query'
import { getABStats, getABGroupMetrics, simulateABSelections } from '../services/api'
import { ABTestChart } from '../components/analytics/ABTestChart'
import { TrendingUp, Beaker, Target, FlaskConical, BarChart3, Zap } from 'lucide-react'
import type { ABTestStat } from '../types'

const GROUP_COLORS: Record<string, { hex: string; tailwind: string; bg: string }> = {
  A: { hex: '#a855f7', tailwind: 'text-purple-400', bg: 'bg-purple-500' },
  B: { hex: '#6366f1', tailwind: 'text-indigo-400', bg: 'bg-indigo-500' },
  C: { hex: '#ec4899', tailwind: 'text-pink-400', bg: 'bg-pink-500' },
}

const C_EXPLORE = 2.0

function ucbDecompose(s: ABTestStat, totalTrials: number) {
  const q = s.q_value
  const explore =
    s.total_trials === 0
      ? Infinity
      : C_EXPLORE * Math.sqrt(Math.log(Math.max(totalTrials, 1)) / s.total_trials)
  return { q, explore, ucb1: s.ucb1_score }
}

function getConvergencePhase(stats: ABTestStat[], totalTrials: number) {
  if (!stats.length || totalTrials === 0) return { phase: 'No Data', pct: 0, leader: null }
  const best = stats.reduce((a, b) => (a.total_trials > b.total_trials ? a : b))
  const concentration = best.total_trials / totalTrials
  const phase = concentration > 0.6 ? 'Exploiting' : 'Exploring'
  return { phase, pct: Math.round(concentration * 100), leader: best.group }
}

export function ABTesting() {
  const { data, isLoading } = useQuery({
    queryKey: ['ab-stats'],
    queryFn: getABStats,
    refetchInterval: 30_000,
  })

  const { data: metricsData } = useQuery({
    queryKey: ['ab-group-metrics'],
    queryFn: getABGroupMetrics,
    refetchInterval: 60_000,
  })

  const { data: simData } = useQuery({
    queryKey: ['ab-simulate'],
    queryFn: () => simulateABSelections(20),
    refetchInterval: 60_000,
  })

  const stats = data?.stats ?? []
  const totalTrials = data?.total_trials ?? stats.reduce((s, x) => s + x.total_trials, 0)
  const convergence = getConvergencePhase(stats, totalTrials)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Beaker className="w-5 h-5 text-purple-400" />
          A/B Testing & Reinforcement Learning
        </h2>
        <p className="text-sm text-gray-400 mt-1">
          UCB1 multi-armed bandit selects the optimal strategy. Groups auto-converge toward highest reward over time.
        </p>
      </div>

      {/* Strategy group cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { group: 'A', colorKey: 'purple', title: 'Group A — Cash Discount', desc: 'Request cash discount improvement to ≥ 2% (STD Terms). Best when vendor has low current discount.' },
          { group: 'B', colorKey: 'indigo', title: 'Group B — Term Days', desc: 'Request +10 days on both Term Days and Net Days. Best when vendor already has adequate discount.' },
          { group: 'C', colorKey: 'pink', title: 'Group C — Both', desc: 'Request both cash discount AND term days extension. Highest potential reward, higher rejection risk.' },
        ].map(item => (
          <div key={item.group} className="card border border-gray-700">
            <h3 className={`text-sm font-semibold mb-1 text-${item.colorKey}-400`}>{item.title}</h3>
            <p className="text-xs text-gray-400">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* UCB1 formula card */}
      <div className="card border border-blue-900/40 bg-blue-900/10 space-y-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-blue-300">UCB1 Algorithm</h3>
        </div>
        <p className="text-xs text-gray-300 leading-relaxed">
          Each time a new negotiation starts, the UCB1 algorithm scores each arm:
          <strong className="text-white"> UCB1 = Q(a) + c × √(ln N / N(a))</strong> — Q(a) is the estimated reward
          (exploitation), the second term is the exploration bonus (larger when arm is under-sampled).
          As data accumulates the highest-performing strategy is selected more often.
        </p>
        <div className="flex flex-wrap gap-6 text-xs">
          <div><span className="text-gray-400">Reward scale: </span><span className="text-red-400">0 = reject</span> · <span className="text-yellow-400">0.5 = partial</span> · <span className="text-blue-400">1.0 = full agree</span> · <span className="text-purple-400">1.5 = 1st-round</span></div>
          <div><span className="text-gray-400">c = </span><span className="text-white">2.0</span></div>
          <div><span className="text-gray-400">Total trials: </span><span className="text-white font-mono">{totalTrials}</span></div>
        </div>
      </div>

      {/* ── Section 1: UCB1 Score Decomposition ── */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-4 h-4 text-yellow-400" />
          <h3 className="text-sm font-semibold text-white">UCB1 Score Decomposition</h3>
          <span className="text-xs text-gray-500 ml-1">— exploitation vs. exploration per arm</span>
        </div>

        {isLoading ? (
          <p className="text-gray-500 text-sm">Loading…</p>
        ) : stats.length === 0 ? (
          <p className="text-gray-500 text-sm">No data yet.</p>
        ) : (
          <div className="space-y-4">
            {stats.map(s => {
              const { q, explore } = ucbDecompose(s, totalTrials)
              const isInf = s.total_trials === 0
              const maxScore = isInf ? 1 : Math.max(...stats.map(x => ucbDecompose(x, totalTrials).ucb1))
              const qPct = isInf ? 0 : Math.min((q / maxScore) * 100, 100)
              const ePct = isInf ? 100 : Math.min((explore / maxScore) * 100, 100 - qPct)
              const col = GROUP_COLORS[s.group]
              return (
                <div key={s.group}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-semibold ${col.tailwind}`}>Group {s.group}</span>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-gray-400">Q(a) <span className="text-white font-mono">{q.toFixed(4)}</span></span>
                      <span className="text-gray-400">Explore <span className="text-yellow-300 font-mono">{isInf ? '∞' : explore.toFixed(4)}</span></span>
                      <span className="text-gray-400">UCB1 <span className="text-green-300 font-mono">{isInf ? '∞' : s.ucb1_score.toFixed(4)}</span></span>
                    </div>
                  </div>
                  <div className="h-5 rounded overflow-hidden bg-gray-800 flex">
                    <div
                      className="h-full transition-all duration-500"
                      style={{ width: `${qPct}%`, backgroundColor: col.hex }}
                      title={`Exploitation: ${q.toFixed(4)}`}
                    />
                    <div
                      className="h-full transition-all duration-500 bg-yellow-500/70"
                      style={{ width: `${ePct}%` }}
                      title={`Exploration bonus: ${isInf ? '∞' : explore.toFixed(4)}`}
                    />
                  </div>
                  <div className="flex gap-4 mt-1 text-[10px] text-gray-500">
                    <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2 rounded-sm" style={{ backgroundColor: col.hex }} /> Exploitation (Q-value)</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2 rounded-sm bg-yellow-500/70" /> Exploration bonus</span>
                    <span className="ml-auto">{s.total_trials} trial{s.total_trials !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Section 2: Convergence Indicator ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Phase */}
        <div className="card border border-gray-700 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-xs font-semibold text-white">Current Phase</span>
          </div>
          <div className={`text-2xl font-bold ${convergence.phase === 'Exploiting' ? 'text-green-400' : 'text-yellow-400'}`}>
            {convergence.phase}
          </div>
          <p className="text-xs text-gray-400">
            {convergence.phase === 'Exploiting'
              ? `Group ${convergence.leader} dominates ${convergence.pct}% of trials — algorithm is converging.`
              : convergence.phase === 'Exploring'
              ? 'Trials still distributed broadly — algorithm is gathering information.'
              : 'Run some negotiations to start collecting data.'}
          </p>
        </div>

        {/* Trial distribution */}
        <div className="card border border-gray-700 flex flex-col gap-3">
          <span className="text-xs font-semibold text-white">Trial Distribution</span>
          {stats.length === 0 ? (
            <p className="text-gray-500 text-xs">No data.</p>
          ) : (
            stats.map(s => {
              const pct = totalTrials ? Math.round((s.total_trials / totalTrials) * 100) : 0
              const col = GROUP_COLORS[s.group]
              return (
                <div key={s.group}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className={col.tailwind}>Group {s.group}</span>
                    <span className="text-gray-300">{s.total_trials} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded overflow-hidden">
                    <div className="h-full rounded transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: col.hex }} />
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Reward summary */}
        <div className="card border border-gray-700 flex flex-col gap-3">
          <span className="text-xs font-semibold text-white">Reward Summary</span>
          {stats.length === 0 ? (
            <p className="text-gray-500 text-xs">No data.</p>
          ) : (
            stats.map(s => {
              const col = GROUP_COLORS[s.group]
              return (
                <div key={s.group} className="flex items-center gap-3 text-xs">
                  <span className={`w-16 ${col.tailwind}`}>Group {s.group}</span>
                  <div className="flex-1 space-y-0.5">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Success</span>
                      <span className="text-green-400">{(s.success_rate * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Avg reward</span>
                      <span className="text-blue-300">{(s.avg_reward * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── Section 3: Per-Group Negotiation Outcomes ── */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Negotiation Outcome Breakdown by Group</h3>
          <span className="text-xs text-gray-500 ml-1">— from completed negotiations</span>
        </div>

        {!metricsData?.metrics?.length ? (
          <p className="text-gray-500 text-sm">No negotiation outcome data yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {metricsData.metrics.map(m => {
              const col = GROUP_COLORS[m.group] ?? GROUP_COLORS['A']
              const total = m.total || 1
              return (
                <div key={m.group} className="rounded-xl border border-gray-700 p-4 bg-gray-800/30">
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-base font-bold ${col.tailwind}`}>Group {m.group}</span>
                    <span className="text-xs text-gray-400">{m.total} negotiations</span>
                  </div>

                  {/* Outcome stacked bar */}
                  <div className="h-3 rounded overflow-hidden bg-gray-700 flex mb-2">
                    <div className="h-full bg-green-500" style={{ width: `${(m.agreed / total) * 100}%` }} title={`Agreed: ${m.agreed}`} />
                    <div className="h-full bg-red-500" style={{ width: `${(m.rejected / total) * 100}%` }} title={`Rejected: ${m.rejected}`} />
                    <div className="h-full bg-yellow-500" style={{ width: `${(m.escalated / total) * 100}%` }} title={`Escalated: ${m.escalated}`} />
                    <div className="h-full bg-gray-500" style={{ width: `${(m.in_progress / total) * 100}%` }} title={`In Progress: ${m.in_progress}`} />
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] mb-3">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500 inline-block" />Agreed {m.agreed}</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500 inline-block" />Rejected {m.rejected}</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-yellow-500 inline-block" />Escalated {m.escalated}</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-gray-500 inline-block" />In Progress {m.in_progress}</span>
                  </div>

                  {/* KPI grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <div className="flex justify-between"><span className="text-gray-400">Close rate</span><span className="text-green-400">{(m.close_rate * 100).toFixed(1)}%</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Rejection rate</span><span className="text-red-400">{(m.rejection_rate * 100).toFixed(1)}%</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">1st-round close</span><span className="text-purple-400">{(m.first_round_rate * 100).toFixed(1)}%</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Avg rounds</span><span className="text-white">{m.avg_rounds.toFixed(1)}</span></div>
                    <div className="col-span-2 flex justify-between">
                      <span className="text-gray-400">Avg improvement score</span>
                      <span className="text-blue-300">{m.avg_improvement_score.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Section 4: Next Selections Simulation ── */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <FlaskConical className="w-4 h-4 text-green-400" />
          <h3 className="text-sm font-semibold text-white">Next 20 Selections — Simulation</h3>
          <span className="text-xs text-gray-500 ml-1">— predicted by current UCB1 scores</span>
        </div>

        {!simData ? (
          <p className="text-gray-500 text-sm">Loading simulation…</p>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-400">
              If 20 new negotiations started right now, UCB1 predicts the following group distribution based on current Q-values and trial counts:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {Object.entries(simData.distribution).map(([group, dist]) => {
                const col = GROUP_COLORS[group] ?? GROUP_COLORS['A']
                return (
                  <div key={group} className="rounded-lg border border-gray-700 p-3 bg-gray-800/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-sm font-semibold ${col.tailwind}`}>Group {group}</span>
                      <span className="text-white font-mono text-sm">{dist.count} / 20</span>
                    </div>
                    <div className="h-3 bg-gray-700 rounded overflow-hidden mb-2">
                      <div
                        className="h-full rounded transition-all duration-700"
                        style={{ width: `${dist.pct}%`, backgroundColor: col.hex }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>{dist.pct.toFixed(1)}% of selections</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Charts (existing) ── */}
      {isLoading ? (
        <div className="text-gray-500 text-center py-12">Loading A/B data…</div>
      ) : (
        <ABTestChart
          stats={stats}
          recommendedGroup={data?.recommended_group ?? null}
        />
      )}
    </div>
  )
}
