-- Replace broad SELECT policies that allowed listing all files in public buckets.
-- Files remain accessible via direct public URLs (CDN). Only enumeration is blocked.

DROP POLICY IF EXISTS "Public avatar access" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view story images" ON storage.objects;

-- Avatars: only owner can list their own folder; public CDN URLs still work
CREATE POLICY "Users can list own avatar"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- Story images: only owner can list their own folder; public CDN URLs still work
CREATE POLICY "Users can list own story images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'story-images'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- Badge images: admins/founders can list; public CDN URLs still work
CREATE POLICY "Admins can list badge images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'badge-images'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'founder'::app_role))
);
