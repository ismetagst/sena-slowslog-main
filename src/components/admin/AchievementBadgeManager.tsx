import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, Plus, Pencil, Trash2, Award, Search, Sparkles, X, Check } from "lucide-react";
import { toast } from "sonner";
import { CATEGORY_META } from "@/lib/achievements";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BadgeRow {
  id: string;
  category: string;
  title: string;
  description: string;
  image_url: string | null;
  check_type: string;
  check_value: number | null;
  sort_order: number;
  is_active: boolean;
}

interface UserRow {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

const CATEGORIES = ["output", "reach", "special"];
const CHECK_TYPES = [
  { value: "story_count", label: "Story Count" },
  { value: "total_views", label: "Total Views" },
  { value: "early_adopter", label: "Early Adopter" },
  { value: "editors_pick", label: "Editor's Pick" },
  { value: "anniversary", label: "Anniversary" },
  { value: "manual", label: "Manual" },
];

// Only these check_types are eligible for manual grant via UI
const MANUAL_GRANTABLE = new Set(["manual", "editors_pick"]);

const AchievementBadgeManager = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<"badges" | "grant">("badges");
  const [formOpen, setFormOpen] = useState(false);
  const [editBadge, setEditBadge] = useState<BadgeRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BadgeRow | null>(null);
  const [uploading, setUploading] = useState(false);
  const qc = useQueryClient();

  // Form state (badge def)
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("output");
  const [checkType, setCheckType] = useState("manual");
  const [checkValue, setCheckValue] = useState<string>("");
  const [sortOrder, setSortOrder] = useState("0");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Grant flow state
  const [userQuery, setUserQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<{ badge: BadgeRow; user: UserRow } | null>(null);

  const { data: badges, refetch } = useQuery({
    queryKey: ["admin-achievement-badges"],
    queryFn: async () => {
      const { data } = await supabase
        .from("achievement_badges")
        .select("*")
        .order("category")
        .order("sort_order", { ascending: true });
      return (data || []) as BadgeRow[];
    },
  });

  // User search (only when grant view active and query >= 2)
  const { data: userResults, isFetching: userSearching } = useQuery({
    queryKey: ["admin-user-search", userQuery],
    enabled: view === "grant" && userQuery.trim().length >= 2,
    queryFn: async () => {
      const q = userQuery.trim();
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .limit(8);
      return (data || []) as UserRow[];
    },
  });

  // Fetch granted badges for the selected user
  const { data: userGranted, refetch: refetchUserGranted } = useQuery({
    queryKey: ["admin-user-granted", selectedUser?.user_id],
    enabled: !!selectedUser?.user_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_achievements")
        .select("badge_id")
        .eq("user_id", selectedUser!.user_id);
      return new Set((data || []).map((d: any) => d.badge_id));
    },
  });

