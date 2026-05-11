import { useEffect, useState } from "react";
import { ChevronDown, FileText, Plus, Trash2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import type { FooterPage } from "@/hooks/useFooterPages";

const FooterPagesManager = () => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pages, setPages] = useState<FooterPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, { title: string; content: string; slug: string; sort_order: number }>>({});
  const [deleteTarget, setDeleteTarget] = useState<FooterPage | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newPage, setNewPage] = useState({ slug: "", title: "", content: "", sort_order: 99 });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("footer_pages")
      .select("*")
      .order("sort_order", { ascending: true });
    setPages((data || []) as FooterPage[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const startEdit = (p: FooterPage) => {
    setEditing((e) => ({ ...e, [p.id]: { title: p.title, content: p.content, slug: p.slug, sort_order: p.sort_order } }));
  };

  const cancelEdit = (id: string) => {
    setEditing((e) => {
      const n = { ...e };
      delete n[id];
      return n;
    });
  };

  const saveEdit = async (id: string) => {
    const data = editing[id];
    if (!data) return;
    if (!data.title.trim() || !data.slug.trim()) {
      toast.error("slug and title are required");
      return;
    }
    setSavingId(id);
    const { error } = await supabase
      .from("footer_pages")
      .update({
        title: data.title.trim(),
        content: data.content,
        slug: data.slug.trim().toLowerCase(),
        sort_order: data.sort_order,
      })
      .eq("id", id);
    setSavingId(null);
    if (error) {
      toast.error("failed to save");
    } else {
      toast.success("saved ✓");
      cancelEdit(id);
      await load();
      qc.invalidateQueries({ queryKey: ["footer-pages"] });
      qc.invalidateQueries({ queryKey: ["footer-page"] });
    }
  };

  const toggleEnabled = async (p: FooterPage, enabled: boolean) => {
    setSavingId(p.id);
    const { error } = await supabase.from("footer_pages").update({ enabled }).eq("id", p.id);
    setSavingId(null);
    if (error) {
      toast.error("failed to update");
    } else {
      toast.success(enabled ? "enabled ✓" : "disabled");
      await load();
      qc.invalidateQueries({ queryKey: ["footer-pages"] });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("footer_pages").delete().eq("id", deleteTarget.id);
    if (error) {
      toast.error("failed to delete");
    } else {
      toast.success("deleted");
      setDeleteTarget(null);
      await load();
      qc.invalidateQueries({ queryKey: ["footer-pages"] });
    }
  };

  const handleCreate = async () => {
    if (!newPage.slug.trim() || !newPage.title.trim()) {
      toast.error("slug and title are required");
      return;
    }
    const { error } = await supabase.from("footer_pages").insert({
      slug: newPage.slug.trim().toLowerCase(),
      title: newPage.title.trim(),
      content: newPage.content,
      sort_order: newPage.sort_order,
      enabled: true,
    });
    if (error) {
      toast.error(error.message.includes("duplicate") ? "slug already exists" : "failed to create");
    } else {
      toast.success("created ✓");
      setNewPage({ slug: "", title: "", content: "", sort_order: 99 });
      setShowNew(false);
      await load();
      qc.invalidateQueries({ queryKey: ["footer-pages"] });
    }
  };

  return (
    <div className="rounded-lg border border-border">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between p-5 text-left hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-medium">Footer Pages</h3>
              <p className="text-xs text-muted-foreground">
                About, Privacy, Terms, Roadmap — manage content & visibility
              </p>
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border px-5 py-4 space-y-3">
            {loading ? (
              <p className="text-xs text-muted-foreground">loading...</p>
            ) : (
              <>
                {pages.map((p) => {
                  const ed = editing[p.id];
                  return (
                    <div key={p.id} className="rounded-md border border-border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{p.title}</span>
                            <a
                              href={`/page/${p.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-foreground"
                              title="Preview page"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                          <p className="text-[10px] text-muted-foreground font-mono">/page/{p.slug} · order {p.sort_order}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Switch
                            checked={p.enabled}
                            disabled={savingId === p.id}
                            onCheckedChange={(v) => toggleEnabled(p, v)}
                          />
                          {!ed ? (
                            <>
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => startEdit(p)}>
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                onClick={() => setDeleteTarget(p)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </div>

                      {ed && (
                        <div className="mt-3 space-y-2 border-t border-border pt-3">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-muted-foreground">Slug</label>
                              <input
                                value={ed.slug}
                                onChange={(e) => setEditing({ ...editing, [p.id]: { ...ed, slug: e.target.value } })}
                                className="w-full rounded-md border border-border bg-transparent px-2 py-1 text-sm focus:outline-none focus:border-foreground"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground">Sort order</label>
                              <input
                                type="number"
                                value={ed.sort_order}
                                onChange={(e) => setEditing({ ...editing, [p.id]: { ...ed, sort_order: parseInt(e.target.value) || 0 } })}
                                className="w-full rounded-md border border-border bg-transparent px-2 py-1 text-sm focus:outline-none focus:border-foreground"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground">Title</label>
                            <input
                              value={ed.title}
                              onChange={(e) => setEditing({ ...editing, [p.id]: { ...ed, title: e.target.value } })}
                              className="w-full rounded-md border border-border bg-transparent px-2 py-1 text-sm focus:outline-none focus:border-foreground"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground">Content (plain text, use ## for roadmap headings)</label>
                            <textarea
                              value={ed.content}
                              onChange={(e) => setEditing({ ...editing, [p.id]: { ...ed, content: e.target.value } })}
                              rows={10}
                              className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-sm focus:outline-none focus:border-foreground font-mono"
                            />
                          </div>
                          <div className="flex items-center gap-2 justify-end">
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => cancelEdit(p.id)}>
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              className="h-7 text-xs"
                              disabled={savingId === p.id}
                              onClick={() => saveEdit(p.id)}
                            >
                              {savingId === p.id ? "Saving..." : "Save"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add new */}
                {!showNew ? (
                  <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => setShowNew(true)}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add new page
                  </Button>
                ) : (
                  <div className="rounded-md border border-dashed border-border p-3 space-y-2">
                    <p className="text-xs font-medium">New page</p>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        placeholder="slug (e.g. faq)"
                        value={newPage.slug}
                        onChange={(e) => setNewPage({ ...newPage, slug: e.target.value })}
                        className="rounded-md border border-border bg-transparent px-2 py-1 text-sm focus:outline-none focus:border-foreground"
                      />
                      <input
                        type="number"
                        placeholder="sort order"
                        value={newPage.sort_order}
                        onChange={(e) => setNewPage({ ...newPage, sort_order: parseInt(e.target.value) || 0 })}
                        className="rounded-md border border-border bg-transparent px-2 py-1 text-sm focus:outline-none focus:border-foreground"
                      />
                    </div>
                    <input
                      placeholder="Title"
                      value={newPage.title}
                      onChange={(e) => setNewPage({ ...newPage, title: e.target.value })}
                      className="w-full rounded-md border border-border bg-transparent px-2 py-1 text-sm focus:outline-none focus:border-foreground"
                    />
                    <textarea
                      placeholder="Content..."
                      value={newPage.content}
                      onChange={(e) => setNewPage({ ...newPage, content: e.target.value })}
                      rows={6}
                      className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-sm focus:outline-none focus:border-foreground font-mono"
                    />
                    <div className="flex items-center gap-2 justify-end">
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowNew(false)}>
                        Cancel
                      </Button>
                      <Button size="sm" className="h-7 text-xs" onClick={handleCreate}>
                        Create
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this page?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.title}" will be permanently removed. The footer link will disappear.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, keep it</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes, delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FooterPagesManager;
