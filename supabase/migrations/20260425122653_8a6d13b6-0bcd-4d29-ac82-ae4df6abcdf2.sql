-- Fix 1: Restrict user_roles SELECT to owner + admins/founders only (remove public read)
DROP POLICY IF EXISTS "Roles viewable by everyone" ON public.user_roles;

-- Existing policies "Users can view own roles" and "Admins can view all roles" already cover
-- legitimate access. Public anonymous enumeration is now blocked.

-- Fix 2: Restore inner_circle visibility gate on stories SELECT
DROP POLICY IF EXISTS "Published stories viewable by everyone" ON public.stories;

CREATE POLICY "Published stories viewable by everyone"
ON public.stories
FOR SELECT
USING (
  (auth.uid() = user_id)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'founder'::app_role)
  OR (
    is_draft = false
    AND is_hidden = false
    AND deleted_at IS NULL
    AND (
      visibility = 'public'
      OR (visibility = 'inner_circle' AND has_role(auth.uid(), 'inner_circle'::app_role))
    )
  )
);