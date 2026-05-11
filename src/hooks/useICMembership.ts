import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ICMembership {
  id: string;
  user_id: string;
  plan: string;
  starts_at: string;
  expires_at: string | null;
  granted_by: string | null;
  created_at: string;
}

export const useICMembership = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["ic-membership", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("ic_memberships" as any)
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data as unknown as ICMembership | null) ?? null;
    },
  });
};
