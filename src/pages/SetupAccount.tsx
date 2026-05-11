import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Step = "welcome" | "form" | "loading" | "complete";

const SetupAccount = () => {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [step, setStep] = useState<Step>("welcome");

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
    if (!loading && profile && (profile as any).is_setup_complete) navigate("/");
  }, [loading, user, profile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !username.trim()) return;
    setStep("loading");

    // Check username uniqueness
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username.trim().toLowerCase())
      .neq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      toast.error("Username already taken (╥﹏╥)");
      setStep("form");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        username: username.trim().toLowerCase(),
        display_name: displayName.trim() || username.trim(),
        is_setup_complete: true,
      } as any)
      .eq("user_id", user.id);

    if (error) {
      toast.error("Failed to set up account");
      setStep("form");
      return;
    }

    // Show "setting up" for a moment, then "complete"
    setTimeout(() => setStep("complete"), 1200);
  };

  if (loading) return null;

  // Step 1: Welcome
  if (step === "welcome") {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <p className="font-serif text-base leading-relaxed text-foreground">
            welcome.
          </p>
          <p className="mt-4 font-serif text-base leading-relaxed text-foreground">
            your personal key works.
            <br />
            one last small step.
          </p>
          <p className="mt-4 font-serif text-base leading-relaxed text-muted-foreground">
            let's set up your name
            <br />
            so others can find you here.
          </p>
          <button
            onClick={() => setStep("form")}
            className="mt-10 w-full border border-foreground bg-foreground py-3 text-sm font-medium text-background transition-opacity hover:opacity-80"
          >
            continue
          </button>
        </div>
      </div>
    );
  }

  // Step 3: Loading
  if (step === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <p className="font-serif text-base leading-relaxed text-foreground animate-pulse">
            setting up your account...
          </p>
        </div>
      </div>
    );
  }

  // Step 4: Complete
  if (step === "complete") {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <p className="font-serif text-base leading-relaxed text-foreground">
            all done. (◕‿◕)
          </p>
          <p className="mt-4 font-serif text-base leading-relaxed text-foreground">
            your account is ready.
          </p>
          <p className="mt-4 font-serif text-base leading-relaxed text-muted-foreground">
            happy reading
            <br />
            and writing.
          </p>
          <button
            onClick={() => navigate("/")}
            className="mt-10 w-full border border-foreground bg-foreground py-3 text-sm font-medium text-background transition-opacity hover:opacity-80"
          >
            enter sena
          </button>
        </div>
      </div>
    );
  }

  // Step 2: Form
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
          Setup Account
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You can change later
        </p>

        <form onSubmit={handleSubmit} className="mt-10 space-y-6">
          <input
            type="text"
            placeholder="username"
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/[^a-z0-9_]/gi, "").toLowerCase())}
            required
            className="w-full border-b border-border bg-transparent py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-foreground focus:outline-none transition-colors"
          />
          <input
            type="text"
            placeholder="display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full border-b border-border bg-transparent py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-foreground focus:outline-none transition-colors"
          />

          <button
            type="submit"
            disabled={!username.trim()}
            className="mt-4 w-full border border-foreground bg-foreground py-3 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            Set Up
          </button>
        </form>
      </div>
    </div>
  );
};

export default SetupAccount;
