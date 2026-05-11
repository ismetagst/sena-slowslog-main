-- Create whisper_folders table (event-based collections)
CREATE TABLE public.whisper_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT '',
  description text DEFAULT '',
  visibility text NOT NULL DEFAULT 'private', -- 'public' | 'link_only' | 'private'
  event_window_start timestamptz,
  cover_emoji text DEFAULT '♪',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_whisper_folders_user ON public.whisper_folders(user_id);
CREATE INDEX idx_whisper_folders_visibility ON public.whisper_folders(visibility);

-- Add folder_id to whisper_notes
ALTER TABLE public.whisper_notes
  ADD COLUMN folder_id uuid REFERENCES public.whisper_folders(id) ON DELETE CASCADE;

CREATE INDEX idx_whisper_notes_folder ON public.whisper_notes(folder_id);

-- Enable RLS
ALTER TABLE public.whisper_folders ENABLE ROW LEVEL SECURITY;

-- RLS: visibility-aware select
CREATE POLICY "Public folders viewable by everyone"
ON public.whisper_folders FOR SELECT
USING (
  visibility = 'public'
  OR auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'founder'::app_role)
);

-- Note: link_only folders are accessed by direct ID lookup; we still allow select if you know the ID
CREATE POLICY "Link-only folders viewable by id"
ON public.whisper_folders FOR SELECT
USING (visibility = 'link_only');

CREATE POLICY "IC and admins can create folders"
ON public.whisper_folders FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (
    has_role(auth.uid(), 'inner_circle'::app_role)
    OR has_role(auth.uid(), 'founder'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "Owners and admins can update folders"
ON public.whisper_folders FOR UPDATE
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'founder'::app_role)
)
WITH CHECK (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'founder'::app_role)
);

CREATE POLICY "Owners and admins can delete folders"
ON public.whisper_folders FOR DELETE
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'founder'::app_role)
);

-- Trigger updated_at
CREATE TRIGGER update_whisper_folders_updated_at
  BEFORE UPDATE ON public.whisper_folders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Replace the public select policy on whisper_notes to respect folder visibility
DROP POLICY IF EXISTS "Active whisper notes viewable by everyone" ON public.whisper_notes;

CREATE POLICY "Whisper notes visible based on folder"
ON public.whisper_notes FOR SELECT
USING (
  status = 'active'
  AND (
    -- owner/admin always
    auth.uid() = user_id
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'founder'::app_role)
    -- public folders
    OR EXISTS (
      SELECT 1 FROM public.whisper_folders f
      WHERE f.id = whisper_notes.folder_id
        AND f.visibility = 'public'
    )
    -- link_only folders (accessible if you know the folder/note id)
    OR EXISTS (
      SELECT 1 FROM public.whisper_folders f
      WHERE f.id = whisper_notes.folder_id
        AND f.visibility = 'link_only'
    )
    -- legacy notes without folder remain visible to owner only (covered above)
  )
);