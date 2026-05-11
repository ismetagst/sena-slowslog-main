
-- Bookmarks table
CREATE TABLE public.bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, story_id)
);

ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bookmarks" ON public.bookmarks
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bookmarks" ON public.bookmarks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own bookmarks" ON public.bookmarks
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Story views tracking table (unique per user per story)
CREATE TABLE public.story_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  viewer_ip text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(story_id, viewer_id)
);

ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert views" ON public.story_views
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = viewer_id);

CREATE POLICY "Views readable by everyone" ON public.story_views
  FOR SELECT USING (true);

-- Function to record a view and update the count
CREATE OR REPLACE FUNCTION public.record_story_view(p_story_id uuid, p_viewer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.story_views (story_id, viewer_id)
  VALUES (p_story_id, p_viewer_id)
  ON CONFLICT (story_id, viewer_id) DO NOTHING;
  
  UPDATE public.stories
  SET views = (SELECT COUNT(*) FROM public.story_views WHERE story_id = p_story_id)
  WHERE id = p_story_id;
END;
$$;
