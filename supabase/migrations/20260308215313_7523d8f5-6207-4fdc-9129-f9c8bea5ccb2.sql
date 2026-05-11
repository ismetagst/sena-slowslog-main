
-- ic_orders: allow admin to view all orders
CREATE POLICY "Admins can view all orders"
ON public.ic_orders FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- ic_orders: allow admin to update orders
CREATE POLICY "Admins can update orders"
ON public.ic_orders FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- site_settings: allow admin to manage settings
CREATE POLICY "Admins can manage settings"
ON public.site_settings FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- user_roles: allow admin to manage roles
CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- stories: allow admin to delete stories
DROP POLICY IF EXISTS "Users can delete own stories" ON public.stories;
CREATE POLICY "Users can delete own stories"
ON public.stories FOR DELETE TO authenticated
USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'founder'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
