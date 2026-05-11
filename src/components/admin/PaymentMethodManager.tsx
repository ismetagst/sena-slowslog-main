import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, GripVertical, CreditCard, ChevronDown } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { compressImage } from "@/lib/image-compress";

interface PaymentMethod {
  id: string;
  name: string;
  image_url: string | null;
  link_url: string | null;
  is_active: boolean;
  sort_order: number;
}

const PaymentMethodManager = () => {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [collapsed, setCollapsed] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLink, setNewLink] = useState("");
  const [newImage, setNewImage] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchMethods = async () => {
    const { data } = await supabase
      .from("payment_methods")
      .select("*")
      .order("sort_order", { ascending: true });
    setMethods((data as any[]) || []);
  };

  useEffect(() => { fetchMethods(); }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      let imageUrl: string | null = null;
      if (newImage) {
        const compressed = await compressImage(newImage);
        const filePath = `payment-methods/${Date.now()}-${newImage.name}`;
        const { error: upErr } = await supabase.storage.from("story-images").upload(filePath, compressed);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("story-images").getPublicUrl(filePath);
        imageUrl = urlData.publicUrl;
      }
      const maxOrder = methods.length > 0 ? Math.max(...methods.map(m => m.sort_order)) + 1 : 0;
      await supabase.from("payment_methods").insert({
        name: newName.trim(),
        link_url: newLink.trim() || null,
        image_url: imageUrl,
        sort_order: maxOrder,
      } as any);
      toast.success("Payment method added (◕‿◕)");
      setNewName(""); setNewLink(""); setNewImage(null); setAdding(false);
      fetchMethods();
    } catch (err: any) {
      toast.error(err.message || "Failed to add");
    } finally { setSaving(false); }
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("payment_methods").update({ is_active: active } as any).eq("id", id);
    fetchMethods();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("payment_methods").delete().eq("id", id);
    toast.success("Deleted");
    fetchMethods();
  };

  return (
    <div className="space-y-3">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center gap-2 text-left"
      >
        <CreditCard className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium flex-1">Payment Methods</span>
        <span className="text-[10px] text-muted-foreground">{methods.filter(m => m.is_active).length} active</span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`} />
      </button>

      {!collapsed && (
        <div className="space-y-2 pl-6">
          {methods.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-md border border-border p-3">
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 flex-shrink-0" />
              {m.image_url && (
                <img src={m.image_url} alt={m.name} className="h-8 w-8 rounded object-cover flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{m.name}</p>
                {m.link_url && (
                  <a href={m.link_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-muted-foreground hover:text-foreground truncate block">
                    {m.link_url}
                  </a>
                )}
              </div>
              <Switch checked={m.is_active} onCheckedChange={(v) => toggleActive(m.id, v)} />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete "{m.name}"?</AlertDialogTitle>
                    <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(m.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}

          {adding ? (
            <div className="rounded-md border border-border p-3 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Name</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. QRIS, Lynk, Gumroad" className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Link URL (optional)</Label>
                <Input value={newLink} onChange={(e) => setNewLink(e.target.value)} placeholder="https://..." className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Image (optional)</Label>
                <input type="file" accept="image/*" onChange={(e) => setNewImage(e.target.files?.[0] || null)} className="text-xs" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAdd} disabled={saving || !newName.trim()}>
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setNewName(""); setNewLink(""); setNewImage(null); }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Add payment method
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default PaymentMethodManager;
