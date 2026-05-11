import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface WhisperEventStatus {
  visible: boolean;
  feature_enabled: boolean;
  window_open: boolean;
  window_start: string | null;
  window_end: string | null;
  is_privileged: boolean;
  can_create: boolean;
  used_count: number;
  max_notes: number;
  max_duration_seconds: number;
}

export type WhisperVisibility = "public" | "link_only" | "private";

export interface WhisperFolder {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  visibility: WhisperVisibility;
  event_window_start: string | null;
  cover_emoji: string | null;
  created_at: string;
  updated_at: string;
  note_count?: number;
}

export interface WhisperNote {
  id: string;
  user_id: string;
  folder_id: string | null;
  title: string;
  audio_url: string;
  audio_path: string;
  duration_seconds: number;
  file_size_bytes: number;
  status: string;
  recipient_name: string | null;
  short_message: string | null;
  event_window_start: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

const attachPlayableWhisperUrls = async (notes: WhisperNote[]) => {
  if (notes.length === 0) return notes;
  const paths = notes.map((note) => note.audio_path).filter(Boolean);
  if (paths.length === 0) return notes;

  const { data, error } = await supabase.storage
    .from("whisper-audio")
    .createSignedUrls(paths, 60 * 60);

  if (error || !data) return notes;

  const signedByPath = new Map(
    data
      .filter((item) => item.path && item.signedUrl)
      .map((item) => [item.path as string, item.signedUrl as string])
  );

  return notes.map((note) => ({
    ...note,
    audio_url: signedByPath.get(note.audio_path) || note.audio_url,
  }));
};

export const useWhisperEventStatus = () => {
  return useQuery({
    queryKey: ["whisper-event-status"],
    queryFn: async (): Promise<WhisperEventStatus> => {
      const { data, error } = await supabase.rpc("get_whisper_event_status");
      if (error) throw error;
      return data as unknown as WhisperEventStatus;
    },
    staleTime: 30_000,
  });
};

// Folders for a user (visibility filtered by RLS automatically)
export const useWhisperFolders = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["whisper-folders", userId],
    enabled: !!userId,
    queryFn: async (): Promise<WhisperFolder[]> => {
      const { data, error } = await supabase
        .from("whisper_folders")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;

      // attach note counts
      const folders = (data || []) as WhisperFolder[];
      if (folders.length === 0) return folders;

      const { data: counts } = await supabase
        .from("whisper_notes")
        .select("folder_id")
        .in("folder_id", folders.map((f) => f.id))
        .neq("status", "deleted");

      const map = new Map<string, number>();
      (counts || []).forEach((r: { folder_id: string | null }) => {
        if (r.folder_id) map.set(r.folder_id, (map.get(r.folder_id) || 0) + 1);
      });

      return folders.map((f) => ({ ...f, note_count: map.get(f.id) || 0 }));
    },
  });
};

export const useWhisperFolder = (folderId: string | undefined) => {
  return useQuery({
    queryKey: ["whisper-folder", folderId],
    enabled: !!folderId,
    queryFn: async (): Promise<WhisperFolder | null> => {
      const { data, error } = await supabase
        .from("whisper_folders")
        .select("*")
        .eq("id", folderId!)
        .maybeSingle();
      if (error) throw error;
      return data as WhisperFolder | null;
    },
  });
};

export const useFolderNotes = (folderId: string | undefined) => {
  return useQuery({
    queryKey: ["whisper-folder-notes", folderId],
    enabled: !!folderId,
    queryFn: async (): Promise<WhisperNote[]> => {
      const { data, error } = await supabase
        .from("whisper_notes")
        .select("*")
        .eq("folder_id", folderId!)
        .neq("status", "deleted")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return attachPlayableWhisperUrls((data || []) as WhisperNote[]);
    },
  });
};

interface CreateFolderInput {
  userId: string;
  title: string;
  description?: string;
  visibility: WhisperVisibility;
  cover_emoji?: string;
}

export const useCreateFolder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateFolderInput) => {
      const { data, error } = await supabase
        .from("whisper_folders")
        .insert({
          user_id: input.userId,
          title: input.title.trim() || "Untitled folder",
          description: input.description?.trim() || null,
          visibility: input.visibility,
          cover_emoji: input.cover_emoji || "♪",
        })
        .select()
        .single();
      if (error) throw error;
      return data as WhisperFolder;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["whisper-folders", vars.userId] });
      toast.success("folder created (♪⌒)");
    },
    onError: (err: Error) => toast.error(err.message || "could not create folder"),
  });
};

export const useUpdateFolder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      title?: string;
      description?: string;
      visibility?: WhisperVisibility;
      cover_emoji?: string;
    }) => {
      const { id, ...patch } = input;
      const { data, error } = await supabase
        .from("whisper_folders")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as WhisperFolder;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["whisper-folders", data.user_id] });
      qc.invalidateQueries({ queryKey: ["whisper-folder", data.id] });
      toast.success("folder updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });
};

export const useDeleteFolder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (folder: WhisperFolder) => {
      // fetch note paths to clean up storage
      const { data: notes } = await supabase
        .from("whisper_notes")
        .select("audio_path")
        .eq("folder_id", folder.id);
      const paths = (notes || []).map((n: { audio_path: string }) => n.audio_path).filter(Boolean);

      const { error } = await supabase.from("whisper_folders").delete().eq("id", folder.id);
      if (error) throw error;
      if (paths.length > 0) {
        await supabase.storage.from("whisper-audio").remove(paths);
      }
      return folder;
    },
    onSuccess: (folder) => {
      qc.invalidateQueries({ queryKey: ["whisper-folders", folder.user_id] });
      toast.success("folder removed");
    },
    onError: (err: Error) => toast.error(err.message),
  });
};

// Legacy: all notes by user (used in admin moderation)
export const useWhisperNotes = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["whisper-notes", userId],
    enabled: !!userId,
    queryFn: async (): Promise<WhisperNote[]> => {
      const { data, error } = await supabase
        .from("whisper_notes")
        .select("*")
        .eq("user_id", userId!)
        .neq("status", "deleted")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return attachPlayableWhisperUrls((data || []) as WhisperNote[]);
    },
  });
};
