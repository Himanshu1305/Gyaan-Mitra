import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type QuestionMix = {
  mcq: number;
  shortTwo: number;
  shortThree: number;
  longFour: number;
  longFive: number;
};

type ChapterSelection = {
  chapterName: string;
  bookDisplayName: string;
  questionMix?: QuestionMix;
  filePath: string | null;
};

type RequestBody = {
  generationType: "lesson-plan" | "worksheet" | "exam-paper";
  chapterSelections: ChapterSelection[];
  additionalInstructions: string;
  board: string;
  classNumber: number;
  subject: string;
  questionMix?: QuestionMix;
  examType?: string;
  duration?: string;
  difficulty?: string;
};

const STORAGE_BASE =
  "https://bpvakrgthezixqzslmng.supabase.co/storage/v1/object/public/ncert-books";

async function fetchPdfBase64(filePath: string): Promise<string | null> {
  try {
    const url = `${STORAGE_BASE}/${filePath}`;
    console.log("[generate-with-chapters] Fetching PDF:", url);
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) {
      console.warn("[generate-with-chapters] PDF fetch failed:", url, res.status);
      return null;
    }
    const buf = await res.arrayBuffer();
    return Buffer.from(buf).toString("base64");
  } catch (e) {
    console.warn("[generate-with-chapters] PDF fetch exception:", e);
    return null;
  }
}

async function analyzeWithGemini(chapters: ChapterSelection[]): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log("[generate-with-chapters] GEMINI_API_KEY exists:", !!apiKey);
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const parts: { inlineData: { data: string; mimeType: string } }[] = [];
  const loaded: string[] = [];

  for (const ch of chapters.slice(0, 20)) {
    if (!ch.filePath) {
      console.log("[generate-with-chapters] Skipping chapter (no filePath):", ch.chapterName);
      continue;
    }
    const b64 = await fetchPdfBase64(ch.filePath);
    if (b64) {
      parts.push({ inlineData: { data: b64, mimeType: "application/pdf" } });
      loaded.push(`${ch.bookDisplayName}: ${ch.chapterName}`);
    }
  }

  if (parts.length === 0) throw new Error("No PDFs could be fetched");

  console.log("[generate-with-chapters] Gemini analyzing", loaded.length, "chapters:", loaded);
  const prompt = `Analyze these NCERT textbook chapters: ${loaded.join(", ")}.
For each chapter extract: main topics, key concepts, important diagrams/figures mentioned, and sample questions from exercises.
Return structured JSON with chapter name as key.`;

  const result = await model.generateContent([prompt, ...parts]);
  return result.response.text();
}

const FORMATTING_RULES = `
IMPORTANT FORMATTING RULES:
- Use clean Markdown only: ## headings, **bold**, - bullet points, 1. numbered lists
- No HTML tags whatsoever (no <br>, <p>, <div>, <span>, etc.)
- No &nbsp; or other HTML entities — use plain spaces only
- For MCQ options use: (a) ... (b) ... (c) ... (d) ...
- Number questions as Q1, Q2, Q3 etc.
- For answer key entries use: Ans. 1: ...
- No decorative separators or excessive blank lines
`;

function questionMixDescription(qm: QuestionMix): string {
  const parts: string[] = [];
  if (qm.mcq > 0) parts.push(`${qm.mcq} MCQ (1 mark each = ${qm.mcq} marks)`);
  if (qm.shortTwo > 0) parts.push(`${qm.shortTwo} Short Answer (2 marks each = ${qm.shortTwo * 2} marks)`);
  if (qm.shortThree > 0) parts.push(`${qm.shortThree} Short Answer (3 marks each = ${qm.shortThree * 3} marks)`);
  if (qm.longFour > 0) parts.push(`${qm.longFour} Long Answer (4 marks each = ${qm.longFour * 4} marks)`);
  if (qm.longFive > 0) parts.push(`${qm.longFive} Long Answer (5 marks each = ${qm.longFive * 5} marks)`);
  const total = qm.mcq + qm.shortTwo * 2 + qm.shortThree * 3 + qm.longFour * 4 + qm.longFive * 5;
  return parts.join(", ") + `. Total: ${total} marks.`;
}

