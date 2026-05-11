import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CreateWhisperInput {
  userId: string;
  folderId?: string | null;
  title: string;
  recipientName?: string;
  shortMessage?: string;
  audioBlob: Blob;
  durationSeconds: number;
  onProgress?: (percent: number) => void;
}

const AUDIO_EXTENSIONS = ["mp3", "wav", "m4a", "aac", "ogg", "webm", "mp4"] as const;

const getBlobExtension = (blob: Blob): string => {
  const nameExt = blob instanceof File ? blob.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] : undefined;
  if (nameExt && AUDIO_EXTENSIONS.includes(nameExt as typeof AUDIO_EXTENSIONS[number])) return nameExt;
  if (blob.type.includes("webm")) return "webm";
  if (blob.type.includes("mp4") || blob.type.includes("m4a")) return "m4a";
  if (blob.type.includes("aac")) return "aac";
  if (blob.type.includes("ogg")) return "ogg";
  if (blob.type.includes("wav")) return "wav";
  return "mp3";
};

const getAudioContentType = (ext: string, fallback?: string) => {
  if (ext === "m4a" || ext === "mp4") return "audio/mp4";
  if (ext === "aac") return "audio/aac";
  if (ext === "webm") return "audio/webm";
  if (ext === "ogg") return "audio/ogg";
  if (ext === "wav") return "audio/wav";
  if (fallback?.startsWith("audio/")) return fallback;
  return "audio/mpeg";
};

const validateUploadBlob = (blob: Blob) => {
  if (!(blob instanceof Blob)) throw new Error("audio upload payload is invalid");
  if (blob.size <= 0) throw new Error("audio upload payload is empty (0 B)");
};

const verifyStoredObjectSize = async (path: string) => {
  const folder = path.split("/").slice(0, -1).join("/");
  const fileName = path.split("/").pop();
  const { data: objects, error: listError } = await supabase.storage
    .from("whisper-audio")
    .list(folder, { search: fileName, limit: 1 });
  if (listError) throw listError;

  const listedSize = objects?.find((object) => object.name === fileName)?.metadata?.size;
  if (typeof listedSize === "number") return listedSize;

  const { data: downloaded, error: downloadError } = await supabase.storage.from("whisper-audio").download(path);
  if (downloadError) throw downloadError;
  return downloaded.size;
};

const uploadAudioObject = async (path: string, blob: Blob, contentType: string, onProgress?: (p: number) => void) => {
  validateUploadBlob(blob);
  onProgress?.(8);
  const payload = await blob.arrayBuffer();
  if (payload.byteLength <= 0) throw new Error("audio upload payload became empty before storage (0 B)");
  onProgress?.(20);

  const { error } = await supabase.storage
    .from("whisper-audio")
    .upload(path, payload, { contentType, cacheControl: "31536000", upsert: false });
  if (error) throw error;
  onProgress?.(95);

  const uploadedSize = await verifyStoredObjectSize(path);
  if (uploadedSize <= 0) {
    await supabase.storage.from("whisper-audio").remove([path]);
    throw new Error("audio upload reached storage as 0 B");
  }
  onProgress?.(100);
};

export const useCreateWhisper = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateWhisperInput) => {
      const {
        userId,
        folderId,
        title,
        recipientName,
        shortMessage,
        audioBlob,
        durationSeconds,
        onProgress,
      } = input;

      const ext = getBlobExtension(audioBlob);

      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const contentType = getAudioContentType(ext, audioBlob.type);

      onProgress?.(0);
      await uploadAudioObject(path, audioBlob, contentType, onProgress);

      const { data: pub } = supabase.storage.from("whisper-audio").getPublicUrl(path);

      const { error: insErr, data } = await supabase
        .from("whisper_notes")
        .insert({
          user_id: userId,
          folder_id: folderId || null,
          title: title.trim() || "Untitled whisper",
          recipient_name: recipientName?.trim() || null,
          short_message: shortMessage?.trim() || null,
          audio_url: pub.publicUrl,
          audio_path: path,
          duration_seconds: Math.round(durationSeconds),
          file_size_bytes: audioBlob.size,
        })
        .select()
        .single();

      if (insErr) {
        await supabase.storage.from("whisper-audio").remove([path]);
        throw insErr;
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whisper-notes"] });
      qc.invalidateQueries({ queryKey: ["whisper-folder-notes"] });
      qc.invalidateQueries({ queryKey: ["whisper-folders"] });
      qc.invalidateQueries({ queryKey: ["whisper-event-status"] });
      toast.success("whisper saved (♪⌒)");
    },
    onError: (err: Error) => {
      toast.error(err.message || "could not save whisper");
    },
  });
};

export const useDeleteWhisper = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (note: { id: string; audio_path: string }) => {
      const { error } = await supabase.from("whisper_notes").delete().eq("id", note.id);
      if (error) throw error;
      await supabase.storage.from("whisper-audio").remove([note.audio_path]);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whisper-notes"] });
      qc.invalidateQueries({ queryKey: ["whisper-folder-notes"] });
      qc.invalidateQueries({ queryKey: ["whisper-folders"] });
      qc.invalidateQueries({ queryKey: ["whisper-event-status"] });
      toast.success("whisper removed");
    },
    onError: (err: Error) => toast.error(err.message),
  });
};
