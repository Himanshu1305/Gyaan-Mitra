import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const serviceSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: callerProfile } = await serviceSupabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!callerProfile?.is_admin) {
    return new Response("Forbidden", { status: 403 });
  }

  const { targetUserId, action }: { targetUserId: string; action: "grant" | "revoke" } = await req.json();

  if (!targetUserId || !["grant", "revoke"].includes(action)) {
    return new Response("Invalid request", { status: 400 });
  }

  const tier = action === "grant" ? "premium" : "free";

  const { error } = await serviceSupabase
    .from("profiles")
    .update({ subscription_tier: tier })
    .eq("id", targetUserId);

  if (error) {
    return new Response(`Failed to update profile: ${error.message}`, { status: 500 });
  }

  if (action === "grant") {
    await serviceSupabase.from("subscriptions").upsert([{
      user_id: targetUserId,
      plan: "premium",
      status: "active",
      started_at: new Date().toISOString(),
    }], { onConflict: "user_id" });
  } else {
    await serviceSupabase
      .from("subscriptions")
      .update({ status: "cancelled" })
      .eq("user_id", targetUserId);
  }

  return new Response(JSON.stringify({ success: true, tier }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
