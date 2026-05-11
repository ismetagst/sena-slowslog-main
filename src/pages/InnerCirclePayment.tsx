import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Upload, Loader2, Ticket, X, ExternalLink, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { compressImage } from "@/lib/image-compress";

const plans: Record<string, { name: string; price: string; period: string; amount: number }> = {
  yearly: { name: "1 Year", price: "Rp. 99.000", period: "/year", amount: 99000 },
  forever: { name: "Lifetime", price: "Rp. 299.000", period: " one-time", amount: 299000 },
};

const formatRupiah = (val: number) => `Rp. ${val.toLocaleString("id-ID")}`;

interface PaymentMethod {
  id: string;
  name: string;
  image_url: string | null;
  link_url: string | null;
  is_active: boolean;
  sort_order: number;
}

const PaymentMethodSelector = () => {
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);

  const { data: methods } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payment_methods")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      return (data as unknown as PaymentMethod[]) || [];
    },
  });

  if (!methods?.length) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-6 text-center">
        <p className="text-sm text-muted-foreground">No payment methods available yet.</p>
      </div>
    );
  }

  const activeMethod = methods.find((m) => m.id === selectedMethod);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <CreditCard className="h-4 w-4" />
        Pilih Pembayaran
      </div>
      <div className="grid gap-2">
        {methods.map((m) => (
          <button
            key={m.id}
            onClick={() => setSelectedMethod(selectedMethod === m.id ? null : m.id)}
            className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
              selectedMethod === m.id
                ? "border-foreground bg-muted/50"
                : "border-border hover:border-muted-foreground/50"
            }`}
          >
            {m.image_url && (
              <img src={m.image_url} alt={m.name} className="h-6 w-6 rounded object-cover flex-shrink-0" />
            )}
            <span className="text-sm font-medium flex-1">{m.name}</span>
            {m.link_url && (
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
        ))}
      </div>

      {activeMethod && (
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
          {activeMethod.image_url && !activeMethod.link_url && (
            <div className="mx-auto overflow-hidden rounded-lg border border-border bg-background">
              <img
                src={activeMethod.image_url}
                alt={activeMethod.name}
                className="w-full max-w-xs mx-auto"
              />
            </div>
          )}
          {activeMethod.link_url && (
            <a
              href={activeMethod.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium hover:bg-muted transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Open {activeMethod.name}
            </a>
          )}
          {activeMethod.image_url && activeMethod.link_url && (
            <div className="mx-auto overflow-hidden rounded-lg border border-border bg-background">
              <img
                src={activeMethod.image_url}
                alt={activeMethod.name}
                className="w-full max-w-xs mx-auto"
              />
            </div>
          )}
          <p className="text-xs text-muted-foreground text-center">
            {activeMethod.link_url ? "Click above to proceed with payment" : "Scan to pay"}
          </p>
        </div>
      )}
    </div>
  );
};

const VoucherSection = ({
  voucherApplied,
  voucherCode,
  voucherError,
  voucherLoading,
  onApply,
  onRemove,
  onCodeChange,
  formatRupiah,
}: {
  voucherApplied: { code: string; discount_type: string; discount_value: number } | null;
  voucherCode: string;
  voucherError: string;
  voucherLoading: boolean;
  onApply: () => void;
  onRemove: () => void;
  onCodeChange: (v: string) => void;
  formatRupiah: (v: number) => string;
}) => (
  <div className="space-y-2">
    <Label className="flex items-center gap-1.5">
      <Ticket className="h-3.5 w-3.5" />
      Voucher Code
    </Label>
    {voucherApplied ? (
      <div className="flex items-center justify-between rounded-lg border border-[hsl(140,50%,75%)] bg-[hsl(140,50%,95%)] px-3 py-2.5">
        <div>
          <code className="text-sm font-medium">{voucherApplied.code}</code>
          <p className="text-xs text-[hsl(140,50%,30%)]">
            -{voucherApplied.discount_type === "percentage"
              ? `${voucherApplied.discount_value}%`
              : formatRupiah(voucherApplied.discount_value)
            } discount applied!
          </p>
        </div>
        <button onClick={onRemove} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
    ) : (
      <div className="flex gap-2">
        <Input
          value={voucherCode}
          onChange={(e) => onCodeChange(e.target.value.toUpperCase())}
          placeholder="Enter voucher code"
          className="font-mono text-sm"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={onApply}
          disabled={voucherLoading || !voucherCode.trim()}
          className="flex-shrink-0"
        >
          {voucherLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Apply"}
        </Button>
      </div>
    )}
    {voucherError && <p className="text-xs text-destructive">{voucherError}</p>}
  </div>
);

const InnerCirclePayment = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planId = searchParams.get("plan");
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const [proofFile, setProofFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [voucherCode, setVoucherCode] = useState("");
  const [voucherApplied, setVoucherApplied] = useState<{
    code: string;
    discount_type: string;
    discount_value: number;
  } | null>(null);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherError, setVoucherError] = useState("");

  const plan = planId ? plans[planId] : null;

  if (!plan || !user) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">Invalid payment link.</p>
            <Button variant="outline" onClick={() => navigate("/inner-circle")}>
              Back to Inner Circle
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const discountAmount = voucherApplied
    ? voucherApplied.discount_type === "percentage"
      ? Math.round((plan.amount * voucherApplied.discount_value) / 100)
      : Math.min(voucherApplied.discount_value, plan.amount)
    : 0;
  const finalPrice = Math.max(0, plan.amount - discountAmount);

  const handleApplyVoucher = async () => {
    if (!voucherCode.trim()) return;
    setVoucherLoading(true);
    setVoucherError("");
    try {
      const { data, error } = await supabase.rpc("validate_voucher", {
        p_code: voucherCode.trim(),
      });
      if (error) throw error;
      const result = data as any;
      if (!result?.valid) { setVoucherError(result?.error || "Voucher not found or inactive"); return; }
      setVoucherApplied({
        code: result.code,
        discount_type: result.discount_type,
        discount_value: Number(result.discount_value),
      });
      toast.success("Voucher applied! (◕ᴗ◕✿)");
    } catch (err: any) {
      setVoucherError(err.message || "Failed to validate voucher");
    } finally { setVoucherLoading(false); }
  };

  const removeVoucher = () => { setVoucherApplied(null); setVoucherCode(""); setVoucherError(""); };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setProofFile(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  };

  const handleSubmit = async () => {
    if (!proofFile || !planId) return;
    setSubmitting(true);
    try {
      const compressed = await compressImage(proofFile);
      const ext = proofFile.name.split(".").pop() || "jpg";
      const filePath = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("transfer-proofs").upload(filePath, compressed);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("transfer-proofs").getPublicUrl(filePath);
      const { error: insertError } = await supabase.from("ic_orders").insert({
        user_id: user.id,
        email: user.email || "",
        plan: planId,
        transfer_proof_url: urlData.publicUrl,
        voucher_code: voucherApplied?.code || null,
        discount_amount: discountAmount,
        final_price: finalPrice,
      } as any);
      if (insertError) throw insertError;
      if (voucherApplied) {
        await supabase.rpc("increment_voucher_usage" as any, { p_code: voucherApplied.code });
      }
      queryClient.invalidateQueries({ queryKey: ["ic-order-pending"] });
      toast.success("Order submitted! We'll review it soon (◕ᴗ◕✿)");
      navigate("/inner-circle");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit order");
    } finally { setSubmitting(false); }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <section className="mx-auto max-w-lg px-6 py-12">
          <button
            onClick={() => navigate("/inner-circle")}
            className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <h1 className="font-serif text-2xl font-medium tracking-tight">
            Complete Your Order
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {plan.name} — {plan.price}
            <span className="text-xs">{plan.period}</span>
          </p>

          <div className="mt-8 space-y-6">
            {/* User Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" value={profile?.username || "—"} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user.email || "—"} disabled className="bg-muted" />
              </div>
            </div>

            {/* Payment Methods */}
            <PaymentMethodSelector />

            {/* Voucher Section */}
            <VoucherSection
              voucherApplied={voucherApplied}
              voucherCode={voucherCode}
              voucherError={voucherError}
              voucherLoading={voucherLoading}
              onApply={handleApplyVoucher}
              onRemove={removeVoucher}
              onCodeChange={(v) => { setVoucherCode(v); setVoucherError(""); }}
              formatRupiah={formatRupiah}
            />

            {/* Upload Transfer Proof */}
            <div className="space-y-2">
              <Label>Upload Transfer Proof</Label>
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-6 transition-colors hover:border-muted-foreground/50">
                {previewUrl ? (
                  <img src={previewUrl} alt="Transfer proof preview" className="max-h-48 rounded-lg object-contain" />
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Click to upload transfer screenshot</span>
                  </>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </label>
              {proofFile && (
                <p className="text-xs text-muted-foreground truncate">{proofFile.name}</p>
              )}
            </div>

            {/* Price Summary - Always visible */}
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-medium">{plan.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Price</span>
                <span>{plan.price}</span>
              </div>
              {voucherApplied && (
                <div className="flex justify-between text-[hsl(140,50%,40%)]">
                  <span>Discount ({voucherApplied.code})</span>
                  <span>-{formatRupiah(discountAmount)}</span>
                </div>
              )}
              <div className="border-t border-border pt-1.5 flex justify-between font-medium">
                <span>Total</span>
                <span>{formatRupiah(finalPrice)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => navigate("/inner-circle")} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!proofFile || submitting}
                className="flex-1 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Order"}
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default InnerCirclePayment;
