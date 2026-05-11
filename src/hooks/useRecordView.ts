import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const getDeviceType = (): string => {
  const ua = navigator.userAgent;
  if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) return "mobile";
  return "desktop";
};

export const useRecordView = (storyId: string | undefined) => {
  useEffect(() => {
    if (!storyId) return;

    const record = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.rpc("record_story_view", {
        p_story_id: storyId,
        p_viewer_id: user.id,
        p_device_type: getDeviceType(),
      });
    };

    record();
  }, [storyId]);
};
