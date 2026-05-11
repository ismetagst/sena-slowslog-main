
-- Track failed login attempts for brute-force protection
CREATE TABLE public.login_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  ip_address text,
  attempted_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for fast lookup by email + time
CREATE INDEX idx_login_attempts_email_time ON public.login_attempts (email, attempted_at DESC);

-- Enable RLS
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Edge function uses service role, so no public policies needed for insert
-- Admin/founder can view for monitoring
CREATE POLICY "Admins can manage login attempts"
ON public.login_attempts FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Founders can manage login attempts"
ON public.login_attempts FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'founder'::app_role));
