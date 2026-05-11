
-- Add visibility and is_hidden columns to stories
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public';
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

-- Update RLS: published stories viewable by everyone (but respect visibility & hidden)
DROP POLICY IF EXISTS "Published stories viewable by everyone" ON public.stories;

CREATE POLICY "Published stories viewable by everyone"
ON public.stories FOR SELECT
USING (
  (auth.uid() = user_id)
  OR (
    is_draft = false
    AND is_hidden = false
    AND (
      visibility = 'public'
      OR (visibility = 'inner_circle' AND has_role(auth.uid(), 'inner_circle'))
    )
  )
);
