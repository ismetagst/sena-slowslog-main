
-- Fix WARN 1: whisper_notes UPDATE needs WITH CHECK
DROP POLICY IF EXISTS "Users update own whisper notes" ON public.whisper_notes;
CREATE POLICY "Users update own whisper notes"
  ON public.whisper_notes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Fix WARN 2: storage update needs WITH CHECK
DROP POLICY IF EXISTS "Users update own whisper audio" ON storage.objects;
CREATE POLICY "Users update own whisper audio"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'whisper-audio'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'whisper-audio'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Fix WARN 3: restrict listing to owner/admin (individual file SELECT still public via signed/public URL)
DROP POLICY IF EXISTS "Whisper audio publicly readable" ON storage.objects;
CREATE POLICY "Whisper audio readable by owner and admins"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'whisper-audio'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'founder'::app_role)
    )
  );
