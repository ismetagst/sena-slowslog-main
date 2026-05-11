
-- =============================================
-- 1. WAITLIST: Restrict SELECT to admin/founder only
-- =============================================
DROP POLICY IF EXISTS "Waitlist viewable by everyone" ON public.waitlist;

CREATE POLICY "Admins can view waitlist"
ON public.waitlist FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Founders already have ALL policy, but let's be explicit for SELECT
-- (the existing "Founders can manage waitlist" ALL policy already covers SELECT)

-- RPC for daily waitlist count (used by public signup page)
CREATE OR REPLACE FUNCTION public.get_today_waitlist_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.waitlist
  WHERE created_at >= date_trunc('day', now());
$$;

-- =============================================
-- 2. STORY VIEWS: Restrict SELECT to story owner + admin/founder
-- =============================================
DROP POLICY IF EXISTS "Views readable by everyone" ON public.story_views;

CREATE POLICY "Users can view own story views"
ON public.story_views FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.stories s
    WHERE s.id = story_views.story_id AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all story views"
ON public.story_views FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Founders can view all story views"
ON public.story_views FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'founder'::app_role));

-- =============================================
-- 3. IC MEMBERSHIPS: Restrict SELECT to own user + admin/founder
-- =============================================
DROP POLICY IF EXISTS "Memberships readable by everyone" ON public.ic_memberships;

CREATE POLICY "Users can view own membership"
ON public.ic_memberships FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Admin/founder ALL policies already cover SELECT

-- =============================================
-- 4. USER ROLES: Restrict SELECT to authenticated only
-- =============================================
DROP POLICY IF EXISTS "Roles viewable by everyone" ON public.user_roles;

CREATE POLICY "Roles viewable by authenticated"
ON public.user_roles FOR SELECT TO authenticated
USING (true);

-- =============================================
-- 5. TRANSFER PROOFS: Restrict storage access
-- =============================================
-- Drop existing overly permissive SELECT policy if any
DROP POLICY IF EXISTS "Transfer proofs are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view transfer proofs" ON storage.objects;

-- Owner can view their own
CREATE POLICY "Users can view own transfer proofs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'transfer-proofs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Admin can view all
CREATE POLICY "Admins can view all transfer proofs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'transfer-proofs'
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Founder can view all
CREATE POLICY "Founders can view all transfer proofs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'transfer-proofs'
  AND has_role(auth.uid(), 'founder'::app_role)
);

-- =============================================
-- 6. INVITE CODES: Restrict SELECT to admin/founder
-- =============================================
DROP POLICY IF EXISTS "Invite codes readable by everyone" ON public.invite_codes;

-- Admin/founder ALL policies already cover SELECT, no additional policy needed

-- =============================================
-- 7. VOUCHERS: Restrict SELECT + create validation RPC
-- =============================================
DROP POLICY IF EXISTS "Vouchers readable by authenticated" ON public.vouchers;

CREATE POLICY "Admins can view all vouchers"
ON public.vouchers FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Founders can view all vouchers"
ON public.vouchers FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'founder'::app_role));

-- RPC for voucher validation (used by payment page)
CREATE OR REPLACE FUNCTION public.validate_voucher(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_voucher record;
BEGIN
  SELECT * INTO v_voucher
  FROM public.vouchers
  WHERE code = UPPER(TRIM(p_code))
    AND is_active = true;

  IF v_voucher IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Voucher not found or inactive');
  END IF;

  IF v_voucher.max_uses IS NOT NULL AND v_voucher.used_count >= v_voucher.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Voucher has reached maximum uses');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'discount_type', v_voucher.discount_type,
    'discount_value', v_voucher.discount_value,
    'code', v_voucher.code
  );
END;
$$;

-- =============================================
-- 8. STORY IMAGES: Add UPDATE policy
-- =============================================
CREATE POLICY "Users can update own story images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'story-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Also make transfer-proofs bucket private
UPDATE storage.buckets SET public = false WHERE id = 'transfer-proofs';