function buildChapterDistribution(chapters: ChapterSelection[]): string {
  return chapters.map(c => {
    const qm = c.questionMix;
    if (!qm) return `- ${c.chapterName}: balanced mix`;
    const parts: string[] = [];
    if (qm.mcq > 0) parts.push(`${qm.mcq} MCQ (1m each)`);
    if (qm.shortTwo > 0) parts.push(`${qm.shortTwo} Short Answer (2m each)`);
    if (qm.shortThree > 0) parts.push(`${qm.shortThree} Short Answer (3m each)`);
    if (qm.longFour > 0) parts.push(`${qm.longFour} Long Answer (4m each)`);
    if (qm.longFive > 0) parts.push(`${qm.longFive} Long Answer (5m each)`);
    const marks = (qm.mcq) + (qm.shortTwo * 2) + (qm.shortThree * 3) + (qm.longFour * 4) + (qm.longFive * 5);
    return `- ${c.chapterName}: ${parts.join(", ") || "balanced mix"} [${marks} marks]`;
  }).join("\n");
}

function buildClaudePrompt(body: RequestBody, geminiOutput: string, isFallback: boolean): string {
  const { generationType, chapterSelections, additionalInstructions, board, classNumber, subject, questionMix, examType, duration, difficulty } = body;

  const chapterList = chapterSelections
    .map((c) => `- ${c.bookDisplayName}: ${c.chapterName}`)
    .join("\n");

  const contentSection = isFallback
    ? `Chapters to cover:\n${chapterList}`
    : `NCERT Chapter Content (extracted from actual textbooks):\n${geminiOutput}\n\nChapters:\n${chapterList}`;

  const hasPerChapterMix = chapterSelections.some(c => c.questionMix);

  if (generationType === "exam-paper") {
    const mixSection = hasPerChapterMix
      ? `Chapter-wise question distribution (generate EXACTLY these questions per chapter):\n${buildChapterDistribution(chapterSelections)}`
      : questionMix
      ? `Question Mix: ${questionMixDescription(questionMix)}`
      : "Balanced mix of MCQ, short and long answer questions";

    const paperType = examType || "Exam Paper";
    const paperDuration = duration || "3 hours";
    const paperDifficulty = difficulty || "Standard";

    return `You are an expert Indian school teacher. Create a ${board} ${paperType} for Class ${classNumber} ${subject}.
${FORMATTING_RULES}
${contentSection}

${mixSection}
Duration: ${paperDuration}
Difficulty: ${paperDifficulty}
Teacher instructions: ${additionalInstructions || "None"}

Format as a proper exam paper:
- School/date header section
- Clear sections (Section A: MCQ, Section B: Short Answer, Section C: Long Answer)
- Question numbers and marks in brackets
- Space for student name and roll number
- Instructions at the top

Do NOT include the answer key in the question paper.`;
  }

  if (generationType === "worksheet") {
    const mixSection = hasPerChapterMix
      ? `Chapter-wise question distribution:\n${buildChapterDistribution(chapterSelections)}`
      : questionMix
      ? `Question Mix: ${questionMixDescription(questionMix)}`
      : "Varied question types";

    return `You are an expert Indian school teacher. Create a practice worksheet for Class ${classNumber} ${subject} (${board} curriculum).
${FORMATTING_RULES}
${contentSection}

${mixSection}
Teacher instructions: ${additionalInstructions || "None"}

Create a well-structured worksheet with:
- Clear sections for each question type
- Instructions for each section
- Questions based strictly on the chapter content above
- An ANSWER KEY section at the end (clearly separated)

Format clearly with question numbers and marks in brackets.`;
  }

  // lesson-plan
  return `You are an expert Indian school teacher. Create a detailed lesson plan for Class ${classNumber} ${subject} (${board} curriculum).
${FORMATTING_RULES}
Chapters:
${chapterList}

${isFallback ? "" : `Chapter content overview:\n${geminiOutput}\n`}Teacher instructions: ${additionalInstructions || "None"}

Create a comprehensive lesson plan covering:
1. Learning Objectives
2. Prerequisites
3. Time Allocation per chapter/topic
4. Teaching Methodology
5. Classroom Activities and Discussion Points
6. Assessment Strategies
7. Key Vocabulary
8. Homework Suggestions

Format clearly and professionally.`;
}

