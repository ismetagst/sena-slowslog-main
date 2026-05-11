
CREATE TABLE public.waitlist_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_waitlist_attempts_ip_time ON public.waitlist_attempts (ip_address, created_at DESC);
CREATE INDEX idx_waitlist_attempts_email_time ON public.waitlist_attempts (email, created_at DESC);

ALTER TABLE public.waitlist_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view waitlist attempts"
  ON public.waitlist_attempts FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'founder'::app_role));

CREATE POLICY "Admins can manage waitlist attempts"
  ON public.waitlist_attempts FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'founder'::app_role));
