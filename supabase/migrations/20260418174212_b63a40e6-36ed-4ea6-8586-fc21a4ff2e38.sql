CREATE OR REPLACE FUNCTION public.get_pending_waitlist_count()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::integer FROM public.waitlist WHERE status = 'pending';
$$;

GRANT EXECUTE ON FUNCTION public.get_pending_waitlist_count() TO anon, authenticated;