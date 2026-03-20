import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Play, Filter, RefreshCw, Upload, Wand2, X, BookOpen, ChevronDown } from 'lucide-react'
import { listVendors, startNegotiation, importVendors, generateSyntheticVendors, listRuleTemplates } from '../../services/api'
import { StatusBadge } from '../common/StatusBadge'
import { RuleBuilderModal } from './RuleBuilderModal'
import type { Vendor, RuleTemplate } from '../../types'

interface Props {
  onViewNegotiation?: (id: string) => void
}

export function VendorTable({ onViewNegotiation }: Props) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [eligibleOnly, setEligibleOnly] = useState(false)
  const [page, setPage] = useState(0)
  const [showGenModal, setShowGenModal] = useState(false)
  const [showRuleBuilder, setShowRuleBuilder] = useState(false)
  const [activeTemplate, setActiveTemplate] = useState<RuleTemplate | null>(null)
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false)
  const [genCount, setGenCount] = useState(100)
  const PAGE_SIZE = 50

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['vendors', eligibleOnly, page, activeTemplate?.id ?? null],
    queryFn: () => listVendors({
      eligible_only: eligibleOnly && !activeTemplate,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      template_id: activeTemplate?.id ?? null,
    }),
  })

  const { data: templatesData } = useQuery({
    queryKey: ['rule-templates'],
    queryFn: listRuleTemplates,
  })

  const importMut = useMutation({
    mutationFn: importVendors,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendors'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
  })

  const startMut = useMutation({
    mutationFn: (vendorId: number) => startNegotiation(vendorId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendors'] }); qc.invalidateQueries({ queryKey: ['negotiations'] }) },
  })

  const genMut = useMutation({
    mutationFn: (count: number) => generateSyntheticVendors(count),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendors'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setShowGenModal(false)
    },
  })

  const filtered = (data?.vendors ?? []).filter((v: Vendor) =>
    v.vendor_long_name.toLowerCase().includes(search.toLowerCase()) ||
    String(v.vendor_id).includes(search),
  )

  return (
    <div className="card flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            className="input pl-9"
            placeholder="Search vendors…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <label className={`flex items-center gap-2 text-sm cursor-pointer transition-colors ${activeTemplate ? 'text-gray-600 opacity-40 pointer-events-none' : 'text-gray-300'}`}>
          <Filter className="w-4 h-4 text-gray-400" />
          <input
            type="checkbox"
            className="accent-blue-500"
            checked={eligibleOnly}
            disabled={!!activeTemplate}
            onChange={e => { setEligibleOnly(e.target.checked); setPage(0) }}
          />
          Eligible only
        </label>

        {/* Template Preset Selector */}
        <div className="relative">
          <button
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
              activeTemplate
                ? 'bg-blue-900/40 border-blue-600 text-blue-300'
                : 'btn-secondary border-gray-700 text-gray-300'
            }`}
            onClick={() => setShowTemplateDropdown(v => !v)}
          >
            <BookOpen className="w-3.5 h-3.5" />
            {activeTemplate ? activeTemplate.name : 'Presets'}
            {activeTemplate
              ? <X className="w-3 h-3 ml-1 hover:text-red-400" onClick={e => { e.stopPropagation(); setActiveTemplate(null); setPage(0) }} />
              : <ChevronDown className="w-3.5 h-3.5 opacity-60" />
            }
          </button>

          {showTemplateDropdown && (
            <div className="absolute left-0 top-full mt-1 z-30 bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-64 py-1">
              {(templatesData?.templates ?? []).length === 0 ? (
                <p className="py-3 px-4 text-xs text-gray-500">No presets saved yet.</p>
              ) : (
                (templatesData?.templates ?? []).map(t => (
                  <button
                    key={t.id}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-800 transition-colors"
                    onClick={() => { setActiveTemplate(t); setPage(0); setShowTemplateDropdown(false) }}
                  >
                    <span className={`font-medium ${activeTemplate?.id === t.id ? 'text-blue-300' : 'text-white'}`}>{t.name}</span>
                    {t.description && <span className="block text-xs text-gray-500 truncate">{t.description}</span>}
                  </button>
                ))
              )}
              <div className="border-t border-gray-800 mt-1 pt-1">
                <button
                  className="w-full text-left px-4 py-2 text-xs text-blue-400 hover:text-blue-300 hover:bg-gray-800 transition-colors flex items-center gap-1.5"
                  onClick={() => { setShowTemplateDropdown(false); setShowRuleBuilder(true) }}
                >
                  <BookOpen className="w-3.5 h-3.5" /> Manage presets…
                </button>
              </div>
            </div>
          )}
        </div>

        <button className="btn-secondary flex items-center gap-1.5 text-sm" onClick={() => refetch()}>
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
        <button
          className="btn-primary flex items-center gap-1.5 text-sm"
          onClick={() => importMut.mutate()}
          disabled={importMut.isPending}
        >
          <Upload className="w-3.5 h-3.5" />
          {importMut.isPending ? 'Importing…' : 'Import Excel'}
        </button>
        <button
          className="btn-secondary flex items-center gap-1.5 text-sm border-purple-700 text-purple-300 hover:bg-purple-900/30"
          onClick={() => setShowGenModal(true)}
        >
          <Wand2 className="w-3.5 h-3.5" /> Generate Data
        </button>
      </div>

      {/* Active template chip */}
      {activeTemplate && (
        <div className="flex items-center gap-2 text-xs text-blue-300 bg-blue-900/20 border border-blue-800/50 rounded-lg px-3 py-2">
          <BookOpen className="w-3.5 h-3.5 shrink-0" />
          <span className="font-medium">{activeTemplate.name}</span>
          <span className="text-blue-500">·</span>
          <span className="text-blue-400">{activeTemplate.conditions.length} condition{activeTemplate.conditions.length !== 1 ? 's' : ''} ({activeTemplate.conjunction})</span>
          <button className="ml-auto text-blue-500 hover:text-white transition-colors" onClick={() => setActiveTemplate(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {importMut.isSuccess && (
        <div className="text-xs text-green-400 bg-green-900/20 rounded-lg px-3 py-2">
          ✓ Import complete — {(importMut.data as { ingested?: number })?.ingested ?? 0} vendors loaded
        </div>
      )}

      {genMut.isSuccess && (
        <div className="text-xs text-green-400 bg-green-900/20 rounded-lg px-3 py-2">
          ✓ Generated {(genMut.data as { generated?: number })?.generated ?? 0} synthetic vendors
          ({(genMut.data as { eligible_vendors?: number })?.eligible_vendors ?? 0} eligible)
        </div>
      )}

      {/* Generate Synthetic Data Modal */}
      {showGenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-purple-400" />
                <h3 className="text-white font-semibold text-base">Generate Synthetic Vendors</h3>
              </div>
              <button onClick={() => setShowGenModal(false)} className="text-gray-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-gray-400 mb-5">
              Creates randomized vendor records with realistic names, YTD amounts, and payment terms.
              ~80% will be MPN comp, ~70% will have email addresses, and eligibility rules are applied automatically.
            </p>

            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-300">Vendor Count</label>
                <span className="text-purple-300 font-semibold text-sm w-12 text-right">{genCount}</span>
              </div>
              <input
                type="range"
                min={10}
                max={2000}
                step={10}
                value={genCount}
                onChange={e => setGenCount(Number(e.target.value))}
                className="w-full accent-purple-500"
              />
              <div className="flex justify-between text-xs text-gray-600">
                <span>10</span>
                <span>500</span>
                <span>1000</span>
                <span>2000</span>
              </div>
              <input
                type="number"
                min={10}
                max={2000}
                value={genCount}
                onChange={e => setGenCount(Math.min(2000, Math.max(10, Number(e.target.value))))}
                className="input text-sm w-full"
              />
            </div>

            <div className="flex gap-3">
              <button
                className="flex-1 btn-secondary text-sm"
                onClick={() => setShowGenModal(false)}
                disabled={genMut.isPending}
              >
                Cancel
              </button>
              <button
                className="flex-1 bg-purple-700 hover:bg-purple-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                onClick={() => genMut.mutate(genCount)}
                disabled={genMut.isPending}
              >
                <Wand2 className="w-4 h-4" />
                {genMut.isPending ? `Generating ${genCount} vendors…` : `Generate ${genCount} Vendors`}
              </button>
            </div>

            {genMut.isError && (
              <p className="text-xs text-red-400 mt-3">Error generating vendors. Check console for details.</p>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto -mx-5">
        <table className="w-full">
          <thead className="border-y border-gray-800">
            <tr>
              {['Vendor', 'ID', 'Catg', 'Status', 'YTD Purchase', 'Discount %', 'Term Days', 'Net Days', 'Eligible', 'Neg. Status', ''].map(h => (
                <th key={h} className="table-header">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {isLoading ? (
              <tr><td colSpan={11} className="table-cell text-center text-gray-500 py-8">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={11} className="table-cell text-center text-gray-500 py-8">No vendors found</td></tr>
            ) : (
              filtered.map((v: Vendor) => (
                <tr key={v.id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="table-cell font-medium text-white">{v.vendor_long_name}</td>
                  <td className="table-cell text-gray-400">{v.vendor_id}</td>
                  <td className="table-cell">
                    <span className="badge bg-gray-800 text-gray-300">{v.catg}</span>
                  </td>
                  <td className="table-cell">
                    <span className={`badge ${v.status === 'ACT' ? 'bg-green-900 text-green-300' : 'bg-gray-800 text-gray-400'}`}>
                      {v.status}
                    </span>
                  </td>
                  <td className="table-cell text-right">${v.ytd_purchase_amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                  <td className="table-cell text-right">
                    <span className={v.std_terms < 2 ? 'text-red-400' : 'text-green-400'}>{v.std_terms}%</span>
                  </td>
                  <td className="table-cell text-right">{v.term_days}</td>
                  <td className="table-cell text-right">{v.net_days}</td>
                  <td className="table-cell">
                    {v.eligible_for_negotiation ? (
                      <span className="badge bg-green-900 text-green-300">Yes</span>
                    ) : (
                      <span title={v.exclusion_reason ?? ''} className="badge bg-gray-800 text-gray-500 cursor-help">No</span>
                    )}
                  </td>
                  <td className="table-cell">
                    <StatusBadge type="status" value={v.negotiation_status} />
                  </td>
                  <td className="table-cell">
                    {v.eligible_for_negotiation && v.negotiation_status === 'eligible' && (
                      <button
                        className="btn-primary text-xs flex items-center gap-1"
                        onClick={() => startMut.mutate(v.vendor_id)}
                        disabled={startMut.isPending}
                      >
                        <Play className="w-3 h-3" /> Start
                      </button>
                    )}
                    {v.active_negotiation_id && onViewNegotiation && (
                      <button
                        className="btn-secondary text-xs"
                        onClick={() => onViewNegotiation(v.active_negotiation_id!)}
                      >
                        View
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{data?.total ?? 0} total vendors ({data?.eligible_count ?? 0} eligible)</span>
        <div className="flex gap-2">
          <button className="btn-secondary text-xs" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span className="py-2">Page {page + 1}</span>
          <button className="btn-secondary text-xs" onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      </div>

      {/* Rule Builder Modal */}
      {showRuleBuilder && (
        <RuleBuilderModal
          onClose={() => setShowRuleBuilder(false)}
          onApply={(t) => { setActiveTemplate(t); setPage(0) }}
        />
      )}

      {/* Click-outside overlay for template dropdown */}
      {showTemplateDropdown && (
        <div className="fixed inset-0 z-20" onClick={() => setShowTemplateDropdown(false)} />
      )}
    </div>
  )
}
