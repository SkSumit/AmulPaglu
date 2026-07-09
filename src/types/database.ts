// ============================================================
// Supabase Database type definitions
// Mirrors the schema exactly so queries are type-safe.
// ============================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Inline badge condition to avoid circular imports with index.ts
export interface BadgeConditionJson {
  type: string
  minimum_count?: number
  category?: string
  minimum_points?: number
  before_date?: string
  product_name?: string
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          full_name: string | null
          avatar_url: string | null
          is_admin: boolean
          total_points: number
          created_at: string
        }
        Insert: {
          id: string
          username: string
          full_name?: string | null
          avatar_url?: string | null
          is_admin?: boolean
          total_points?: number
          created_at?: string
        }
        Update: {
          id?: string
          username?: string
          full_name?: string | null
          avatar_url?: string | null
          is_admin?: boolean
          total_points?: number
          created_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          name: string
          category: string | null
          description: string | null
          image_url: string | null
          points: number | null
          rarity_label: string | null
          availability: string | null
          is_discontinued: boolean
          source_url: string | null
          status: string
          submitted_by: string | null
          tried_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          category?: string | null
          description?: string | null
          image_url?: string | null
          points?: number | null
          rarity_label?: string | null
          availability?: string | null
          is_discontinued?: boolean
          source_url?: string | null
          status?: string
          submitted_by?: string | null
          tried_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          category?: string | null
          description?: string | null
          image_url?: string | null
          points?: number | null
          rarity_label?: string | null
          availability?: string | null
          is_discontinued?: boolean
          source_url?: string | null
          status?: string
          submitted_by?: string | null
          tried_count?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_products: {
        Row: {
          id: string
          user_id: string
          product_id: string
          status: string
          tried_at: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          product_id: string
          status?: string
          tried_at?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          product_id?: string
          status?: string
          tried_at?: string | null
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      suggestions: {
        Row: {
          id: string
          submitted_by: string | null
          name: string
          category: string | null
          description: string | null
          image_url: string | null
          source_url: string | null
          admin_note: string | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          submitted_by?: string | null
          name: string
          category?: string | null
          description?: string | null
          image_url?: string | null
          source_url?: string | null
          admin_note?: string | null
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          submitted_by?: string | null
          name?: string
          category?: string | null
          description?: string | null
          image_url?: string | null
          source_url?: string | null
          admin_note?: string | null
          status?: string
          created_at?: string
        }
        Relationships: []
      }
      scrape_logs: {
        Row: {
          id: string
          run_at: string
          products_found: number | null
          new_products: number | null
          status: string | null
          log_detail: Json | null
        }
        Insert: {
          id?: string
          run_at?: string
          products_found?: number | null
          new_products?: number | null
          status?: string | null
          log_detail?: Json | null
        }
        Update: {
          id?: string
          run_at?: string
          products_found?: number | null
          new_products?: number | null
          status?: string | null
          log_detail?: Json | null
        }
        Relationships: []
      }
      badges: {
        Row: {
          id: string
          slug: string
          name: string
          description: string
          icon: string
          condition: BadgeConditionJson
          created_at: string
        }
        Insert: {
          id?: string
          slug: string
          name: string
          description: string
          icon: string
          condition: BadgeConditionJson
          created_at?: string
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          description?: string
          icon?: string
          condition?: BadgeConditionJson
          created_at?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          id: string
          user_id: string
          badge_slug: string
          earned_at: string
        }
        Insert: {
          id?: string
          user_id: string
          badge_slug: string
          earned_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          badge_slug?: string
          earned_at?: string
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      check_and_award_badges: {
        Args: { p_user_id: string }
        Returns: { new_slug: string; new_name: string; new_icon: string }[]
      }
      get_and_clear_new_badges: {
        Args: { p_user_id: string }
        Returns: { new_slug: string; new_name: string; new_icon: string; new_description: string }[]
      }
      revoke_unearned_badges: {
        Args: { p_user_id: string }
        Returns: void
      }
      get_landing_page_data: {
        Args: Record<PropertyKey, never>
        Returns: any
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
