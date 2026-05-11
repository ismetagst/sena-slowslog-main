
-- Server-side validation trigger for waitlist inserts
-- Prevents bypassing client-side checks
CREATE OR REPLACE FUNCTION public.validate_waitlist_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config jsonb;
  v_enabled boolean;
  v_daily_limit integer;
  v_today_count integer;
BEGIN
  -- Get waitlist config from site_settings
  SELECT value INTO v_config
  FROM public.site_settings
  WHERE key = 'waitlist_config';

  v_enabled := COALESCE((v_config->>'enabled')::boolean, true);
  v_daily_limit := COALESCE((v_config->>'daily_limit')::integer, 200);

  -- Check if registration is enabled
  IF NOT v_enabled THEN
    RAISE EXCEPTION 'Registration is currently closed.';
  END IF;

  -- Check daily limit
  SELECT COUNT(*) INTO v_today_count
  FROM public.waitlist
  WHERE created_at >= date_trunc('day', now());

  IF v_today_count >= v_daily_limit THEN
    RAISE EXCEPTION 'Daily registration limit reached. Try again tomorrow.';
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to waitlist table
DROP TRIGGER IF EXISTS check_waitlist_limits ON public.waitlist;
CREATE TRIGGER check_waitlist_limits
  BEFORE INSERT ON public.waitlist
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_waitlist_insert();
