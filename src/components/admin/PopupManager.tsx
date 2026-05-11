import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Trash2, Upload, ExternalLink, Monitor, Smartphone, ChevronDown, Image } from "lucide-react";

interface PopupConfig {
  is_active: boolean;
  image_url: string | null;
  redirect_url: string | null;
}

const DEFAULT_CONFIG: PopupConfig = {
  is_active: false,
  image_url: null,
  redirect_url: null,
};

const PopupManager = () => {
  const [config, setConfig] = useState<PopupConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "homepage_popup")
      .single();
    if (data?.value) {
      setConfig(data.value as unknown as PopupConfig);
    }
    setLoading(false);
  };

  const saveConfig = async (newConfig: PopupConfig) => {
    setSaving(true);
    const { error } = await supabase
      .from("site_settings")
      .upsert(
        { key: "homepage_popup", value: newConfig as any, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
    setSaving(false);
    if (error) {
      toast.error("Failed to save popup settings");
      return;
    }
    setConfig(newConfig);
    toast.success("Popup settings saved");
  };

  const handleToggle = (checked: boolean) => {
    if (checked && !config.image_url) {
      toast.error("Upload an image first");
      return;
    }
    saveConfig({ ...config, is_active: checked });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `popup/popup-image.${ext}`;

    // Delete old file first
    await supabase.storage.from("story-images").remove([path]);

    const { error } = await supabase.storage
      .from("story-images")
      .upload(path, file, { upsert: true });

    if (error) {
      toast.error("Upload failed");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("story-images")
      .getPublicUrl(path);

    const imageUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    setUploading(false);
    saveConfig({ ...config, image_url: imageUrl });
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDelete = async () => {
    await supabase.storage.from("story-images").remove(["popup/popup-image.png", "popup/popup-image.jpg", "popup/popup-image.jpeg", "popup/popup-image.webp"]);
    saveConfig({ is_active: false, image_url: null, redirect_url: null });
  };

  const handleRedirectChange = (url: string) => {
    setConfig((prev) => ({ ...prev, redirect_url: url || null }));
  };

  const saveRedirect = () => {
    saveConfig(config);
  };

  if (loading)
    return <p className="text-sm text-muted-foreground">Loading popup settings...</p>;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="space-y-3">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-lg border border-border px-5 py-4 text-left hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Image className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-medium">Homepage Popup</h3>
              <p className="text-xs text-muted-foreground">
                {config.is_active ? "Active" : "Inactive"}
              </p>
            </div>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-4">
        <div className="rounded-lg border border-border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-sm">Homepage Popup</h3>
              <p className="text-xs text-muted-foreground">Show a promotional popup on the homepage</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {config.is_active ? "Active" : "Inactive"}
              </span>
              <Switch
                checked={config.is_active}
                onCheckedChange={handleToggle}
                disabled={saving}
              />
            </div>
          </div>

          {/* Upload */}
          <div className="space-y-2">
            <label className="text-xs font-medium">Popup Image (1:1 ratio recommended, transparent PNG preferred)</label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="h-3 w-3 mr-1" />
                {uploading ? "Uploading..." : "Upload Image"}
              </Button>
              {config.image_url && (
                <Button variant="destructive" size="sm" onClick={handleDelete} disabled={saving}>
                  <Trash2 className="h-3 w-3 mr-1" /> Delete
                </Button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
            />
          </div>

          {/* Redirect URL */}
          <div className="space-y-2">
            <label className="text-xs font-medium flex items-center gap-1">
              <ExternalLink className="h-3 w-3" /> Redirect URL (optional)
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="https://example.com"
                value={config.redirect_url || ""}
                onChange={(e) => handleRedirectChange(e.target.value)}
                className="text-xs h-8"
              />
              <Button variant="outline" size="sm" onClick={saveRedirect} disabled={saving}>
                Save
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              If filled, clicking the image will redirect to this URL. If empty, image is display only.
            </p>
          </div>

          {/* Preview */}
          {config.image_url && (
            <div className="space-y-2">
              <label className="text-xs font-medium">Preview</label>
              <div className="grid grid-cols-2 gap-4">
                {/* Web preview */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Monitor className="h-3 w-3" /> Web
                  </div>
                  <div className="border rounded-lg p-4 bg-black/5 flex items-center justify-center" style={{ aspectRatio: "16/10" }}>
                    <img
                      src={config.image_url}
                      alt="Popup preview web"
                      className="max-w-[60%] max-h-[80%] object-contain rounded"
                    />
                  </div>
                </div>
                {/* Mobile preview */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Smartphone className="h-3 w-3" /> Mobile
                  </div>
                  <div className="border rounded-lg p-4 bg-black/5 flex items-center justify-center mx-auto" style={{ aspectRatio: "9/16", maxWidth: "120px" }}>
                    <img
                      src={config.image_url}
                      alt="Popup preview mobile"
                      className="max-w-[80%] max-h-[60%] object-contain rounded"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default PopupManager;
