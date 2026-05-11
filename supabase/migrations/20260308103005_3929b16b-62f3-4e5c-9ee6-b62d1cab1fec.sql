
-- Add inner_circle to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'inner_circle';

-- Create site_settings table for feature toggles
CREATE TABLE public.site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings
CREATE POLICY "Settings readable by everyone"
  ON public.site_settings FOR SELECT
  USING (true);

-- Only founders can manage settings
CREATE POLICY "Founders can manage settings"
  ON public.site_settings FOR ALL
  USING (public.has_role(auth.uid(), 'founder'));

-- Insert default setting for inner circle feature
INSERT INTO public.site_settings (key, value)
VALUES ('inner_circle_enabled', '{"enabled": false}'::jsonb);
