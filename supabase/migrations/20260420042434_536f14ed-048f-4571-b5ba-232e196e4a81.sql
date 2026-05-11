-- =========================
-- NOTIFICATIONS SYSTEM
-- =========================

-- 1. last_seen column on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notifications_last_seen_at timestamptz NOT NULL DEFAULT now();

-- 2. notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('greeting', 'achievement', 'views_milestone')),
  story_id uuid REFERENCES public.stories(id) ON DELETE CASCADE,
  badge_id uuid REFERENCES public.achievement_badges(id) ON DELETE CASCADE,
  count integer NOT NULL DEFAULT 1,
  milestone_value integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Uniqueness: one greeting notif per (user, story); one achievement notif per (user, badge); one milestone per (user, story, milestone_value)
CREATE UNIQUE INDEX IF NOT EXISTS notifications_greeting_unique
  ON public.notifications (user_id, story_id) WHERE type = 'greeting';
CREATE UNIQUE INDEX IF NOT EXISTS notifications_achievement_unique
  ON public.notifications (user_id, badge_id) WHERE type = 'achievement';
CREATE UNIQUE INDEX IF NOT EXISTS notifications_milestone_unique
  ON public.notifications (user_id, story_id, milestone_value) WHERE type = 'views_milestone';

CREATE INDEX IF NOT EXISTS notifications_user_updated_idx
  ON public.notifications (user_id, updated_at DESC);

-- 3. RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own notifications"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage all notifications"
  ON public.notifications FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'founder'::app_role));

-- updated_at trigger
CREATE TRIGGER notifications_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- TRIGGER: greeting added
-- =========================
CREATE OR REPLACE FUNCTION public.notify_on_greeting_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner uuid;
BEGIN
  SELECT user_id INTO v_owner FROM public.stories WHERE id = NEW.story_id;
  -- don't notify yourself
  IF v_owner IS NULL OR v_owner = NEW.user_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, story_id, count, updated_at)
  VALUES (v_owner, 'greeting', NEW.story_id, 1, now())
  ON CONFLICT (user_id, story_id) WHERE type = 'greeting'
  DO UPDATE SET count = notifications.count + 1, updated_at = now();

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_greeting_insert
  AFTER INSERT ON public.high_fives
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_greeting_insert();

-- greeting removed → decrement, delete if 0
CREATE OR REPLACE FUNCTION public.notify_on_greeting_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner uuid;
BEGIN
  SELECT user_id INTO v_owner FROM public.stories WHERE id = OLD.story_id;
  IF v_owner IS NULL OR v_owner = OLD.user_id THEN
    RETURN OLD;
  END IF;

  UPDATE public.notifications
    SET count = GREATEST(count - 1, 0)
    WHERE user_id = v_owner AND story_id = OLD.story_id AND type = 'greeting';

  DELETE FROM public.notifications
    WHERE user_id = v_owner AND story_id = OLD.story_id AND type = 'greeting' AND count <= 0;

  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_notify_greeting_delete
  AFTER DELETE ON public.high_fives
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_greeting_delete();

-- =========================
-- TRIGGER: achievement granted
-- =========================
CREATE OR REPLACE FUNCTION public.notify_on_achievement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, badge_id, updated_at)
  VALUES (NEW.user_id, 'achievement', NEW.badge_id, now())
  ON CONFLICT (user_id, badge_id) WHERE type = 'achievement'
  DO UPDATE SET updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_achievement
  AFTER INSERT ON public.user_achievements
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_achievement();

-- =========================
-- TRIGGER: views milestone (every 100)
-- =========================
CREATE OR REPLACE FUNCTION public.notify_on_views_milestone()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  old_bucket integer;
  new_bucket integer;
  m integer;
BEGIN
  IF NEW.views IS NULL OR NEW.views <= 0 THEN
    RETURN NEW;
  END IF;

  old_bucket := COALESCE(OLD.views, 0) / 100;
  new_bucket := NEW.views / 100;

  IF new_bucket > old_bucket THEN
    -- create one notif per crossed 100-bucket (usually just 1)
    FOR m IN (old_bucket + 1)..new_bucket LOOP
      INSERT INTO public.notifications (user_id, type, story_id, milestone_value, updated_at)
      VALUES (NEW.user_id, 'views_milestone', NEW.id, m * 100, now())
      ON CONFLICT (user_id, story_id, milestone_value) WHERE type = 'views_milestone'
      DO NOTHING;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_views_milestone
  AFTER UPDATE OF views ON public.stories
  FOR EACH ROW
  WHEN (NEW.views IS DISTINCT FROM OLD.views)
  EXECUTE FUNCTION public.notify_on_views_milestone();

-- =========================
-- Helper: mark all seen
-- =========================
CREATE OR REPLACE FUNCTION public.mark_notifications_seen()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE public.profiles
    SET notifications_last_seen_at = now()
    WHERE user_id = auth.uid();
END;
$$;