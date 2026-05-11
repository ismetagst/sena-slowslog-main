-- ============================================================
-- LETTERS (mail art) — seasonal feature
-- A user can leave a short paper-style letter on another user's profile.
-- Visualised as an envelope; opens with a small animation to reveal the message.
-- ============================================================

-- Table
CREATE TABLE public.letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID NOT NULL,
  sender_user_id UUID NOT NULL,
  body TEXT NOT NULL,
  signature TEXT,
  paper_style TEXT NOT NULL DEFAULT 'cream',
  cover_emoji TEXT DEFAULT '✉',
  status TEXT NOT NULL DEFAULT 'active', -- active | hidden_by_recipient | deleted
  event_window_start TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX letters_recipient_idx ON public.letters(recipient_user_id, created_at DESC);
CREATE INDEX letters_sender_idx ON public.letters(sender_user_id, created_at DESC);
CREATE INDEX letters_status_idx ON public.letters(status);

ALTER TABLE public.letters ENABLE ROW LEVEL SECURITY;

-- Update timestamp trigger
CREATE TRIGGER letters_set_updated_at
BEFORE UPDATE ON public.letters
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Validation trigger (on INSERT): enforce feature gate, window, caps, length
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_letter_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config jsonb;
  v_feature jsonb;
  v_window_start timestamptz;
  v_window_end timestamptz;
  v_window_enabled boolean;
  v_feature_enabled boolean;
  v_is_privileged boolean;
  v_per_recipient_count integer;
  v_max_per_recipient integer := 5;
  v_max_body_length integer := 280;
BEGIN
  -- Length cap applies to everyone
  IF char_length(NEW.body) = 0 THEN
    RAISE EXCEPTION 'Letter body cannot be empty.';
  END IF;
  IF char_length(NEW.body) > v_max_body_length THEN
    RAISE EXCEPTION 'Letter exceeds % characters.', v_max_body_length;
  END IF;

  -- No self-letter (founders/admins may, for testing)
  v_is_privileged := public.has_role(NEW.sender_user_id, 'founder'::app_role)
                  OR public.has_role(NEW.sender_user_id, 'admin'::app_role);

  IF NEW.sender_user_id = NEW.recipient_user_id AND NOT v_is_privileged THEN
    RAISE EXCEPTION 'Cannot send a letter to yourself.';
  END IF;

  SELECT value INTO v_feature FROM public.site_settings WHERE key = 'letter_enabled';
  v_feature_enabled := COALESCE((v_feature->>'enabled')::boolean, false);

  SELECT value INTO v_config FROM public.site_settings WHERE key = 'letter_event_window';
  v_window_enabled := COALESCE((v_config->>'enabled')::boolean, false);
  v_window_start := NULLIF(v_config->>'start_at', '')::timestamptz;
  v_window_end := NULLIF(v_config->>'end_at', '')::timestamptz;

  IF NOT v_is_privileged THEN
    IF NOT v_feature_enabled THEN
      RAISE EXCEPTION 'Letter feature is currently closed.';
    END IF;

    IF v_window_enabled THEN
      IF v_window_start IS NULL OR v_window_end IS NULL
         OR now() < v_window_start OR now() > v_window_end THEN
        RAISE EXCEPTION 'Letter window is not currently open.';
      END IF;

      SELECT COUNT(*) INTO v_per_recipient_count
      FROM public.letters
      WHERE sender_user_id = NEW.sender_user_id
        AND recipient_user_id = NEW.recipient_user_id
        AND event_window_start = v_window_start
        AND status <> 'deleted';

      IF v_per_recipient_count >= v_max_per_recipient THEN
        RAISE EXCEPTION 'You have reached the limit of % letters to this person for this window.', v_max_per_recipient;
      END IF;

      NEW.event_window_start := v_window_start;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER letters_validate_insert
BEFORE INSERT ON public.letters
FOR EACH ROW EXECUTE FUNCTION public.validate_letter_insert();

