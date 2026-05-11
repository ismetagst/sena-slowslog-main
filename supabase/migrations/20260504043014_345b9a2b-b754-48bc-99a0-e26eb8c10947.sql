CREATE POLICY "Authenticated users can view role badges"
ON public.user_roles
FOR SELECT
TO authenticated
USING (true);