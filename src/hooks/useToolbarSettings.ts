import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ToolbarSettings {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  bullet_list: boolean;
  blockquote: boolean;
  link: boolean;
  kaomoji: boolean;
  image: boolean;
  /** when true, image upload is restricted to Inner Circle members */
  image_ic_only: boolean;
}

export const TOOLBAR_DEFAULTS: ToolbarSettings = {
  bold: true,
  italic: true,
  underline: true,
  strikethrough: true,
  bullet_list: true,
  blockquote: true,
  link: true,
  kaomoji: true,
  image: true,
  image_ic_only: true,
};

export const TOOLBAR_LABELS: Record<keyof ToolbarSettings, string> = {
  bold: "Bold (B)",
  italic: "Italic (I)",
  underline: "Underline (U)",
  strikethrough: "Strikethrough",
  bullet_list: "Bullet list",
  blockquote: "Quote (kutipan)",
  link: "Insert link",
  kaomoji: "Kaomoji picker",
  image: "Insert image",
  image_ic_only: "Image: Inner Circle only",
};

export const useToolbarSettings = () => {
  return useQuery({
    queryKey: ["site-settings", "editor_toolbar"],
    queryFn: async (): Promise<ToolbarSettings> => {
      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "editor_toolbar")
        .maybeSingle();
      const value = (data?.value as Partial<ToolbarSettings>) || {};
      return { ...TOOLBAR_DEFAULTS, ...value };
    },
  });
};
