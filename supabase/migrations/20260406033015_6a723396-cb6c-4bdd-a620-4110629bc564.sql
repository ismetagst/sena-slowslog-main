
ALTER TABLE public.stories ADD COLUMN deleted_at timestamptz DEFAULT NULL;

-- Update the select policy to also exclude soft-deleted stories
DROP POLICY IF EXISTS "Published stories viewable by everyone" ON public.stories;
CREATE POLICY "Published stories viewable by everyone" ON public.stories FOR SELECT TO public
USING ((auth.uid() = user_id) OR (is_draft = false AND is_hidden = false AND deleted_at IS NULL));
