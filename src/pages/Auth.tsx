import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const GENERIC_LOGIN_ERROR = "Email atau personal key tidak valid.";

const Auth = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [personalKey, setPersonalKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotConfirm, setForgotConfirm] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSubmitted, setForgotSubmitted] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);

  const checkLockout = async (emailToCheck: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke("manage-registration", {
        body: { action: "check_lockout", email: emailToCheck },
      });
      if (error) return false;
      if (data?.locked) {
        setLockedUntil(`Terlalu banyak percobaan. Coba lagi dalam ${data.remaining_minutes} menit.`);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const recordFailedLogin = async (emailToRecord: string) => {
    try {
      const { data } = await supabase.functions.invoke("manage-registration", {
        body: { action: "record_failed_login", email: emailToRecord },
      });
      if (data?.locked) {
        setLockedUntil(`Terlalu banyak percobaan. Coba lagi dalam 15 menit.`);
      }
    } catch {
      // silent
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    const locked = await checkLockout(email.trim().toLowerCase());
    if (locked) {
      toast.error(lockedUntil || "Akun dikunci sementara.");
      return;
    }
    setLockedUntil(null);
    setKeyDialogOpen(true);
  };

  const handleLogin = async () => {
    if (!personalKey) return;
    setLoading(true);

    const normalizedEmail = email.trim().toLowerCase();

    // Check lockout before attempting
    const locked = await checkLockout(normalizedEmail);
    if (locked) {
      toast.error(lockedUntil || "Akun dikunci sementara.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: personalKey,
    });

    if (error) {
      // Record failed attempt — generic error message
      await recordFailedLogin(normalizedEmail);
      toast.error(GENERIC_LOGIN_ERROR);
      setLoading(false);
      return;
    }

    if (data.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_setup_complete")
        .eq("user_id", data.user.id)
        .single();

      if (!(profile as any)?.is_setup_complete) {
        navigate("/setup-account");
      } else {
        navigate("/");
      }
    }
    setLoading(false);
    setKeyDialogOpen(false);
  };

  const handleForgotSubmit = async () => {
    if (forgotConfirm !== "forgot-personal-key") return;
    setForgotLoading(true);

    const { data, error } = await supabase.functions.invoke("manage-registration", {
      body: { action: "submit_forgot", email: forgotEmail.trim().toLowerCase() },
    });

    setForgotLoading(false);
    if (error || data?.error) {
      const msg = data?.error || "Failed to submit request";
      toast.error(msg);
    } else {
      setForgotSubmitted(true);
      toast.success("Request submitted. An admin will assist you.");
    }
    setForgotOpen(false);
    setForgotConfirm("");
    setForgotEmail("");
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-xs">
        <div className="mb-12 text-center">
          <h1 className="font-serif text-xl font-bold tracking-tight text-foreground">
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your email to continue
          </p>
        </div>

        <form onSubmit={handleEmailSubmit} className="space-y-5">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border-b border-border bg-transparent py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-foreground focus:outline-none transition-colors"
          />

          {lockedUntil && (
            <p className="text-xs text-destructive">{lockedUntil}</p>
          )}

          <div className="pt-4">
            <button
              type="submit"
              className="w-full border border-foreground bg-foreground py-3 text-sm font-medium text-background transition-opacity hover:opacity-80"
            >
              Login
            </button>
          </div>
        </form>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          No account?{" "}
          <button
            onClick={() => navigate("/waitlist")}
            className="text-foreground underline underline-offset-4 hover:opacity-70 transition-opacity"
          >
            sign up
          </button>
        </p>

        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground italic">
            Don't tell me you forgot your Personal Key? (╥﹏╥)
          </p>
          <button
            onClick={() => setForgotOpen(true)}
            className="mt-1 text-xs text-foreground underline underline-offset-4 hover:opacity-70 transition-opacity"
          >
            Click here to find it again.
          </button>
        </div>
      </div>

      {/* Personal Key Dialog */}
      <AlertDialog open={keyDialogOpen} onOpenChange={(open) => {
        setKeyDialogOpen(open);
        if (!open) { setPersonalKey(""); setShowKey(false); }
      }}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Personal Key</AlertDialogTitle>
            <AlertDialogDescription>
              Enter your personal key to sign in as{" "}
              <span className="font-medium text-foreground">{email}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                placeholder="Enter your personal key"
                value={personalKey}
                onChange={(e) => setPersonalKey(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
                autoFocus
                className="w-full border-b border-border bg-transparent py-2 pr-8 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-foreground focus:outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {lockedUntil && (
              <p className="mt-2 text-xs text-destructive">{lockedUntil}</p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogin}
              disabled={!personalKey || loading || !!lockedUntil}
              className="bg-foreground text-background hover:bg-foreground/80"
            >
              {loading ? "..." : "Enter"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Forgot Personal Key Dialog */}
      <AlertDialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Forgot Personal Key</AlertDialogTitle>
            <AlertDialogDescription>
              Enter your email and type <span className="font-mono font-medium text-foreground">"forgot-personal-key"</span> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <input
              type="email"
              placeholder="Your email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              className="w-full border-b border-border bg-transparent py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-foreground focus:outline-none transition-colors"
            />
            <input
              type="text"
              placeholder='Type "forgot-personal-key"'
              value={forgotConfirm}
              onChange={(e) => setForgotConfirm(e.target.value)}
              className="w-full border-b border-border bg-transparent py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-foreground focus:outline-none transition-colors font-mono"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleForgotSubmit}
              disabled={forgotConfirm !== "forgot-personal-key" || !forgotEmail || forgotLoading}
              className="bg-foreground text-background hover:bg-foreground/80"
            >
              {forgotLoading ? "..." : "Submit"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Auth;
