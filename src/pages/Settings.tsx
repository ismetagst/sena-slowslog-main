import { useState, useMemo, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { usePublishCooldown } from "@/hooks/usePublishCooldown";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { exportArticlesToPDF } from "@/lib/pdf-export";
import { compressImage } from "@/lib/image-compress";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Download, FileText, PenLine, Bookmark, User as UserIcon, Clock, Filter, BarChart3, Camera, BadgeCheck, Lock, Trash2, AlertTriangle, ChevronDown, RotateCcw, Key } from "lucide-react";
import PersonalKeySettings from "@/components/settings/PersonalKeySettings";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { differenceInDays, format } from "date-fns";
import StoryCard from "@/components/StoryCard";
import { getPrimaryRoleForDisplay, type Story } from "@/lib/types";
import AnalyticsTab from "@/components/AnalyticsTab";
import { useICMembership } from "@/hooks/useICMembership";
import { useTrashStories, useRestoreStory, usePermanentDeleteStory } from "@/hooks/useStories";

const CooldownDisplay = () => {
  const { data: cooldown, isLoading } = usePublishCooldown();
  const { roles } = useAuth();
  const isInnerCircle = roles.includes("inner_circle");
  if (isLoading) return null;

  const days = cooldown?.cooldownDays ?? (isInnerCircle ? 3 : 6);

  return (
    <div className="rounded-md border border-border bg-muted/30 p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span>Slow Writing</span>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground/70">
        {isInnerCircle
          ? `inner circle: 1 publish every ${days} days ✦`
          : `1 publish every ${days} days`}
      </p>
      {cooldown?.canPublish ? (
        <p className="mt-1.5 text-xs text-muted-foreground">
          you can write and publish now ✿
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-muted-foreground">
          you can write again in{" "}
          <span className="font-medium text-foreground">
            {cooldown?.daysLeft ? `${cooldown.daysLeft} days ${cooldown.hoursLeft} hours` : `${cooldown?.hoursLeft} hours`}
          </span>{" "}
          (◕ᴗ◕✿)
        </p>
      )}
    </div>
  );
};

const getDateFilterOptions = () => {
  const now = new Date();
  const options: { label: string; value: string; startDate: Date | null }[] = [
    { label: "All time", value: "all", startDate: null },
  ];
  // Add last 12 months
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    options.push({ label, value: `month-${i}`, startDate: d });
  }
  // Add years
  const currentYear = now.getFullYear();
  for (let y = currentYear; y >= currentYear - 3; y--) {
    options.push({ label: `${y}`, value: `year-${y}`, startDate: new Date(y, 0, 1) });
  }
  return options;
};

const filterStoriesByDate = (stories: any[], filterValue: string) => {
  if (filterValue === "all") return stories;
  const now = new Date();
  if (filterValue.startsWith("month-")) {
    const monthsAgo = parseInt(filterValue.split("-")[1]);
    const start = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0, 23, 59, 59);
    return stories.filter((s) => {
      const d = new Date(s.published_at || s.created_at);
      return d >= start && d <= end;
    });
  }
  if (filterValue.startsWith("year-")) {
    const year = parseInt(filterValue.split("-")[1]);
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59);
    return stories.filter((s) => {
      const d = new Date(s.published_at || s.created_at);
      return d >= start && d <= end;
    });
  }
  return stories;
};

