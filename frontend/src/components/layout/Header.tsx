import { Wifi, WifiOff } from 'lucide-react'
import { NotificationBell } from './NotificationBell'

interface Props {
  title: string
  subtitle?: string
  wsConnected: boolean
}

export function Header({ title, subtitle, wsConnected }: Props) {
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

        {/* Notification bell — live pending-approval dropdown */}
        <NotificationBell />

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
