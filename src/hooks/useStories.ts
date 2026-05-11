import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getPrimaryRoleForDisplay, type Story } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";

const mapStory = (row: any): Story => ({
  ...row,
  visibility: (row.visibility || "public") as Story["visibility"],
  author: row.profiles
    ? {
        id: row.profiles.id,
        user_id: row.profiles.user_id,
        display_name: row.profiles.display_name,
        username: row.profiles.username,
        avatar_url: row.profiles.avatar_url,
        bio: row.profiles.bio || "",
        role: row.user_roles?.[0]?.role,
      }
    : undefined,
});

export const usePublishedStories = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["stories", "published", user?.id ?? "anon"],
    queryFn: async () => {
      const { data } = await supabase
        .from("stories")
        .select("*")
        .eq("is_draft", false)
        .is("deleted_at", null)
        .order("published_at", { ascending: false });

      if (!data || data.length === 0) return [];

      const userIds = [...new Set(data.map((s: any) => s.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("*").in("user_id", userIds);
      const { data: roles } = user
        ? await supabase.from("user_roles").select("*").in("user_id", userIds)
        : { data: [] };

      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

      // Group all roles by user, then pick primary (non-inner_circle) role
      const rolesMap = new Map<string, string[]>();
      (roles || []).forEach((r) => {
        const existing = rolesMap.get(r.user_id) || [];
        existing.push(r.role);
        rolesMap.set(r.user_id, existing);
      });

      return data.map((s: any) => {
        const p = profileMap.get(s.user_id);
        const userRoles = rolesMap.get(s.user_id) || [];
        const primaryRole = getPrimaryRoleForDisplay(userRoles);
        return mapStory({
          ...s,
          profiles: p || null,
          user_roles: [{ role: primaryRole }],
        });
      });
    },
  });
};

export const useMyDrafts = () =>
  useQuery({
    queryKey: ["stories", "drafts"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("stories")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_draft", true)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });
      return data || [];
    },
  });

/**
 * Core story fetch — returns shell (title, subtitle, content) ASAP.
 * Author info loads progressively via useStoryAuthor.
 * Hydrates from any cached list ("stories", *) so navigating from a
 * feed/profile renders instantly with zero network wait.
 */
export const useStory = (id: string | undefined) => {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ["story", id],
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    // Seed from any cached stories list so first paint is instant.
    initialData: () => {
      if (!id) return undefined;
      const lists = qc.getQueriesData<any>({ queryKey: ["stories"] });
      for (const [, list] of lists) {
        if (Array.isArray(list)) {
          const found = list.find((s: any) => s?.id === id);
          if (found) return found as Story;
        }
      }
      return undefined;
    },
    initialDataUpdatedAt: 0, // mark stale so background refetch fills in content
    queryFn: async () => {
      // Single round-trip: row + secure content in parallel.
      const [rowRes, contentRes] = await Promise.all([
        supabase.from("stories").select("*").eq("id", id!).is("deleted_at", null).maybeSingle(),
        supabase.rpc("get_story_content", { p_story_id: id! }),
      ]);
      if (rowRes.error) throw rowRes.error;
      if (!rowRes.data) return null;
      return mapStory({ ...rowRes.data, content: contentRes.data ?? rowRes.data.content });
    },
  });
};

/**
 * Progressive author loader — fetched separately so the article body
 * paints before the author chip resolves.
 */
export const useStoryAuthor = (userId: string | undefined) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["story-author", userId, user?.id ?? "anon"],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const [profileRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", userId!).single(),
        user ? supabase.from("user_roles").select("role").eq("user_id", userId!) : Promise.resolve({ data: [] }),
      ]);
      const allRoles = (rolesRes.data || []).map((r: any) => r.role);
      const primaryRole = getPrimaryRoleForDisplay(allRoles);
      if (!profileRes.data) return null;
      return {
        id: profileRes.data.id,
        user_id: profileRes.data.user_id,
        display_name: profileRes.data.display_name,
        username: profileRes.data.username,
        avatar_url: profileRes.data.avatar_url,
        bio: profileRes.data.bio || "",
        role: primaryRole,
      };
    },
  });
};

