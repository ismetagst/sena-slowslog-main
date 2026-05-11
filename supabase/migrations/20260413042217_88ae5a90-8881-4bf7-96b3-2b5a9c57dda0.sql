
-- Create achievement_badges table
CREATE TABLE public.achievement_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('output', 'reach', 'special')),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  check_type TEXT NOT NULL DEFAULT 'manual',
  check_value INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.achievement_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Achievement badges readable by everyone"
ON public.achievement_badges FOR SELECT
USING (true);

CREATE POLICY "Admins can manage achievement badges"
ON public.achievement_badges FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Founders can manage achievement badges"
ON public.achievement_badges FOR ALL
USING (has_role(auth.uid(), 'founder'::app_role));

CREATE TRIGGER update_achievement_badges_updated_at
BEFORE UPDATE ON public.achievement_badges
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create user_achievements table
CREATE TABLE public.user_achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  badge_id UUID NOT NULL REFERENCES public.achievement_badges(id) ON DELETE CASCADE,
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  granted_by UUID,
  UNIQUE(user_id, badge_id)
);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User achievements readable by everyone"
ON public.user_achievements FOR SELECT
USING (true);

CREATE POLICY "Admins can manage user achievements"
ON public.user_achievements FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Founders can manage user achievements"
ON public.user_achievements FOR ALL
USING (has_role(auth.uid(), 'founder'::app_role));

-- Storage bucket for badge images
INSERT INTO storage.buckets (id, name, public) VALUES ('badge-images', 'badge-images', true);

CREATE POLICY "Badge images publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'badge-images');

CREATE POLICY "Admins can upload badge images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'badge-images' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'founder'::app_role)));

CREATE POLICY "Admins can update badge images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'badge-images' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'founder'::app_role)));

CREATE POLICY "Admins can delete badge images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'badge-images' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'founder'::app_role)));

-- Seed data: Output badges
INSERT INTO public.achievement_badges (category, title, description, check_type, check_value, sort_order) VALUES
('output', 'First Steps', 'Published your first story', 'story_count', 1, 1),
('output', 'Getting Started', 'Published 5 stories', 'story_count', 5, 2),
('output', 'Consistent Writer', 'Published 10 stories', 'story_count', 10, 3),
('output', 'Storyteller', 'Published 25 stories', 'story_count', 25, 4),
('output', 'Dedicated Author', 'Published 50 stories', 'story_count', 50, 5),
('output', 'Grand Narrator', 'Published 100 stories', 'story_count', 100, 6);

-- Seed data: Reach badges
INSERT INTO public.achievement_badges (category, title, description, check_type, check_value, sort_order) VALUES
('reach', 'Getting Noticed', 'Your articles reached 100 views', 'total_views', 100, 1),
('reach', 'Rising Star', 'Your articles reached 500 views', 'total_views', 500, 2),
('reach', 'Viral Voice', 'Your articles reached 1,000 views', 'total_views', 1000, 3),
('reach', 'Phenomenon', 'Your articles reached 10,000 views', 'total_views', 10000, 4);

-- Seed data: Special badges
INSERT INTO public.achievement_badges (category, title, description, check_type, check_value, sort_order) VALUES
('special', 'Early Adopter', 'Among the first 250 users', 'early_adopter', 250, 1),
('special', 'Editor''s Pick', 'Curated by editorial team', 'editors_pick', NULL, 2),
('special', 'Anniversary', '1 year on the platform', 'anniversary', 1, 3);
