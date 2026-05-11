
CREATE OR REPLACE FUNCTION public.increment_voucher_usage(p_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.vouchers
  SET used_count = used_count + 1, updated_at = now()
  WHERE code = p_code;
END;
$$;
