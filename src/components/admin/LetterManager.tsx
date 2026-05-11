import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Mail, Trash2, ArrowLeft, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
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

interface SettingValue {
  enabled?: boolean;
  start_at?: string;
  end_at?: string;
}

const useSetting = (key: string) =>
  useQuery({
    queryKey: ["site-settings", key],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", key)
        .maybeSingle();
      return (data?.value as SettingValue) ?? {};
    },
  });

const upsertSetting = async (key: string, value: SettingValue) => {
  const { data: existing } = await supabase
    .from("site_settings")
    .select("id")
    .eq("key", key)
    .maybeSingle();
  if (existing) {
    await supabase
      .from("site_settings")
      .update({ value: value as never, updated_at: new Date().toISOString() })
      .eq("key", key);
  } else {
    await supabase.from("site_settings").insert({ key, value: value as never });
  }
};

const toLocalInput = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const PAGE_SIZE = 10;

interface RecipientGroup {
  user_id: string;
  username: string;
  display_name: string;
  count: number;
  latest_at: string;
}

interface LetterRow {
  id: string;
  body: string;
  recipient_user_id: string;
  sender_user_id: string;
  status: string;
  created_at: string;
}

const LetterManager = () => {
  const qc = useQueryClient();
  const visibility = useSetting("letter_visibility");
  const feature = useSetting("letter_enabled");
  const win = useSetting("letter_event_window");

  const [open, setOpen] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [windowEnabled, setWindowEnabled] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LetterRow | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<RecipientGroup | null>(null);

  useEffect(() => {
    if (win.data) {
      setStart(toLocalInput(win.data.start_at));
      setEnd(toLocalInput(win.data.end_at));
      setWindowEnabled(win.data.enabled ?? false);
    }
  }, [win.data]);

  const toggleVisibility = async (v: boolean) => {
    await upsertSetting("letter_visibility", { enabled: v });
    qc.invalidateQueries({ queryKey: ["site-settings", "letter_visibility"] });
    qc.invalidateQueries({ queryKey: ["letter-event-status"] });
    toast.success(v ? "tab visible to others" : "tab hidden from others");
  };

  const toggleFeature = async (v: boolean) => {
    await upsertSetting("letter_enabled", { enabled: v });
    qc.invalidateQueries({ queryKey: ["site-settings", "letter_enabled"] });
    qc.invalidateQueries({ queryKey: ["letter-event-status"] });
    toast.success(v ? "create enabled" : "create disabled");
  };

  const saveWindow = async () => {
    if (windowEnabled && (!start || !end)) {
      toast.error("set both start and end");
      return;
    }
    if (start && end && new Date(start) >= new Date(end)) {
      toast.error("end must be after start");
      return;
    }
    await upsertSetting("letter_event_window", {
      enabled: windowEnabled,
      start_at: start ? new Date(start).toISOString() : "",
      end_at: end ? new Date(end).toISOString() : "",
    });
    qc.invalidateQueries({ queryKey: ["site-settings", "letter_event_window"] });
    qc.invalidateQueries({ queryKey: ["letter-event-status"] });
    toast.success("window saved");
  };

  const { data: letters } = useQuery({
    queryKey: ["admin-letters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("letters")
        .select("id, body, recipient_user_id, sender_user_id, status, created_at")
        .neq("status", "deleted")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as LetterRow[];
    },
  });

  const userIds = useMemo(
    () => Array.from(new Set((letters || []).map((l) => l.recipient_user_id))),
    [letters],
  );

  const { data: profiles } = useQuery({
    queryKey: ["admin-letters-profiles", userIds],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, display_name")
        .in("user_id", userIds);
      return data || [];
    },
  });

  const groups = useMemo<RecipientGroup[]>(() => {
    if (!letters) return [];
    const profileMap = new Map((profiles || []).map((p) => [p.user_id, p] as const));
    const map = new Map<string, RecipientGroup>();
    for (const l of letters) {
      const existing = map.get(l.recipient_user_id);
      if (existing) {
        existing.count += 1;
        if (l.created_at > existing.latest_at) existing.latest_at = l.created_at;
      } else {
        const p = profileMap.get(l.recipient_user_id);
        map.set(l.recipient_user_id, {
          user_id: l.recipient_user_id,
          username: p?.username || "unknown",
          display_name: p?.display_name || p?.username || "unknown",
          count: 1,
          latest_at: l.created_at,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.latest_at.localeCompare(a.latest_at));
  }, [letters, profiles]);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(
      (g) =>
        g.username.toLowerCase().includes(q) ||
        g.display_name.toLowerCase().includes(q),
    );
  }, [groups, search]);

  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / PAGE_SIZE));
  const pagedGroups = filteredGroups.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  const userLetters = useMemo(
    () =>
      selected ? (letters || []).filter((l) => l.recipient_user_id === selected.user_id) : [],
    [letters, selected],
  );

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("letters").delete().eq("id", deleteTarget.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["admin-letters"] });
    qc.invalidateQueries({ queryKey: ["letters"] });
    toast.success("removed");
    setDeleteTarget(null);
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="space-y-3">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-lg border border-border px-5 py-4 text-left hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Mail className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-medium">Letters (mail art)</h3>
              <p className="text-xs text-muted-foreground">
                {visibility.data?.enabled ? "visible" : "hidden"} ·{" "}
                {feature.data?.enabled ? "create on" : "create off"} ·{" "}
                {groups.length} recipient{groups.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-6">
        <div className="rounded-lg border border-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">Tab visibility</p>
              <p className="text-xs text-muted-foreground">
                show letters tab on every profile (off = hidden for all users; founders/admins still see it)
              </p>
            </div>
            <Switch
              checked={visibility.data?.enabled ?? false}
              onCheckedChange={toggleVisibility}
            />
          </div>

          <div className="flex items-center justify-between border-t border-border pt-4">
            <div>
              <p className="text-sm">Create enabled</p>
              <p className="text-xs text-muted-foreground">
                allow signed-in users to send letters to others
              </p>
            </div>
            <Switch
              checked={feature.data?.enabled ?? false}
              onCheckedChange={toggleFeature}
            />
          </div>

          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm">Event window</p>
                <p className="text-xs text-muted-foreground">
                  limit creation to this time range (off = no time limit while feature is on)
                </p>
              </div>
              <Switch checked={windowEnabled} onCheckedChange={setWindowEnabled} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1">start</label>
                <Input
                  type="datetime-local"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1">end</label>
                <Input
                  type="datetime-local"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>
            <Button onClick={saveWindow} size="sm" className="mt-3">
              Save window
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border p-5">
          {selected ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setSelected(null)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> back to recipients
                </button>
                <p className="text-xs text-muted-foreground">
                  @{selected.username} · {userLetters.length} letter
                  {userLetters.length === 1 ? "" : "s"}
                </p>
              </div>
              {userLetters.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">no letters</p>
              ) : (
                <div className="divide-y divide-border">
                  {userLetters.map((l) => (
                    <div key={l.id} className="flex items-start gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm line-clamp-2">{l.body}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {format(new Date(l.created_at), "d MMM yyyy HH:mm")} · {l.status}
                        </p>
                      </div>
                      <button
                        onClick={() => setDeleteTarget(l)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3 gap-3">
                <h3 className="text-sm font-medium">
                  Recent letters ({groups.length} recipient{groups.length === 1 ? "" : "s"})
                </h3>
                <div className="relative w-full max-w-xs">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="search recipient..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    className="pl-7 text-xs h-8"
                  />
                </div>
              </div>

              {pagedGroups.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">
                  {search ? "no matching users" : "no letters yet"}
                </p>
              ) : (
                <>
                  <div className="divide-y divide-border">
                    {pagedGroups.map((g) => (
                      <button
                        key={g.user_id}
                        onClick={() => setSelected(g)}
                        className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-muted/30 px-2 -mx-2 rounded transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm truncate">{g.display_name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            @{g.username} · last {format(new Date(g.latest_at), "d MMM yyyy")}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {g.count} letter{g.count === 1 ? "" : "s"}
                        </span>
                      </button>
                    ))}
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-1.5 mt-4">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`h-7 w-7 rounded text-xs transition-colors ${
                            p === page
                              ? "bg-foreground text-background"
                              : "border border-border hover:bg-muted"
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </CollapsibleContent>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this letter?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the message.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Collapsible>
  );
};

export default LetterManager;
