INSERT INTO storage.buckets (id, name, public) VALUES ('story-images', 'story-images', true);

CREATE POLICY "Authenticated users can upload story images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'story-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view story images"
ON storage.objects FOR SELECT
USING (bucket_id = 'story-images');

CREATE POLICY "Users can delete own story images"
ON storage.objects FOR DELETE
USING (bucket_id = 'story-images' AND auth.uid()::text = (storage.foldername(name))[1]);