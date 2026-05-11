import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

const Waitlist = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const startedAt = useRef<number>(Date.now());

  const { data: config } = useQuery({
    queryKey: ["site-settings", "waitlist_config"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "waitlist_config")
        .maybeSingle();
      return (data?.value as any) ?? { enabled: true, daily_limit: 200 };
    },
  });

  const isEnabled = config?.enabled !== false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEnabled) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("submit-waitlist", {
        body: {
          email: email.toLowerCase().trim(),
          website,
          startedAt: startedAt.current,
        },
      });

      if (error || (data as any)?.error) {
        const msg = (data as any)?.error || error?.message || "Something went wrong";
        toast.error(msg);
      } else {
        setQueuePosition((data as any)?.queue_position ?? null);
        setSubmitted(true);
      }
    } catch {
      toast.error("Something went wrong");
    }
    setLoading(false);
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <p className="font-serif text-base leading-relaxed text-foreground">
            your place is being prepared.
          </p>
          <p className="mt-4 font-serif text-base leading-relaxed text-foreground">
            no rush.
            <br />
            you can take your time here.
          </p>
          <p className="mt-4 font-serif text-base leading-relaxed text-foreground">
            we'll send your personal key by email
            <br />
            when it's ready.
          </p>
          {queuePosition !== null && (
            <p className="mt-6 font-serif text-base leading-relaxed text-foreground">
              your queue number:{" "}
              <span className="font-semibold">#{queuePosition}</span>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-xs text-center">
        <h1 className="font-serif text-xl font-bold leading-snug tracking-tight text-foreground">
          Join
          <br />
          Sena Slowblog
          <br />
          Waitlist
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Start your blog
        </p>

        {!isEnabled ? (
          <p className="mt-8 text-sm text-muted-foreground">
            registration is currently closed.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-10 space-y-8">
            {/* Honeypot — hidden from real users, bots fill it */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              aria-hidden="true"
              style={{
                position: "absolute",
                left: "-9999px",
                width: "1px",
                height: "1px",
                opacity: 0,
                pointerEvents: "none",
              }}
            />

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={254}
              className="w-full border-b border-border bg-transparent py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-foreground focus:outline-none transition-colors"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full border border-foreground bg-foreground py-3 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              {loading ? "..." : "waitlist"}
            </button>
          </form>
        )}

        <p className="mt-8 text-xs text-muted-foreground">
          have an account?{" "}
          <button
            onClick={() => navigate("/auth")}
            className="text-foreground underline underline-offset-4 hover:opacity-70 transition-opacity"
          >
            sign in
          </button>
        </p>
      </div>
    </div>
  );
};

export default Waitlist;
