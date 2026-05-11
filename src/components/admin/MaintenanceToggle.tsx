import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Construction } from "lucide-react";

const MaintenanceToggle = () => {
  const qc = useQueryClient();

  const { data: enabled } = useQuery({
    queryKey: ["site-settings", "maintenance_mode"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "maintenance_mode")
        .single();
      return (data?.value as any)?.enabled === true;
    },
  });

  const toggle = async () => {
    const newValue = !enabled;
    const { data: existing } = await supabase
      .from("site_settings")
      .select("id")
      .eq("key", "maintenance_mode")
      .single();

    if (existing) {
      await supabase
        .from("site_settings")
        .update({ value: { enabled: newValue }, updated_at: new Date().toISOString() })
        .eq("key", "maintenance_mode");
    } else {
      await supabase
        .from("site_settings")
        .insert({ key: "maintenance_mode", value: { enabled: newValue } });
    }

    qc.invalidateQueries({ queryKey: ["site-settings", "maintenance_mode"] });
    toast.success(newValue ? "Maintenance mode enabled 🔧" : "Maintenance mode disabled (◕‿◕)");
  };

  return (
    <div className="rounded-lg border border-border p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <Construction className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-medium">Maintenance Mode</h3>
            <p className="text-xs text-muted-foreground">
              {enabled
                ? "Site is in maintenance — only founders & admins can access"
                : "Site is live and accessible to everyone"}
            </p>
          </div>
        </div>
        <Switch checked={enabled ?? false} onCheckedChange={toggle} />
      </div>
    </div>
  );
};

export default MaintenanceToggle;
