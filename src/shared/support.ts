/**
 * Support / ticket system — constants and pure rules shared by the Convex
 * backend and the UI (single source of truth for categories, statuses,
 * transitions and limits).
 */

export const SUPPORT_CATEGORIES = ["bug", "billing", "account", "howto", "feature", "other"] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export const SUPPORT_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type SupportPriority = (typeof SUPPORT_PRIORITIES)[number];

/**
 * open      = waiting for CORE829 support
 * waiting   = waiting for the customer
 * resolved  = support considers it solved (customer can reopen; auto-closes)
 * closed    = final, no more replies
 */
export const SUPPORT_STATUSES = ["open", "waiting", "resolved", "closed"] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export const SUPPORT_LIMITS = {
  subjectMin: 3,
  subjectMax: 120,
  bodyMin: 3,
  bodyMax: 4000,
  messagesPerTicket: 200,
  openTicketsPerUser: 10,
  createPerHour: 5,
  replyPerHour: 30,
  /** Resolved tickets with no customer reply are closed after this many days. */
  autoCloseDays: 7,
  /** Closed tickets are deleted after this many days (retention). */
  retentionDays: 730,
} as const;

/** Allowed staff-driven status transitions. */
export const SUPPORT_TRANSITIONS: Record<SupportStatus, readonly SupportStatus[]> = {
  open: ["waiting", "resolved", "closed"],
  waiting: ["open", "resolved", "closed"],
  resolved: ["open", "closed"],
  closed: [],
};

export function canTransition(from: SupportStatus, to: SupportStatus): boolean {
  return SUPPORT_TRANSITIONS[from].includes(to);
}

/** First-response target by priority, in hours (informational SLA). */
export const SUPPORT_SLA_HOURS: Record<SupportPriority, number> = {
  urgent: 4,
  high: 8,
  normal: 24,
  low: 72,
};
