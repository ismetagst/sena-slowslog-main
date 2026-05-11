DROP POLICY IF EXISTS "Public folders viewable by everyone" ON public.whisper_folders;
DROP POLICY IF EXISTS "Link-only folders viewable by id" ON public.whisper_folders;

CREATE POLICY "Folders viewable by visibility rules"
ON public.whisper_folders FOR SELECT
USING (
  visibility IN ('public', 'link_only')
  OR auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'founder'::app_role)
);