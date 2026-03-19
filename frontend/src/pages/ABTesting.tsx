import { useQuery } from '@tanstack/react-query'
import { getABStats } from '../services/api'
import { ABTestChart } from '../components/analytics/ABTestChart'
import { TrendingUp, Beaker } from 'lucide-react'

export function ABTesting() {
  const { data, isLoading } = useQuery({
    queryKey: ['ab-stats'],
    queryFn: getABStats,
    refetchInterval: 30_000,
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Beaker className="w-5 h-5 text-purple-400" />
          A/B Testing & Reinforcement Learning
        </h2>
        <p className="text-sm text-gray-400 mt-1">
          UCB1 multi-armed bandit selects the optimal strategy. Groups auto-converge toward highest reward over time.
        </p>
      </div>

      {/* RL explanation */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            group: 'A',
            color: 'purple',
            title: 'Group A — Cash Discount',
            desc: 'Request cash discount improvement to ≥ 2% (STD Terms). Best when vendor has low current discount.',
          },
          {
            group: 'B',
            color: 'indigo',
            title: 'Group B — Term Days',
            desc: 'Request +10 days on both Term Days and Net Days. Best when vendor already has adequate discount.',
          },
          {
            group: 'C',
            color: 'pink',
            title: 'Group C — Both',
            desc: 'Request both cash discount AND term days extension. Highest potential reward, higher rejection risk.',
          },
        ].map(item => (
          <div key={item.group} className="card border border-gray-700">
            <h3 className={`text-sm font-semibold mb-1 text-${item.color}-400`}>{item.title}</h3>
            <p className="text-xs text-gray-400">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* UCB1 explanation */}
      <div className="card border border-blue-900/40 bg-blue-900/10 space-y-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-blue-300">UCB1 Algorithm</h3>
        </div>
        <p className="text-xs text-gray-300 leading-relaxed">
          Each time a new negotiation starts, the UCB1 algorithm scores each strategy arm:
          <strong className="text-white"> UCB1 = Q(a) + c × √(ln N / N(a))</strong>, where Q(a) = estimated reward,
          N = total trials, N(a) = trials for arm a, c = exploration constant (2.0). Arms with
          fewer trials get exploration bonuses. As data accumulates, the best-performing strategy
          is selected more frequently, effectively implementing reinforcement learning.
        </p>
        <div className="flex gap-6 text-xs">
          <div><span className="text-gray-400">Reward scale: </span><span className="text-green-400">0 = reject</span> · <span className="text-yellow-400">0.5 = partial</span> · <span className="text-blue-400">1.0 = full</span> · <span className="text-purple-400">1.5 = 1st round</span></div>
          <div><span className="text-gray-400">Exploration constant: </span><span className="text-white">c = 2.0</span></div>
        </div>
      </div>

      {/* Charts */}
      {isLoading ? (
        <div className="text-gray-500 text-center py-12">Loading A/B data…</div>
      ) : (
        <ABTestChart
          stats={data?.stats ?? []}
          recommendedGroup={data?.recommended_group ?? null}
        />
      )}
    </div>
  )
}
