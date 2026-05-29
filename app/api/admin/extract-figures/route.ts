import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabase as anonClient } from "@/lib/supabase";
import Anthropic from "@anthropic-ai/sdk";

// ── Auth / DB helpers ──────────────────────────────────────────────────────────

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
    console.error("[extract-figures] verifyAdmin:", err);
    return false;
  }
}

function slugify(s: string) {
  return s.replace(/[\s\-]+/g, "_").toLowerCase();
}

// ── Claude figure detection ────────────────────────────────────────────────────

interface FigureResponse {
  caption: string;
  keywords: string[];
  diagram_type: string;
  bbox: { x: number; y: number; w: number; h: number };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function parseFiguresFromClaude(text: string): FigureResponse[] {
  let cleaned = text.trim();
  // Strip markdown code fences
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  // Find the JSON array
  const arrStart = cleaned.indexOf("[");
  const arrEnd = cleaned.lastIndexOf("]");
  if (arrStart === -1 || arrEnd === -1) return [];
  cleaned = cleaned.slice(arrStart, arrEnd + 1);

  try {
    const parsed: unknown[] = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (f): f is Record<string, unknown> =>
          f !== null && typeof f === "object" &&
          typeof (f as Record<string, unknown>).caption === "string" &&
          (f as Record<string, unknown>).bbox !== null &&
          typeof (f as Record<string, unknown>).bbox === "object"
      )
      .map((f) => {
        const bbox = f.bbox as Record<string, unknown>;
        return {
          caption: String(f.caption ?? ""),
          keywords: Array.isArray(f.keywords)
            ? (f.keywords as unknown[]).map(String)
            : [],
          diagram_type: String(f.diagram_type ?? "illustration"),
          bbox: {
            x: clamp(Number(bbox.x) || 0, 0, 0.99),
            y: clamp(Number(bbox.y) || 0, 0, 0.99),
            w: clamp(Number(bbox.w) || 0.5, 0.01, 1),
            h: clamp(Number(bbox.h) || 0.3, 0.01, 1),
          },
        };
      });
  } catch {
    return [];
  }
}

const DETECT_PROMPT = `You are analyzing a page from an NCERT textbook (Indian school curriculum, classes 6–12).

Identify every figure, diagram, illustration, chart, graph, or map on this page.
Do NOT include: decorative borders, headers, footers, page numbers, or text-only boxes.
DO include: scientific diagrams, biological illustrations, chemical structures, geographical maps, graphs, flowcharts, mathematical figures.

For each figure, return its bounding box as normalized coordinates where (0,0) is the top-left corner and (1,1) is the bottom-right corner of the image.

Return ONLY a JSON array, no explanation, no markdown:
[
  {
    "caption": "Brief description of what the figure shows",
    "keywords": ["keyword1", "keyword2", "keyword3"],
    "diagram_type": "biological_diagram|circuit_diagram|chemical_structure|geographical_map|graph|mathematical_diagram|illustration|flowchart|other",
    "bbox": {"x": 0.05, "y": 0.20, "w": 0.90, "h": 0.45}
  }
]

If no figures are on this page, return exactly: []`;

// ── POST handler ───────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    if (!(await verifyAdmin(req))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    // ── action: detect ─────────────────────────────────────────────────────────
    if (action === "detect") {
      const { pageImage, pageNum, totalPages } = body as {
        pageImage: string;
        pageNum: number;
        totalPages: number;
      };
      if (!pageImage) {
        return NextResponse.json({ error: "pageImage is required" }, { status: 400 });
      }

      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/png",
                  data: pageImage,
                },
              },
              {
                type: "text",
                text: `Page ${pageNum} of ${totalPages}.\n\n${DETECT_PROMPT}`,
              },
            ],
          },
        ],
      });

      const responseText =
        message.content[0].type === "text" ? message.content[0].text : "[]";
      const figures = parseFiguresFromClaude(responseText);

      return NextResponse.json({ figures, error: null });
    }

    // ── action: upload ─────────────────────────────────────────────────────────
    if (action === "upload") {
      const {
        imageBase64,
        classNumber,
        subject,
        bookCode,
        chapterNumber,
        chapterName,
        caption,
        keywords,
        diagramType,
        width,
        height,
      } = body as {
        imageBase64: string;
        classNumber: number;
        subject: string;
        bookCode: string;
        chapterNumber: number;
        chapterName: string;
        caption: string;
        keywords: string[];
        diagramType: string;
        width: number;
        height: number;
      };

      if (!imageBase64) {
        return NextResponse.json({ error: "imageBase64 is required" }, { status: 400 });
      }

      const db = getServiceClient();
      const chStr = String(chapterNumber).padStart(2, "0");
      const storagePath = `class${classNumber}/${slugify(subject)}/${slugify(bookCode)}/ch${chStr}/fig_${Date.now()}.png`;
      const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/ncert-figures/${storagePath}`;

      const imageBuffer = Buffer.from(imageBase64, "base64");

      const { error: uploadError } = await db.storage
        .from("ncert-figures")
        .upload(storagePath, imageBuffer, {
          contentType: "image/png",
          upsert: false,
        });

      if (uploadError) {
        return NextResponse.json({ error: `Storage upload failed: ${uploadError.message}` });
      }

      const { error: insertError } = await db.from("ncert_figures").insert({
        class_number: classNumber,
        subject,
        book_code: bookCode,
        chapter_number: chapterNumber,
        chapter_name: chapterName,
        figure_caption: caption,
        keywords: keywords,
        diagram_type: diagramType,
        public_url: publicUrl,
        image_path: storagePath,
        width,
        height,
        is_active: true,
        reviewed_at: new Date().toISOString(),
      });

      if (insertError) {
        return NextResponse.json({ error: `DB insert failed: ${insertError.message}` });
      }

      return NextResponse.json({ public_url: publicUrl, image_path: storagePath, error: null });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error("[extract-figures POST] unhandled:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
