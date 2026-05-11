CREATE POLICY "Roles viewable by everyone"
ON public.user_roles
FOR SELECT
TO public
USING (true);