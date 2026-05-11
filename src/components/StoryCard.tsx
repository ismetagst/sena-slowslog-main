import { Story } from "@/lib/types";
import RoleBadge from "./RoleBadge";
import VerifiedBadge from "./VerifiedBadge";
import { Eye, EyeOff, Pin } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getPrimaryRoleForDisplay } from "@/lib/types";

interface StoryCardProps {
  story: Story;
  showPinned?: boolean;
}

const StoryCard = ({ story, showPinned }: StoryCardProps) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const date = story.published_at ? format(new Date(story.published_at), "MMM d") : "";
  const isInnerCircleOnly = story.visibility === "inner_circle";
  const showIdentityBadges = !!user;

  const prefetchStory = () => {
    // Seed shell from list immediately
    qc.setQueryData(["story", story.id], (prev: any) => prev ?? story);
    // Prefetch full content + author in background (dedup'd by react-query)
    qc.prefetchQuery({
      queryKey: ["story", story.id],
      staleTime: 2 * 60 * 1000,
      queryFn: async () => {
        const [rowRes, contentRes] = await Promise.all([
          supabase.from("stories").select("*").eq("id", story.id).is("deleted_at", null).maybeSingle(),
          supabase.rpc("get_story_content", { p_story_id: story.id }),
        ]);
        if (!rowRes.data) return null;
        return {
          ...rowRes.data,
          content: contentRes.data ?? rowRes.data.content,
          visibility: (rowRes.data.visibility || "public"),
          author: story.author,
        };
      },
    });
    if (story.author?.user_id) {
      qc.prefetchQuery({
        queryKey: ["story-author", story.author.user_id, user?.id ?? "anon"],
        staleTime: 5 * 60 * 1000,
        queryFn: async () => {
          const [profileRes, rolesRes] = await Promise.all([
            supabase.from("profiles").select("*").eq("user_id", story.author!.user_id).single(),
            user ? supabase.from("user_roles").select("role").eq("user_id", story.author!.user_id) : Promise.resolve({ data: [] }),
          ]);
          if (!profileRes.data) return null;
          const allRoles = (rolesRes.data || []).map((r: any) => r.role);
          return {
            id: profileRes.data.id,
            user_id: profileRes.data.user_id,
            display_name: profileRes.data.display_name,
            username: profileRes.data.username,
            avatar_url: profileRes.data.avatar_url,
            bio: profileRes.data.bio || "",
            role: getPrimaryRoleForDisplay(allRoles),
          };
        },
      });
    }
  };

  return (
    <article className="py-8">
      {showPinned && story.is_pinned && (
        <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
          <Pin className="h-3 w-3" /> pinned
        </div>
      )}
      <Link
        to={`/story/${story.id}`}
        className="group block"
        onMouseEnter={prefetchStory}
        onTouchStart={prefetchStory}
        onFocus={prefetchStory}
      >
        <h2 className="font-serif text-xl font-medium tracking-tight text-foreground transition-colors group-hover:text-muted-foreground md:text-2xl">
          {story.title}
        </h2>
        {story.subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{story.subtitle}</p>
        )}
      </Link>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        {story.author && (
          <>
            <Link
              to={`/@${story.author.username}`}
              className="text-foreground/70 hover:text-foreground transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {story.author.display_name}
            </Link>
            {showIdentityBadges && isInnerCircleOnly && <VerifiedBadge size="sm" />}
            {showIdentityBadges && <RoleBadge role={story.author.role} variant="card" />}
            <span>·</span>
          </>
        )}
        <span>{date}</span>
        <span>·</span>
        <span className="flex items-center gap-1">
          <Eye className="h-3 w-3" /> {story.views}
        </span>
        {story.is_hidden && (
          <span className="flex items-center gap-1 text-muted-foreground/60">
            <span>·</span>
            <EyeOff className="h-3 w-3" /> hidden
          </span>
        )}
      </div>
    </article>
  );
};

export default StoryCard;
