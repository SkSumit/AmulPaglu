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
  is_notified boolean     NOT NULL DEFAULT false,
  UNIQUE (user_id, badge_slug)
);

ALTER TABLE user_badges
  ADD COLUMN IF NOT EXISTS is_notified boolean NOT NULL DEFAULT false;

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

      -- At least N approved suggestions
      WHEN 'suggestion_approved' THEN
        SELECT COUNT(*) INTO v_count
          FROM suggestions
         WHERE submitted_by = p_user_id AND status = 'approved';
        condition_met := v_count >= COALESCE((c->>'minimum_count')::integer, 1);

      -- Early adopter check: one of the first N users to sign up
      WHEN 'early_adopter' THEN
        SELECT created_at INTO v_profile_created_at
          FROM profiles WHERE id = p_user_id;
        SELECT COUNT(*) INTO v_count
          FROM profiles
         WHERE created_at <= v_profile_created_at;
        condition_met := v_count <= COALESCE((c->>'minimum_count')::integer, 50);

      -- Tried ALL approved products total (dynamic)
      WHEN 'all_complete' THEN
        SELECT COUNT(*) INTO v_total
          FROM products
         WHERE status = 'approved';

        SELECT COUNT(*) INTO v_count
          FROM user_products up
          JOIN products p ON p.id = up.product_id
         WHERE up.user_id = p_user_id
           AND up.status = 'tried'
           AND p.status = 'approved';

        condition_met := v_total > 0 AND v_count >= v_total;

      -- Tried a specific product by product name filter
      WHEN 'product_tried' THEN
        SELECT COUNT(*) INTO v_count
          FROM user_products up
          JOIN products p ON p.id = up.product_id
         WHERE up.user_id = p_user_id
           AND up.status = 'tried'
           AND p.name ILIKE c->>'product_name';
        condition_met := v_count >= 1;

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


