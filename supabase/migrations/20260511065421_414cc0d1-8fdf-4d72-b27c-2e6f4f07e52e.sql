CREATE OR REPLACE FUNCTION public.validate_letter_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_config jsonb;
  v_feature jsonb;
  v_window_start timestamptz;
  v_window_end timestamptz;
  v_window_enabled boolean;
  v_feature_enabled boolean;
  v_is_privileged boolean;
  v_is_ic boolean;
  v_per_recipient_count integer;
  v_max_per_recipient integer := 50;
  v_max_body_length integer := 280;
BEGIN
  IF char_length(NEW.body) = 0 THEN
    RAISE EXCEPTION 'Letter body cannot be empty.';
  END IF;
  IF char_length(NEW.body) > v_max_body_length THEN
    RAISE EXCEPTION 'Letter exceeds % characters.', v_max_body_length;
  END IF;

  v_is_privileged := public.has_role(NEW.sender_user_id, 'founder'::app_role)
                  OR public.has_role(NEW.sender_user_id, 'admin'::app_role);
  v_is_ic := public.has_role(NEW.sender_user_id, 'inner_circle'::app_role);

  SELECT value INTO v_feature FROM public.site_settings WHERE key = 'letter_enabled';
  v_feature_enabled := COALESCE((v_feature->>'enabled')::boolean, false);

  SELECT value INTO v_config FROM public.site_settings WHERE key = 'letter_event_window';
  v_window_enabled := COALESCE((v_config->>'enabled')::boolean, false);
  v_window_start := NULLIF(v_config->>'start_at', '')::timestamptz;
  v_window_end := NULLIF(v_config->>'end_at', '')::timestamptz;

  IF NOT v_is_privileged THEN
    -- Inner Circle gating: only IC members can send letters.
    IF NOT v_is_ic THEN
      RAISE EXCEPTION 'Letters are exclusive to Inner Circle members.';
    END IF;

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
        RAISE EXCEPTION 'You have reached the limit of % letters for this window.', v_max_per_recipient;
      END IF;

      NEW.event_window_start := v_window_start;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_letter_event_status()
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
  v_window_enabled boolean;
  v_visible boolean;
  v_feature_enabled boolean;
  v_is_open boolean := true;
  v_is_privileged boolean := false;
  v_is_ic boolean := false;
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
    v_is_ic := public.has_role(v_uid, 'inner_circle'::app_role);
  END IF;

  RETURN jsonb_build_object(
    'visible', v_visible,
    'feature_enabled', v_feature_enabled,
    'window_enabled', v_window_enabled,
    'window_open', v_is_open,
    'window_start', v_window_start,
    'window_end', v_window_end,
    'is_privileged', v_is_privileged,
    'is_inner_circle', v_is_ic,
    'can_create', v_is_privileged OR (v_is_ic AND v_feature_enabled AND v_is_open),
    'max_body_length', 280,
    'max_per_recipient', 5
  );
END;
$function$;