import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface LetterEventStatus {
  visible: boolean;
  feature_enabled: boolean;
  window_enabled: boolean;
  window_open: boolean;
  window_start: string | null;
  window_end: string | null;
  is_privileged: boolean;
  is_inner_circle: boolean;
  can_create: boolean;
  max_body_length: number;
  max_per_recipient: number;
}

export type LetterStatus = "active" | "hidden_by_recipient" | "deleted";
export type PaperStyle = "cream" | "blush" | "sky" | "sage";

export interface Letter {
  id: string;
  recipient_user_id: string;
  sender_user_id: string;
  body: string;
  signature: string | null;
  paper_style: PaperStyle;
  cover_emoji: string | null;
  status: LetterStatus;
  event_window_start: string | null;
  created_at: string;
  updated_at: string;
  sender?: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
}

export const useLetterEventStatus = () =>
  useQuery({
    queryKey: ["letter-event-status"],
    queryFn: async (): Promise<LetterEventStatus> => {
      const { data, error } = await supabase.rpc("get_letter_event_status");
      if (error) throw error;
      return data as unknown as LetterEventStatus;
    },
    staleTime: 30_000,
  });

export const useLetters = (recipientUserId: string | undefined) =>
  useQuery({
    queryKey: ["letters", recipientUserId],
    enabled: !!recipientUserId,
    queryFn: async (): Promise<Letter[]> => {
      const { data, error } = await supabase
        .from("letters")
        .select("*")
        .eq("recipient_user_id", recipientUserId!)
        .neq("status", "deleted")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const letters = (data || []) as Letter[];
      if (letters.length === 0) return letters;

      const senderIds = Array.from(new Set(letters.map((l) => l.sender_user_id)));
      const { data: senders } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .in("user_id", senderIds);
      const map = new Map((senders || []).map((s) => [s.user_id, s] as const));

      return letters.map((l) => ({
        ...l,
        sender: (() => {
          const s = map.get(l.sender_user_id);
          return s
            ? {
                username: s.username,
                display_name: s.display_name,
                avatar_url: s.avatar_url,
              }
            : null;
        })(),
      }));
    },
  });

export const useCreateLetter = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      recipientUserId: string;
      senderUserId: string;
      body: string;
      signature?: string;
      paper_style?: PaperStyle;
      cover_emoji?: string;
    }) => {
      const { data, error } = await supabase
        .from("letters")
        .insert({
          recipient_user_id: input.recipientUserId,
          sender_user_id: input.senderUserId,
          body: input.body.trim(),
          signature: input.signature?.trim() || null,
          paper_style: input.paper_style || "cream",
          cover_emoji: input.cover_emoji || "✉",
        })
        .select()
        .single();
      if (error) throw error;
      return data as Letter;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["letters", vars.recipientUserId] });
      toast.success("letter sent (｡♥‿♥｡)");
    },
    onError: (err: Error) => toast.error(err.message || "could not send"),
  });
};

export const useUpdateLetterStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status: LetterStatus; recipientUserId: string }) => {
      const { error } = await supabase
        .from("letters")
        .update({ status: input.status })
        .eq("id", input.id);
      if (error) throw error;
      return input;
    },
    onSuccess: (vars) => {
      qc.invalidateQueries({ queryKey: ["letters", vars.recipientUserId] });
      toast.success(vars.status === "hidden_by_recipient" ? "letter hidden" : "letter restored");
    },
    onError: (err: Error) => toast.error(err.message),
  });
};

export const useDeleteLetter = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; recipientUserId: string }) => {
      const { error } = await supabase.from("letters").delete().eq("id", input.id);
      if (error) throw error;
      return input;
    },
    onSuccess: (vars) => {
      qc.invalidateQueries({ queryKey: ["letters", vars.recipientUserId] });
      toast.success("letter removed");
    },
    onError: (err: Error) => toast.error(err.message),
  });
};
