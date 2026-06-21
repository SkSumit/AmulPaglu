// ============================================================
// App-level types derived from the database schema
// ============================================================

import type { Database } from './database'
export type { BadgeConditionJson as BadgeCondition } from './database'

// ── Row types (what you get back from Supabase) ────────────
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Product = Database['public']['Tables']['products']['Row']
export type UserProduct = Database['public']['Tables']['user_products']['Row']
export type Suggestion = Database['public']['Tables']['suggestions']['Row']
export type ScrapeLog = Database['public']['Tables']['scrape_logs']['Row']

// ── Insert / Update types ──────────────────────────────────
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProductInsert = Database['public']['Tables']['products']['Insert']
export type UserProductInsert = Database['public']['Tables']['user_products']['Insert']
export type SuggestionInsert = Database['public']['Tables']['suggestions']['Insert']

export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']
export type ProductUpdate = Database['public']['Tables']['products']['Update']
export type UserProductUpdate = Database['public']['Tables']['user_products']['Update']
export type SuggestionUpdate = Database['public']['Tables']['suggestions']['Update']

// ── Enum-like string literals ──────────────────────────────
export type ProductStatus = 'approved' | 'pending' | 'rejected'
export type UserProductStatus = 'want_to_try' | 'tried'
export type SuggestionStatus = 'pending' | 'approved' | 'rejected'
export type RarityLabel = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary'
export type Availability = 'Pan India' | 'Regional' | 'Seasonal' | 'Discontinued'

// ── Points / tier system ───────────────────────────────────
export interface Tier {
  label: string
  emoji: string
  minPoints: number
  maxPoints: number
  color: string
}

export const TIERS: Tier[] = [
  { label: 'Milk Drinker',        emoji: '🥛', minPoints: 0,   maxPoints: 50,  color: 'tier-milk'    },
  { label: 'Cheese Explorer',     emoji: '🧀', minPoints: 51,  maxPoints: 150, color: 'tier-cheese'  },
  { label: 'Ice Cream Connoisseur', emoji: '🍦', minPoints: 151, maxPoints: 300, color: 'tier-icecream' },
  { label: 'Butter Aficionado',   emoji: '🧈', minPoints: 301, maxPoints: 500, color: 'tier-butter'  },
  { label: 'Amul Legend',         emoji: '👑', minPoints: 501, maxPoints: Infinity, color: 'tier-legend' },
]

export function getTier(points: number): Tier {
  return TIERS.findLast((t) => points >= t.minPoints) ?? TIERS[0]
}

export const RARITY_POINTS: Record<RarityLabel, number> = {
  Common:     1,
  Uncommon:   2,
  Rare:       3,
  Epic:       4,
  Legendary:  5,
}

// ── Badge types ────────────────────────────────────────────
export type BadgeConditionType =
  | 'tried_count'
  | 'category_tried_count'
  | 'category_complete'
  | 'rarity_tried_count'
  | 'suggestion_approved'
  | 'early_adopter'

export type Badge = Database['public']['Tables']['badges']['Row']
export type UserBadge = Database['public']['Tables']['user_badges']['Row']
export type BadgeInsert = Database['public']['Tables']['badges']['Insert']
export type BadgeUpdate = Database['public']['Tables']['badges']['Update']

/** Human-readable description of a badge condition */
import type { BadgeConditionJson } from './database'
export function conditionSummary(condition: BadgeConditionJson): string {
  switch (condition.type) {
    case 'tried_count':
      return `Try ${condition.minimum_count} or more products total`
    case 'category_tried_count':
      return `Try ${condition.minimum_count} or more products in "${condition.category}"`
    case 'category_complete':
      return `Try all products in "${condition.category}"`
    case 'rarity_tried_count':
      return `Try ${condition.minimum_count} or more products with ${condition.minimum_points}+ points`
    case 'suggestion_approved':
      return 'Get at least 1 product suggestion approved'
    case 'early_adopter':
      return `Sign up before ${condition.before_date ?? 'a certain date'}`
    default:
      return 'Special condition'
  }
}

export const RARITY_COLORS: Record<string, string> = {
  Common:     'text-rarity-common   bg-gray-100   dark:bg-gray-800',
  Uncommon:   'text-rarity-uncommon bg-green-100  dark:bg-green-900/30',
  Rare:       'text-rarity-rare     bg-blue-100   dark:bg-blue-900/30',
  Epic:       'text-rarity-epic     bg-purple-100 dark:bg-purple-900/30',
  Legendary:  'text-rarity-legendary bg-amber-100 dark:bg-amber-900/30',
}

// ── Product card (product + current user's list status) ───
export interface ProductWithUserStatus extends Product {
  user_status?: UserProductStatus | null
  user_product_id?: string | null
  tried_at?: string | null
}
