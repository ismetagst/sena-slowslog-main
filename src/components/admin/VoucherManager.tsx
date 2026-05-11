import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Ticket, Copy } from "lucide-react";

interface Voucher {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
  created_at: string;
}

const VoucherManager = () => {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"fixed" | "percentage">("fixed");
  const [discountValue, setDiscountValue] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: vouchers = [], refetch } = useQuery({
    queryKey: ["admin-vouchers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("vouchers")
        .select("*")
        .order("created_at", { ascending: false });
      return (data || []) as Voucher[];
    },
  });

  const generateCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let result = "IC-";
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCode(result);
  };

  const handleCreate = async () => {
    if (!code.trim() || !discountValue) return;
    const val = parseFloat(discountValue);
    if (isNaN(val) || val <= 0) {
      toast.error("Invalid discount value");
      return;
    }
    if (discountType === "percentage" && val > 100) {
      toast.error("Percentage cannot exceed 100%");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("vouchers").insert({
        code: code.trim().toUpperCase(),
        discount_type: discountType,
        discount_value: val,
        max_uses: maxUses ? parseInt(maxUses) : null,
      } as any);
      if (error) throw error;
      toast.success("Voucher created (★‿★)");
      setShowForm(false);
      setCode("");
      setDiscountValue("");
      setMaxUses("");
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to create voucher");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    await supabase.from("vouchers").update({ is_active: !currentActive } as any).eq("id", id);
    toast.success(currentActive ? "Voucher deactivated" : "Voucher activated");
    refetch();
  };

  const deleteVoucher = async (id: string) => {
    await supabase.from("vouchers").delete().eq("id", id);
    toast.success("Voucher deleted");
    refetch();
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Copied!");
  };

  const formatDiscount = (v: Voucher) => {
    if (v.discount_type === "percentage") return `${v.discount_value}%`;
    return `Rp. ${Number(v.discount_value).toLocaleString("id-ID")}`;
  };

  return (
    <div className="rounded-lg border border-border p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(280,60%,92%)]">
            <Ticket className="h-5 w-5 text-[hsl(280,60%,50%)]" />
          </div>
          <div>
            <h3 className="text-sm font-medium">Voucher Management</h3>
            <p className="text-xs text-muted-foreground">
              {vouchers.filter((v) => v.is_active).length} active voucher(s)
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => { setShowForm(!showForm); if (!showForm) generateCode(); }}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          New
        </Button>
      </div>

      {showForm && (
        <div className="mt-4 space-y-3 rounded-lg border border-dashed border-border p-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Voucher Code</Label>
            <div className="flex gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="IC-XXXXXX"
                className="font-mono text-sm"
              />
              <Button size="sm" variant="outline" onClick={generateCode} className="text-xs flex-shrink-0">
                Generate
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Discount Type</Label>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as "fixed" | "percentage")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="fixed">Fixed (Rp)</option>
                <option value="percentage">Percentage (%)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                {discountType === "fixed" ? "Amount (Rp)" : "Percentage (%)"}
              </Label>
              <Input
                type="number"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === "fixed" ? "50000" : "25"}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Max Uses (leave empty for unlimited)</Label>
            <Input
              type="number"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder="Unlimited"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)} className="flex-1">
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={submitting || !code.trim() || !discountValue} className="flex-1">
              {submitting ? "Creating..." : "Create Voucher"}
            </Button>
          </div>
        </div>
      )}

      {vouchers.length > 0 && (
        <div className="mt-4 divide-y divide-border rounded-md border border-border">
          {vouchers.map((v) => (
            <div key={v.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">{v.code}</code>
                  <button onClick={() => copyCode(v.code)} className="text-muted-foreground hover:text-foreground">
                    <Copy className="h-3 w-3" />
                  </button>
                  <span className={`text-[10px] font-medium ${v.is_active ? "text-[hsl(140,50%,40%)]" : "text-muted-foreground"}`}>
                    {v.is_active ? "active" : "inactive"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  -{formatDiscount(v)} · {v.used_count}/{v.max_uses ?? "∞"} used
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Switch
                  checked={v.is_active}
                  onCheckedChange={() => toggleActive(v.id, v.is_active)}
                />
                <button
                  onClick={() => deleteVoucher(v.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VoucherManager;
