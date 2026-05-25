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
    console.error("[admin/figures] verifyAdmin exception:", err);
    return false;
  }
}

// GET /api/admin/figures?type=figures|stats|chapters&class=10&subject=Science&chapter=11&status=all
export async function GET(req: NextRequest) {
  try {
    if (!(await verifyAdmin(req))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sp = new URL(req.url).searchParams;
    const type = sp.get("type") ?? "figures";
    const classNum = Number(sp.get("class") ?? 10);
    const subject = sp.get("subject") ?? "";
    const chapter = sp.get("chapter") ?? "";
    const status = sp.get("status") ?? "all";

    const db = getServiceClient();

    if (type === "chapters") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = db
        .from("ncert_figures")
        .select("chapter_number, chapter_name")
        .eq("class_number", classNum)
        .not("chapter_number", "is", null)
        .order("chapter_number");
      if (subject) q = q.eq("subject", subject);
      const { data, error } = await q;
      return NextResponse.json({ data: data ?? [], error: error?.message ?? null });
    }

    if (type === "stats") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = db
        .from("ncert_figures")
        .select("is_active, reviewed_at")
        .eq("class_number", classNum);
      if (subject) q = q.eq("subject", subject);
      if (chapter) q = q.eq("chapter_number", Number(chapter));
      const { data, error } = await q;
      return NextResponse.json({ data: data ?? [], error: error?.message ?? null });
    }

    // type === "figures"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = db.from("ncert_figures").select("*").eq("class_number", classNum);
    if (subject) q = q.eq("subject", subject);
    if (chapter) q = q.eq("chapter_number", Number(chapter));
    if (status === "unreviewed") q = q.is("reviewed_at", null);
    else if (status === "verified") q = q.eq("is_active", true).not("reviewed_at", "is", null);
    else if (status === "rejected") q = q.eq("is_active", false);
    q = q.order("created_at", { ascending: true });

    const { data, error } = await q;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (data ?? []).map((row: any) => {
      const url: string | null = row.public_url ?? null;
      if (!url || url.startsWith("http")) return row;
      const { data: urlData } = db.storage.from("ncert-figures").getPublicUrl(url);
      return { ...row, public_url: urlData.publicUrl };
    });
    return NextResponse.json({ data: rows, error: error?.message ?? null });
  } catch (err) {
    console.error("[admin/figures GET] unhandled exception:", err);
    return NextResponse.json({ data: null, error: String(err) }, { status: 500 });
  }
}

// POST /api/admin/figures  body: { action: "reject"|"save"|"verify", id, ...fields }
export async function POST(req: NextRequest) {
  try {
    if (!(await verifyAdmin(req))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action, id } = body;
    const db = getServiceClient();

    if (action === "reject") {
      const { error } = await db
        .from("ncert_figures")
        .update({
          is_active: false,
          reviewed_at: new Date().toISOString(),
          review_notes: body.review_notes ?? null,
        })
        .eq("id", id);
      return NextResponse.json({ error: error?.message ?? null });
    }

    if (action === "save") {
      const { error } = await db
        .from("ncert_figures")
        .update({
          figure_caption: body.figure_caption,
          diagram_type: body.diagram_type,
          keywords: body.keywords,
          chapter_number: body.chapter_number ?? null,
          review_notes: body.review_notes ?? null,
        })
        .eq("id", id);
      return NextResponse.json({ error: error?.message ?? null });
    }

    if (action === "verify") {
      const { error: updateErr } = await db
        .from("ncert_figures")
        .update({
          figure_caption: body.figure_caption,
          diagram_type: body.diagram_type,
          keywords: body.keywords,
          chapter_number: body.chapter_number ?? null,
          is_active: true,
          reviewed_at: new Date().toISOString(),
          review_notes: body.review_notes ?? null,
        })
        .eq("id", id);
      if (updateErr) return NextResponse.json({ error: updateErr.message });

      const { error: insertErr } = await db.from("verified_figures").upsert(
        {
          ncert_figure_id: id,
          class_number: body.class_number,
          subject: body.subject,
          chapter_number: body.chapter_number ?? null,
          chapter_name: body.chapter_name,
          figure_caption: body.figure_caption,
          concept_tags: body.keywords,
          suitable_for: ["study the diagram", "label the parts", "identify the parts", "name the parts shown"],
          not_suitable_for: [],
          public_url: body.public_url,
          verified_by: "admin",
          is_active: true,
        },
        { onConflict: "ncert_figure_id" }
      );
      return NextResponse.json({ error: insertErr?.message ?? null });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error("[admin/figures POST] unhandled exception:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
