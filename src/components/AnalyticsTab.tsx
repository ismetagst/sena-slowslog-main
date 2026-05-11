import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Eye, Monitor, Smartphone, TrendingUp } from "lucide-react";
import highfiveDefault from "@/assets/highfive-default.png";

const COLORS = ["hsl(var(--foreground))", "hsl(var(--muted-foreground))"];

const AnalyticsTab = () => {
  const { user } = useAuth();

  // Fetch all user's published stories
  const { data: stories } = useQuery({
    queryKey: ["analytics-stories", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("stories")
        .select("id, title, views, published_at")
        .eq("user_id", user!.id)
        .eq("is_draft", false)
        .order("published_at", { ascending: true });
      return data || [];
    },
  });

  // Fetch all views for user's stories
  const { data: viewsData } = useQuery({
    queryKey: ["analytics-views", user?.id],
    enabled: !!user && !!stories?.length,
    queryFn: async () => {
      const storyIds = stories!.map((s) => s.id);
      const { data } = await supabase
        .from("story_views")
        .select("story_id, created_at, device_type")
        .in("story_id", storyIds);
      return data || [];
    },
  });

  // Fetch all high fives for user's stories
  const { data: highFivesData } = useQuery({
    queryKey: ["analytics-highfives", user?.id],
    enabled: !!user && !!stories?.length,
    queryFn: async () => {
      const storyIds = stories!.map((s) => s.id);
      const { data } = await supabase
        .from("high_fives")
        .select("story_id, created_at")
        .in("story_id", storyIds);
      return data || [];
    },
  });

  const totalViews = stories?.reduce((sum, s) => sum + (s.views || 0), 0) || 0;
  const totalHighFives = highFivesData?.length || 0;
  const engagementRate = totalViews > 0 ? ((totalHighFives / totalViews) * 100).toFixed(1) : "0";

  // Build monthly engagement chart data (last 6 months)
  const chartData = useMemo(() => {
    const months: { label: string; views: number; highFives: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const label = d.toLocaleDateString("en-US", { month: "short" });

      const views = (viewsData || []).filter((v) => {
        const vd = new Date(v.created_at);
        return vd >= d && vd <= end;
      }).length;

      const hf = (highFivesData || []).filter((h) => {
        const hd = new Date(h.created_at);
        return hd >= d && hd <= end;
      }).length;

      months.push({ label, views, highFives: hf });
    }
    return months;
  }, [viewsData, highFivesData]);

  // Device breakdown
  const deviceData = useMemo(() => {
    const desktop = (viewsData || []).filter((v) => v.device_type === "desktop").length;
    const mobile = (viewsData || []).filter((v) => v.device_type !== "desktop").length;
    return [
      { name: "Desktop", value: desktop },
      { name: "Mobile", value: mobile },
    ].filter((d) => d.value > 0);
  }, [viewsData]);

  // Top stories
  const topStories = useMemo(() => {
    if (!stories) return [];
    return [...stories].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5);
  }, [stories]);

  return (
    <div className="space-y-8 overflow-x-hidden">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-md border border-border p-3 min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Eye className="h-3 w-3 flex-shrink-0" /> Views
          </div>
          <p className="mt-1 text-xl font-medium">{totalViews}</p>
        </div>
        <div className="rounded-md border border-border p-3 min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <img src={highfiveDefault} alt="" className="h-3 w-auto object-contain flex-shrink-0 dark:invert" /> Greetings
          </div>
          <p className="mt-1 text-xl font-medium">{totalHighFives}</p>
        </div>
        <div className="rounded-md border border-border p-3 min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <TrendingUp className="h-3 w-3 flex-shrink-0" /> Engagement
          </div>
          <p className="mt-1 text-xl font-medium">{engagementRate}%</p>
        </div>
      </div>

      {/* Engagement chart */}
      <div>
        <h3 className="text-sm font-medium mb-3">Engagement over time</h3>
        <div className="rounded-md border border-border p-4">
          {chartData.some((d) => d.views > 0 || d.highFives > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    fontSize: "12px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="views"
                  stroke="hsl(var(--foreground))"
                  fill="hsl(var(--foreground) / 0.1)"
                  name="Views"
                />
                <Area
                  type="monotone"
                  dataKey="highFives"
                  stroke="hsl(var(--muted-foreground))"
                  fill="hsl(var(--muted-foreground) / 0.1)"
                  name="Greetings"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">no data yet</p>
          )}
        </div>
      </div>

      {/* Device breakdown */}
      <div>
        <h3 className="text-sm font-medium mb-3">Device breakdown</h3>
        <div className="rounded-md border border-border p-4">
          {deviceData.length > 0 ? (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={120} height={120}>
                <PieChart>
                  <Pie
                    data={deviceData}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    outerRadius={50}
                    strokeWidth={0}
                  >
                    {deviceData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {deviceData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2 text-sm">
                    {d.name === "Desktop" ? (
                      <Monitor className="h-3.5 w-3.5" />
                    ) : (
                      <Smartphone className="h-3.5 w-3.5" />
                    )}
                    <span>{d.name}</span>
                    <span className="text-muted-foreground">
                      {d.value} ({totalViews > 0 ? ((d.value / totalViews) * 100).toFixed(0) : 0}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">no data yet</p>
          )}
        </div>
      </div>

      {/* Top stories */}
      <div>
        <h3 className="text-sm font-medium mb-3">Top stories</h3>
        <div className="divide-y divide-border rounded-md border border-border">
          {topStories.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">no stories yet</p>
          ) : (
            topStories.map((s, i) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.title || "untitled"}</p>
                </div>
                <span className="text-xs text-muted-foreground">{s.views} views</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsTab;
