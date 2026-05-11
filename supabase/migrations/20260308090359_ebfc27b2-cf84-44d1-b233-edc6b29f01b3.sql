
-- Add device_type column to story_views
ALTER TABLE public.story_views ADD COLUMN IF NOT EXISTS device_type text DEFAULT 'unknown';

-- Update the record_story_view function to accept device_type
CREATE OR REPLACE FUNCTION public.record_story_view(p_story_id uuid, p_viewer_id uuid, p_device_type text DEFAULT 'unknown')
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.story_views (story_id, viewer_id, device_type)
  VALUES (p_story_id, p_viewer_id, p_device_type)
  ON CONFLICT (story_id, viewer_id) DO UPDATE SET device_type = EXCLUDED.device_type;
  
  UPDATE public.stories
  SET views = (SELECT COUNT(*) FROM public.story_views WHERE story_id = p_story_id)
  WHERE id = p_story_id;
END;
$function$;