-- ── 5.5 Function: get_and_clear_new_badges (notification wrapper)
CREATE OR REPLACE FUNCTION get_and_clear_new_badges(p_user_id uuid)
RETURNS TABLE(new_slug text, new_name text, new_icon text, new_description text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Run badge evaluation triggers first to award any new badges
  PERFORM check_and_award_badges(p_user_id);

  -- Retrieve and mark as notified all unnotified user badges
  RETURN QUERY
  WITH updated_badges AS (
    UPDATE user_badges
       SET is_notified = true
     WHERE user_id = p_user_id AND is_notified = false
     RETURNING badge_slug
  )
  SELECT b.slug, b.name, b.icon, b.description
    FROM badges b
    JOIN updated_badges ub ON ub.badge_slug = b.slug;
END;
$$;


-- ── 6. Trigger: auto-check badges on user_products changes ─
CREATE OR REPLACE FUNCTION trigger_check_badges()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'tried' THEN
      PERFORM revoke_unearned_badges(OLD.user_id);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'tried' AND OLD.status IS DISTINCT FROM 'tried' THEN
      PERFORM check_and_award_badges(NEW.user_id);
    ELSIF NEW.status IS DISTINCT FROM 'tried' AND OLD.status = 'tried' THEN
      PERFORM revoke_unearned_badges(NEW.user_id);
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.status = 'tried' THEN
      PERFORM check_and_award_badges(NEW.user_id);
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_badges_on_try ON user_products;
CREATE TRIGGER trg_check_badges_on_try
  AFTER INSERT OR UPDATE OR DELETE ON user_products
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
  ('first_drop',               'Calf Steps',                'Marked your very first Amul product as tried.',                                                 '🍼', '{"type":"tried_count","minimum_count":1}'),
  ('active_herd',              'Active Herd',               'You are grazing regularly. Keep chewing!',                                                      '🐄', '{"type":"tried_count","minimum_count":10}'),
  ('explorer',                 'Grazing Around',            'Tried 5 or more different Amul products.',                                                      '🧭', '{"type":"tried_count","minimum_count":5}'),
  ('adventurer',               'Dairy-Devil',               'Tried 15 or more different Amul products.',                                                     '🏕️', '{"type":"tried_count","minimum_count":15}'),
  ('connoisseur',              'The Cow-Father',            'Tried 30 or more different Amul products. You know your Amul.',                                 '🎩', '{"type":"tried_count","minimum_count":30}'),
  ('lactose_tolerant_99',      'Lactose Tolerant Level 99', 'Your digestive system is a biological marvel. You laugh in the face of dairy warnings.',        '💪', '{"type":"tried_count","minimum_count":50}'),
  ('one_zero_one_ways',        '101 Ways to Try Amul',      'Tried 101 different Amul products. That is a lot of ways to love dairy.',                       '📖', '{"type":"tried_count","minimum_count":101}'),
  ('amul_emperor',             'Amul Emperor',              'Tried 150 different Amul products. You rule the entire dairy realm.',                           '👑', '{"type":"tried_count","minimum_count":150}'),
  ('amul_pagluest',            'Amul Pagluest',             'The Ultimate Amul Fanatic. You have tried every single approved product in the entire catalog!', '🌌', '{"type":"all_complete"}'),
  ('utterly_butterly_devotee', 'Utterly Butterly Devotee',  'Your bread is merely a vehicle for Amul Butter. Your cardiologist is sweating.',                '🧈', '{"type":"category_tried_count","category":"Butter & Spreads","minimum_count":5}'),
  ('ghee_wiz',                 'Ghee Wiz!',                 'You measure your happiness in spoonfuls of melted gold on hot parathas.',                       '🫙', '{"type":"category_tried_count","category":"Ghee","minimum_count":2}'),
  ('cheese_head',              'Cheesy Personality',        'Tried at least 3 Amul cheese products.',                                                        '🧀', '{"type":"category_tried_count","category":"Cheese","minimum_count":3}'),
  ('lactose_and_loaded',       'Lactose & Loaded',          'Pizza? Cheese. Toast? Cheese. Roti? Believe it or not, cheese.',                                '🍕', '{"type":"category_complete","category":"Cheese"}'),
  ('ice_cream_fanatic',        'Cone Artist',               'Tried at least 5 Amul ice cream products. Brain freeze accepted.',                              '🍦', '{"type":"category_tried_count","category":"Ice Cream","minimum_count":5}'),
  ('brain_freeze_champion',    'Brain Freeze Champion',     'Temperature is just a number. Winter is just a season. Ice cream is a lifestyle.',              '🥶', '{"type":"category_tried_count","category":"Ice Cream","minimum_count":10}'),
  ('choco_baron',              'Choco-Baron',               'You judge people by whether they bite or lick their chocobar.',                                 '🍫', '{"type":"category_tried_count","category":"Ice Cream","minimum_count":5}'),
  ('butter_lover',             'Smooth Operator',           'Tried every single Amul butter & spreads product.',                                             '🧈', '{"type":"category_complete","category":"Butter & Spreads"}'),
  ('beverage_boss',            'Gulp Fiction',              'Tried 5 or more Amul beverage products.',                                                       '🥛', '{"type":"category_tried_count","category":"Beverages","minimum_count":5}'),
  ('mithai_master',            'Sweet Talker',              'Tried at least 3 Amul mithai & traditional products.',                                          '🍮', '{"type":"category_tried_count","category":"Mithai & Traditional","minimum_count":3}'),
  ('shrikhand_shaman',         'Shrikhand Shaman',          'Mango, Kesar, or Elaichi? You can identify the flavor blindfolded.',                            '🥣', '{"type":"category_tried_count","category":"Mithai & Traditional","minimum_count":3}'),
  ('kool_kid',                 'Kool Kid',                  'You carry a bottle of Amul Kool like a high-fashion accessory.',                                '🧃', '{"type":"category_tried_count","category":"Beverages","minimum_count":5}'),
  ('lassi_ng_impression',      'Lassi-ng Impression',       'One glass of Amul Lassi and you are legally required to take a 4-hour afternoon nap.',          '💤', '{"type":"category_tried_count","category":"Beverages","minimum_count":3}'),
  ('haldi_doodh_healer',       'Haldi Doodh Healer',        'Your mother is so proud. You have conquered the ultimate Indian remedy.',                       '🛟', '{"type":"product_tried","product_name":"%haldi%"}'),
  ('camel_rider',              'Camel Rider',               'You have transcended cow and buffalo milk. You are riding high on desert dairy.',               '🐪', '{"type":"product_tried","product_name":"%camel%"}'),
  ('legendary_hunter',         'Gold Digger',               'Tried at least 1 Legendary (5-point) Amul product.',                                            '👑', '{"type":"rarity_tried_count","minimum_points":5,"minimum_count":1}'),
  ('epic_finder',              'Epic Finder',               'Tried at least 3 Epic (4+ point) Amul products.',                                               '💜', '{"type":"rarity_tried_count","minimum_points":4,"minimum_count":3}'),
  ('rare_taste',               'Fancy Pants',               'Tried at least 5 Rare (3+ point) Amul products.',                                               '💎', '{"type":"rarity_tried_count","minimum_points":3,"minimum_count":5}'),
  ('completionist',            'No Crumb Left Behind',      'Tried every product in at least one full category. Respect.',                                   '🏆', '{"type":"category_complete","category":"Butter & Spreads"}'),
  ('suggester',                'Amul Archaeologist',        'Had at least one product suggestion approved by the admins.',                                   '💡', '{"type":"suggestion_approved","minimum_count":1}'),
  ('early_adopter',            'The Pre-Pasteurized Clan',  'Joined Amul Paglu as one of the first 50 users. You were here before the pasture got crowded.',  '⚡', '{"type":"early_adopter","minimum_count":50}')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  condition = EXCLUDED.condition;


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
        condition_met := v_count >= COALESCE((c->>'minimum_count')::integer, 1);

      WHEN 'early_adopter' THEN
        SELECT created_at INTO v_profile_created_at FROM profiles WHERE id = p_user_id;
        SELECT COUNT(*) INTO v_count FROM profiles WHERE created_at <= v_profile_created_at;
        condition_met := v_count <= COALESCE((c->>'minimum_count')::integer, 50);

      WHEN 'all_complete' THEN
        SELECT COUNT(*) INTO v_total FROM products
         WHERE status = 'approved';
        SELECT COUNT(*) INTO v_count
          FROM user_products up JOIN products p ON p.id = up.product_id
         WHERE up.user_id = p_user_id AND up.status = 'tried'
           AND p.status = 'approved';
        condition_met := v_total > 0 AND v_count >= v_total;

      WHEN 'product_tried' THEN
        SELECT COUNT(*) INTO v_count
          FROM user_products up JOIN products p ON p.id = up.product_id
         WHERE up.user_id = p_user_id AND up.status = 'tried'
           AND p.name ILIKE c->>'product_name';
        condition_met := v_count >= 1;

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