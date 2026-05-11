CREATE POLICY "Admins can delete orders"
ON public.ic_orders
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Founders can delete orders"
ON public.ic_orders
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'founder'::app_role));