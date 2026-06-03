import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabase as anonClient } from "@/lib/supabase";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return false;
    const { data } = await anonClient.auth.getUser(token);
    return data?.user?.email === "usdvisionai@gmail.com";
  } catch (err) {
    console.error("[image-pool] verifyAdmin:", err);
    return false;
  }
}

// Recalculate image_count from live diagram_pool rows
async function recalcImageCount(topicKey: string) {
  const db = getServiceClient();
  const { count } = await db
    .from("diagram_pool")
    .select("*", { count: "exact", head: true })
    .eq("topic_key", topicKey)
    .eq("is_active", true)
    .eq("is_approved", true);
  await db
    .from("diagram_topics")
    .update({ image_count: count ?? 0 })
    .eq("topic_key", topicKey);
}

// ── GET ────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const db = getServiceClient();

  try {
    // List all diagram topics with image_count
    if (action === "topics") {
      const { data, error } = await db
        .from("diagram_topics")
        .select("*")
        .order("chapter_number")
        .order("topic_name");
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ topics: data ?? [], error: null });
    }

    // List approved images for one topic
    if (action === "images") {
      const topicKey = searchParams.get("topic_key");
      if (!topicKey) {
        return NextResponse.json({ error: "topic_key required" }, { status: 400 });
      }
      const { data, error } = await db
        .from("diagram_pool")
        .select("*")
        .eq("topic_key", topicKey)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ images: data ?? [], error: null });
    }

    // List missing diagram log, sorted by most-requested
    if (action === "missing") {
      const { data, error } = await db
        .from("missing_diagram_log")
        .select("*")
        .order("request_count", { ascending: false });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ missing: data ?? [], error: null });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── POST ───────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getServiceClient();

  try {
    const body = await req.json() as Record<string, unknown>;
    const action = String(body.action ?? "");

    // Insert a new image into the pool
    if (action === "add_image") {
      const topic_key = String(body.topic_key ?? "");
      const image_url = String(body.image_url ?? "");
      const source_url = String(body.source_url ?? "");
      const variant = String(body.variant ?? "");
      const license = body.license ? String(body.license) : null;

      if (!topic_key || !image_url || !source_url || !variant) {
        return NextResponse.json(
          { error: "topic_key, image_url, source_url, variant are required" },
          { status: 400 }
        );
      }

      const { error: insertError } = await db.from("diagram_pool").insert({
        topic_key,
        image_url,
        source_url,
        variant,
        license,
        is_approved: true,
        is_active: true,
        usage_count: 0,
      });

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      await recalcImageCount(topic_key);
      return NextResponse.json({ error: null });
    }

    // Soft-delete an image
    if (action === "remove_image") {
      const imageId = Number(body.image_id);
      if (!imageId) {
        return NextResponse.json({ error: "image_id required" }, { status: 400 });
      }

      // Grab topic_key before deactivating
      const { data: imgRow } = await db
        .from("diagram_pool")
        .select("topic_key")
        .eq("id", imageId)
        .single();

      const { error: updateError } = await db
        .from("diagram_pool")
        .update({ is_active: false })
        .eq("id", imageId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      const topicKey = (imgRow as { topic_key?: string } | null)?.topic_key;
      if (topicKey) await recalcImageCount(topicKey);

      return NextResponse.json({ error: null });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
