import { useEffect, useState } from "react";
import { ChevronDown, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  TOOLBAR_DEFAULTS,
  TOOLBAR_LABELS,
  type ToolbarSettings,
} from "@/hooks/useToolbarSettings";

const FEATURE_KEYS: (keyof ToolbarSettings)[] = [
  "bold",
  "italic",
  "underline",
  "strikethrough",
  "bullet_list",
  "blockquote",
  "link",
  "kaomoji",
  "image",
];

const ToolbarSettingsManager = () => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<ToolbarSettings>(TOOLBAR_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "editor_toolbar")
        .maybeSingle();
      const value = (data?.value as Partial<ToolbarSettings>) || {};
      setSettings({ ...TOOLBAR_DEFAULTS, ...value });
      setLoading(false);
    })();
  }, []);

  const updateSetting = async (key: keyof ToolbarSettings, value: boolean) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    setSaving(true);
    const { error } = await supabase
      .from("site_settings")
      .upsert({ key: "editor_toolbar", value: next as any }, { onConflict: "key" });
    setSaving(false);
    if (error) {
      toast.error("failed to save");
      setSettings(settings);
    } else {
      toast.success("saved ✓");
      qc.invalidateQueries({ queryKey: ["site-settings", "editor_toolbar"] });
    }
  };

  return (
    <div className="rounded-lg border border-border">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between p-5 text-left hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Wrench className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-medium">Editor Toolbar</h3>
              <p className="text-xs text-muted-foreground">
                Enable / disable formatting buttons in the writing editor
              </p>
            </div>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border px-5 py-4 space-y-3">
            {loading ? (
              <p className="text-xs text-muted-foreground">loading...</p>
            ) : (
              <>
                {FEATURE_KEYS.map((key) => (
                  <div key={key} className="flex items-center justify-between py-1">
                    <label className="text-sm">{TOOLBAR_LABELS[key]}</label>
                    <Switch
                      checked={settings[key]}
                      disabled={saving}
                      onCheckedChange={(v) => updateSetting(key, v)}
                    />
                  </div>
                ))}

                {/* Image gating sub-option, only visible when image enabled */}
                {settings.image && (
                  <div className="mt-2 rounded-md border border-dashed border-border bg-muted/20 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm">{TOOLBAR_LABELS.image_ic_only}</label>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          When ON: only Inner Circle members can insert images.
                          When OFF: available to all writers.
                        </p>
                      </div>
                      <Switch
                        checked={settings.image_ic_only}
                        disabled={saving}
                        onCheckedChange={(v) => updateSetting("image_ic_only", v)}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default ToolbarSettingsManager;
