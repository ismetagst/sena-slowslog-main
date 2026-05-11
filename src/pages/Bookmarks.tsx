import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StoryCard from "@/components/StoryCard";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { getPrimaryRoleForDisplay, type Story } from "@/lib/types";

const Bookmarks = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const { data: stories, isLoading } = useQuery({
    queryKey: ["bookmarks", "stories-full"],
    enabled: !!user,
    queryFn: async () => {
      const { data: bookmarks } = await supabase
        .from("bookmarks")
        .select("story_id")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (!bookmarks?.length) return [];

      const storyIds = bookmarks.map((b: any) => b.story_id);
      const { data: storiesData } = await supabase
        .from("stories")
        .select("*")
        .in("id", storyIds)
        .eq("is_draft", false);

      if (!storiesData?.length) return [];

      const userIds = [...new Set(storiesData.map((s) => s.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("*").in("user_id", userIds);
      const { data: roles } = await supabase.from("user_roles").select("*").in("user_id", userIds);

      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
      const rolesMap = new Map<string, string[]>();
      (roles || []).forEach((r) => {
        const existing = rolesMap.get(r.user_id) || [];
        existing.push(r.role);
        rolesMap.set(r.user_id, existing);
      });

      return storiesData.map((s): Story => {
        const p = profileMap.get(s.user_id);
        return {
          ...s,
          visibility: (s.visibility || "public") as Story["visibility"],
          author: p ? {
            id: p.id,
            user_id: p.user_id,
            display_name: p.display_name,
            username: p.username,
            avatar_url: p.avatar_url,
            bio: p.bio || "",
            role: getPrimaryRoleForDisplay(rolesMap.get(s.user_id)),
          } : undefined,
        };
      });
    },
  });

  if (loading) return null;
  if (!user) {
    navigate("/auth");
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <section className="mx-auto max-w-2xl px-6 py-12">
          <h1 className="font-serif text-xl font-medium">bookmarks</h1>
          <p className="mt-1 text-xs text-muted-foreground">artikel yang kamu simpan (◕‿◕)</p>

          <div className="mt-8 divide-y divide-border">
            {isLoading ? (
              <p className="py-12 text-center text-sm text-muted-foreground">loading...</p>
            ) : !stories?.length ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                belum ada bookmark. coba simpan artikel yang kamu suka! ✿
              </p>
            ) : (
              stories.map((story) => (
                <StoryCard key={story.id} story={story} />
              ))
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Bookmarks;
