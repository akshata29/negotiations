import axios from 'axios'
import type {
  Vendor, Negotiation, ABTestStat, DashboardStats, ABGroup
} from '../types'

const api = axios.create({ baseURL: '/api' })

// ── Vendors ──────────────────────────────────────────────────────────────

export async function listVendors(params?: {
  eligible_only?: boolean
  limit?: number
  offset?: number
}) {
  const res = await api.get<{
    vendors: Vendor[]
    total: number
    eligible_count: number
    in_progress_count: number
    completed_count: number
  }>('/vendors', { params })
  return res.data
}

export async function importVendors() {
  const res = await api.post<{ status: string; ingested: number; errors: number }>('/vendors/import')
  return res.data
}

export async function generateSyntheticVendors(count: number) {
  const res = await api.post<{
    status: string
    generated: number
    errors: number
    total_vendors: number
    eligible_vendors: number
  }>('/vendors/generate-synthetic', null, { params: { count } })
  return res.data
}

export async function getVendor(vendorId: number) {
  const res = await api.get<Vendor>(`/vendors/${vendorId}`)
  return res.data
}

// ── Negotiations ──────────────────────────────────────────────────────────

export async function listNegotiations(params?: {
  limit?: number
  offset?: number
  stage?: string
}) {
  const res = await api.get<{ negotiations: Negotiation[]; total: number }>('/negotiations', { params })
  return res.data
}

export async function getPendingApprovals() {
  const res = await api.get<{ negotiations: Negotiation[]; total: number }>('/negotiations/pending-approval')
  return res.data
}

export async function getNegotiation(id: string) {
  const res = await api.get<Negotiation & { emails: Negotiation['emails'] }>(`/negotiations/${id}`)
  return res.data
}

export async function startNegotiation(vendorId: number, overrideAbGroup?: ABGroup) {
  const res = await api.post<Negotiation>('/negotiations', {
    vendor_id: vendorId,
    override_ab_group: overrideAbGroup ?? null,
  })
  return res.data
}

export async function approveEmail(
  negotiationId: string,
  approvedBy: string,
  editedBody?: string,
) {
  const res = await api.post<Negotiation>(`/negotiations/${negotiationId}/approve`, {
    approved_by: approvedBy,
    edited_body: editedBody ?? null,
  })
  return res.data
}

export async function submitVendorReply(
  negotiationId: string,
  body: string,
  senderName?: string,
) {
  const res = await api.post<{ negotiation: Negotiation; analysis: Record<string, unknown> }>(
    `/negotiations/${negotiationId}/respond`,
    { body, sender_name: senderName ?? null },
  )
  return res.data
}

export async function escalateNegotiation(negotiationId: string, notes?: string) {
  const res = await api.post<Negotiation>(`/negotiations/${negotiationId}/escalate?notes=${encodeURIComponent(notes ?? '')}`)
  return res.data
}

export async function getSimulationScenarios() {
  const res = await api.get<{
    scenarios: Array<{
      id: string; label: string; icon: string; color: string
      description: string; has_counter: boolean; rounds: number
    }>
  }>('/negotiations/simulate/scenarios')
  return res.data
}

export async function simulateNegotiation(negotiationId: string, scenario: string) {
  const res = await api.post<{
    scenario: string
    scenario_label: string
    final_stage: string
    rounds: number
    agreed_terms: Record<string, number | null> | null
    log: Array<{ action: string; detail: string; stage?: string }>
    negotiation: Record<string, unknown>
    emails: unknown[]
  }>(`/negotiations/${negotiationId}/simulate`, null, { params: { scenario } })
  return res.data
}

// ── AB Testing ────────────────────────────────────────────────────────────

export async function getABStats() {
  const res = await api.get<{ stats: ABTestStat[]; recommended_group: ABGroup; total_trials: number }>('/ab-testing/stats')
  return res.data
}

// ── Dashboard ─────────────────────────────────────────────────────────────

export async function getDashboardStats() {
  const res = await api.get<DashboardStats>('/dashboard/stats')
  return res.data
}
