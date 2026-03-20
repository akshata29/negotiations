import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, MessageSquare, BarChart3, Settings, Zap
} from 'lucide-react'
import { clsx } from 'clsx'

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/vendors', icon: Users, label: 'Vendors' },
  { to: '/negotiations', icon: MessageSquare, label: 'Negotiations' },
  { to: '/ab-testing', icon: BarChart3, label: 'A/B Testing & RL' },
]

export function Sidebar() {
  return (
    <aside className="w-60 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">ABC</p>
            <p className="text-xs text-gray-400 leading-tight">NegoAgent</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800',
              )
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-800">
        <p className="text-xs text-gray-600">Autonomous Negotiations v1.0</p>
        <p className="text-xs text-gray-700">Azure AI Foundry • Cosmos DB</p>
      </div>
    </aside>
  )
}
