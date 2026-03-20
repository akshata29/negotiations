import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Plus, Trash2, Save, BookOpen } from 'lucide-react'
import { createRuleTemplate, deleteRuleTemplate, getFieldCatalog, listRuleTemplates } from '../../services/api'
import type { RuleCondition, RuleConjunction, RuleTemplate } from '../../types'

// ── Field display labels ───────────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  comp: 'Comp',
  catg: 'Category',
  status: 'Status',
  ytd_purchase_amount: 'YTD Purchase ($)',
  ytd_rcvd_amount: 'YTD Received ($)',
  std_terms: 'Discount %',
  term_days: 'Term Days',
  net_days: 'Net Days',
  eligible_for_negotiation: 'Eligible',
}

const OPERATOR_LABELS: Record<string, string> = {
  eq: '=',
  ne: '≠',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  in: 'in',
  not_in: 'not in',
}

// Common string preset values per field
const STRING_PRESETS: Record<string, string[]> = {
  comp: ['MPN', 'WHL', 'SPC'],
  catg: ['DRY', 'FRS', 'TOB', 'SEA', 'PET', 'DAI', 'HBC'],
  status: ['ACT', 'INA'],
  eligible_for_negotiation: ['true', 'false'],
}

interface Props {
  onClose: () => void
  onApply: (template: RuleTemplate) => void
}

interface ConditionDraft {
  field: string
  operator: string
  rawValue: string   // text input; parsed on save
}

const EMPTY_CONDITION: ConditionDraft = {
  field: 'comp',
  operator: 'eq',
  rawValue: '',
}

function parseValue(raw: string, fieldType: string, operator: string): string | number | boolean | string[] {
  if (operator === 'in' || operator === 'not_in') {
    return raw.split(',').map(s => s.trim()).filter(Boolean)
  }
  if (fieldType === 'number') {
    const n = parseFloat(raw)
    return isNaN(n) ? 0 : n
  }
  if (fieldType === 'boolean') {
    return raw === 'true'
  }
  return raw
}

