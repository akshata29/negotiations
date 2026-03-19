import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, Edit3, X, MessageSquare, AlertTriangle } from 'lucide-react'
import { approveEmail, submitVendorReply, escalateNegotiation } from '../../services/api'
import { StatusBadge } from '../common/StatusBadge'
import type { Negotiation } from '../../types'

interface Props {
  negotiation: Negotiation
  onClose: () => void
}

export function ApprovalModal({ negotiation, onClose }: Props) {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'approve' | 'reply' | 'escalate'>('approve')
  const [editedBody, setEditedBody] = useState('')
  const [replyBody, setReplyBody] = useState('')
  const [escalateNotes, setEscalateNotes] = useState('')
  const [approver] = useState('James Caldwell')
  const [isEditing, setIsEditing] = useState(false)

  const approveMut = useMutation({
    mutationFn: () =>
      approveEmail(negotiation.id, approver, isEditing && editedBody ? editedBody : undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['negotiations'] })
      qc.invalidateQueries({ queryKey: ['negotiation', negotiation.id] })
      onClose()
    },
  })

  const replyMut = useMutation({
    mutationFn: () => submitVendorReply(negotiation.id, replyBody),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['negotiation', negotiation.id] })
      qc.invalidateQueries({ queryKey: ['negotiations'] })
      onClose()
    },
  })

  const escalateMut = useMutation({
    mutationFn: () => escalateNegotiation(negotiation.id, escalateNotes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['negotiations'] })
      onClose()
    },
  })

  // Find pending email from emails list
  const pendingEmail = negotiation.emails?.find(e => e.id === negotiation.pending_approval_email_id)

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <h2 className="font-semibold text-white">{negotiation.vendor_long_name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge type="stage" value={negotiation.stage} />
              {negotiation.ab_group && <StatusBadge type="group" value={negotiation.ab_group} />}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800">
          {[
            { key: 'approve', label: 'Approve Email', icon: CheckCircle },
            { key: 'reply', label: 'Submit Vendor Reply', icon: MessageSquare },
            { key: 'escalate', label: 'Escalate', icon: AlertTriangle },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key as typeof tab)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === key
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Approve tab */}
          {tab === 'approve' && (
            <div className="space-y-4">
              {pendingEmail ? (
                <>
                  <div className="bg-gray-800 rounded-lg p-4 space-y-2">
                    <p className="text-xs text-gray-400">Subject</p>
                    <p className="text-sm text-white font-medium">{pendingEmail.subject}</p>
                  </div>
                  {isEditing ? (
                    <textarea
                      className="input h-48 resize-none font-mono text-xs"
                      value={editedBody || pendingEmail.body}
                      onChange={e => setEditedBody(e.target.value)}
                    />
                  ) : (
                    <div className="bg-gray-800/50 rounded-lg p-4 text-sm text-gray-200 whitespace-pre-wrap max-h-60 overflow-y-auto border border-gray-700">
                      {pendingEmail.body}
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <button
                      className="btn-secondary text-sm flex items-center gap-1.5"
                      onClick={() => { setIsEditing(!isEditing); if (!editedBody) setEditedBody(pendingEmail.body) }}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      {isEditing ? 'Preview' : 'Edit Draft'}
                    </button>
                    <button
                      className="btn-primary text-sm flex items-center gap-1.5 ml-auto"
                      onClick={() => approveMut.mutate()}
                      disabled={approveMut.isPending}
                    >
                      <CheckCircle className="w-4 h-4" />
                      {approveMut.isPending ? 'Approving…' : 'Approve & Send'}
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-gray-400 text-sm">No email pending approval for this negotiation.</p>
              )}
            </div>
          )}

          {/* Reply tab */}
          {tab === 'reply' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">Paste the vendor's email reply to continue the negotiation workflow.</p>
              <textarea
                className="input h-48 resize-none text-sm"
                placeholder="Paste vendor reply here…"
                value={replyBody}
                onChange={e => setReplyBody(e.target.value)}
              />
              <button
                className="btn-primary text-sm w-full"
                onClick={() => replyMut.mutate()}
                disabled={replyMut.isPending || !replyBody.trim()}
              >
                {replyMut.isPending ? 'Processing reply…' : 'Submit Reply & Advance Workflow'}
              </button>
            </div>
          )}

          {/* Escalate tab */}
          {tab === 'escalate' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">Escalate this negotiation for manual human handling.</p>
              <textarea
                className="input h-28 resize-none text-sm"
                placeholder="Notes for escalation (optional)…"
                value={escalateNotes}
                onChange={e => setEscalateNotes(e.target.value)}
              />
              <button
                className="btn-danger text-sm w-full flex items-center justify-center gap-2"
                onClick={() => escalateMut.mutate()}
                disabled={escalateMut.isPending}
              >
                <AlertTriangle className="w-4 h-4" />
                {escalateMut.isPending ? 'Escalating…' : 'Escalate to Human'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