const TrashTab = () => {
  const { data: trashItems, isLoading } = useTrashStories();
  const restoreMutation = useRestoreStory();
  const permanentDeleteMutation = usePermanentDeleteStory();

  const getTimeLeft = (deletedAt: string) => {
    const deleted = new Date(deletedAt);
    const expiry = new Date(deleted.getTime() + 24 * 60 * 60 * 1000);
    const now = new Date();
    const hoursLeft = Math.max(0, Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60)));
    const minsLeft = Math.max(0, Math.floor(((expiry.getTime() - now.getTime()) % (1000 * 60 * 60)) / (1000 * 60)));
    if (hoursLeft <= 0 && minsLeft <= 0) return "expiring...";
    return `${hoursLeft}h ${minsLeft}m left`;
  };

  return (
    <div>
      <h2 className="flex items-center gap-2 text-sm font-medium">
        <Trash2 className="h-4 w-4" /> Trash
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        deleted items are automatically removed after 24 hours.
      </p>

      <div className="mt-4 divide-y divide-border rounded-md border border-border">
        {isLoading ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">loading...</p>
        ) : !trashItems?.length ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            trash is empty ✿
          </p>
        ) : (
          trashItems.map((item: any) => (
            <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">{item.title || "untitled"}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">
                    {item.is_draft ? "draft" : "published"}
                  </span>
                  <span className="text-[10px] text-destructive/70 flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    {getTimeLeft(item.deleted_at)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={async () => {
                    await restoreMutation.mutateAsync(item.id);
                    toast.success("restored (◕‿◕)");
                  }}
                  disabled={restoreMutation.isPending}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="h-3 w-3" /> restore
                </button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="flex items-center gap-1.5 text-xs text-destructive/60 hover:text-destructive">
                      <Trash2 className="h-3 w-3" /> delete forever
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete permanently?</AlertDialogTitle>
                      <AlertDialogDescription>
                        "{item.title || "untitled"}" will be permanently deleted. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={async () => {
                          await permanentDeleteMutation.mutateAsync(item.id);
                          toast.success("permanently deleted");
                        }}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete forever
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
const ICOrderHistory = ({ userId }: { userId: string }) => {
  const { data: orders, isLoading } = useQuery({
    queryKey: ["ic-order-history", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ic_orders")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  if (isLoading) return <p className="mt-3 text-[11px] text-muted-foreground">loading history...</p>;
  if (!orders?.length) return null;

  return (
    <div className="mt-3 space-y-1.5">
      <p className="text-[11px] font-medium text-muted-foreground">Order History</p>
      <div className="rounded-md border border-border divide-y divide-border">
        {orders.map((o: any) => (
          <div key={o.id} className="px-3 py-2 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium">
                {o.plan === "yearly" ? "1 Year" : o.plan === "forever" ? "Lifetime" : o.plan}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {new Date(o.created_at).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
              o.status === "pending"
                ? "bg-[hsl(45,80%,92%)] text-[hsl(45,60%,35%)]"
                : o.status === "approved"
                ? "bg-[hsl(140,50%,92%)] text-[hsl(140,50%,30%)]"
                : "bg-destructive/10 text-destructive"
            }`}>
              {o.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const Settings = () => {

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, profile, loading, isFounder, isAdmin, roles } = useAuth();
  const isInnerCircle = roles.includes("inner_circle");
  const hasElevated = isFounder || isAdmin;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bio, setBio] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [editingUsername, setEditingUsername] = useState(false);
  const [savingUsername, setSavingUsername] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState("");
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const [dateFilter, setDateFilter] = useState("all");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [icDetailsOpen, setIcDetailsOpen] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const { data: membership } = useICMembership(user?.id);

  const dateOptions = useMemo(() => getDateFilterOptions(), []);

  // Fetch IC order status
  const { data: icOrder } = useQuery({
    queryKey: ["ic-order-status", user?.id],
    enabled: !!user && !isInnerCircle,
    queryFn: async () => {
      const { data } = await supabase
        .from("ic_orders")
        .select("status, plan, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  // Fetch published stories for PDF backup
  const { data: stories } = useQuery({
    queryKey: ["my-stories-for-backup"],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("stories")
        .select("*")
        .eq("user_id", user!.id)
        .eq("is_draft", false)
        .order("published_at", { ascending: false });
      return data || [];
    },
  });

  const filteredStories = useMemo(() => filterStoriesByDate(stories || [], dateFilter), [stories, dateFilter]);

  // Fetch bookmarked stories
  const { data: bookmarkedStories, isLoading: bookmarksLoading } = useQuery({
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

  // Fetch drafts
  const { data: drafts, isLoading: draftsLoading } = useQuery({
    queryKey: ["my-drafts"],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("stories")
        .select("*")
        .eq("user_id", user!.id)
        .eq("is_draft", true)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });
      return data || [];
    },
  });

  // Fetch username_changed_at
  const { data: profileFull } = useQuery({
    queryKey: ["profile-full", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username_changed_at, display_name_changed_at")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
  });

  if (loading) return null;
  if (!user) {
    navigate("/auth");
    return null;
  }

  const currentBio = bio ?? profile?.bio ?? "";

  const canChange = (field: 'username' | 'display_name') => {
    const changedAt = field === 'username' ? profileFull?.username_changed_at : profileFull?.display_name_changed_at;
    if (!changedAt) return true;
    const diffDays = (Date.now() - new Date(changedAt).getTime()) / (1000 * 60 * 60 * 24);
    return diffDays >= 30;
  };

  const countdown = (field: 'username' | 'display_name') => {
    const changedAt = field === 'username' ? profileFull?.username_changed_at : profileFull?.display_name_changed_at;
    if (!changedAt) return "";
    const nextChange = new Date(new Date(changedAt).getTime() + 30 * 24 * 60 * 60 * 1000);
    const daysLeft = Math.ceil((nextChange.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return `can be changed in ${daysLeft} days`;
  };

  const handleSaveBio = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ bio: currentBio })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Failed to update bio");
    } else {
      toast.success("Bio updated (◕‿◕)");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    }
  };

  const handleSaveUsername = async () => {
    if (!user || !newUsername.trim()) return;
    setSavingUsername(true);
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", newUsername)
      .neq("user_id", user.id)
      .maybeSingle();
    if (existing) {
      toast.error("Username already taken (╥﹏╥)");
      setSavingUsername(false);
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ username: newUsername, username_changed_at: new Date().toISOString() })
      .eq("user_id", user.id);
    setSavingUsername(false);
    if (error) {
      toast.error("Failed to update username");
    } else {
      toast.success("Username updated (◕‿◕)");
      setEditingUsername(false);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["profile-full"] });
    }
  };

  const handleSaveDisplayName = async () => {
    if (!user || !newDisplayName.trim()) return;
    setSavingDisplayName(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: newDisplayName.trim(), display_name_changed_at: new Date().toISOString() })
      .eq("user_id", user.id);
    setSavingDisplayName(false);
    if (error) {
      toast.error("Failed to update display name");
    } else {
      toast.success("Display name updated (◕‿◕)");
      setEditingDisplayName(false);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["profile-full"] });
    }
  };

  // PDF export helpers
  const toggleAll = () => {
    if (selected.size === filteredStories.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredStories.map((s) => s.id)));
    }
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    setUploadingAvatar(true);
    try {
      const compressed = await compressImage(file);
      const filePath = `${user.id}/avatar.webp`;
      // Remove old avatar first
      await supabase.storage.from("avatars").remove([filePath]);
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, compressed, { contentType: "image/webp", upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("user_id", user.id);
      if (updateError) throw updateError;
      toast.success("Profile photo updated (◕‿◕)");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["profile-full"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to upload photo");
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;
    setUploadingAvatar(true);
    try {
      await supabase.storage.from("avatars").remove([`${user.id}/avatar.webp`]);
      await supabase.from("profiles").update({ avatar_url: null }).eq("user_id", user.id);
      toast.success("Profile photo removed");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    } catch {
      toast.error("Failed to remove photo");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleExport = () => {
    if (!selected.size || !stories) return;
    const toExport = stories.filter((s) => selected.has(s.id)).map((s) => ({
      title: s.title,
      subtitle: s.subtitle,
      content: s.content,
      published_at: s.published_at,
    }));
    exportArticlesToPDF(toExport);
    toast.success(`exported ${toExport.length} article(s) (◕‿◕)`);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <section className="mx-auto max-w-2xl px-6 py-12">
          <h1 className="font-serif text-xl font-medium">settings</h1>
          <p className="mt-1 text-xs text-muted-foreground">manage your account (◕ᴗ◕✿)</p>

          <Tabs defaultValue="profile" className="mt-8">
            <TabsList className="bg-transparent border-b border-border rounded-none w-full justify-start gap-0 h-auto p-0 overflow-x-auto overflow-y-hidden flex-nowrap scrollbar-none">
              <TabsTrigger value="profile" className="rounded-none border-b-2 border-transparent px-4 py-2 text-xs data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                <UserIcon className="h-3.5 w-3.5 mr-1.5" /> Profile
              </TabsTrigger>
              <TabsTrigger value="drafts" className="rounded-none border-b-2 border-transparent px-4 py-2 text-xs data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                <FileText className="h-3.5 w-3.5 mr-1.5" /> Drafts
              </TabsTrigger>
              <TabsTrigger value="bookmarks" className="rounded-none border-b-2 border-transparent px-4 py-2 text-xs data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                <Bookmark className="h-3.5 w-3.5 mr-1.5" /> Bookmarks
              </TabsTrigger>
              <TabsTrigger value="backup" disabled={!isInnerCircle && !hasElevated} className="rounded-none border-b-2 border-transparent px-4 py-2 text-xs data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none disabled:opacity-40">
                {!isInnerCircle && !hasElevated && <Lock className="h-3 w-3 mr-1" />}
                <Download className="h-3.5 w-3.5 mr-1.5" /> Backup
              </TabsTrigger>
              <TabsTrigger value="analytics" disabled={!isInnerCircle && !hasElevated} className="rounded-none border-b-2 border-transparent px-4 py-2 text-xs data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none disabled:opacity-40">
                {!isInnerCircle && !hasElevated && <Lock className="h-3 w-3 mr-1" />}
                <BarChart3 className="h-3.5 w-3.5 mr-1.5" /> Analytics
              </TabsTrigger>
              <TabsTrigger value="trash" disabled={!isInnerCircle && !hasElevated} className="rounded-none border-b-2 border-transparent px-4 py-2 text-xs data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none disabled:opacity-40">
                {!isInnerCircle && !hasElevated && <Lock className="h-3 w-3 mr-1" />}
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Trash
              </TabsTrigger>
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile" className="mt-6">
              <div className="space-y-6">
                {/* Avatar Upload */}
                <div className="flex items-center gap-4">
                  <div className="relative group">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name} />
                      <AvatarFallback className="text-lg font-medium text-muted-foreground">
                        {profile?.display_name?.[0]?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <button
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/40 text-background opacity-0 group-hover:opacity-100 transition-opacity disabled:cursor-not-allowed"
                    >
                      <Camera className="h-4 w-4" />
                    </button>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{profile?.display_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={uploadingAvatar}
                        className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
                      >
                        {uploadingAvatar ? "uploading..." : "change photo"}
                      </button>
                      {profile?.avatar_url && (
                        <button
                          onClick={handleRemoveAvatar}
                          disabled={uploadingAvatar}
                          className="text-xs text-destructive/70 hover:text-destructive disabled:opacity-40"
                        >
                          remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Username</label>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                    {!canChange('username')
                      ? countdown('username')
                      : "changing your username requires a 30-day wait before you can change it again"}
                  </p>
                  {editingUsername ? (
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">@</span>
                      <input
                        type="text"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                        className="flex-1 rounded-md border border-border bg-transparent px-3 py-1.5 text-sm focus:border-foreground focus:outline-none transition-colors"
                        placeholder="new username"
                      />
                      <Button
                        onClick={handleSaveUsername}
                        disabled={savingUsername || !newUsername.trim() || newUsername === profile?.username}
                        size="sm"
                      >
                        {savingUsername ? "saving..." : "Save"}
                      </Button>
                      <Button
                        onClick={() => setEditingUsername(false)}
                        variant="ghost"
                        size="sm"
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-1 flex items-center gap-2">
                      <p className="text-sm">@{profile?.username}</p>
                      <button
                        onClick={() => {
                          if (canChange('username')) {
                            setNewUsername(profile?.username || "");
                            setEditingUsername(true);
                          }
                        }}
                        disabled={!canChange('username')}
                        className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                        title={canChange('username') ? "Edit username" : countdown('username')}
                      >
                        <PenLine className="h-3 w-3 inline" /> edit
                      </button>
                      {!canChange('username') && (
                        <span className="text-[10px] text-muted-foreground">{countdown('username')}</span>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Email</label>
                  <p className="mt-1 text-sm">{user.email}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Display Name</label>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                    {!canChange('display_name')
                      ? countdown('display_name')
                      : "changing your display name requires a 30-day wait before you can change it again"}
                  </p>
                  {editingDisplayName ? (
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={newDisplayName}
                        onChange={(e) => setNewDisplayName(e.target.value)}
                        className="flex-1 rounded-md border border-border bg-transparent px-3 py-1.5 text-sm focus:border-foreground focus:outline-none transition-colors"
                        placeholder="new display name"
                        maxLength={50}
                      />
                      <Button
                        onClick={handleSaveDisplayName}
                        disabled={savingDisplayName || !newDisplayName.trim() || newDisplayName === profile?.display_name}
                        size="sm"
                      >
                        {savingDisplayName ? "saving..." : "Save"}
                      </Button>
                      <Button
                        onClick={() => setEditingDisplayName(false)}
                        variant="ghost"
                        size="sm"
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-1 flex items-center gap-2">
                      <p className="text-sm">{profile?.display_name}</p>
                      <button
                        onClick={() => {
                          if (canChange('display_name')) {
                            setNewDisplayName(profile?.display_name || "");
                            setEditingDisplayName(true);
                          }
                        }}
                        disabled={!canChange('display_name')}
                        className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                        title={canChange('display_name') ? "Edit display name" : countdown('display_name')}
                      >
                        <PenLine className="h-3 w-3 inline" /> edit
                      </button>
                      {!canChange('display_name') && (
                        <span className="text-[10px] text-muted-foreground">{countdown('display_name')}</span>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label htmlFor="bio" className="text-xs font-medium text-muted-foreground">Bio</label>
                  <textarea
                    id="bio"
                    value={currentBio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    placeholder="Tell us about yourself..."
                    className="mt-1 w-full resize-none rounded-md border border-border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:border-foreground focus:outline-none transition-colors"
                  />
                  <Button
                    onClick={handleSaveBio}
                    disabled={saving || currentBio === (profile?.bio ?? "")}
                    size="sm"
                    className="mt-2"
                  >
                    {saving ? "saving..." : "Save bio"}
                  </Button>
                </div>
                {!hasElevated && <CooldownDisplay />}

                {/* Inner Circle Status */}
                <div className="rounded-md border border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <BadgeCheck className="h-4 w-4 text-[hsl(45,90%,50%)] fill-[hsl(45,90%,50%)] stroke-white" />
                    <span>Inner Circle</span>
                  </div>
                  {isInnerCircle ? (
                    <>
                      <button
                        onClick={() => setIcDetailsOpen(!icDetailsOpen)}
                        className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-left"
                      >
                        <span>you're an Inner Circle member! thank you for your support (★‿★)</span>
                        <ChevronDown className={`h-3 w-3 ml-auto flex-shrink-0 transition-transform duration-200 ${icDetailsOpen ? "" : "-rotate-90"}`} />
                      </button>
                      {icDetailsOpen && membership && (
                        <div className="mt-3 rounded-md border border-[hsl(45,70%,80%)] bg-[hsl(45,80%,97%)] p-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-muted-foreground">Plan</span>
                            <span className="text-[11px] font-medium">
                              {membership.plan === "lifetime" ? "Lifetime ∞" : membership.plan.startsWith("custom_") ? `Gift (${membership.plan.replace("custom_", "")})` : "1 Year"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-muted-foreground">Started</span>
                            <span className="text-[11px] font-medium">
                              {format(new Date(membership.starts_at), "dd MMMM yyyy")}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-muted-foreground">Expires</span>
                            <span className="text-[11px] font-medium">
                              {membership.plan === "lifetime"
                                ? "never (◕ᴗ◕✿)"
                                : membership.expires_at
                                  ? format(new Date(membership.expires_at), "dd MMMM yyyy")
                                  : "—"}
                            </span>
                          </div>
                        </div>
                      )}
                      {icDetailsOpen && !membership && (
                        <p className="mt-3 text-[11px] text-muted-foreground italic">membership details not available</p>
                      )}
                      {/* Order History */}
                      {icDetailsOpen && <ICOrderHistory userId={user.id} />}
                    </>
                  ) : icOrder?.status === "pending" ? (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      your order is <span className="font-medium text-[hsl(45,60%,35%)]">being reviewed</span>. we'll notify you soon! (◕ᴗ◕✿)
                    </p>
                  ) : icOrder?.status === "rejected" ? (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      your order was <span className="font-medium text-destructive">not approved</span>. you can try again on the{" "}
                      <Link to="/inner-circle" className="underline hover:text-foreground">Inner Circle page</Link>.
                    </p>
                  ) : (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      support us & unlock exclusive features.{" "}
                      <Link to="/inner-circle" className="underline hover:text-foreground">learn more →</Link>
                    </p>
                  )}
                </div>

                {/* Personal Key Settings */}
                <PersonalKeySettings />
              </div>
            </TabsContent>

            {/* Drafts Tab */}
            <TabsContent value="drafts" className="mt-6">
              {/* Warning banner */}
              <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-border bg-muted/50 px-4 py-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Drafts are automatically deleted after <span className="font-medium text-foreground">14 days</span> of no edits. Edit or publish your drafts to keep them.
                </p>
              </div>
              <div className="divide-y divide-border">
                {draftsLoading ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">loading...</p>
                ) : !drafts?.length ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">no drafts yet (◡‿◡)</p>
                ) : (
                  drafts.map((draft) => {
                    const daysLeft = Math.max(0, 14 - differenceInDays(new Date(), new Date(draft.updated_at)));
                    const isUrgent = daysLeft <= 3;

                    return (
                      <div key={draft.id} className="flex items-center justify-between py-4">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{draft.title || "untitled"}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {draft.subtitle && <p className="truncate text-xs text-muted-foreground">{draft.subtitle}</p>}
                              <span className={`flex items-center gap-1 text-[10px] shrink-0 ${isUrgent ? "text-destructive" : "text-muted-foreground"}`}>
                                <Clock className="h-2.5 w-2.5" />
                                {daysLeft === 0 ? "expires today" : `${daysLeft}d left`}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                          <Link
                            to={`/write?edit=${draft.id}&from=/settings`}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <PenLine className="h-3 w-3" /> edit
                          </Link>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button className="flex items-center gap-1.5 text-xs text-destructive/60 hover:text-destructive">
                                <Trash2 className="h-3 w-3" /> delete
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete draft?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  "{draft.title || "untitled"}" will be moved to trash. You can recover it within 24 hours.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={async () => {
                                    const { error } = await supabase.from("stories").update({ deleted_at: new Date().toISOString() } as any).eq("id", draft.id);
                                    if (error) {
                                      toast.error("Failed to delete draft");
                                    } else {
                                      toast.success("Draft moved to trash (◕‿◕)");
                                      queryClient.invalidateQueries({ queryKey: ["my-drafts"] });
                                      queryClient.invalidateQueries({ queryKey: ["trash"] });
                                    }
                                  }}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </TabsContent>

            {/* Bookmarks Tab */}
            <TabsContent value="bookmarks" className="mt-6">
              <div className="divide-y divide-border">
                {bookmarksLoading ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">loading...</p>
                ) : !bookmarkedStories?.length ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    no bookmarks yet. save articles you like! ✿
                  </p>
                ) : (
                  bookmarkedStories.map((story) => (
                    <StoryCard key={story.id} story={story} />
                  ))
                )}
              </div>
            </TabsContent>

            {/* Backup PDF Tab */}
            <TabsContent value="backup" className="mt-6">
              <h2 className="flex items-center gap-2 text-sm font-medium">
                <FileText className="h-4 w-4" /> Backup Articles to PDF
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Select articles to backup, then download as PDF.
              </p>

              {!stories?.length ? (
                <p className="mt-6 text-sm text-muted-foreground">no published articles yet.</p>
              ) : (
                <>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                      <select
                        value={dateFilter}
                        onChange={(e) => { setDateFilter(e.target.value); setSelected(new Set()); }}
                        className="rounded-md border border-border bg-transparent px-2 py-1 text-xs focus:outline-none focus:border-foreground transition-colors"
                      >
                        {dateOptions.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <button onClick={toggleAll} className="text-xs text-muted-foreground hover:text-foreground">
                      {selected.size === filteredStories.length ? "Deselect all" : "Select all"}
                    </button>
                    <Button
                      onClick={handleExport}
                      disabled={!selected.size}
                      size="sm"
                      className="gap-2"
                    >
                      <Download className="h-3.5 w-3.5" /> Download PDF ({selected.size})
                    </Button>
                  </div>

                  <div className="mt-3 divide-y divide-border rounded-md border border-border">
                    {filteredStories.length === 0 ? (
                      <p className="px-4 py-8 text-center text-sm text-muted-foreground">no articles in this period</p>
                    ) : (
                      filteredStories.map((s) => (
                        <label
                          key={s.id}
                          className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={selected.has(s.id)}
                            onCheckedChange={() => toggle(s.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-sm font-medium">{s.title || "Untitled"}</p>
                            <p className="text-xs text-muted-foreground">
                              {s.published_at ? new Date(s.published_at).toLocaleDateString() : ""}
                            </p>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </>
              )}
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="mt-6">
              <AnalyticsTab />
            </TabsContent>
            {/* Trash Tab */}
            <TabsContent value="trash" className="mt-6">
              <TrashTab />
            </TabsContent>
          </Tabs>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Settings;
