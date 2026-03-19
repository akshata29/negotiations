from __future__ import annotations
from enum import Enum
from typing import Optional, Any
from pydantic import BaseModel, Field
import uuid
from datetime import datetime


class NegotiationStage(str, Enum):
    ELIGIBLE = "eligible"
    CONTACT_DRAFTING = "contact_drafting"
    CONTACT_APPROVAL = "contact_approval"       # waiting for human approval
    CONTACT_SENT = "contact_sent"
    CONTACT_REPLIED = "contact_replied"         # vendor replied — analyzing
    CONTACT_CONFIRMED = "contact_confirmed"     # right person confirmed
    CONTACT_REJECTED = "contact_rejected"       # wrong person / bounced
    PROPOSAL_DRAFTING = "proposal_drafting"
    PROPOSAL_APPROVAL = "proposal_approval"     # waiting for human approval
    PROPOSAL_SENT = "proposal_sent"
    PROPOSAL_REPLIED = "proposal_replied"       # vendor replied — analyzing
    COUNTER_OFFER = "counter_offer"
    COUNTER_DRAFTING = "counter_drafting"
    COUNTER_APPROVAL = "counter_approval"
    COUNTER_SENT = "counter_sent"
    AGREED = "agreed"
    REJECTED = "rejected"
    ESCALATED = "escalated"
    COMPLETED = "completed"


class ABGroup(str, Enum):
    A = "A"   # Cash discount only
    B = "B"   # Term days extension only
    C = "C"   # Both cash discount + net days


STRATEGY_DESCRIPTIONS = {
    ABGroup.A: "Request cash discount improvement (STD Terms ≥ 2%)",
    ABGroup.B: "Request term days extension (+10 days on Term Days & Net Days)",
    ABGroup.C: "Request both cash discount improvement and term days extension",
}


class ProposedTerms(BaseModel):
    std_terms: Optional[float] = None    # target cash discount %
    term_days: Optional[int] = None      # target term days
    net_days: Optional[int] = None       # target net days


class NegotiationInDB(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vendor_id: int
    vendor_long_name: str
    vendor_short_name: Optional[str] = None
    vendor_email: Optional[str] = None

    # Current / original terms
    original_std_terms: float = 0.0
    original_term_days: int = 0
    original_net_days: int = 30

    # Target terms
    proposed_terms: Optional[ProposedTerms] = None
    agreed_terms: Optional[ProposedTerms] = None

    # Workflow
    stage: NegotiationStage = NegotiationStage.ELIGIBLE
    ab_group: Optional[ABGroup] = None
    strategy: Optional[str] = None

    # Agent thread tracking
    agent_thread_id: Optional[str] = None

    # Human-in-the-loop
    pending_approval_email_id: Optional[str] = None
    human_notes: Optional[str] = None

    # Outcome tracking for RL
    rounds: int = 0
    outcome: Optional[str] = None       # "accepted" | "rejected" | "counter_accepted" | "escalated"
    improvement_score: float = 0.0      # 0-1, used for RL reward

    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class EmailDirection(str, Enum):
    OUTBOUND = "outbound"
    INBOUND = "inbound"


class EmailStatus(str, Enum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    SENT = "sent"
    RECEIVED = "received"


class EmailThread(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    negotiation_id: str
    vendor_id: int

    sender_name: str
    sender_email: str
    recipient_name: str
    recipient_email: str

    subject: str
    body: str

    direction: EmailDirection
    status: EmailStatus
    stage: NegotiationStage

    approved_by: Optional[str] = None
    approved_at: Optional[str] = None

    ai_suggested: bool = True           # was this AI-generated?
    human_edited: bool = False

    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    sent_at: Optional[str] = None


class ApproveEmailRequest(BaseModel):
    approved_by: str = "Human Reviewer"
    edited_body: Optional[str] = None   # if human edited the draft


class VendorReplyRequest(BaseModel):
    body: str
    sender_name: Optional[str] = None
    sender_email: Optional[str] = None


class StartNegotiationRequest(BaseModel):
    vendor_id: int
    override_ab_group: Optional[ABGroup] = None


# ── RL State ──────────────────────────────────────────────────────────────


class RLArmState(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    group: ABGroup
    strategy: str
    total_trials: int = 0
    successes: int = 0
    total_reward: float = 0.0
    q_value: float = 0.0
    ucb1_score: float = float("inf")    # starts high to encourage exploration
    last_reward: float = 0.0
    updated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class RLGlobalState(BaseModel):
    id: str = "rl_global"
    total_negotiations: int = 0
    epsilon: float = 0.3
    exploration_constant: float = 2.0
    arms: dict[str, RLArmState] = Field(default_factory=dict)
    updated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class ABTestStats(BaseModel):
    group: str
    strategy: str
    total_trials: int
    successes: int
    success_rate: float
    avg_reward: float
    q_value: float
    ucb1_score: float