const FREE_LIMIT = 5;

function monthYear(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json();
    const { generationType, chapterSelections } = body;

    console.log("[generate-with-chapters] Request:", { generationType, chapterCount: chapterSelections?.length, board: body.board, subject: body.subject });

    if (!generationType || !chapterSelections || chapterSelections.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Auth & premium check
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    let userId: string | null = null;

    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        userId = user.id;
        const userSupa = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          { global: { headers: { Authorization: `Bearer ${token}` } } }
        );
        const profileClient = process.env.SUPABASE_SERVICE_ROLE_KEY
          ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
          : userSupa;
        const { data: profile, error: profileError } = await profileClient
          .from("profiles")
          .select("subscription_tier")
          .eq("id", userId)
          .single();
        if (profileError) console.error("[generate-with-chapters] Profile fetch error:", profileError);
        const isPremium = profile?.subscription_tier === "premium";
        console.log("[generate-with-chapters] User:", userId, "isPremium:", isPremium);
        if (!isPremium) {
          const { count } = await userSupa
            .from("usage_tracking")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("month_year", monthYear());
          if ((count ?? 0) >= FREE_LIMIT) {
            return NextResponse.json(
              { error: "You have used all 5 free generations this month. Upgrade to Premium for unlimited access." },
              { status: 429 }
            );
          }
        }
      }
    } else {
      console.log("[generate-with-chapters] No auth token — guest request");
    }

    // Step A — Gemini reads PDFs
    let geminiOutput = "";
    let isFallback = false;
    try {
      console.log(`[generate-with-chapters] Gemini analyzing ${chapterSelections.length} chapters…`);
      geminiOutput = await analyzeWithGemini(chapterSelections);
      console.log("[generate-with-chapters] Gemini done, output length:", geminiOutput.length);
    } catch (err) {
      console.warn("[generate-with-chapters] Gemini failed, falling back to chapter names:", err);
      isFallback = true;
    }

    // Step B — Claude generates content
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    console.log("[generate-with-chapters] ANTHROPIC_API_KEY exists:", !!anthropicKey);
    if (!anthropicKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }

    const client = new Anthropic({ apiKey: anthropicKey });
    const prompt = buildClaudePrompt(body, geminiOutput, isFallback);

    console.log("[generate-with-chapters] Claude prompt length:", prompt.length);
    console.log("[generate-with-chapters] Claude prompt preview:", prompt.slice(0, 300));
    console.log(`[generate-with-chapters] Claude generating ${generationType}…`);

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    });

    const draft = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n");

    console.log("[generate-with-chapters] Done, draft length:", draft.length);

    // Track usage
    if (userId) {
      const userSupa = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      );
      await userSupa.from("usage_tracking").insert([{ user_id: userId, month_year: monthYear(), content_type: generationType }]);
    }

    return NextResponse.json({
      success: true,
      draft,
      geminiSummary: isFallback ? null : geminiOutput,
      usedFallback: isFallback,
    });
  } catch (err) {
    console.error("[generate-with-chapters] Error:", err);
    return NextResponse.json(
      { error: "Generation failed. Please try again.", detail: String(err) },
      { status: 500 }
    );
  }
}
