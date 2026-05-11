import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  Key, Search, Clock, ChevronDown, ChevronLeft, ChevronRight, Copy, AlertTriangle, Bell, RefreshCw, Settings, Trash2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

interface WaitlistEntry {
  id: string;
  email: string;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  auth_user_id: string | null;
  // Synced profile data
  username?: string;
  display_name?: string;
  role?: string;
  hasInnerCircle?: boolean;
}

interface ForgotRequest {
  id: string;
  email: string;
  status: string;
  created_at: string;
}

interface KeyHistory {
  id: string;
  created_at: string;
  change_type: string;
  generated_by: string | null;
}

const ITEMS_PER_PAGE = 20;

const getMonthYearKey = (dateStr: string) => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Unknown";
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

const groupByMonth = <T,>(items: T[], dateKey: keyof T): { label: string; items: T[] }[] => {
  const groups = new Map<string, T[]>();
  items.forEach((item) => {
    const key = getMonthYearKey(item[dateKey] as string);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  });
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
};

const StatusBadge = ({ status }: { status: string }) => {
  const colors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${colors[status] || "bg-muted text-muted-foreground"}`}>
      {status}
    </span>
  );
};

const ConfidentialRegistData = ({ onUserApproved }: { onUserApproved?: () => void }) => {
  const { isFounder } = useAuth();
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [forgotRequests, setForgotRequests] = useState<ForgotRequest[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  const [waitlistEnabled, setWaitlistEnabled] = useState(true);
  const [dailyLimit, setDailyLimit] = useState(200);
  const [savingConfig, setSavingConfig] = useState(false);
  const [forgotCollapsed, setForgotCollapsed] = useState(false);
  const [forgotPage, setForgotPage] = useState(1);
  const [selectedForgot, setSelectedForgot] = useState<Set<string>>(new Set());
  const [deletingForgot, setDeletingForgot] = useState(false);
  const [deleteEntryTarget, setDeleteEntryTarget] = useState<WaitlistEntry | null>(null);

  // Confidential access dialog
  const [accessTarget, setAccessTarget] = useState<WaitlistEntry | null>(null);
  const [accessConfirm, setAccessConfirm] = useState("");

  // Personal key dialog
  const [keyDialogEntry, setKeyDialogEntry] = useState<WaitlistEntry | null>(null);
  const [keyHistory, setKeyHistory] = useState<KeyHistory[]>([]);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // Forgot request key generation
  const [forgotAccessTarget, setForgotAccessTarget] = useState<ForgotRequest | null>(null);
  const [forgotAccessConfirm, setForgotAccessConfirm] = useState("");
  const [forgotKeyDialog, setForgotKeyDialog] = useState<ForgotRequest | null>(null);
  const [forgotKeyHistory, setForgotKeyHistory] = useState<KeyHistory[]>([]);
  const [forgotGeneratedKey, setForgotGeneratedKey] = useState<string | null>(null);
  const [forgotGenerating, setForgotGenerating] = useState(false);

  const fetchEntries = async () => {
    const { data } = await supabase
      .from("waitlist")
      .select("*")
      .order("created_at", { ascending: false });
    const rawEntries = (data as any[]) || [];

    // Sync profile & role data for approved users
    const userIds = rawEntries.filter((e) => e.auth_user_id).map((e) => e.auth_user_id);
    let profileMap = new Map<string, { username: string; display_name: string }>();
    let roleMap = new Map<string, { role: string; hasIC: boolean }>();

    if (userIds.length > 0) {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("user_id, username, display_name").in("user_id", userIds),
        supabase.from("user_roles").select("user_id, role").in("user_id", userIds),
      ]);
      (profiles || []).forEach((p: any) => profileMap.set(p.user_id, { username: p.username, display_name: p.display_name }));
      const rolesGrouped = new Map<string, string[]>();
      (roles || []).forEach((r: any) => {
        const arr = rolesGrouped.get(r.user_id) || [];
        arr.push(r.role);
        rolesGrouped.set(r.user_id, arr);
      });
      rolesGrouped.forEach((rr, uid) => {
        const primary = rr.find((r) => r !== "inner_circle") || "writer";
        roleMap.set(uid, { role: primary, hasIC: rr.includes("inner_circle") });
      });
    }

    setEntries(
      rawEntries.map((e) => {
        const prof = e.auth_user_id ? profileMap.get(e.auth_user_id) : undefined;
        const rl = e.auth_user_id ? roleMap.get(e.auth_user_id) : undefined;
        return {
          ...e,
          username: prof?.username,
          display_name: prof?.display_name,
          role: rl?.role,
          hasInnerCircle: rl?.hasIC,
        };
      })
    );
  };

  const fetchForgotRequests = async () => {
    const { data } = await supabase
      .from("forgot_key_requests")
      .select("*")
      .order("created_at", { ascending: false });
    setForgotRequests((data as any[]) || []);
  };

  const fetchWaitlistConfig = async () => {
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "waitlist_config")
      .maybeSingle();
    const config = (data?.value as any) ?? { enabled: true, daily_limit: 200 };
    setWaitlistEnabled(config.enabled !== false);
    setDailyLimit(config.daily_limit ?? 200);
  };

  const saveWaitlistConfig = async () => {
    setSavingConfig(true);
    const value = { enabled: waitlistEnabled, daily_limit: dailyLimit };
    const { data: existing } = await supabase
      .from("site_settings")
      .select("id")
      .eq("key", "waitlist_config")
      .maybeSingle();
    if (existing) {
      await supabase.from("site_settings").update({ value } as any).eq("key", "waitlist_config");
    } else {
      await supabase.from("site_settings").insert({ key: "waitlist_config", value } as any);
    }
    setSavingConfig(false);
    toast.success("Waitlist config saved");
  };

  useEffect(() => {
    fetchEntries();
    fetchForgotRequests();
    fetchWaitlistConfig();
  }, []);

  const pendingForgotCount = useMemo(
    () => forgotRequests.filter((r) => r.status === "pending").length,
    [forgotRequests]
  );

  const pendingForgotItems = useMemo(
    () => forgotRequests.filter((r) => r.status === "pending"),
    [forgotRequests]
  );

  const forgotTotalPages = Math.max(1, Math.ceil(pendingForgotItems.length / ITEMS_PER_PAGE));
  const paginatedForgot = useMemo(
    () => pendingForgotItems.slice((forgotPage - 1) * ITEMS_PER_PAGE, forgotPage * ITEMS_PER_PAGE),
    [pendingForgotItems, forgotPage]
  );

  const toggleForgotSelect = (id: string) => {
    const next = new Set(selectedForgot);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedForgot(next);
  };

  const toggleAllForgot = () => {
    if (selectedForgot.size === paginatedForgot.length) {
      setSelectedForgot(new Set());
    } else {
      setSelectedForgot(new Set(paginatedForgot.map((r) => r.id)));
    }
  };

  const handleDeleteSelectedForgot = async () => {
    if (selectedForgot.size === 0) return;
    setDeletingForgot(true);
    const ids = Array.from(selectedForgot);
    for (const id of ids) {
      await supabase.from("forgot_key_requests").delete().eq("id", id);
    }
    setDeletingForgot(false);
    setSelectedForgot(new Set());
    toast.success(`Deleted ${ids.length} request${ids.length > 1 ? "s" : ""}`);
    fetchForgotRequests();
  };

  const filtered = useMemo(() => {
    let result = entries;
    if (statusFilter !== "all") result = result.filter((e) => e.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((e) =>
        e.email.toLowerCase().includes(q) ||
        (e.username || "").toLowerCase().includes(q) ||
        (e.display_name || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [entries, statusFilter, search]);

  const grouped = useMemo(() => groupByMonth(filtered, "created_at"), [filtered]);

  // Queue position: order pending entries by created_at ASC, assign #1, #2...
  const queueMap = useMemo(() => {
    const map = new Map<string, number>();
    const pending = entries
      .filter((e) => e.status === "pending")
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    pending.forEach((e, i) => map.set(e.id, i + 1));
    return map;
  }, [entries]);

  const handleApprove = async (entry: WaitlistEntry) => {
    const { data, error } = await supabase.functions.invoke("manage-registration", {
      body: { action: "approve", waitlist_id: entry.id },
    });
    if (error || data?.error) {
      toast.error(data?.error || "Failed to approve");
    } else {
      toast.success(`Approved ${entry.email} (◕‿◕)`);
      fetchEntries();
      onUserApproved?.();
    }
  };

  const handleReject = async (entry: WaitlistEntry) => {
    const { data, error } = await supabase.functions.invoke("manage-registration", {
      body: { action: "reject", waitlist_id: entry.id },
    });
    if (error || data?.error) {
      toast.error(data?.error || "Failed to reject");
    } else {
      toast.success("Rejected");
      fetchEntries();
    }
  };

  const handleChangeWaitlistStatus = async (entry: WaitlistEntry, newStatus: string) => {
    if (newStatus === entry.status) return;
    if (newStatus === "approved") {
      await handleApprove(entry);
    } else if (newStatus === "rejected") {
      await handleReject(entry);
    } else {
      // Set back to pending
      await supabase.from("waitlist").update({ status: "pending", reviewed_at: null, reviewed_by: null } as any).eq("id", entry.id);
      toast.success("Set back to pending");
      fetchEntries();
    }
  };

  const handleDeleteEntry = async () => {
    if (!deleteEntryTarget) return;
    await supabase.from("waitlist").delete().eq("id", deleteEntryTarget.id);
    toast.success("Entry deleted");
    setDeleteEntryTarget(null);
    fetchEntries();
  };

  const openKeyDialog = (entry: WaitlistEntry) => {
    setAccessTarget(entry);
    setAccessConfirm("");
  };

  const confirmAccess = async () => {
    if (accessConfirm !== "confidential-access" || !accessTarget) return;
    setKeyDialogEntry(accessTarget);
    setAccessTarget(null);
    setAccessConfirm("");
    setGeneratedKey(null);

    // Fetch key history
    if (accessTarget.auth_user_id) {
      const { data } = await supabase
        .from("personal_key_history")
        .select("*")
        .eq("user_id", accessTarget.auth_user_id)
        .order("created_at", { ascending: false });
      setKeyHistory((data as any[]) || []);
    }
  };

  const generateKey = async () => {
    if (!keyDialogEntry?.auth_user_id) return;
    setGenerating(true);

    const { data, error } = await supabase.functions.invoke("manage-registration", {
      body: { action: "generate_key", user_id: keyDialogEntry.auth_user_id },
    });

    setGenerating(false);
    if (error || data?.error) {
      toast.error(data?.error || "Failed to generate key");
    } else {
      setGeneratedKey(data.personal_key);
      toast.success("Personal Key generated");
      // Refresh history
      const { data: h } = await supabase
        .from("personal_key_history")
        .select("*")
        .eq("user_id", keyDialogEntry.auth_user_id)
        .order("created_at", { ascending: false });
      setKeyHistory((h as any[]) || []);
    }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success("Copied to clipboard");
  };

  // Forgot request: open key dialog
  const openForgotKeyDialog = (req: ForgotRequest) => {
    setForgotAccessTarget(req);
    setForgotAccessConfirm("");
  };

  const confirmForgotAccess = async () => {
    if (forgotAccessConfirm !== "confidential-access" || !forgotAccessTarget) return;
    setForgotKeyDialog(forgotAccessTarget);
    setForgotAccessTarget(null);
    setForgotAccessConfirm("");
    setForgotGeneratedKey(null);

    // Find user by email in waitlist
    const entry = entries.find((e) => e.email === forgotAccessTarget.email && e.auth_user_id);
    if (entry?.auth_user_id) {
      const { data } = await supabase
        .from("personal_key_history")
        .select("*")
        .eq("user_id", entry.auth_user_id)
        .order("created_at", { ascending: false });
      setForgotKeyHistory((data as any[]) || []);
    }
  };

  const generateForgotKey = async () => {
    if (!forgotKeyDialog) return;
    const entry = entries.find((e) => e.email === forgotKeyDialog.email && e.auth_user_id);
    if (!entry?.auth_user_id) {
      toast.error("No associated user found for this email");
      return;
    }
    setForgotGenerating(true);

    const { data, error } = await supabase.functions.invoke("manage-registration", {
      body: { action: "generate_key", user_id: entry.auth_user_id },
    });

    if (error || data?.error) {
      toast.error(data?.error || "Failed to generate key");
    } else {
      setForgotGeneratedKey(data.personal_key);
      // Resolve the forgot request
      await supabase.functions.invoke("manage-registration", {
        body: { action: "resolve_forgot", request_id: forgotKeyDialog.id },
      });
      toast.success("New Personal Key generated & request resolved");
      fetchForgotRequests();
      const { data: h } = await supabase
        .from("personal_key_history")
        .select("*")
        .eq("user_id", entry.auth_user_id)
        .order("created_at", { ascending: false });
      setForgotKeyHistory((h as any[]) || []);
    }
    setForgotGenerating(false);
  };

  return (
    <div className="space-y-8">
      {/* Waitlist Configuration */}
      <div className="rounded-md border border-border p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Settings className="h-4 w-4 text-muted-foreground" />
          Waitlist Settings
        </div>

        <div className="flex flex-col gap-4">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-sm font-medium">Registration</label>
              <p className="text-xs text-muted-foreground">
                {waitlistEnabled ? "Users can join the waitlist" : "Waitlist is closed, no new signups"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${waitlistEnabled ? "text-green-600" : "text-muted-foreground"}`}>
                {waitlistEnabled ? "Enabled" : "Disabled"}
              </span>
              <Switch
                checked={waitlistEnabled}
                onCheckedChange={setWaitlistEnabled}
              />
            </div>
          </div>

          {/* Daily Limit - only active when enabled */}
          <div className={`flex items-center gap-3 transition-opacity ${!waitlistEnabled ? "opacity-40 pointer-events-none" : ""}`}>
            <span className="text-xs text-muted-foreground">Daily Limit:</span>
            <input
              type="number"
              min={1}
              max={10000}
              value={dailyLimit}
              onChange={(e) => setDailyLimit(Math.max(1, parseInt(e.target.value) || 200))}
              disabled={!waitlistEnabled}
              className="w-20 rounded-md border border-border bg-transparent px-2 py-1 text-sm focus:border-foreground focus:outline-none disabled:cursor-not-allowed"
            />
          </div>

          {/* Save Button */}
          <button
            onClick={saveWaitlistConfig}
            disabled={savingConfig}
            className="w-fit rounded-md bg-foreground px-4 py-1.5 text-xs font-medium text-background hover:opacity-80 transition-opacity disabled:opacity-50"
          >
            {savingConfig ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>

      {/* Forgot Key Requests */}
      {pendingForgotCount > 0 && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50/50">
          <button
            onClick={() => setForgotCollapsed(!forgotCollapsed)}
            className="flex w-full items-center justify-between p-4"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-yellow-800">
              <Bell className="h-4 w-4" />
              {pendingForgotCount} forgot key request{pendingForgotCount > 1 ? "s" : ""} pending
            </div>
            <ChevronDown className={`h-4 w-4 text-yellow-700 transition-transform duration-200 ${forgotCollapsed ? "-rotate-90" : ""}`} />
          </button>

          {!forgotCollapsed && (
            <div className="px-4 pb-4 space-y-3">
              {/* Bulk actions */}
              {selectedForgot.size > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{selectedForgot.size} selected</span>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        disabled={deletingForgot}
                        className="flex items-center gap-1.5 rounded bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:opacity-80 transition-opacity disabled:opacity-50"
                      >
                        <Trash2 className="h-3 w-3" /> {deletingForgot ? "Deleting..." : "Delete Selected"}
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete {selectedForgot.size} request{selectedForgot.size > 1 ? "s" : ""}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently remove the selected forgot key request{selectedForgot.size > 1 ? "s" : ""}. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteSelectedForgot}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}

              {/* Select all */}
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <Checkbox
                  checked={paginatedForgot.length > 0 && selectedForgot.size === paginatedForgot.length}
                  onCheckedChange={toggleAllForgot}
                />
                <span className="text-[10px] text-muted-foreground">Select all on page</span>
              </div>

              <div className="space-y-2">
                {paginatedForgot.map((req) => (
                  <div key={req.id} className="flex items-center gap-3 rounded border border-border bg-background px-3 py-2">
                    <Checkbox
                      checked={selectedForgot.has(req.id)}
                      onCheckedChange={() => toggleForgotSelect(req.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{req.email}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(req.created_at).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })} · {new Date(req.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <button
                      onClick={() => openForgotKeyDialog(req)}
                      className="flex items-center gap-1.5 rounded bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-80 transition-opacity flex-shrink-0"
                    >
                      <Key className="h-3 w-3" /> Generate New Key
                    </button>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {forgotTotalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-[10px] text-muted-foreground">
                    Page {forgotPage} of {forgotTotalPages}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setForgotPage((p) => Math.max(1, p - 1)); setSelectedForgot(new Set()); }}
                      disabled={forgotPage <= 1}
                      className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => { setForgotPage((p) => Math.min(forgotTotalPages, p + 1)); setSelectedForgot(new Set()); }}
                      disabled={forgotPage >= forgotTotalPages}
                      className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-border bg-transparent py-2 pl-9 pr-3 text-sm focus:border-foreground focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-border bg-transparent py-2 pl-3 pr-8 text-xs focus:border-foreground focus:outline-none"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <button onClick={() => { fetchEntries(); fetchForgotRequests(); }} className="text-muted-foreground hover:text-foreground" title="Refresh">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Entries grouped by month */}
      <div className="rounded-md border border-border">
        {grouped.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">no registrations yet</p>
        ) : (
          grouped.map((group, gi) => (
            <CollapsibleGroup key={group.label} label={group.label} count={group.items.length} defaultOpen={gi === 0}>
              {(start, end) =>
                group.items.slice(start, end).map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3 border-b border-border last:border-b-0 px-4 py-3">
                    {entry.status === "pending" && queueMap.get(entry.id) && (
                      <span className="flex-shrink-0 inline-flex items-center justify-center min-w-[28px] h-6 px-1.5 rounded-md bg-muted text-[10px] font-semibold text-foreground">
                        #{queueMap.get(entry.id)}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">{entry.email}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(entry.created_at).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                        {entry.username && (
                          <span className="text-[10px] text-muted-foreground">
                            · @{entry.username}
                          </span>
                        )}
                        {entry.display_name && (
                          <span className="text-[10px] text-muted-foreground">
                            · {entry.display_name}
                          </span>
                        )}
                        {entry.role && (
                          <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-0 text-[9px] font-medium text-muted-foreground">
                            {entry.role}
                          </span>
                        )}
                        {entry.hasInnerCircle && (
                          <span className="inline-flex items-center rounded-full bg-accent px-1.5 py-0 text-[9px] font-medium text-accent-foreground">
                            IC
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <select
                        value={entry.status}
                        onChange={(e) => handleChangeWaitlistStatus(entry, e.target.value)}
                        className={`rounded-md border px-2 py-1 text-[10px] font-medium focus:outline-none transition-colors ${
                          entry.status === "pending"
                            ? "border-yellow-300 bg-yellow-50 text-yellow-800"
                            : entry.status === "approved"
                            ? "border-green-300 bg-green-50 text-green-800"
                            : "border-red-300 bg-red-50 text-red-800"
                        }`}
                      >
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                      </select>
                      {entry.status === "approved" && entry.auth_user_id && (
                        <button
                          onClick={() => openKeyDialog(entry)}
                          className="group relative flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          title="Personal Key"
                        >
                          <Key className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Personal Key</span>
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteEntryTarget(entry)}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete entry"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              }
            </CollapsibleGroup>
          ))
        )}
      </div>

      {/* Confidential Access Dialog - Waitlist */}
      <AlertDialog open={!!accessTarget} onOpenChange={(open) => !open && setAccessTarget(null)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 font-serif">
              <AlertTriangle className="h-4 w-4 text-yellow-500" /> Confidential Access
            </AlertDialogTitle>
            <AlertDialogDescription>
              To confirm, type <span className="font-mono font-medium text-foreground">"confidential-access"</span> in the box below
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input
            type="text"
            placeholder='Type "confidential-access"'
            value={accessConfirm}
            onChange={(e) => setAccessConfirm(e.target.value)}
            className="w-full border-b border-border bg-transparent py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 focus:border-foreground focus:outline-none"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAccess}
              disabled={accessConfirm !== "confidential-access"}
              className="bg-foreground text-background hover:bg-foreground/80"
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Personal Key Management Dialog */}
      <Dialog open={!!keyDialogEntry} onOpenChange={(open) => { if (!open) { setKeyDialogEntry(null); setGeneratedKey(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-serif">
              <Key className="h-4 w-4" /> Personal Key
            </DialogTitle>
            <DialogDescription>{keyDialogEntry?.email}</DialogDescription>
          </DialogHeader>

          {/* Key History */}
          {keyHistory.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">History</p>
              <div className="max-h-32 overflow-y-auto rounded border border-border divide-y divide-border">
                {keyHistory.map((h) => (
                  <div key={h.id} className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(h.created_at).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="text-[10px] text-muted-foreground/70">
                      {h.change_type === "admin_generated" ? "admin generated" : h.change_type === "user_changed" ? "user changed" : h.change_type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Generated Key Display */}
          {generatedKey && (
            <div className="rounded-md border border-green-200 bg-green-50/50 p-3">
              <p className="text-[10px] font-medium text-green-700 mb-1">New Personal Key</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-background px-2 py-1 text-sm font-mono text-foreground border border-border">
                  {generatedKey}
                </code>
                <button
                  onClick={() => copyKey(generatedKey)}
                  className="flex items-center gap-1 rounded bg-foreground px-2 py-1.5 text-xs text-background hover:opacity-80"
                >
                  <Copy className="h-3 w-3" /> Copy
                </button>
              </div>
              <p className="mt-2 text-[10px] text-green-600">
                Send this key to the user securely. It won't be shown again.
              </p>
            </div>
          )}

          <button
            onClick={generateKey}
            disabled={generating}
            className="w-full rounded bg-foreground py-2.5 text-sm font-medium text-background hover:opacity-80 disabled:opacity-40 transition-opacity"
          >
            {generating ? "Generating..." : generatedKey ? "Generate New Key" : "Generate Personal Key"}
          </button>
        </DialogContent>
      </Dialog>

      {/* Forgot Request Confidential Access Dialog */}
      <AlertDialog open={!!forgotAccessTarget} onOpenChange={(open) => !open && setForgotAccessTarget(null)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 font-serif">
              <AlertTriangle className="h-4 w-4 text-yellow-500" /> Confidential Access
            </AlertDialogTitle>
            <AlertDialogDescription>
              To confirm, type <span className="font-mono font-medium text-foreground">"confidential-access"</span> in the box below
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input
            type="text"
            placeholder='Type "confidential-access"'
            value={forgotAccessConfirm}
            onChange={(e) => setForgotAccessConfirm(e.target.value)}
            className="w-full border-b border-border bg-transparent py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 focus:border-foreground focus:outline-none"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmForgotAccess}
              disabled={forgotAccessConfirm !== "confidential-access"}
              className="bg-foreground text-background hover:bg-foreground/80"
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Forgot Request Key Dialog */}
      <Dialog open={!!forgotKeyDialog} onOpenChange={(open) => { if (!open) { setForgotKeyDialog(null); setForgotGeneratedKey(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-serif">
              <Key className="h-4 w-4" /> Recovery Key
            </DialogTitle>
            <DialogDescription>{forgotKeyDialog?.email}</DialogDescription>
          </DialogHeader>

          {forgotKeyHistory.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">History</p>
              <div className="max-h-32 overflow-y-auto rounded border border-border divide-y divide-border">
                {forgotKeyHistory.map((h) => (
                  <div key={h.id} className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(h.created_at).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="text-[10px] text-muted-foreground/70">
                      {h.change_type === "admin_generated" ? "admin generated" : h.change_type === "user_changed" ? "user changed" : h.change_type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {forgotGeneratedKey && (
            <div className="rounded-md border border-green-200 bg-green-50/50 p-3">
              <p className="text-[10px] font-medium text-green-700 mb-1">New Personal Key</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-background px-2 py-1 text-sm font-mono text-foreground border border-border">
                  {forgotGeneratedKey}
                </code>
                <button
                  onClick={() => copyKey(forgotGeneratedKey)}
                  className="flex items-center gap-1 rounded bg-foreground px-2 py-1.5 text-xs text-background hover:opacity-80"
                >
                  <Copy className="h-3 w-3" /> Copy
                </button>
              </div>
              <p className="mt-2 text-[10px] text-green-600">
                Send this key to the user. Previous key is now invalid.
              </p>
            </div>
          )}

          <button
            onClick={generateForgotKey}
            disabled={forgotGenerating}
            className="w-full rounded bg-foreground py-2.5 text-sm font-medium text-background hover:opacity-80 disabled:opacity-40 transition-opacity"
          >
            {forgotGenerating ? "Generating..." : "Generate New Personal Key"}
          </button>
        </DialogContent>
      </Dialog>

      {/* Delete Waitlist Entry Dialog */}
      <AlertDialog open={!!deleteEntryTarget} onOpenChange={(open) => !open && setDeleteEntryTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the waitlist entry for {deleteEntryTarget?.email}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEntry} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes, delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const CollapsibleGroup = ({
  label, count, defaultOpen = false, children,
}: {
  label: string; count: number; defaultOpen?: boolean;
  children: (start: number, end: number) => React.ReactNode;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(count / ITEMS_PER_PAGE));
  const start = (page - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
      >
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`} />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex-1">{label}</span>
        <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">{count}</span>
      </button>
      {isOpen && (
        <div>
          {children(start, end)}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 py-2">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30">
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="text-[10px] text-muted-foreground px-2">{page} / {totalPages}</span>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30">
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ConfidentialRegistData;
