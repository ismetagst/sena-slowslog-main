export interface AchievementBadge {
  id: string;
  category: "output" | "reach" | "special";
  title: string;
  description: string;
  image_url: string | null;
  check_type: string;
  check_value: number | null;
  sort_order: number;
  is_active: boolean;
}

export interface UserStats {
  storyCount: number;
  totalViews: number;
  bookmarkCount: number;
  hasBio: boolean;
  joinedAt: string;
  userIndex?: number; // position among all users (for early_adopter)
}

export const isBadgeUnlocked = (
  badge: AchievementBadge,
  stats: UserStats,
  manualBadgeIds: Set<string>
): boolean => {
  if (manualBadgeIds.has(badge.id)) return true;

  switch (badge.check_type) {
    case "story_count":
      return badge.check_value != null && stats.storyCount >= badge.check_value;
    case "total_views":
      return badge.check_value != null && stats.totalViews >= badge.check_value;
    case "early_adopter":
      return stats.userIndex != null && badge.check_value != null && stats.userIndex <= badge.check_value;
    case "anniversary": {
      if (!stats.joinedAt) return false;
      const joined = new Date(stats.joinedAt);
      const now = new Date();
      const years = (now.getTime() - joined.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      return badge.check_value != null && years >= badge.check_value;
    }
    case "editors_pick":
    case "manual":
      return manualBadgeIds.has(badge.id);
    default:
      return false;
  }
};

export const CATEGORY_META: Record<string, { label: string; color: string; dot: string }> = {
  output: { label: "Output", color: "hsl(210, 70%, 50%)", dot: "bg-blue-500" },
  reach: { label: "Reach", color: "hsl(38, 90%, 50%)", dot: "bg-amber-500" },
  special: { label: "Special", color: "hsl(270, 60%, 55%)", dot: "bg-purple-500" },
};
