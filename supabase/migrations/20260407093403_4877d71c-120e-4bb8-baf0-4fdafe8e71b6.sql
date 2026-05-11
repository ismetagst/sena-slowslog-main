
-- Add is_setup_complete to profiles (existing users default true)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_setup_complete boolean NOT NULL DEFAULT true;

-- Waitlist table
CREATE TABLE public.waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  auth_user_id uuid,
  CONSTRAINT waitlist_email_unique UNIQUE (email)
);

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert waitlist" ON public.waitlist
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Waitlist viewable by everyone" ON public.waitlist
  FOR SELECT USING (true);

CREATE POLICY "Founders can manage waitlist" ON public.waitlist
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'founder'::app_role));

CREATE POLICY "Admins can manage waitlist" ON public.waitlist
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Personal key history
CREATE TABLE public.personal_key_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  generated_by uuid,
  change_type text NOT NULL DEFAULT 'admin_generated'
);

ALTER TABLE public.personal_key_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders can manage key history" ON public.personal_key_history
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'founder'::app_role));

CREATE POLICY "Admins can manage key history" ON public.personal_key_history
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own key history" ON public.personal_key_history
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own key history" ON public.personal_key_history
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Forgot key requests
CREATE TABLE public.forgot_key_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid
);

ALTER TABLE public.forgot_key_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit forgot request" ON public.forgot_key_requests
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Founders can manage forgot requests" ON public.forgot_key_requests
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'founder'::app_role));

CREATE POLICY "Admins can manage forgot requests" ON public.forgot_key_requests
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
