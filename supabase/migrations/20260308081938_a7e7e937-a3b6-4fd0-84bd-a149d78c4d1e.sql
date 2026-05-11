
CREATE TABLE public.high_fives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(story_id, user_id)
);

ALTER TABLE public.high_fives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view high fives" ON public.high_fives
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert high fives" ON public.high_fives
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own high fives" ON public.high_fives
  FOR DELETE USING (auth.uid() = user_id);
