import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useEffect } from "react";

export interface NotificationRow {
  id: string;
  user_id: string;
  type: "greeting" | "achievement" | "views_milestone";
  story_id: string | null;
  badge_id: string | null;
  count: number;
  milestone_value: number | null;
  created_at: string;
  updated_at: string;
  story?: { id: string; title: string } | null;
  badge?: { id: string; title: string; image_url: string | null; category: string } | null;
}

export const useNotifications = (limit = 50) => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["notifications", user?.id, limit],
    queryFn: async (): Promise<NotificationRow[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false })
        .limit(limit);
      if (error) throw error;

      const rows = (data || []) as NotificationRow[];
      const storyIds = Array.from(new Set(rows.map((r) => r.story_id).filter(Boolean))) as string[];
      const badgeIds = Array.from(new Set(rows.map((r) => r.badge_id).filter(Boolean))) as string[];

      const [storiesRes, badgesRes] = await Promise.all([
        storyIds.length
          ? supabase.from("stories").select("id, title").in("id", storyIds)
          : Promise.resolve({ data: [], error: null } as any),
        badgeIds.length
          ? supabase
              .from("achievement_badges")
              .select("id, title, image_url, category")
              .in("id", badgeIds)
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      const storyMap = new Map((storiesRes.data || []).map((s: any) => [s.id, s]));
      const badgeMap = new Map((badgesRes.data || []).map((b: any) => [b.id, b]));

      return rows.map((r) => ({
        ...r,
        story: r.story_id ? ((storyMap.get(r.story_id) as any) ?? null) : null,
        badge: r.badge_id ? ((badgeMap.get(r.badge_id) as any) ?? null) : null,
      })) as NotificationRow[];
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  // Realtime: refetch on any change to this user's notifications
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["notifications", user.id] });
          qc.invalidateQueries({ queryKey: ["notifications-unseen", user.id] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  return query;
};

/** Returns whether the user has any notifications newer than their last_seen_at. */
export const useHasUnseenNotifications = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["notifications-unseen", user?.id],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("notifications_last_seen_at")
        .eq("user_id", user!.id)
        .maybeSingle();
      const lastSeen = profile?.notifications_last_seen_at ?? new Date(0).toISOString();

      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .gt("updated_at", lastSeen);
      if (error) throw error;
      return (count ?? 0) > 0;
    },
    enabled: !!user,
    staleTime: 15_000,
  });
};

export const useMarkNotificationsSeen = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("mark_notifications_seen");
      if (error) throw error;
    },
    onSuccess: () => {
      if (user) qc.invalidateQueries({ queryKey: ["notifications-unseen", user.id] });
    },
  });
};

export const useDeleteNotification = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (user) qc.invalidateQueries({ queryKey: ["notifications", user.id] });
    },
  });
};
