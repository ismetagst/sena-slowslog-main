
-- Update RLS: everyone can see all published non-hidden stories (content protection at app level)
-- Inner circle stories should appear in feed but content is gated
DROP POLICY IF EXISTS "Published stories viewable by everyone" ON public.stories;

CREATE POLICY "Published stories viewable by everyone"
ON public.stories FOR SELECT
USING (
  (auth.uid() = user_id)
  OR (
    is_draft = false
    AND is_hidden = false
  )
);

-- Create a secure function to get story content (returns truncated for non-inner-circle users)
CREATE OR REPLACE FUNCTION public.get_story_content(p_story_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_visibility text;
  v_content text;
  v_user_id uuid;
  v_story_owner uuid;
BEGIN
  SELECT visibility, content, user_id INTO v_visibility, v_content, v_story_owner
  FROM public.stories WHERE id = p_story_id;
  
  v_user_id := auth.uid();
  
  -- Owner always sees full content
  IF v_user_id = v_story_owner THEN
    RETURN v_content;
  END IF;
  
  -- Public stories: full content
  IF v_visibility = 'public' THEN
    RETURN v_content;
  END IF;
  
  -- Inner circle stories: check role
  IF v_visibility = 'inner_circle' THEN
    IF has_role(v_user_id, 'inner_circle') THEN
      RETURN v_content;
    ELSE
      -- Return only first 300 chars stripped of HTML
      RETURN LEFT(regexp_replace(v_content, '<[^>]+>', ' ', 'g'), 300);
    END IF;
  END IF;
  
  RETURN v_content;
END;
$$;
