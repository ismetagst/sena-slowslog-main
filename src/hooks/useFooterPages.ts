import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FooterPage {
  id: string;
  slug: string;
  title: string;
  content: string;
  enabled: boolean;
  sort_order: number;
  updated_at: string;
}

export const useFooterPages = (onlyEnabled = true) => {
  return useQuery({
    queryKey: ["footer-pages", onlyEnabled],
    queryFn: async (): Promise<FooterPage[]> => {
      let q = supabase.from("footer_pages").select("*").order("sort_order", { ascending: true });
      if (onlyEnabled) q = q.eq("enabled", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as FooterPage[];
    },
  });
};

export const useFooterPage = (slug: string) => {
  return useQuery({
    queryKey: ["footer-page", slug],
    queryFn: async (): Promise<FooterPage | null> => {
      const { data, error } = await supabase
        .from("footer_pages")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return (data as FooterPage) || null;
    },
  });
};
