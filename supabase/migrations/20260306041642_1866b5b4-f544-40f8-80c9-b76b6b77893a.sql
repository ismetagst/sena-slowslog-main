
-- Rename enum value early_contributor to early_adopter
ALTER TYPE public.app_role RENAME VALUE 'early_contributor' TO 'early_adopter';

-- Add username_changed_at column to profiles
ALTER TABLE public.profiles ADD COLUMN username_changed_at timestamp with time zone DEFAULT NULL;

-- Update handle_new_user to assign early_adopter instead of writer
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', SPLIT_PART(NEW.email, '@', 1))
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'early_adopter');
  RETURN NEW;
END;
$function$;

-- Update default value for user_roles role column
ALTER TABLE public.user_roles ALTER COLUMN role SET DEFAULT 'early_adopter'::app_role;
