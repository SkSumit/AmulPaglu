-- ============================================================
-- AMUL PAGLU — Badges Feature Migration
-- Paste this entire file into your Supabase SQL Editor and run it.
-- ============================================================


-- ── 1. Add tried_count column to products ──────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS tried_count integer NOT NULL DEFAULT 0;


-- ── 2. Create badges table ─────────────────────────────────
CREATE TABLE IF NOT EXISTS badges (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text        UNIQUE NOT NULL,
  name        text        NOT NULL,
  description text        NOT NULL,
  icon        text        NOT NULL,
  condition   jsonb       NOT NULL,
  created_at  timestamptz DEFAULT now()
);

-- RLS: readable by all authenticated, writable by admins only
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "badges_select_authenticated" ON badges;
DROP POLICY IF EXISTS "badges_all_admin" ON badges;

CREATE POLICY "badges_select_authenticated"
  ON badges FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "badges_all_admin"
  ON badges FOR ALL
  TO authenticated
  USING   ( (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true )
  WITH CHECK ( (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true );


-- ── 3. Create user_badges table ────────────────────────────
CREATE TABLE IF NOT EXISTS user_badges (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  badge_slug  text        REFERENCES badges(slug)  ON DELETE CASCADE NOT NULL,
  earned_at   timestamptz DEFAULT now(),
  UNIQUE (user_id, badge_slug)
);

-- RLS: users read own; admins read all; inserts only via DB function
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_badges_select_own" ON user_badges;
DROP POLICY IF EXISTS "user_badges_no_direct_write" ON user_badges;

CREATE POLICY "user_badges_select_own"
  ON user_badges FOR SELECT
  TO authenticated
  USING ( user_id = auth.uid()
    OR (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true );

-- No direct INSERT/UPDATE/DELETE from client — only via SECURITY DEFINER function
CREATE POLICY "user_badges_no_direct_write"
  ON user_badges FOR INSERT
  TO authenticated
  WITH CHECK (false);


-- ── 4. Trigger: keep products.tried_count in sync ──────────
CREATE OR REPLACE FUNCTION update_tried_count()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE products
      SET tried_count = (
        SELECT COUNT(*) FROM user_products
        WHERE product_id = OLD.product_id AND status = 'tried'
      )
    WHERE id = OLD.product_id;
  ELSE
    UPDATE products
      SET tried_count = (
        SELECT COUNT(*) FROM user_products
        WHERE product_id = NEW.product_id AND status = 'tried'
      )
    WHERE id = NEW.product_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_tried_count ON user_products;
CREATE TRIGGER trg_update_tried_count
  AFTER INSERT OR UPDATE OR DELETE ON user_products
  FOR EACH ROW EXECUTE FUNCTION update_tried_count();


-- ── 5. Function: check_and_award_badges (dynamic) ──────────
-- Reads badge conditions from the badges table at runtime.
-- Returns newly awarded badges so the client can show toasts.
CREATE OR REPLACE FUNCTION check_and_award_badges(p_user_id uuid)
RETURNS TABLE(new_slug text, new_name text, new_icon text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  b                        RECORD;
  c                        jsonb;
  condition_met            boolean;
  v_count                  integer;
  v_total                  integer;
  v_profile_created_at     timestamptz;
BEGIN
  FOR b IN SELECT * FROM badges LOOP
    -- Skip already-earned badges
    IF EXISTS (
      SELECT 1 FROM user_badges
      WHERE user_id = p_user_id AND badge_slug = b.slug
    ) THEN
      CONTINUE;
    END IF;

    c             := b.condition;
    condition_met := false;

    CASE c->>'type'

      -- Total tried products
      WHEN 'tried_count' THEN
        SELECT COUNT(*) INTO v_count
          FROM user_products
         WHERE user_id = p_user_id AND status = 'tried';
        condition_met := v_count >= (c->>'minimum_count')::integer;

      -- Tried N products in a specific category
      WHEN 'category_tried_count' THEN
        SELECT COUNT(*) INTO v_count
          FROM user_products up
          JOIN products p ON p.id = up.product_id
         WHERE up.user_id = p_user_id
           AND up.status = 'tried'
           AND p.category = c->>'category';
        condition_met := v_count >= (c->>'minimum_count')::integer;

      -- Tried ALL approved products in a category
      WHEN 'category_complete' THEN
        SELECT COUNT(*) INTO v_total
          FROM products
         WHERE category = c->>'category' AND status = 'approved';

        SELECT COUNT(*) INTO v_count
          FROM user_products up
          JOIN products p ON p.id = up.product_id
         WHERE up.user_id = p_user_id
           AND up.status = 'tried'
           AND p.category = c->>'category'
           AND p.status = 'approved';

        condition_met := v_total > 0 AND v_count >= v_total;

      -- Tried N products with points >= minimum_points
      WHEN 'rarity_tried_count' THEN
        SELECT COUNT(*) INTO v_count
          FROM user_products up
          JOIN products p ON p.id = up.product_id
         WHERE up.user_id = p_user_id
           AND up.status = 'tried'
           AND COALESCE(p.points, 0) >= (c->>'minimum_points')::integer;
        condition_met := v_count >= (c->>'minimum_count')::integer;

      -- At least one approved suggestion
      WHEN 'suggestion_approved' THEN
        SELECT COUNT(*) INTO v_count
          FROM suggestions
         WHERE submitted_by = p_user_id AND status = 'approved';
        condition_met := v_count >= 1;

      -- Signed up before a specific date
      WHEN 'early_adopter' THEN
        SELECT created_at INTO v_profile_created_at
          FROM profiles WHERE id = p_user_id;
        condition_met := v_profile_created_at < (c->>'before_date')::timestamptz;

      ELSE
        condition_met := false;
    END CASE;

    IF condition_met THEN
      BEGIN
        INSERT INTO user_badges (user_id, badge_slug)
          VALUES (p_user_id, b.slug);

        new_slug := b.slug;
        new_name := b.name;
        new_icon := b.icon;
        RETURN NEXT;
      EXCEPTION WHEN unique_violation THEN
        -- Already earned (race condition); skip silently
        NULL;
      END;
    END IF;
  END LOOP;
END;
$$;


-- ── 6. Trigger: auto-check badges on user_products changes ─
CREATE OR REPLACE FUNCTION trigger_check_badges()
RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.status = 'tried' THEN
    PERFORM check_and_award_badges(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_badges_on_try ON user_products;
CREATE TRIGGER trg_check_badges_on_try
  AFTER INSERT OR UPDATE ON user_products
  FOR EACH ROW EXECUTE FUNCTION trigger_check_badges();


-- ── 7. Also call badge check when suggestion is approved ───
CREATE OR REPLACE FUNCTION trigger_check_badges_on_suggestion()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.status = 'approved'
     AND (OLD.status IS DISTINCT FROM 'approved')
     AND NEW.submitted_by IS NOT NULL
  THEN
    PERFORM check_and_award_badges(NEW.submitted_by);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_badges_on_suggestion ON suggestions;
CREATE TRIGGER trg_check_badges_on_suggestion
  AFTER UPDATE ON suggestions
  FOR EACH ROW EXECUTE FUNCTION trigger_check_badges_on_suggestion();


-- ── 8. Seed default badges ─────────────────────────────────
INSERT INTO badges (slug, name, description, icon, condition) VALUES
  ('first_try',         'First Try',          'Marked your very first Amul product as tried.',                                        '🎉', '{"type":"tried_count","minimum_count":1}'),
  ('explorer',          'Explorer',           'Tried 5 or more different Amul products.',                                             '🧭', '{"type":"tried_count","minimum_count":5}'),
  ('adventurer',        'Adventurer',         'Tried 15 or more different Amul products.',                                            '🏕️', '{"type":"tried_count","minimum_count":15}'),
  ('connoisseur',       'Connoisseur',        'Tried 30 or more different Amul products. You know your Amul.',                        '🎩', '{"type":"tried_count","minimum_count":30}'),
  ('cheese_head',       'Cheese Head',        'Tried at least 3 Amul cheese products.',                                              '🧀', '{"type":"category_tried_count","category":"Cheese","minimum_count":3}'),
  ('ice_cream_fanatic', 'Ice Cream Fanatic',  'Tried at least 5 Amul ice cream products. Brain freeze accepted.',                    '🍦', '{"type":"category_tried_count","category":"Ice Cream","minimum_count":5}'),
  ('butter_lover',      'Butter Lover',       'Tried every single Amul butter & spreads product.',                                   '🧈', '{"type":"category_complete","category":"Butter & Spreads"}'),
  ('beverage_boss',     'Beverage Boss',      'Tried 5 or more Amul beverage products.',                                             '🥛', '{"type":"category_tried_count","category":"Beverages","minimum_count":5}'),
  ('mithai_master',     'Mithai Master',      'Tried at least 3 Amul mithai & traditional products.',                                '🍮', '{"type":"category_tried_count","category":"Mithai & Traditional","minimum_count":3}'),
  ('legendary_hunter',  'Legendary Hunter',   'Tried at least 1 Legendary (5-point) Amul product.',                                  '👑', '{"type":"rarity_tried_count","minimum_points":5,"minimum_count":1}'),
  ('epic_finder',       'Epic Finder',        'Tried at least 3 Epic (4+ point) Amul products.',                                     '💜', '{"type":"rarity_tried_count","minimum_points":4,"minimum_count":3}'),
  ('rare_taste',        'Rare Taste',         'Tried at least 5 Rare (3+ point) Amul products.',                                     '💎', '{"type":"rarity_tried_count","minimum_points":3,"minimum_count":5}'),
  ('completionist',     'Completionist',      'Tried every product in at least one full category. Respect.',                         '🏆', '{"type":"category_complete","category":"Butter & Spreads"}'),
  ('suggester',         'Suggester',          'Had at least one product suggestion approved by the admins.',                         '💡', '{"type":"suggestion_approved"}'),
  ('early_adopter',     'Early Adopter',      'Joined Amul Paglu before March 2025. You were here before it was cool.',              '⚡', '{"type":"early_adopter","before_date":"2025-03-01"}')
ON CONFLICT (slug) DO NOTHING;


-- ── 9. Function: revoke_unearned_badges ───────────────────
-- Removes badges a user no longer qualifies for.
-- Called from the client after an "un-try" action.
CREATE OR REPLACE FUNCTION revoke_unearned_badges(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  b                        RECORD;
  c                        jsonb;
  condition_met            boolean;
  v_count                  integer;
  v_total                  integer;
  v_profile_created_at     timestamptz;
BEGIN
  -- Only check badges the user has already earned
  FOR b IN
    SELECT ba.* FROM badges ba
    JOIN user_badges ub ON ub.badge_slug = ba.slug
    WHERE ub.user_id = p_user_id
  LOOP
    c             := b.condition;
    condition_met := false;

    CASE c->>'type'
      WHEN 'tried_count' THEN
        SELECT COUNT(*) INTO v_count FROM user_products
         WHERE user_id = p_user_id AND status = 'tried';
        condition_met := v_count >= (c->>'minimum_count')::integer;

      WHEN 'category_tried_count' THEN
        SELECT COUNT(*) INTO v_count
          FROM user_products up JOIN products p ON p.id = up.product_id
         WHERE up.user_id = p_user_id AND up.status = 'tried' AND p.category = c->>'category';
        condition_met := v_count >= (c->>'minimum_count')::integer;

      WHEN 'category_complete' THEN
        SELECT COUNT(*) INTO v_total FROM products
         WHERE category = c->>'category' AND status = 'approved';
        SELECT COUNT(*) INTO v_count
          FROM user_products up JOIN products p ON p.id = up.product_id
         WHERE up.user_id = p_user_id AND up.status = 'tried'
           AND p.category = c->>'category' AND p.status = 'approved';
        condition_met := v_total > 0 AND v_count >= v_total;

      WHEN 'rarity_tried_count' THEN
        SELECT COUNT(*) INTO v_count
          FROM user_products up JOIN products p ON p.id = up.product_id
         WHERE up.user_id = p_user_id AND up.status = 'tried'
           AND COALESCE(p.points, 0) >= (c->>'minimum_points')::integer;
        condition_met := v_count >= (c->>'minimum_count')::integer;

      WHEN 'suggestion_approved' THEN
        SELECT COUNT(*) INTO v_count FROM suggestions
         WHERE submitted_by = p_user_id AND status = 'approved';
        condition_met := v_count >= 1;

      WHEN 'early_adopter' THEN
        SELECT created_at INTO v_profile_created_at FROM profiles WHERE id = p_user_id;
        condition_met := v_profile_created_at < (c->>'before_date')::timestamptz;

      ELSE
        condition_met := true; -- Unknown condition — don't revoke
    END CASE;

    -- Revoke if condition is no longer met
    IF NOT condition_met THEN
      DELETE FROM user_badges
       WHERE user_id = p_user_id AND badge_slug = b.slug;
    END IF;
  END LOOP;
END;
$$;
