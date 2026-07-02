import { supabase } from '@/lib/supabase'
import type { UnlockedBadge } from '@/components/badges/BadgeUnlockPopup'

/**
 * Calls check_and_award_badges and returns any newly unlocked badges.
 * The caller is responsible for showing the popup.
 */
export async function checkAndAwardBadges(
  userId: string,
): Promise<UnlockedBadge[]> {
  try {
    const { data, error } = await supabase.rpc('get_and_clear_new_badges', {
      p_user_id: userId,
    })
    if (error || !data) return []
    return data.map((b) => ({
      icon:        b.new_icon,
      name:        b.new_name,
      description: b.new_description,
    }))
  } catch {
    return []
  }
}

/**
 * Revokes badges the user no longer qualifies for.
 * Called from the client after an "un-try" action.
 * Uses a direct DB call — the DB trigger only awards, not revokes.
 */
export async function revokeBadgesIfNeeded(userId: string): Promise<void> {
  try {
    await supabase.rpc('revoke_unearned_badges', { p_user_id: userId })
  } catch {
    // Revocation failure is non-critical
  }
}
