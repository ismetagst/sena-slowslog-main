ALTER TABLE public.profiles ADD COLUMN joined_at timestamp with time zone DEFAULT now();
UPDATE public.profiles SET joined_at = created_at;