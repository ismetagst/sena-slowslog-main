import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StoryCard from "@/components/StoryCard";
import RoleBadge from "@/components/RoleBadge";
import VerifiedBadge from "@/components/VerifiedBadge";
import AchievementList from "@/components/AchievementList";
import WhisperList from "@/components/WhisperList";
import LetterList from "@/components/LetterList";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useUserStories } from "@/hooks/useStories";
import { useWhisperEventStatus } from "@/hooks/useWhisper";
import { useLetterEventStatus } from "@/hooks/useLetters";
import { FileText, Settings, Award, ArrowUpDown, Calendar, Music, BookOpen, Mail } from "lucide-react";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";

import { getPrimaryRoleForDisplay, type Role } from "@/lib/types";
import type { UserStats } from "@/lib/achievements";

const Profile = () => {
  const { username: rawUsername } = useParams();
  const username = rawUsername?.startsWith("@") ? rawUsername.slice(1) : rawUsername;
  const { user, isFounder, isAdmin } = useAuth();
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  

  const { data: profileData } = useQuery({
    queryKey: ["profile", username, user?.id ?? "anon"],
    enabled: !!username,
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username!)
        .single();
      if (!profile) return null;

      const { data: roles } = user
        ? await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", profile.user_id)
        : { data: [] };

      const allRoles = (roles || []).map((r) => r.role as Role);
      const primaryRole = getPrimaryRoleForDisplay(allRoles);
      const hasInnerCircle = allRoles.includes("inner_circle");

      const storyCount = await supabase
        .from("stories")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.user_id)
        .eq("is_draft", false)
        .is("deleted_at", null);

      return {
        ...profile,
        role: primaryRole,
        hasInnerCircle,
        storyCount: storyCount.count || 0,
      };
    },
  });

  const { data: stories } = useUserStories(profileData?.user_id);
  const pinnedStories = stories?.filter((s) => s.is_pinned) || [];
  const otherStories = (stories?.filter((s) => !s.is_pinned) || []).sort((a, b) => {
    const dateA = new Date(a.published_at || a.created_at).getTime();
    const dateB = new Date(b.published_at || b.created_at).getTime();
    return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
  });

  // Stats for achievements
  const { data: achievementStats } = useQuery({
    queryKey: ["achievement-stats", profileData?.user_id],
    enabled: !!profileData?.user_id,
    queryFn: async () => {
      const userId = profileData!.user_id;

      // Total views
      const { data: viewStories } = await supabase
        .from("stories")
        .select("views")
        .eq("user_id", userId)
        .eq("is_draft", false)
        .is("deleted_at", null);
      const totalViews = (viewStories || []).reduce((sum, s) => sum + (s.views || 0), 0);

      // Bookmark count
      const bookmarkCount = await supabase
        .from("bookmarks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);

      // User index (position among all users for early_adopter)
      const { count: totalUsers } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .lte("created_at", profileData!.created_at);

      return {
        storyCount: profileData!.storyCount,
        totalViews,
        bookmarkCount: bookmarkCount.count || 0,
        hasBio: !!(profileData?.bio && profileData.bio.trim()),
        joinedAt: profileData!.joined_at || profileData!.created_at,
        userIndex: totalUsers || 999999,
      } as UserStats;
    },
  });

  const isOwnProfile = !!(user && profileData && user.id === profileData.user_id);
  const showIdentityBadges = !!user;
  const { data: whisperStatus } = useWhisperEventStatus();
  const { data: letterStatus } = useLetterEventStatus();
  // Visibility off → tab hidden everywhere (incl. own profile). Admin/founder always see it.
  const showWhisperTab = !!(whisperStatus?.visible || isFounder || isAdmin);
  const showLetterTab = !!(letterStatus?.visible || isFounder || isAdmin);

  if (!profileData) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">loading...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <section className="mx-auto max-w-2xl px-6 py-12">
          <div className="flex items-start gap-5">
            <Avatar className="h-16 w-16 flex-shrink-0">
              <AvatarImage src={profileData.avatar_url || undefined} alt={profileData.display_name} />
              <AvatarFallback className="text-lg font-medium text-muted-foreground">
                {profileData.display_name[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="font-serif text-xl font-medium">{profileData.display_name}</h1>
                {showIdentityBadges && profileData.hasInnerCircle && <VerifiedBadge size="md" />}
                {showIdentityBadges && <RoleBadge role={profileData.role} variant="profile" />}
              </div>
              <p className="text-xs text-muted-foreground">@{profileData.username}</p>
              <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3" /> {profileData.storyCount} stories
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Joined {format(new Date(profileData.joined_at || profileData.created_at), "MMM yyyy")}
                </span>
              </div>
            </div>
            {isOwnProfile && (
              <Link
                to="/settings"
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Settings"
              >
                <Settings className="h-4 w-4" />
              </Link>
            )}
          </div>

          {profileData.bio && <p className="mt-5 text-sm text-muted-foreground whitespace-pre-line break-words">{profileData.bio}</p>}




          <Tabs defaultValue="stories" className="mt-8">
            <TabsList className="bg-transparent border-b border-border rounded-none w-full justify-start gap-0 h-auto p-0">
              <TabsTrigger value="stories" className="rounded-none border-b-2 border-transparent px-4 py-2 text-xs data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                <BookOpen className="h-3.5 w-3.5 mr-1.5" /> Stories
              </TabsTrigger>
              {showWhisperTab && (
                <TabsTrigger value="whispers" className="rounded-none border-b-2 border-transparent px-4 py-2 text-xs data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                  <Music className="h-3.5 w-3.5 mr-1.5" /> Whispers
                </TabsTrigger>
              )}
              {showLetterTab && (
                <TabsTrigger value="letters" className="rounded-none border-b-2 border-transparent px-4 py-2 text-xs data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                  <Mail className="h-3.5 w-3.5 mr-1.5" /> Letters
                </TabsTrigger>
              )}
              <TabsTrigger value="achievements" className="rounded-none border-b-2 border-transparent px-4 py-2 text-xs data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                <Award className="h-3.5 w-3.5 mr-1.5" /> Achievements
              </TabsTrigger>
            </TabsList>
            <TabsContent value="stories" className="mt-2">
              {stories && stories.length > 0 && (
                <div className="flex justify-end mb-2">
                  <button
                    onClick={() => setSortOrder(sortOrder === "newest" ? "oldest" : "newest")}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowUpDown className="h-3 w-3" />
                    {sortOrder === "newest" ? "newest first" : "oldest first"}
                  </button>
                </div>
              )}
              <div className="divide-y divide-border">
                {pinnedStories.map((story) => (
                  <StoryCard key={story.id} story={story} showPinned />
                ))}
                {otherStories.map((story) => (
                  <StoryCard key={story.id} story={story} />
                ))}
                {!stories?.length && (
                  <p className="py-12 text-center text-sm text-muted-foreground">no stories yet ✍(◔◡◔)</p>
                )}
              </div>
            </TabsContent>
            {showWhisperTab && (
              <TabsContent value="whispers" className="mt-4">
                <WhisperList userId={profileData.user_id} isOwnProfile={isOwnProfile} profileUsername={profileData.username} />
              </TabsContent>
            )}
            {showLetterTab && (
              <TabsContent value="letters" className="mt-4">
                <LetterList
                  recipientUserId={profileData.user_id}
                  isOwnProfile={isOwnProfile}
                  recipientDisplayName={profileData.display_name}
                />
              </TabsContent>
            )}
            <TabsContent value="achievements" className="mt-4">
              {achievementStats && profileData ? (
                <AchievementList stats={achievementStats} userId={profileData.user_id} />
              ) : (
                <p className="py-12 text-center text-sm text-muted-foreground">loading...</p>
              )}
            </TabsContent>
          </Tabs>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Profile;
