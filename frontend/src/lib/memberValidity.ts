/**
 * Calendar date YYYY-MM-DD in the user's local timezone (not UTC).
 * Using toISOString().slice(0, 10) is wrong near midnight for non-UTC zones.
 */
export function localDateYmd(at: Date = new Date()): string {
  const y = at.getFullYear()
  const m = String(at.getMonth() + 1).padStart(2, '0')
  const d = String(at.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export type MemberValidityFields = {
  is_member?: boolean
  member_valid_from?: string | null
  member_valid_until?: string | null
}

/**
 * Whether member pricing benefits apply right now, based only on flags + date range.
 * Always pass fresh `at` (e.g. new Date()) — do not rely on cached API `member_benefits_active`.
 */
export function isMemberBenefitsActiveNow(
  c: MemberValidityFields | null | undefined,
  at: Date = new Date()
): boolean {
  if (!c?.is_member) return false
  const today = localDateYmd(at)
  const from = c.member_valid_from?.slice(0, 10)
  const until = c.member_valid_until?.slice(0, 10)
  if (from && today < from) return false
  if (until && today > until) return false
  return true
}
