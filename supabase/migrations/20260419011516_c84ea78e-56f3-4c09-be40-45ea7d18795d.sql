-- 1. Voucher usage: require matching order
CREATE OR REPLACE FUNCTION public.increment_voucher_usage(p_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.ic_orders
    WHERE user_id = auth.uid()
      AND UPPER(TRIM(voucher_code)) = UPPER(TRIM(p_code))
      AND status IN ('pending', 'approved')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: no matching order found';
  END IF;

  UPDATE public.vouchers
  SET used_count = used_count + 1, updated_at = now()
  WHERE code = UPPER(TRIM(p_code));
END;
$$;

-- 2. Publish cooldown trigger
CREATE OR REPLACE FUNCTION public.enforce_publish_cooldown()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  last_pub timestamptz;
  cooldown_days int := 6;
BEGIN
  -- Only check on transition from draft -> published
  IF NEW.is_draft = false AND (OLD.is_draft = true OR OLD.published_at IS NULL) THEN
    -- Bypass for founders and admins
    IF public.has_role(auth.uid(), 'founder'::app_role)
       OR public.has_role(auth.uid(), 'admin'::app_role) THEN
      RETURN NEW;
    END IF;

    IF public.has_role(auth.uid(), 'inner_circle'::app_role) THEN
      cooldown_days := 3;
    END IF;

    SELECT MAX(published_at) INTO last_pub
    FROM public.stories
    WHERE user_id = NEW.user_id
      AND is_draft = false
      AND deleted_at IS NULL
      AND id <> NEW.id;

    IF last_pub IS NOT NULL AND last_pub > now() - (cooldown_days || ' days')::interval THEN
      RAISE EXCEPTION 'Publishing cooldown active. You can publish again after %',
        to_char(last_pub + (cooldown_days || ' days')::interval, 'YYYY-MM-DD HH24:MI UTC');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_publish_cooldown ON public.stories;
CREATE TRIGGER trg_publish_cooldown
BEFORE UPDATE ON public.stories
FOR EACH ROW
EXECUTE FUNCTION public.enforce_publish_cooldown();

-- 3. Restrict user_roles SELECT to own row
DROP POLICY IF EXISTS "Roles viewable by authenticated" ON public.user_roles;

CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins/founders still need to see all for management
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'founder'::app_role));

-- 4. Restrict listing on public storage buckets (avatars, story-images, badge-images)
-- Direct URL access still works because buckets are public; only listing/enumeration is blocked.
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND cmd = 'SELECT'
      AND (
        policyname ILIKE '%avatar%public%'
        OR policyname ILIKE '%story-images%public%'
        OR policyname ILIKE '%badge%public%'
        OR policyname ILIKE '%public read%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;
