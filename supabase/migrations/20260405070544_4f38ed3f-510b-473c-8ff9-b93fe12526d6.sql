
CREATE TABLE public.ic_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan text NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ic_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Memberships readable by everyone" ON public.ic_memberships FOR SELECT TO public USING (true);
CREATE POLICY "Admins can manage memberships" ON public.ic_memberships FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Founders can manage memberships" ON public.ic_memberships FOR ALL TO authenticated USING (has_role(auth.uid(), 'founder'::app_role));
