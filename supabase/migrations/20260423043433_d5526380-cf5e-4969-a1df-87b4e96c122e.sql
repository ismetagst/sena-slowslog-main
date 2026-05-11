
-- ============================================
-- WHISPER NOTES TABLE
-- ============================================
CREATE TABLE public.whisper_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  audio_url TEXT NOT NULL,
  audio_path TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  recipient_name TEXT,
  short_message TEXT,
  event_window_start TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_whisper_notes_user ON public.whisper_notes(user_id);
CREATE INDEX idx_whisper_notes_status ON public.whisper_notes(status) WHERE status = 'active';
CREATE INDEX idx_whisper_notes_window ON public.whisper_notes(event_window_start);

ALTER TABLE public.whisper_notes ENABLE ROW LEVEL SECURITY;

-- Owner full access
CREATE POLICY "Users view own whisper notes"
  ON public.whisper_notes FOR SELECT
  USING (auth.uid() = user_id);

-- Public can view active notes (for future share link)
CREATE POLICY "Active whisper notes viewable by everyone"
  ON public.whisper_notes FOR SELECT
  USING (status = 'active');

-- Insert: only IC / founder / admin
CREATE POLICY "IC and admins can create whisper notes"
  ON public.whisper_notes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND (
      public.has_role(auth.uid(), 'inner_circle'::app_role) OR
      public.has_role(auth.uid(), 'founder'::app_role) OR
      public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- Update own
CREATE POLICY "Users update own whisper notes"
  ON public.whisper_notes FOR UPDATE
  USING (auth.uid() = user_id);

-- Delete: owner, admin, founder
CREATE POLICY "Owner and admins can delete whisper notes"
  ON public.whisper_notes FOR DELETE
  USING (
    auth.uid() = user_id OR
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'founder'::app_role)
  );

-- Updated_at trigger
CREATE TRIGGER trg_whisper_notes_updated_at
  BEFORE UPDATE ON public.whisper_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- VALIDATION TRIGGER: enforce duration & quota
-- ============================================
CREATE OR REPLACE FUNCTION public.validate_whisper_note()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config jsonb;
  v_window_start timestamptz;
  v_window_end timestamptz;
  v_enabled boolean;
  v_is_privileged boolean;
  v_user_count integer;
  v_max_notes integer := 10;
  v_max_duration integer := 60;
BEGIN
  v_is_privileged := public.has_role(NEW.user_id, 'founder'::app_role)
                  OR public.has_role(NEW.user_id, 'admin'::app_role);

  -- Load config
  SELECT value INTO v_config FROM public.site_settings WHERE key = 'whisper_event_window';
  v_enabled := COALESCE((v_config->>'enabled')::boolean, false);
  v_window_start := NULLIF(v_config->>'start_at', '')::timestamptz;
  v_window_end := NULLIF(v_config->>'end_at', '')::timestamptz;

  IF NOT v_is_privileged THEN
    -- Check feature globally enabled
    IF NOT v_enabled THEN
      RAISE EXCEPTION 'Whisper feature is currently closed.';
    END IF;

    -- Check window
    IF v_window_start IS NULL OR v_window_end IS NULL
       OR now() < v_window_start OR now() > v_window_end THEN
      RAISE EXCEPTION 'Whisper window is not currently open.';
    END IF;

    -- Check duration
    IF NEW.duration_seconds > v_max_duration THEN
      RAISE EXCEPTION 'Whisper duration exceeds % seconds limit.', v_max_duration;
    END IF;

    -- Check quota in current window
    SELECT COUNT(*) INTO v_user_count
    FROM public.whisper_notes
    WHERE user_id = NEW.user_id
      AND event_window_start = v_window_start
      AND status <> 'deleted';

    IF v_user_count >= v_max_notes THEN
      RAISE EXCEPTION 'Maximum % whisper notes per event window reached.', v_max_notes;
    END IF;

    -- Stamp the window
    NEW.event_window_start := v_window_start;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_whisper_notes_validate
  BEFORE INSERT ON public.whisper_notes
  FOR EACH ROW EXECUTE FUNCTION public.validate_whisper_note();

-- ============================================
-- RPC: get whisper event status + remaining quota
-- ============================================
CREATE OR REPLACE FUNCTION public.get_whisper_event_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config jsonb;
  v_visibility jsonb;
  v_feature jsonb;
  v_window_start timestamptz;
  v_window_end timestamptz;
  v_enabled boolean;
  v_visible boolean;
  v_feature_enabled boolean;
  v_is_open boolean := false;
  v_is_privileged boolean := false;
  v_can_create boolean := false;
  v_used_count integer := 0;
  v_uid uuid;
BEGIN
  v_uid := auth.uid();

  SELECT value INTO v_config FROM public.site_settings WHERE key = 'whisper_event_window';
  SELECT value INTO v_visibility FROM public.site_settings WHERE key = 'whisper_visibility';
  SELECT value INTO v_feature FROM public.site_settings WHERE key = 'whisper_enabled';

  v_enabled := COALESCE((v_config->>'enabled')::boolean, false);
  v_window_start := NULLIF(v_config->>'start_at', '')::timestamptz;
  v_window_end := NULLIF(v_config->>'end_at', '')::timestamptz;
  v_visible := COALESCE((v_visibility->>'enabled')::boolean, false);
  v_feature_enabled := COALESCE((v_feature->>'enabled')::boolean, false);

  IF v_enabled AND v_window_start IS NOT NULL AND v_window_end IS NOT NULL
     AND now() >= v_window_start AND now() <= v_window_end THEN
    v_is_open := true;
  END IF;

  IF v_uid IS NOT NULL THEN
    v_is_privileged := public.has_role(v_uid, 'founder'::app_role)
                    OR public.has_role(v_uid, 'admin'::app_role);

    IF v_is_privileged THEN
      v_can_create := v_feature_enabled;
    ELSIF v_feature_enabled AND v_is_open
         AND public.has_role(v_uid, 'inner_circle'::app_role) THEN
      SELECT COUNT(*) INTO v_used_count
      FROM public.whisper_notes
      WHERE user_id = v_uid
        AND event_window_start = v_window_start
        AND status <> 'deleted';
      v_can_create := v_used_count < 10;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'visible', v_visible,
    'feature_enabled', v_feature_enabled,
    'window_open', v_is_open,
    'window_start', v_window_start,
    'window_end', v_window_end,
    'is_privileged', v_is_privileged,
    'can_create', v_can_create,
    'used_count', v_used_count,
    'max_notes', 10,
    'max_duration_seconds', 60
  );
END;
$$;

-- ============================================
-- DEFAULT SITE SETTINGS
-- ============================================
INSERT INTO public.site_settings (key, value)
VALUES
  ('whisper_visibility', '{"enabled": false}'::jsonb),
  ('whisper_enabled', '{"enabled": false}'::jsonb),
  ('whisper_event_window', '{"enabled": false, "start_at": null, "end_at": null}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- STORAGE BUCKET: whisper-audio (public for share)
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'whisper-audio',
  'whisper-audio',
  true,
  26214400,
  ARRAY['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/m4a','audio/mp4','audio/ogg','audio/webm']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (folder = user_id)
CREATE POLICY "Whisper audio publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'whisper-audio');

CREATE POLICY "Users upload to own whisper folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'whisper-audio'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND (
      public.has_role(auth.uid(), 'inner_circle'::app_role) OR
      public.has_role(auth.uid(), 'founder'::app_role) OR
      public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

CREATE POLICY "Users update own whisper audio"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'whisper-audio'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Owner and admins delete whisper audio"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'whisper-audio'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'founder'::app_role)
    )
  );