/**
 * Lightweight story fetch for the editor.
 * Skips profile/roles/RPC joins — owner already has access to row content.
 * Caches aggressively so navigating draft → edit is instant.
 */
export const useStoryForEdit = (id: string | undefined) =>
  useQuery({
    queryKey: ["story-edit", id],
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stories")
        .select("id,user_id,title,subtitle,content,is_draft,published_at,visibility,is_hidden,is_pinned,deleted_at,created_at,updated_at")
        .eq("id", id!)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const useUserStories = (userId: string | undefined) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["stories", "user", userId, user?.id ?? "anon"],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("stories")
        .select("*")
        .eq("user_id", userId!)
        .eq("is_draft", false)
        .is("deleted_at", null)
        .order("is_pinned", { ascending: false })
        .order("published_at", { ascending: false });

      if (!data || data.length === 0) return [];

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId!)
        .single();

      const { data: roles } = user
        ? await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", userId!)
        : { data: [] };

      const allRoles = (roles || []).map((r) => r.role);
      const primaryRole = getPrimaryRoleForDisplay(allRoles);

      return data.map((s: any) => mapStory({ ...s, profiles: profile, user_roles: [{ role: primaryRole }] }));
    },
  });
};

export const useSaveStory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (story: { id?: string; title: string; subtitle: string; content: string; is_draft: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (story.id) {
        // Check if this story was already published — preserve original date
        const { data: existing } = await supabase
          .from("stories")
          .select("published_at, is_draft")
          .eq("id", story.id)
          .single();

        const wasPublished = existing && !existing.is_draft && existing.published_at;

        const { data, error } = await supabase
          .from("stories")
          .update({
            title: story.title,
            subtitle: story.subtitle,
            content: story.content,
            is_draft: story.is_draft,
            published_at: story.is_draft ? null : (wasPublished ? existing.published_at : new Date().toISOString()),
          })
          .eq("id", story.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("stories")
          .insert({
            user_id: user.id,
            title: story.title,
            subtitle: story.subtitle,
            content: story.content,
            is_draft: story.is_draft,
            published_at: story.is_draft ? null : new Date().toISOString(),
          })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (data) => {
      // Prime edit cache so reopening the draft is instant — no refetch needed.
      if (data?.id) {
        qc.setQueryData(["story-edit", data.id], data);
      }
      qc.invalidateQueries({ queryKey: ["stories"] });
    },
  });
};

export const useDeleteStory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Soft-delete: set deleted_at instead of actually deleting
      const { error } = await supabase
        .from("stories")
        .update({ deleted_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async (_, id) => {
      qc.removeQueries({ queryKey: ["story", id], exact: true });
      await qc.invalidateQueries();
      await qc.refetchQueries({ queryKey: ["stories"] });
    },
  });
};

export const useTrashStories = () =>
  useQuery({
    queryKey: ["trash"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("stories")
        .select("*")
        .eq("user_id", user.id)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      return data || [];
    },
  });

export const useRestoreStory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("stories")
        .update({ deleted_at: null } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stories"] });
      qc.invalidateQueries({ queryKey: ["my-drafts"] });
      qc.invalidateQueries({ queryKey: ["trash"] });
    },
  });
};

export const usePermanentDeleteStory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("stories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trash"] });
    },
  });
};

export const useTogglePin = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      const { error } = await supabase.from("stories").update({ is_pinned: pinned }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stories"] });
      qc.invalidateQueries({ queryKey: ["story"] });
    },
  });
};

export const useToggleVisibility = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, visibility }: { id: string; visibility: "public" | "inner_circle" }) => {
      const { error } = await supabase.from("stories").update({ visibility }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stories"] });
      qc.invalidateQueries({ queryKey: ["story"] });
    },
  });
};

export const useToggleHidden = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_hidden }: { id: string; is_hidden: boolean }) => {
      const { error } = await supabase.from("stories").update({ is_hidden }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stories"] });
      qc.invalidateQueries({ queryKey: ["story"] });
    },
  });
};
