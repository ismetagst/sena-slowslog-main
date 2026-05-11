import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function generateKey(length = 20): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join("");
}

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const MAX_FORGOT_PER_EMAIL_PER_DAY = 3;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get caller identity
    const authHeader = req.headers.get("Authorization");
    let callerId: string | null = null;

    if (authHeader) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const {
        data: { user },
      } = await userClient.auth.getUser();
      callerId = user?.id || null;
    }

    // Get client IP from headers
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const body = await req.json();
    const { action, ...params } = body;

    const isAdminOrFounder = async (): Promise<boolean> => {
      if (!callerId) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", callerId)
        .in("role", ["founder", "admin"]);
      return (data?.length || 0) > 0;
    };

    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    // ── CHECK LOGIN LOCKOUT ─────────────────────────────────
    if (action === "check_lockout") {
      const { email } = params;
      if (!email) return json({ error: "Email required" }, 400);

      // Lockout is per (email, ip) so attackers from foreign IPs can't trigger it.
      const cutoff = new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("login_attempts")
        .select("*", { count: "exact", head: true })
        .eq("email", email.trim().toLowerCase())
        .eq("ip_address", clientIp)
        .gte("attempted_at", cutoff);

      const isLocked = (count || 0) >= MAX_LOGIN_ATTEMPTS;
      return json({ locked: isLocked, remaining_minutes: isLocked ? LOCKOUT_MINUTES : 0 });
    }

    // ── RECORD FAILED LOGIN ─────────────────────────────────
    if (action === "record_failed_login") {
      const { email } = params;
      if (!email) return json({ error: "Email required" }, 400);

      const normalizedEmail = email.trim().toLowerCase();

      // Per-IP throttle: prevent attacker from locking out arbitrary emails.
      // Cap inserts at 20 per IP per minute regardless of email.
      if (clientIp && clientIp !== "unknown") {
        const minuteAgo = new Date(Date.now() - 60_000).toISOString();
        const { count: ipCount } = await supabase
          .from("login_attempts")
          .select("*", { count: "exact", head: true })
          .eq("ip_address", clientIp)
          .gte("attempted_at", minuteAgo);
        if ((ipCount || 0) >= 20) {
          return json({ locked: false, attempts: 0, max: MAX_LOGIN_ATTEMPTS }, 429);
        }
      }

      // Record the attempt
      await supabase.from("login_attempts").insert({
        email: normalizedEmail,
        ip_address: clientIp,
      } as any);

      // Lockout requires MAX_LOGIN_ATTEMPTS failures from the SAME IP for the same email,
      // so an attacker pinging from foreign IPs can't lock out a legitimate user.
      const cutoff = new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("login_attempts")
        .select("*", { count: "exact", head: true })
        .eq("email", normalizedEmail)
        .eq("ip_address", clientIp)
        .gte("attempted_at", cutoff);

      const isLocked = (count || 0) >= MAX_LOGIN_ATTEMPTS;
      return json({ locked: isLocked, attempts: count || 0, max: MAX_LOGIN_ATTEMPTS });
    }

    // ── APPROVE ──────────────────────────────────────────────
    if (action === "approve") {
      if (!(await isAdminOrFounder())) return json({ error: "Unauthorized" }, 403);

      const { waitlist_id } = params;
      const { data: entry } = await supabase
        .from("waitlist")
        .select("*")
        .eq("id", waitlist_id)
        .single();

      if (!entry) return json({ error: "Entry not found" }, 404);

      let authUserId: string | null = entry.auth_user_id || null;

      // If user already exists (re-approving after pending/reject), skip creation
      if (!authUserId) {
        // Double-check by email in case auth_user_id wasn't stored
        const { data: existingList } = await supabase.auth.admin.listUsers();
        const existing = existingList?.users?.find(
          (u: any) => u.email?.toLowerCase() === entry.email.toLowerCase()
        );

        if (existing) {
          authUserId = existing.id;
        } else {
          const tempPw = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
          const { data: newUser, error: createErr } =
            await supabase.auth.admin.createUser({
              email: entry.email,
              password: tempPw,
              email_confirm: true,
            });

          if (createErr) return json({ error: createErr.message }, 400);
          authUserId = newUser.user.id;

          await supabase
            .from("profiles")
            .update({ is_setup_complete: false } as any)
            .eq("user_id", authUserId);
        }
      }

      await supabase
        .from("waitlist")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
          reviewed_by: callerId,
          auth_user_id: authUserId,
        } as any)
        .eq("id", waitlist_id);

      return json({ success: true, user_id: authUserId });
    }

    // ── REJECT ───────────────────────────────────────────────
    if (action === "reject") {
      if (!(await isAdminOrFounder())) return json({ error: "Unauthorized" }, 403);

      const { waitlist_id } = params;
      await supabase
        .from("waitlist")
        .update({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
          reviewed_by: callerId,
        } as any)
        .eq("id", waitlist_id);

      return json({ success: true });
    }

    // ── GENERATE KEY ─────────────────────────────────────────
    if (action === "generate_key") {
      if (!(await isAdminOrFounder())) return json({ error: "Unauthorized" }, 403);

      const { user_id } = params;
      const personalKey = generateKey(20);

      const { error: updateErr } = await supabase.auth.admin.updateUserById(
        user_id,
        { password: personalKey }
      );
      if (updateErr) return json({ error: updateErr.message }, 400);

      await supabase.from("personal_key_history").insert({
        user_id,
        generated_by: callerId,
        change_type: "admin_generated",
      } as any);

      return json({ success: true, personal_key: personalKey });
    }

    // ── USER CHANGES OWN KEY ─────────────────────────────────
    if (action === "change_key") {
      if (!callerId) return json({ error: "Unauthorized" }, 401);

      const { new_key } = params;
      if (!new_key || new_key.length < 10)
        return json({ error: "Key must be at least 10 characters" }, 400);

      const { error: updateErr } = await supabase.auth.admin.updateUserById(
        callerId,
        { password: new_key }
      );
      if (updateErr) return json({ error: updateErr.message }, 400);

      await supabase.from("personal_key_history").insert({
        user_id: callerId,
        generated_by: null,
        change_type: "user_changed",
      } as any);

      return json({ success: true });
    }

    // ── SUBMIT FORGOT ────────────────────────────────────────
    if (action === "submit_forgot") {
      const { email } = params;
      if (!email) return json({ error: "Email required" }, 400);

      const normalizedEmail = email.trim().toLowerCase();

      // Rate limit: max 3 requests per email per 24 hours
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("forgot_key_requests")
        .select("*", { count: "exact", head: true })
        .eq("email", normalizedEmail)
        .gte("created_at", dayAgo);

      if ((count || 0) >= MAX_FORGOT_PER_EMAIL_PER_DAY) {
        return json({
          error: "Too many requests for this email. Please try again in 24 hours.",
        }, 429);
      }

      await supabase.from("forgot_key_requests").insert({ email: normalizedEmail } as any);
      return json({ success: true });
    }

    // ── RESOLVE FORGOT ───────────────────────────────────────
    if (action === "resolve_forgot") {
      if (!(await isAdminOrFounder())) return json({ error: "Unauthorized" }, 403);

      const { request_id } = params;
      await supabase
        .from("forgot_key_requests")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
          resolved_by: callerId,
        } as any)
        .eq("id", request_id);

      return json({ success: true });
    }

    // ── SYNC EXISTING USERS ─────────────────────────────────
    if (action === "sync_users") {
      if (!(await isAdminOrFounder())) return json({ error: "Unauthorized" }, 403);

      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("user_id, created_at, joined_at");

      if (!allProfiles || allProfiles.length === 0)
        return json({ synced: 0 });

      const { data: existingWaitlist } = await supabase
        .from("waitlist")
        .select("auth_user_id")
        .not("auth_user_id", "is", null);

      const existingIds = new Set(
        (existingWaitlist || []).map((w: any) => w.auth_user_id)
      );

      const missing = allProfiles.filter(
        (p: any) => !existingIds.has(p.user_id)
      );

      if (missing.length === 0) return json({ synced: 0 });

      let synced = 0;
      for (const prof of missing) {
        const { data: userData } = await supabase.auth.admin.getUserById(
          prof.user_id
        );
        if (!userData?.user?.email) continue;

        const originalDate = prof.joined_at || prof.created_at || userData.user.created_at;

        await supabase.from("waitlist").insert({
          email: userData.user.email,
          status: "approved",
          auth_user_id: prof.user_id,
          created_at: originalDate,
          reviewed_at: originalDate,
        } as any);
        synced++;
      }

      return json({ success: true, synced });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("[manage-registration] unhandled error:", err);
    return new Response(JSON.stringify({ error: "An internal error occurred. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
