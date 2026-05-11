CREATE OR REPLACE FUNCTION public.validate_whisper_note()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_config jsonb;
  v_window_start timestamptz;
  v_window_end timestamptz;
  v_enabled boolean;
  v_is_privileged boolean;
  v_user_count integer;
  v_max_notes integer := 10;
  v_max_duration integer := 120;
BEGIN
  v_is_privileged := public.has_role(NEW.user_id, 'founder'::app_role)
                  OR public.has_role(NEW.user_id, 'admin'::app_role);

  SELECT value INTO v_config FROM public.site_settings WHERE key = 'whisper_event_window';
  v_enabled := COALESCE((v_config->>'enabled')::boolean, false);
  v_window_start := NULLIF(v_config->>'start_at', '')::timestamptz;
  v_window_end := NULLIF(v_config->>'end_at', '')::timestamptz;

  -- Hard duration cap applies to EVERYONE (incl. admin/founder).
  IF NEW.duration_seconds > v_max_duration THEN
    RAISE EXCEPTION 'Whisper duration exceeds % seconds limit.', v_max_duration;
  END IF;

  IF NOT v_is_privileged THEN
    IF NOT v_enabled THEN
      RAISE EXCEPTION 'Whisper feature is currently closed.';
    END IF;

    IF v_window_start IS NULL OR v_window_end IS NULL
       OR now() < v_window_start OR now() > v_window_end THEN
      RAISE EXCEPTION 'Whisper window is not currently open.';
    END IF;

    SELECT COUNT(*) INTO v_user_count
    FROM public.whisper_notes
    WHERE user_id = NEW.user_id
      AND event_window_start = v_window_start
      AND status <> 'deleted';

    IF v_user_count >= v_max_notes THEN
      RAISE EXCEPTION 'Maximum % whisper notes per event window reached.', v_max_notes;
    END IF;

    NEW.event_window_start := v_window_start;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_whisper_event_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    'max_duration_seconds', 120
  );
END;
$function$;