  const grantableBadges = useMemo(
    () =>
      (badges || []).filter(
        (b) => b.category === "special" && MANUAL_GRANTABLE.has(b.check_type) && b.is_active,
      ),
    [badges],
  );

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setCategory("output");
    setCheckType("manual");
    setCheckValue("");
    setSortOrder("0");
    setImageFile(null);
    setImagePreview(null);
    setEditBadge(null);
  };

  const openAddForm = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEditForm = (badge: BadgeRow) => {
    setEditBadge(badge);
    setTitle(badge.title);
    setDescription(badge.description);
    setCategory(badge.category);
    setCheckType(badge.check_type);
    setCheckValue(badge.check_value?.toString() || "");
    setSortOrder(badge.sort_order.toString());
    setImagePreview(badge.image_url);
    setImageFile(null);
    setFormOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.match(/^image\/(png|svg\+xml)$/)) {
      toast.error("Only PNG and SVG files allowed");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const uploadImage = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("badge-images").upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from("badge-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setUploading(true);
    try {
      let imageUrl = editBadge?.image_url || null;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      const payload = {
        title: title.trim(),
        description: description.trim(),
        category,
        check_type: checkType,
        check_value: checkValue ? parseInt(checkValue) : null,
        sort_order: parseInt(sortOrder) || 0,
        image_url: imageUrl,
      };

      if (editBadge) {
        await supabase.from("achievement_badges").update(payload as any).eq("id", editBadge.id);
        toast.success("Badge updated (◕‿◕)");
      } else {
        await supabase.from("achievement_badges").insert(payload as any);
        toast.success("Badge added (★‿★)");
      }

      setFormOpen(false);
      resetForm();
      refetch();
      qc.invalidateQueries({ queryKey: ["achievement-badges"] });
    } catch (err: any) {
      toast.error(err.message || "Failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await supabase.from("achievement_badges").delete().eq("id", deleteTarget.id);
    toast.success("Badge deleted");
    setDeleteTarget(null);
    refetch();
    qc.invalidateQueries({ queryKey: ["achievement-badges"] });
  };

  const handleGrant = async (badge: BadgeRow) => {
    if (!selectedUser) return;
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("user_achievements").insert({
      user_id: selectedUser.user_id,
      badge_id: badge.id,
      granted_by: auth.user?.id,
    } as any);
    if (error) {
      // unique violation = already granted
      if (error.code === "23505") {
        toast.error("User already has this badge");
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success(`Granted "${badge.title}" to @${selectedUser.username} (★‿★)`);
    refetchUserGranted();
    qc.invalidateQueries({ queryKey: ["user-achievements", selectedUser.user_id] });
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    const { badge, user } = revokeTarget;
    const { error } = await supabase
      .from("user_achievements")
      .delete()
      .eq("user_id", user.user_id)
      .eq("badge_id", badge.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Revoked "${badge.title}" from @${user.username}`);
    setRevokeTarget(null);
    refetchUserGranted();
    qc.invalidateQueries({ queryKey: ["user-achievements", user.user_id] });
  };

  const grouped = CATEGORIES.map((cat) => ({
    category: cat,
    badges: (badges || []).filter((b) => b.category === cat),
  }));

  return (
    <div className="rounded-lg border border-border">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-950">
          <Award className="h-4 w-4 text-purple-600 dark:text-purple-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium">Achievement Badge</h3>
          <p className="text-xs text-muted-foreground">Manage definitions & grant special badges</p>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "" : "-rotate-90"}`} />
      </button>

      {isOpen && (
        <div className="border-t border-border p-4 space-y-4">
          {/* Sub-tabs */}
          <div className="flex items-center gap-1 rounded-md bg-muted/40 p-1">
            <button
              onClick={() => setView("badges")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors",
                view === "badges" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Award className="h-3.5 w-3.5" /> Badges
            </button>
            <button
              onClick={() => setView("grant")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors",
                view === "grant" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Sparkles className="h-3.5 w-3.5" /> Grant
            </button>
          </div>

          {view === "badges" && (
            <>
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={openAddForm}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Badge
                </Button>
              </div>

              {grouped.map(({ category: cat, badges: catBadges }) => {
                const meta = CATEGORY_META[cat];
                if (!catBadges.length) return (
                  <div key={cat} className="text-xs text-muted-foreground italic">
                    {meta.label}: no badges
                  </div>
                );
                return (
                  <div key={cat}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{meta.label}</span>
                      <span className="text-[10px] text-muted-foreground/60">{catBadges.length}</span>
                    </div>
                    <div className="rounded-md border border-border divide-y divide-border">
                      {catBadges.map((badge) => (
                        <div key={badge.id} className="flex items-center gap-3 px-3 py-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border flex-shrink-0 overflow-hidden">
                            {badge.image_url ? (
                              <img src={badge.image_url} alt="" className="h-6 w-6 object-contain" />
                            ) : (
                              <Award className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{badge.title}</p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {badge.check_type}{badge.check_value != null ? ` ≥ ${badge.check_value}` : ""} · order: {badge.sort_order}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => openEditForm(badge)}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(badge)}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {view === "grant" && (
            <div className="space-y-3">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Pick a user, then grant a Special badge manually. Only badges in <span className="font-semibold">Special</span> with check type <span className="font-semibold">Manual</span> or <span className="font-semibold">Editor's Pick</span> can be granted here. Auto-awarded badges (Output, Reach, Early Adopter, Anniversary) are not grantable.
              </p>

              {/* User search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder="Search by username or display name..."
                  className="pl-8 text-sm"
                />
                {selectedUser && (
                  <button
                    onClick={() => { setSelectedUser(null); setUserQuery(""); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground"
                    aria-label="Clear selected user"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Results dropdown */}
              {!selectedUser && userQuery.trim().length >= 2 && (
                <div className="rounded-md border border-border max-h-56 overflow-y-auto">
                  {userSearching ? (
                    <p className="px-3 py-3 text-xs text-muted-foreground">Searching...</p>
                  ) : (userResults || []).length === 0 ? (
                    <p className="px-3 py-3 text-xs text-muted-foreground">No users found.</p>
                  ) : (
                    (userResults || []).map((u) => (
                      <button
                        key={u.user_id}
                        onClick={() => { setSelectedUser(u); setUserQuery(""); }}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                      >
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover border border-border" />
                        ) : (
                          <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] text-muted-foreground">
                            {u.display_name?.[0]?.toUpperCase() || "?"}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm truncate">{u.display_name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">@{u.username}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Selected user + badge picker */}
              {selectedUser && (
                <div className="rounded-md border border-border p-3 space-y-3">
                  <div className="flex items-center gap-2.5 pb-2 border-b border-border">
                    {selectedUser.avatar_url ? (
                      <img src={selectedUser.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover border border-border" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground">
                        {selectedUser.display_name?.[0]?.toUpperCase() || "?"}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{selectedUser.display_name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">@{selectedUser.username}</p>
                    </div>
                  </div>

                  {grantableBadges.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-2">
                      No grantable Special badges yet. Create one in the Badges tab with category "Special" and check type "Manual" or "Editor's Pick".
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {grantableBadges.map((badge) => {
                        const granted = userGranted?.has(badge.id);
                        return (
                          <div key={badge.id} className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-muted/40">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border flex-shrink-0 overflow-hidden">
                              {badge.image_url ? (
                                <img src={badge.image_url} alt="" className="h-6 w-6 object-contain" />
                              ) : (
                                <Award className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{badge.title}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{badge.description || badge.check_type}</p>
                            </div>
                            {granted ? (
                              <button
                                onClick={() => setRevokeTarget({ badge, user: selectedUser })}
                                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive px-2 py-1 rounded transition-colors"
                              >
                                <Check className="h-3 w-3" /> Granted · revoke
                              </button>
                            ) : (
                              <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => handleGrant(badge)}>
                                Grant
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={(open) => { if (!open) { setFormOpen(false); resetForm(); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editBadge ? "Edit Badge" : "Add Badge"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Image (PNG/SVG, 1:1)</label>
              <div className="mt-1 flex items-center gap-3">
                {imagePreview && (
                  <img src={imagePreview} alt="" className="h-10 w-10 rounded-full border border-border object-contain" />
                )}
                <input type="file" accept=".png,.svg" onChange={handleImageChange} className="text-xs" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_META[c].label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Check Type</label>
                <select value={checkType} onChange={(e) => setCheckType(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {CHECK_TYPES.map((ct) => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Check Value</label>
                <Input type="number" value={checkValue} onChange={(e) => setCheckValue(e.target.value)} className="mt-1" placeholder="e.g. 10" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Sort Order</label>
                <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="mt-1" />
              </div>
            </div>
            <Button onClick={handleSubmit} disabled={uploading} className="w-full">
              {uploading ? "Saving..." : editBadge ? "Update Badge" : "Add Badge"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete badge confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this badge and all user achievements linked to it.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Yes, delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke confirmation */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke "{revokeTarget?.badge.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the badge from @{revokeTarget?.user.username}. They will lose this achievement immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevoke} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Yes, revoke</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AchievementBadgeManager;
