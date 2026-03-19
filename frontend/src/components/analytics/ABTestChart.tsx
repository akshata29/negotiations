import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from 'recharts'
import type { ABTestStat } from '../../types'

interface Props {
  stats: ABTestStat[]
  recommendedGroup: string | null
}

const GROUP_COLORS: Record<string, string> = {
  A: '#a855f7',
  B: '#6366f1',
  C: '#ec4899',
}

export function ABTestChart({ stats, recommendedGroup }: Props) {
  if (!stats.length) return <p className="text-gray-500 text-sm">No A/B data yet.</p>

  const barData = stats.map(s => ({
    name: `Group ${s.group}`,
    'Success Rate': +(s.success_rate * 100).toFixed(1),
    'Q-Value': +(s.q_value * 100).toFixed(1),
    Trials: s.total_trials,
    fill: GROUP_COLORS[s.group],
  }))

  const radarData = [
    { metric: 'Success Rate', ...Object.fromEntries(stats.map(s => [`Group ${s.group}`, +(s.success_rate * 100).toFixed(1)])) },
    { metric: 'Avg Reward', ...Object.fromEntries(stats.map(s => [`Group ${s.group}`, +(s.avg_reward * 100).toFixed(1)])) },
    { metric: 'Q-Value', ...Object.fromEntries(stats.map(s => [`Group ${s.group}`, +(s.q_value * 100).toFixed(1)])) },
    { metric: 'Trials (×5)', ...Object.fromEntries(stats.map(s => [`Group ${s.group}`, s.total_trials * 5])) },
  ]

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Bar chart */}
      <div className="card">
        <h3 className="text-sm font-semibold text-white mb-4">Success Rate & Q-Value by Group</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={barData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Legend />
            <Bar dataKey="Success Rate" fill="#6366f1" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Q-Value" fill="#a855f7" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Radar */}
      <div className="card">
        <h3 className="text-sm font-semibold text-white mb-4">Multi-Metric Comparison</h3>
        <ResponsiveContainer width="100%" height={220}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="#374151" />
            <PolarAngleAxis dataKey="metric" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            {stats.map(s => (
              <Radar
                key={s.group}
                name={`Group ${s.group}`}
                dataKey={`Group ${s.group}`}
                stroke={GROUP_COLORS[s.group]}
                fill={GROUP_COLORS[s.group]}
                fillOpacity={0.15}
              />
            ))}
            <Legend />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Strategy cards */}
      <div className="xl:col-span-2 grid grid-cols-3 gap-4">
        {stats.map(s => (
          <div
            key={s.group}
            className={`rounded-xl border p-4 ${
              recommendedGroup === s.group
                ? 'border-blue-500 bg-blue-900/20'
                : 'border-gray-800 bg-gray-800/30'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span style={{ color: GROUP_COLORS[s.group] }} className="text-lg font-bold">Group {s.group}</span>
              {recommendedGroup === s.group && (
                <span className="badge bg-blue-900 text-blue-300 text-xs">⭐ Recommended</span>
              )}
            </div>
            <p className="text-xs text-gray-400 mb-3">{s.strategy}</p>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-gray-400">Trials</span><span className="text-white">{s.total_trials}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Success Rate</span><span className="text-green-400">{(s.success_rate * 100).toFixed(1)}%</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Avg Reward</span><span className="text-purple-400">{(s.avg_reward * 100).toFixed(1)}%</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Q-Value</span><span className="text-blue-400">{s.q_value.toFixed(4)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">UCB1 Score</span><span className="text-yellow-400">{s.ucb1_score > 100 ? '∞' : s.ucb1_score.toFixed(4)}</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
