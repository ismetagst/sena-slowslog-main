import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useBookmarks = () =>
  useQuery({
    queryKey: ["bookmarks"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("bookmarks")
        .select("story_id")
        .eq("user_id", user.id);
      return (data || []).map((b: any) => b.story_id as string);
    },
  });

export const useToggleBookmark = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ storyId, bookmarked }: { storyId: string; bookmarked: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (bookmarked) {
        await supabase.from("bookmarks").delete().eq("user_id", user.id).eq("story_id", storyId);
      } else {
        await supabase.from("bookmarks").insert({ user_id: user.id, story_id: storyId });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
    },
  });
};

export const useBookmarkedStories = () =>
  useQuery({
    queryKey: ["bookmarks", "stories"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: bookmarks } = await supabase
        .from("bookmarks")
        .select("story_id")
        .eq("user_id", user.id);

      if (!bookmarks?.length) return [];

      const storyIds = bookmarks.map((b: any) => b.story_id);
      const { data: stories } = await supabase
        .from("stories")
        .select("*")
        .in("id", storyIds)
        .eq("is_draft", false);

      return stories || [];
    },
  });
