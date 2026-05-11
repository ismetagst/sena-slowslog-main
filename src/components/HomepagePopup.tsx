import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";

interface PopupConfig {
  is_active: boolean;
  image_url: string | null;
  redirect_url: string | null;
}

const SESSION_KEY = "popup_dismissed";

const HomepagePopup = () => {
  const [popup, setPopup] = useState<PopupConfig | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) return;

    const fetch = async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "homepage_popup")
        .single();

      const config = data?.value as unknown as PopupConfig | null;
      if (config?.is_active && config?.image_url) {
        setPopup(config);
        setVisible(true);
      }
    };
    fetch();
  }, []);

  const handleClose = () => {
    setVisible(false);
    sessionStorage.setItem(SESSION_KEY, "1");
  };

  if (!visible || !popup) return null;

  const imageEl = (
    <img
      src={popup.image_url!}
      alt="Promotion"
      className="max-w-[90vw] max-h-[70vh] w-auto h-auto object-contain rounded-lg sm:max-w-[400px]"
    />
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 animate-in fade-in-0 duration-200"
      onClick={handleClose}
    >
      <div
        className="relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute -top-3 -right-3 z-10 rounded-full bg-background border shadow-md p-1.5 hover:bg-accent transition-colors"
          aria-label="Close popup"
        >
          <X className="h-4 w-4" />
        </button>

        {popup.redirect_url ? (
          <a
            href={popup.redirect_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block cursor-pointer"
          >
            {imageEl}
          </a>
        ) : (
          imageEl
        )}
      </div>
    </div>
  );
};

export default HomepagePopup;
