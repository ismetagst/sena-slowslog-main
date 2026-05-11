import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Authenticate caller: either a cron secret OR an admin/founder user JWT.
    const cronSecret = Deno.env.get("CRON_SECRET");
    const providedSecret = req.headers.get("x-cron-secret");
    let authorized = false;

    if (cronSecret && providedSecret && providedSecret === cronSecret) {
      authorized = true;
    } else {
      const authHeader = req.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.replace("Bearer ", "");
        const { data: userData, error: userErr } = await supabase.auth.getUser(token);
        if (!userErr && userData?.user) {
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", userData.user.id);
          if (roles?.some((r) => r.role === "admin" || r.role === "founder")) {
            authorized = true;
          }
        }
      }
    }

    if (!authorized) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete drafts not updated in 14 days (only non-trashed ones)
    const draftCutoff = new Date();
    draftCutoff.setDate(draftCutoff.getDate() - 14);

    const { data: deletedDrafts, error: draftError } = await supabase
      .from("stories")
      .delete()
      .eq("is_draft", true)
      .is("deleted_at", null)
      .lt("updated_at", draftCutoff.toISOString())
      .select("id");

    if (draftError) throw draftError;

    // Permanently delete trashed stories older than 24 hours
    const trashCutoff = new Date();
    trashCutoff.setHours(trashCutoff.getHours() - 24);

    const { data: deletedTrash, error: trashError } = await supabase
      .from("stories")
      .delete()
      .not("deleted_at", "is", null)
      .lt("deleted_at", trashCutoff.toISOString())
      .select("id");

    if (trashError) throw trashError;

    return new Response(
      JSON.stringify({
        deleted_drafts: deletedDrafts?.length ?? 0,
        deleted_trash: deletedTrash?.length ?? 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[cleanup-old-drafts] unhandled error:", err);
    return new Response(
      JSON.stringify({ error: "An internal error occurred. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
