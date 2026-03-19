import { type ReactNode } from 'react'
import { clsx } from 'clsx'

interface Props {
  title: string
  value: string | number
  subtitle?: string
  icon: ReactNode
  trend?: 'up' | 'down' | 'neutral'
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple'
}

const colorMap = {
  blue: { bg: 'bg-blue-900/30', icon: 'text-blue-400', border: 'border-blue-800/40' },
  green: { bg: 'bg-green-900/30', icon: 'text-green-400', border: 'border-green-800/40' },
  yellow: { bg: 'bg-yellow-900/30', icon: 'text-yellow-400', border: 'border-yellow-800/40' },
  red: { bg: 'bg-red-900/30', icon: 'text-red-400', border: 'border-red-800/40' },
  purple: { bg: 'bg-purple-900/30', icon: 'text-purple-400', border: 'border-purple-800/40' },
}

export function StatCard({ title, value, subtitle, icon, color = 'blue' }: Props) {
  const c = colorMap[color]
  return (
    <div className={clsx('card border', c.border, 'flex items-start gap-4')}>
      <div className={clsx('p-3 rounded-xl', c.bg)}>
        <div className={clsx('w-5 h-5', c.icon)}>{icon}</div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  )
}
