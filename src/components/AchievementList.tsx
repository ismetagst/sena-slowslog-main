import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isBadgeUnlocked, CATEGORY_META, type AchievementBadge, type UserStats } from "@/lib/achievements";
import { cn } from "@/lib/utils";
import { Award } from "lucide-react";

interface AchievementListProps {
  stats: UserStats;
  userId: string;
}

const AchievementList = ({ stats, userId }: AchievementListProps) => {
  const { data: badges } = useQuery({
    queryKey: ["achievement-badges"],
    queryFn: async () => {
      const { data } = await supabase
        .from("achievement_badges")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      return (data || []) as AchievementBadge[];
    },
  });

  const { data: manualIds } = useQuery({
    queryKey: ["user-achievements", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_achievements")
        .select("badge_id")
        .eq("user_id", userId);
      return new Set((data || []).map((d: any) => d.badge_id));
    },
  });

  if (!badges || !manualIds) {
    return <p className="py-12 text-center text-sm text-muted-foreground">loading...</p>;
  }

  const categories = ["output", "reach", "special"] as const;

  return (
    <div className="space-y-6">
      {categories.map((cat) => {
        const catBadges = badges.filter((b) => b.category === cat);
        if (catBadges.length === 0) return null;
        const meta = CATEGORY_META[cat];
        const earned = catBadges.filter((b) => isBadgeUnlocked(b, stats, manualIds));

        return (
          <div key={cat}>
            {/* Category header */}
            <div className="flex items-center gap-2 mb-3">
              <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {meta.label}
              </span>
              <span className="text-[10px] text-muted-foreground/70">
                {earned.length}/{catBadges.length}
              </span>
            </div>

            {/* Badge grid */}
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5">
              {catBadges.map((badge) => {
                const unlocked = isBadgeUnlocked(badge, stats, manualIds);
                return (
                  <div key={badge.id} className="flex flex-col items-center text-center gap-1.5">
                    {/* Circle badge */}
                    <div
                      className={cn(
                        "flex h-14 w-14 items-center justify-center rounded-full border-2 transition-all",
                        unlocked
                          ? "border-current shadow-sm"
                          : "border-border grayscale opacity-35"
                      )}
                      style={unlocked ? { color: meta.color, borderColor: meta.color } : undefined}
                    >
                      {badge.image_url ? (
                        <img
                          src={badge.image_url}
                          alt={badge.title}
                          className="h-8 w-8 object-contain rounded-full"
                        />
                      ) : (
                        <Award
                          className="h-6 w-6"
                          style={unlocked ? { color: meta.color } : undefined}
                        />
                      )}
                    </div>
                    {/* Title + description */}
                    <p className={cn(
                      "text-[11px] font-semibold leading-tight",
                      !unlocked && "text-muted-foreground"
                    )}>
                      {badge.title}
                    </p>
                    <p className="text-[9px] leading-tight text-muted-foreground/70 max-w-[80px]">
                      {badge.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AchievementList;
