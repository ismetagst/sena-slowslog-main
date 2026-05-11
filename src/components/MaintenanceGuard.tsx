import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const ALLOWED_ROUTES = ["/auth", "/admin", "/settings"];

const MaintenancePage = () => (
  <div className="flex min-h-screen items-center justify-center px-6">
    <div className="text-center max-w-md space-y-6">
      <div className="space-y-2">
        <p className="font-serif text-lg text-foreground">No rush. No noise.</p>
        <p className="font-serif text-lg text-foreground">Just a little maintenance.</p>
      </div>
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">We'll be back soon.</p>
        <p className="text-sm text-muted-foreground">
          Maybe this is a good time to step away for a moment.
        </p>
      </div>
      <p className="text-2xl pt-2">(◕ᴗ◕✿)</p>
    </div>
  </div>
);

export const MaintenanceGuard = ({ children }: { children: ReactNode }) => {
  const { isFounder, isAdmin, loading: authLoading } = useAuth();
  const location = useLocation();
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase
      .from("site_settings")
      .select("value")
      .eq("key", "maintenance_mode")
      .single()
      .then(({ data }) => {
        setMaintenanceEnabled((data?.value as any)?.enabled === true);
        setLoaded(true);
      });
  }, []);

  if (!loaded || authLoading) return null;

  const isAllowedRoute = ALLOWED_ROUTES.some((r) => location.pathname.startsWith(r));

  if (maintenanceEnabled && !isFounder && !isAdmin && !isAllowedRoute) {
    return <MaintenancePage />;
  }

  return <>{children}</>;
};
