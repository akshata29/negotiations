import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Bell, Clock, X, ChevronRight } from 'lucide-react'
import { getPendingApprovals } from '../../services/api'
import { formatDistanceToNow } from 'date-fns'

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['pending-approvals'],
    queryFn: getPendingApprovals,
    refetchInterval: 20_000,
  })

  const negs = data?.negotiations ?? []
  const count = negs.length

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
        aria-label="Notifications"
      >
        <Bell className={count > 0 ? 'w-5 h-5 text-amber-400' : 'w-5 h-5 text-gray-500'} />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-amber-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center leading-none">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-9 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-semibold text-white">Pending Approvals</span>
              {count > 0 && (
                <span className="bg-amber-500/20 text-amber-400 text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {count}
                </span>
              )}
            </div>
            <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="px-4 py-6 text-center text-sm text-gray-500">Loading…</div>
            ) : negs.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No pending approvals</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-800">
                {negs.map(neg => (
                  <li key={neg.id}>
                    <button
                      className="w-full text-left px-4 py-3 hover:bg-gray-800/70 transition-colors flex items-start gap-3 group"
                      onClick={() => {
                        setOpen(false)
                        navigate(`/negotiations/${neg.id}`)
                      }}
                    >
                      <div className="w-2 h-2 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{neg.vendor_long_name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{neg.strategy ?? 'Awaiting approval'}</p>
                        <p className="text-xs text-gray-600 mt-0.5">
                          {formatDistanceToNow(new Date(neg.updated_at), { addSuffix: true })}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 mt-1 flex-shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          {negs.length > 0 && (
            <div className="border-t border-gray-800 px-4 py-2.5">
              <button
                className="text-xs text-blue-400 hover:text-blue-300 font-medium w-full text-center"
                onClick={() => {
                  setOpen(false)
                  navigate('/negotiations?filter=pending_approval')
                }}
              >
                View all pending approvals →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
