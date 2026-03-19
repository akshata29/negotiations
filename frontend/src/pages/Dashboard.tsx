import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Users, MessageSquare, CheckCircle, Clock, TrendingUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getDashboardStats } from '../services/api'
import { StatCard } from '../components/common/StatCard'
import { StatusBadge } from '../components/common/StatusBadge'
import { useWebSocket } from '../hooks/useWebSocket'
import { formatDistanceToNow } from 'date-fns'
import type { WSEvent } from '../types'

interface Props { setWsConnected: (v: boolean) => void; setPending: (n: number) => void }

export function Dashboard({ setWsConnected, setPending }: Props) {
  const qc = useQueryClient()
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboardStats,
    refetchInterval: 30_000,
  })

  useWebSocket((evt: WSEvent) => {
    setWsConnected(true)
    if (['negotiation_started', 'email_sent', 'reply_received', 'approval_needed', 'negotiation_escalated'].includes(evt.event)) {
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['negotiations'] })
      if (data) setPending(data.pending_approvals)
    }
  })

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Loading dashboard…</div>
  }

  const vc = data?.vendor_counts ?? { total: 0, eligible: 0, in_progress: 0, completed: 0 }
  const best = data?.best_ab_group
  const bestStat = data?.rl_stats.find(s => s.group === best)

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total Vendors"
          value={vc.total.toLocaleString()}
          subtitle={`${vc.eligible.toLocaleString()} eligible`}
          icon={<Users className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          title="In Progress"
          value={vc.in_progress}
          subtitle="Active negotiations"
          icon={<MessageSquare className="w-5 h-5" />}
          color="yellow"
        />
        <StatCard
          title="Completed"
          value={vc.completed}
          subtitle="Terms agreed"
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

      {/* RL insight + recent */}
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

      {/* Pending approvals call-to-action */}
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
