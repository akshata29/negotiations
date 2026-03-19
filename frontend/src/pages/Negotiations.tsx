import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { listNegotiations, getPendingApprovals } from '../services/api'
import { StatusBadge } from '../components/common/StatusBadge'
import { ApprovalModal } from '../components/negotiations/ApprovalModal'
import { formatDistanceToNow } from 'date-fns'
import { Clock, Filter } from 'lucide-react'
import type { Negotiation } from '../types'

export function Negotiations() {
  const [params] = useSearchParams()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [selectedNeg, setSelectedNeg] = useState<Negotiation | null>(null)
  const [pendingOnly, setPendingOnly] = useState(params.get('filter') === 'pending_approval')

  const { data } = useQuery({
    queryKey: ['negotiations', pendingOnly],
    queryFn: () => pendingOnly ? getPendingApprovals() : listNegotiations({ limit: 100 }),
    refetchInterval: 15_000,
  })

  const negs = data?.negotiations ?? []

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Negotiations</h2>
          <p className="text-sm text-gray-400">{data?.total ?? negs.length} records</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <Filter className="w-4 h-4 text-gray-400" />
          <input
            type="checkbox"
            className="accent-amber-500"
            checked={pendingOnly}
            onChange={e => setPendingOnly(e.target.checked)}
          />
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-400" /> Pending approval only
          </span>
        </label>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-800">
              <tr>
                {['Vendor', 'Stage', 'Group', 'Strategy', 'Rounds', 'Score', 'Updated', ''].map(h => (
                  <th key={h} className="table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {negs.length === 0 ? (
                <tr><td colSpan={8} className="table-cell text-center text-gray-500 py-8">No negotiations found</td></tr>
              ) : (
                negs.map(neg => (
                  <tr
                    key={neg.id}
                    className="hover:bg-gray-800/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/negotiations/${neg.id}`)}
                  >
                    <td className="table-cell">
                      <p className="font-medium text-white">{neg.vendor_long_name}</p>
                      <p className="text-xs text-gray-500">ID {neg.vendor_id}</p>
                    </td>
                    <td className="table-cell">
                      <StatusBadge type="stage" value={neg.stage} />
                    </td>
                    <td className="table-cell">
                      {neg.ab_group ? <StatusBadge type="group" value={neg.ab_group} /> : '—'}
                    </td>
                    <td className="table-cell max-w-48 truncate text-xs text-gray-400">{neg.strategy ?? '—'}</td>
                    <td className="table-cell text-center">{neg.rounds}</td>
                    <td className="table-cell">
                      {neg.improvement_score > 0 ? (
                        <span className="text-green-400">{(neg.improvement_score * 100).toFixed(0)}%</span>
                      ) : '—'}
                    </td>
                    <td className="table-cell text-xs text-gray-500 whitespace-nowrap">
                      {formatDistanceToNow(new Date(neg.updated_at), { addSuffix: true })}
                    </td>
                    <td className="table-cell" onClick={e => e.stopPropagation()}>
                      {neg.pending_approval_email_id && (
                        <button
                          className="btn-primary text-xs flex items-center gap-1 whitespace-nowrap"
                          onClick={() => setSelectedNeg(neg)}
                        >
                          <Clock className="w-3 h-3" /> Review
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedNeg && (
        <ApprovalModal
          negotiation={selectedNeg}
          onClose={() => { setSelectedNeg(null); qc.invalidateQueries({ queryKey: ['negotiations'] }) }}
        />
      )}
    </div>
  )
}