-- ============================================================
-- Status RPC for clients
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_letter_event_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config jsonb;
  v_visibility jsonb;
  v_feature jsonb;
  v_window_start timestamptz;
  v_window_end timestamptz;
  v_window_enabled boolean;
  v_visible boolean;
  v_feature_enabled boolean;
  v_is_open boolean := true;
  v_is_privileged boolean := false;
  v_uid uuid;
BEGIN
  v_uid := auth.uid();

  SELECT value INTO v_config FROM public.site_settings WHERE key = 'letter_event_window';
  SELECT value INTO v_visibility FROM public.site_settings WHERE key = 'letter_visibility';
  SELECT value INTO v_feature FROM public.site_settings WHERE key = 'letter_enabled';

  v_window_enabled := COALESCE((v_config->>'enabled')::boolean, false);
  v_window_start := NULLIF(v_config->>'start_at', '')::timestamptz;
  v_window_end := NULLIF(v_config->>'end_at', '')::timestamptz;
  v_visible := COALESCE((v_visibility->>'enabled')::boolean, false);
  v_feature_enabled := COALESCE((v_feature->>'enabled')::boolean, false);

  IF v_window_enabled THEN
    v_is_open := (v_window_start IS NOT NULL AND v_window_end IS NOT NULL
                  AND now() >= v_window_start AND now() <= v_window_end);
  END IF;

  IF v_uid IS NOT NULL THEN
    v_is_privileged := public.has_role(v_uid, 'founder'::app_role)
                    OR public.has_role(v_uid, 'admin'::app_role);
  END IF;

  RETURN jsonb_build_object(
    'visible', v_visible,
    'feature_enabled', v_feature_enabled,
    'window_enabled', v_window_enabled,
    'window_open', v_is_open,
    'window_start', v_window_start,
    'window_end', v_window_end,
    'is_privileged', v_is_privileged,
    'can_create', v_is_privileged OR (v_feature_enabled AND v_is_open),
    'max_body_length', 280,
    'max_per_recipient', 5
  );
END;
$$;

-- ============================================================
-- RLS Policies
-- ============================================================

-- SELECT: recipient/sender always; admin/founder always; everyone else only when visibility on AND status='active'
CREATE POLICY "letters_select_visible"
ON public.letters FOR SELECT
USING (
  public.has_role(auth.uid(), 'founder'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR auth.uid() = recipient_user_id
  OR auth.uid() = sender_user_id
  OR (
    status = 'active'
    AND COALESCE(
      ((SELECT value->>'enabled' FROM public.site_settings WHERE key = 'letter_visibility'))::boolean,
      false
    ) = true
  )
);

-- INSERT: any authenticated user, must be the sender
CREATE POLICY "letters_insert_self"
ON public.letters FOR INSERT
WITH CHECK (auth.uid() = sender_user_id);

-- UPDATE:
--  - sender can edit their own letter content
--  - recipient can change status (hide / unhide)
--  - admin/founder always
CREATE POLICY "letters_update_owners"
ON public.letters FOR UPDATE
USING (
  public.has_role(auth.uid(), 'founder'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR auth.uid() = sender_user_id
  OR auth.uid() = recipient_user_id
);

-- DELETE: sender, recipient, admin, founder
CREATE POLICY "letters_delete_owners"
ON public.letters FOR DELETE
USING (
  public.has_role(auth.uid(), 'founder'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR auth.uid() = sender_user_id
  OR auth.uid() = recipient_user_id
);

-- ============================================================
-- Default site_settings rows (off by default)
-- ============================================================
INSERT INTO public.site_settings (key, value)
VALUES
  ('letter_enabled', '{"enabled": false}'::jsonb),
  ('letter_visibility', '{"enabled": false}'::jsonb),
  ('letter_event_window', '{"enabled": false, "start_at": "", "end_at": ""}'::jsonb)
ON CONFLICT (key) DO NOTHING;