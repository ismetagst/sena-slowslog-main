import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Rate limit thresholds
const MAX_PER_IP_PER_HOUR = 3;
const MAX_PER_IP_PER_DAY = 5;
const MIN_SECONDS_BETWEEN_SUBMITS_PER_IP = 30;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "tempmail.com", "10minutemail.com", "guerrillamail.com",
  "throwawaymail.com", "yopmail.com", "trashmail.com", "fakeinbox.com",
  "maildrop.cc", "getnada.com", "dispostable.com",
]);

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const ua = req.headers.get("user-agent")?.slice(0, 255) ?? null;

    let body: any;
    try { body = await req.json(); } catch { return json({ error: "Invalid request" }, 400); }

    const email = String(body?.email ?? "").trim().toLowerCase();
    const honeypot = String(body?.website ?? ""); // hidden field — bots fill this
    const startedAt = Number(body?.startedAt ?? 0); // client timestamp when form opened

    // ── Honeypot — silent reject ─────────────────────────────
    if (honeypot.length > 0) {
      await supabase.from("waitlist_attempts").insert({
        email: email || "honeypot", ip_address: ip, user_agent: ua, success: false,
      });
      return json({ ok: true }); // pretend success
    }

    // ── Time-on-form heuristic — bots submit instantly ──────
    if (startedAt > 0 && Date.now() - startedAt < 1500) {
      await supabase.from("waitlist_attempts").insert({
        email: email || "too_fast", ip_address: ip, user_agent: ua, success: false,
      });
      return json({ error: "Please take a moment before submitting." }, 400);
    }

    // ── Email format ────────────────────────────────────────
    if (!email || !EMAIL_RE.test(email) || email.length > 254) {
      return json({ error: "Invalid email address." }, 400);
    }
    const domain = email.split("@")[1];
    if (DISPOSABLE_DOMAINS.has(domain)) {
      return json({ error: "Disposable email addresses are not allowed." }, 400);
    }

    // ── Waitlist config check ───────────────────────────────
    const { data: settings } = await supabase
      .from("site_settings").select("value").eq("key", "waitlist_config").maybeSingle();
    const cfg = (settings?.value as any) ?? { enabled: true, daily_limit: 200 };
    if (cfg.enabled === false) {
      return json({ error: "Registration is currently closed." }, 403);
    }

    const nowMs = Date.now();
    const hourAgo = new Date(nowMs - 60 * 60 * 1000).toISOString();
    const dayAgo = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();
    const cooldown = new Date(nowMs - MIN_SECONDS_BETWEEN_SUBMITS_PER_IP * 1000).toISOString();

    if (ip !== "unknown") {
      // Cooldown between submits
      const { count: recent } = await supabase
        .from("waitlist_attempts")
        .select("*", { count: "exact", head: true })
        .eq("ip_address", ip)
        .gte("created_at", cooldown);
      if ((recent ?? 0) > 0) {
        return json({ error: "Too many requests. Please wait a moment." }, 429);
      }

      const { count: hourly } = await supabase
        .from("waitlist_attempts")
        .select("*", { count: "exact", head: true })
        .eq("ip_address", ip)
        .gte("created_at", hourAgo);
      if ((hourly ?? 0) >= MAX_PER_IP_PER_HOUR) {
        return json({ error: "Hourly limit reached. Try again later." }, 429);
      }

      const { count: daily } = await supabase
        .from("waitlist_attempts")
        .select("*", { count: "exact", head: true })
        .eq("ip_address", ip)
        .gte("created_at", dayAgo);
      if ((daily ?? 0) >= MAX_PER_IP_PER_DAY) {
        return json({ error: "Daily limit reached. Try again tomorrow." }, 429);
      }
    }

    // ── Email already used (any time) ───────────────────────
    const { count: emailExists } = await supabase
      .from("waitlist_attempts")
      .select("*", { count: "exact", head: true })
      .eq("email", email)
      .eq("success", true);
    if ((emailExists ?? 0) > 0) {
      // Log attempt but return generic
      await supabase.from("waitlist_attempts").insert({
        email, ip_address: ip, user_agent: ua, success: false,
      });
      return json({ error: "This email is already on the waitlist." }, 409);
    }

    // ── Daily site-wide limit (existing rule) ───────────────
    const { count: today } = await supabase
      .from("waitlist")
      .select("*", { count: "exact", head: true })
      .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString());
    const limit = cfg.daily_limit ?? 200;
    if ((today ?? 0) >= limit) {
      return json({ error: "Daily registration limit reached. Try again tomorrow." }, 429);
    }

    // ── Insert waitlist ─────────────────────────────────────
    const { error: insErr } = await supabase
      .from("waitlist").insert({ email });

    if (insErr) {
      await supabase.from("waitlist_attempts").insert({
        email, ip_address: ip, user_agent: ua, success: false,
      });
      if (insErr.code === "23505") {
        return json({ error: "This email is already on the waitlist." }, 409);
      }
      return json({ error: insErr.message }, 400);
    }

    await supabase.from("waitlist_attempts").insert({
      email, ip_address: ip, user_agent: ua, success: true,
    });

    const { data: pending } = await supabase.rpc("get_pending_waitlist_count");

    return json({ ok: true, queue_position: pending ?? null });
  } catch (e) {
    return json({ error: (e as Error).message ?? "Server error" }, 500);
  }
});
