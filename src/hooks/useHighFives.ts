import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export const useHighFiveCount = (storyId: string | undefined) => {
  return useQuery({
    queryKey: ["high-five-count", storyId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("high_fives")
        .select("*", { count: "exact", head: true })
        .eq("story_id", storyId!);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!storyId,
  });
};

export const useHasHighFived = (storyId: string | undefined) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["has-high-fived", storyId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("high_fives")
        .select("id")
        .eq("story_id", storyId!)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled: !!storyId && !!user,
  });
};

export const useToggleHighFive = () => {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ storyId, hasHighFived }: { storyId: string; hasHighFived: boolean }) => {
      if (!user) throw new Error("Must be logged in");
      if (hasHighFived) {
        const { error } = await supabase
          .from("high_fives")
          .delete()
          .eq("story_id", storyId)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("high_fives")
          .insert({ story_id: storyId, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: (_, { storyId }) => {
      qc.invalidateQueries({ queryKey: ["high-five-count", storyId] });
      qc.invalidateQueries({ queryKey: ["has-high-fived", storyId] });
    },
  });
};