export function RuleBuilderModal({ onClose, onApply }: Props) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [conjunction, setConjunction] = useState<RuleConjunction>('AND')
  const [conditions, setConditions] = useState<ConditionDraft[]>([{ ...EMPTY_CONDITION }])
  const [activeTab, setActiveTab] = useState<'build' | 'saved'>('build')
  const [error, setError] = useState<string | null>(null)

  const { data: catalogData } = useQuery({
    queryKey: ['field-catalog'],
    queryFn: getFieldCatalog,
  })

  const { data: templatesData } = useQuery({
    queryKey: ['rule-templates'],
    queryFn: listRuleTemplates,
  })

  const saveMut = useMutation({
    mutationFn: createRuleTemplate,
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['rule-templates'] })
      onApply(saved)
    },
  })

  const deleteMut = useMutation({
    mutationFn: deleteRuleTemplate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rule-templates'] }),
  })

  const fieldMap = Object.fromEntries(
    (catalogData?.fields ?? []).map(f => [f.field, f])
  )

  function addCondition() {
    setConditions(prev => [...prev, { ...EMPTY_CONDITION }])
  }

  function removeCondition(idx: number) {
    setConditions(prev => prev.filter((_, i) => i !== idx))
  }

  function updateCondition(idx: number, patch: Partial<ConditionDraft>) {
    setConditions(prev => prev.map((c, i) => {
      if (i !== idx) return c
      const updated = { ...c, ...patch }
      // Reset operator when field changes if current op is invalid for new field
      if (patch.field) {
        const ft = fieldMap[patch.field]?.type ?? 'string'
        const validOps = fieldMap[patch.field]?.operators ?? []
        if (!validOps.includes(updated.operator as any)) {
          updated.operator = validOps[0] ?? 'eq'
        }
        // Reset value for booleans to a sensible default
        if (ft === 'boolean') updated.rawValue = 'true'
      }
      return updated
    }))
  }

  function handleSave() {
    setError(null)
    if (!name.trim()) { setError('Template name is required'); return }
    if (conditions.length === 0) { setError('Add at least one condition'); return }

    const builtConditions: RuleCondition[] = conditions.map(c => {
      const ft = fieldMap[c.field]?.type ?? 'string'
      return {
        field: c.field,
        operator: c.operator as any,
        value: parseValue(c.rawValue, ft, c.operator),
      }
    })

    saveMut.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      conditions: builtConditions,
      conjunction,
    })
  }

  const catalog = catalogData?.fields ?? []
  const templates = templatesData?.templates ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-400" />
            <h3 className="text-white font-semibold text-base">Filter Presets</h3>
          </div>
          <div className="flex items-center gap-3">
            {/* Tabs */}
            <div className="flex rounded-lg overflow-hidden border border-gray-700 text-sm">
              <button
                onClick={() => setActiveTab('build')}
                className={`px-3 py-1.5 transition-colors ${activeTab === 'build' ? 'bg-blue-700 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
              >
                New Preset
              </button>
              <button
                onClick={() => setActiveTab('saved')}
                className={`px-3 py-1.5 transition-colors ${activeTab === 'saved' ? 'bg-blue-700 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
              >
                Saved ({templates.length})
              </button>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5">
          {activeTab === 'build' ? (
            <div className="space-y-5">
              {/* Name + Description */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Preset Name *</label>
                  <input
                    className="input w-full text-sm"
                    placeholder="e.g. High Value MPN"
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Description</label>
                  <input
                    className="input w-full text-sm"
                    placeholder="Optional short description"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                  />
                </div>
              </div>

              {/* Conjunction toggle */}
              <div className="flex items-center gap-3 text-sm">
                <span className="text-gray-400">Match</span>
                <div className="flex rounded-lg overflow-hidden border border-gray-700">
                  {(['AND', 'OR'] as RuleConjunction[]).map(c => (
                    <button
                      key={c}
                      onClick={() => setConjunction(c)}
                      className={`px-4 py-1.5 font-medium transition-colors ${conjunction === c ? 'bg-blue-700 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <span className="text-gray-400">conditions</span>
              </div>

              {/* Conditions */}
              <div className="space-y-2">
                {conditions.map((cond, idx) => {
                  const fieldInfo = fieldMap[cond.field]
                  const fieldType = fieldInfo?.type ?? 'string'
                  const validOps = fieldInfo?.operators ?? ['eq']
                  const presets = STRING_PRESETS[cond.field]
                  const isMulti = cond.operator === 'in' || cond.operator === 'not_in'

                  return (
                    <div key={idx} className="flex items-center gap-2 bg-gray-800/50 rounded-lg p-2">
                      {/* Field selector */}
                      <select
                        className="input text-sm flex-1"
                        value={cond.field}
                        onChange={e => updateCondition(idx, { field: e.target.value })}
                      >
                        {catalog.map(f => (
                          <option key={f.field} value={f.field}>{FIELD_LABELS[f.field] ?? f.field}</option>
                        ))}
                      </select>

                      {/* Operator selector */}
                      <select
                        className="input text-sm w-24"
                        value={cond.operator}
                        onChange={e => updateCondition(idx, { operator: e.target.value })}
                      >
                        {validOps.map(op => (
                          <option key={op} value={op}>{OPERATOR_LABELS[op] ?? op}</option>
                        ))}
                      </select>

                      {/* Value input */}
                      {fieldType === 'boolean' ? (
                        <select
                          className="input text-sm flex-1"
                          value={cond.rawValue}
                          onChange={e => updateCondition(idx, { rawValue: e.target.value })}
                        >
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      ) : presets && !isMulti ? (
                        <select
                          className="input text-sm flex-1"
                          value={cond.rawValue}
                          onChange={e => updateCondition(idx, { rawValue: e.target.value })}
                        >
                          <option value="">— choose —</option>
                          {presets.map(p => <option key={p} value={p}>{p}</option>)}
                          <option value="__custom">Custom…</option>
                        </select>
                      ) : (
                        <input
                          className="input text-sm flex-1"
                          placeholder={isMulti ? 'val1, val2, …' : fieldType === 'number' ? '0' : 'value'}
                          value={cond.rawValue}
                          onChange={e => updateCondition(idx, { rawValue: e.target.value })}
                        />
                      )}

                      <button
                        onClick={() => removeCondition(idx)}
                        disabled={conditions.length === 1}
                        className="text-gray-600 hover:text-red-400 transition-colors disabled:opacity-30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )
                })}

                <button
                  onClick={addCondition}
                  className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors mt-1"
                >
                  <Plus className="w-4 h-4" /> Add condition
                </button>
              </div>

              {error && (
                <p className="text-xs text-red-400 bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
              )}
              {saveMut.isError && (
                <p className="text-xs text-red-400 bg-red-900/20 rounded-lg px-3 py-2">
                  Failed to save preset. Check that all condition values are filled in.
                </p>
              )}
            </div>
          ) : (
            /* Saved Templates list */
            <div className="space-y-2">
              {templates.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No saved presets yet. Build one on the "New Preset" tab.</p>
              ) : (
                templates.map(t => (
                  <div key={t.id} className="bg-gray-800/50 rounded-lg p-3 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium">{t.name}</p>
                      {t.description && <p className="text-gray-500 text-xs">{t.description}</p>}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {t.conditions.map((c, i) => (
                          <span key={i} className="badge bg-gray-700 text-gray-300 text-xs">
                            {FIELD_LABELS[c.field] ?? c.field} {OPERATOR_LABELS[c.operator as string] ?? c.operator} {Array.isArray(c.value) ? c.value.join(', ') : String(c.value)}
                          </span>
                        ))}
                      </div>
                      <p className="text-gray-600 text-xs mt-1">{t.conjunction} · {t.conditions.length} condition{t.conditions.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        className="btn-primary text-xs"
                        onClick={() => { onApply(t); onClose() }}
                      >
                        Apply
                      </button>
                      <button
                        disabled={deleteMut.isPending}
                        onClick={() => deleteMut.mutate(t.id)}
                        className="text-gray-600 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {activeTab === 'build' && (
          <div className="px-6 py-4 border-t border-gray-800 flex justify-end gap-3">
            <button className="btn-secondary text-sm" onClick={onClose}>Cancel</button>
            <button
              className="btn-primary flex items-center gap-1.5 text-sm"
              onClick={handleSave}
              disabled={saveMut.isPending}
            >
              <Save className="w-4 h-4" />
              {saveMut.isPending ? 'Saving…' : 'Save & Apply'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
