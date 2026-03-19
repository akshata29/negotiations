import { Bell, Wifi, WifiOff } from 'lucide-react'

interface Props {
  title: string
  subtitle?: string
  wsConnected: boolean
  pendingApprovals?: number
}

export function Header({ title, subtitle, wsConnected, pendingApprovals = 0 }: Props) {
  return (
    <header className="h-14 flex-shrink-0 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6">
      <div>
        <h1 className="text-base font-semibold text-white">{title}</h1>
        {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {/* WebSocket status */}
        <div className="flex items-center gap-1.5 text-xs">
          {wsConnected ? (
            <><Wifi className="w-3.5 h-3.5 text-green-400" /><span className="text-green-400">Live</span></>
          ) : (
            <><WifiOff className="w-3.5 h-3.5 text-red-400" /><span className="text-red-400">Disconnected</span></>
          )}
        </div>

        {/* Approval badge */}
        {pendingApprovals > 0 && (
          <div className="relative">
            <Bell className="w-5 h-5 text-amber-400" />
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-500 rounded-full text-xs text-white flex items-center justify-center">
              {pendingApprovals}
            </span>
          </div>
        )}

        {/* User */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
            JC
          </div>
          <span className="text-xs text-gray-300">James Caldwell</span>
        </div>
      </div>
    </header>
  )
}
