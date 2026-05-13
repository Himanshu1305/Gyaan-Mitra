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

type InternalChoice = {
  enabled: boolean;
  sections: string[];
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
  internalChoice?: InternalChoice;
  generationMode?: "quick" | "accurate";
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
For each chapter extract: main topics, key concepts, important diagrams/figures mentioned, definitions, and sample questions from exercises.
Return structured JSON with chapter name as key.`;

  const result = await model.generateContent([prompt, ...parts]);
  return result.response.text();
}

const EXAM_FORMAT_RULES = `
STRICT CBSE EXAM PAPER FORMAT RULES:
1. SECTION HEADERS must include question count and total marks, e.g.:
   ## Section A — Multiple Choice Questions (10 × 1 = 10 marks)
   ## Section B — Short Answer Questions (5 × 2 = 10 marks)
   ## Section C — Short Answer Questions (4 × 3 = 12 marks)
   ## Section D — Long Answer Questions (3 × 5 = 15 marks)
2. DO NOT mention chapter names anywhere in the paper
3. DO NOT add any examiner notes, teacher notes, or parenthetical instructions to the teacher
4. MARKS PER QUESTION:
   - Section A (MCQ): no marks shown per question
   - Section B, C, D: show [X marks] at end of each question
5. ANSWER SPACES below each question:
   - MCQ: Answer: _______
   - 2-mark: ___ ___ ___ ___ (4 lines)
   - 3-mark: ___ ___ ___ ___ ___ ___ (6 lines)
   - 4-mark: (8 lines)
   - 5-mark: (10 lines)
6. CONTINUOUS QUESTION NUMBERING: Q1, Q2, Q3... never restart numbering per section
7. Use plain Markdown only — no HTML tags, no &nbsp;
8. MCQ options: (a) ... (b) ... (c) ... (d) ...
`;

const HINDI_EXAM_RULES = `
HINDI-SPECIFIC RULES (apply when subject is Hindi/हिंदी):
- All questions, options, instructions in Devanagari script only
- Hindi grammar questions must specify type: संधि/समास/अलंकार/क्रिया etc.
- Comprehension passages taken from the actual NCERT lesson text
- Do not switch to English mid-paper
`;

const GENERAL_FORMAT_RULES = `
FORMATTING RULES:
- Use clean Markdown only: ## headings, **bold**, - bullet points, 1. numbered lists
- No HTML tags whatsoever (no <br>, <p>, <div>, <span>, etc.)
- No &nbsp; or other HTML entities — use plain spaces only
- For MCQ options use: (a) ... (b) ... (c) ... (d) ...
- Number questions as Q1, Q2, Q3 etc.
- For answer key entries use: Ans. 1: ...
- No decorative separators or excessive blank lines
`;

const NCERT_ACCURACY = `
NCERT ACCURACY REQUIREMENT:
- Every fact, concept, definition, and example must come from the NCERT textbook chapter provided
- Do not invent, modify, or add content not found in the chapter
- Question wording should reflect the language and style of the NCERT book
- For diagrams, only label components that appear in the NCERT textbook
`;

const HINDI_COMPLETENESS = `
HINDI COMPLETENESS (apply when generating Hindi content):
- Generate the EXACT number of questions specified — do not stop early
- Every question, option, instruction, and answer must be written in Devanagari script
- Do not abbreviate or truncate the output
`;

const ANSWER_KEY_DIAGRAM_RULES = `
ANSWER KEY DIAGRAM RULES:
- For every question that involves a diagram or labelling, include an ASCII art diagram in the answer key
- Format example:
  [DIAGRAM: Diagram Name]
  +---------------------------+
  |       Component A         |
  |   +----------+           |
  |   |  Part B  |           |
  |   +----------+           |
  +---------------------------+
  Labels: (1) Component A  (2) Part B
- Never skip a diagram-related question in the answer key
`;

function cleanNotes(text: string): string {
  return text
    .split("\n")
    .filter(
      (line) =>
        !/(note\s+to\s+(examiner|teacher)|examiner['']s\s+note|teacher['']s\s+note|this\s+question\s+is\s+clubbed|this\s+question\s+comes?\s+from|questions?\s+are\s+from\s+chapter|\[?note\s*:\s)/i.test(
          line
        )
    )
    .join("\n");
}

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

function buildInternalChoiceInstruction(ic: InternalChoice): string {
  if (!ic.enabled || ic.sections.length === 0) return "";
  const sectionNames: Record<string, string> = {
    B: "Section B (2-mark questions)",
    C: "Section C (3-mark questions)",
    D: "Section D (4 & 5-mark questions)",
  };
  const named = ic.sections.map(s => sectionNames[s] ?? `Section ${s}`).join(", ");
  return `\nINTERNAL CHOICE: Provide internal choice (OR questions) in ${named}. Format: write the first question, then on a new line write "OR", then write the alternative question at the same marks.\n`;
}

function buildClaudePrompt(body: RequestBody, geminiOutput: string, isFallback: boolean): string {
  const { generationType, chapterSelections, additionalInstructions, board, classNumber, subject, questionMix, examType, duration, difficulty, internalChoice } = body;

  const chapterList = chapterSelections
    .map((c) => `- ${c.bookDisplayName}: ${c.chapterName}`)
    .join("\n");

  const contentSection = isFallback
    ? `Chapters to cover:\n${chapterList}`
    : `NCERT Chapter Content (extracted from actual textbooks):\n${geminiOutput}\n\nChapters:\n${chapterList}`;

  const hasPerChapterMix = chapterSelections.some(c => c.questionMix);
  const isHindi = /hindi|हिंदी/i.test(subject);

  // Handle FINALISE_AND_KEY: prefix — generate cleaned paper + answer key
  if (/^FINALISE_AND_KEY:/i.test(additionalInstructions || "")) {
    const originalDraft = additionalInstructions.replace(/^FINALISE_AND_KEY:/i, "").trim();
    return `You are an expert Indian school teacher. You have a draft exam paper below. Your task:

1. Clean the exam paper: remove all chapter references, examiner notes, and teacher notes. Keep questions identical.
2. Generate a complete answer key with model answers, marking scheme, and ASCII diagrams where needed.

${EXAM_FORMAT_RULES}
${NCERT_ACCURACY}
${ANSWER_KEY_DIAGRAM_RULES}
${isHindi ? HINDI_COMPLETENESS : ""}

DRAFT PAPER:
${originalDraft}

Output EXACTLY in this format:
===CLEAN PAPER START===
[Cleaned exam paper here — no chapter names, no teacher notes]
===CLEAN PAPER END===

===ANSWER KEY START===
[Complete answer key with model answers, marks allocation, and ASCII diagrams]
===ANSWER KEY END===`;
  }

  if (generationType === "exam-paper") {
    const mixSection = hasPerChapterMix
      ? `Chapter-wise question distribution (generate EXACTLY these questions per chapter):\n${buildChapterDistribution(chapterSelections)}`
      : questionMix
      ? `Question Mix: ${questionMixDescription(questionMix)}`
      : "Balanced mix of MCQ, short and long answer questions";

    const paperType = examType || "Exam Paper";
    const paperDuration = duration || "3 hours";
    const paperDifficulty = difficulty || "Standard";
    const internalChoiceStr = internalChoice ? buildInternalChoiceInstruction(internalChoice) : "";

    return `You are an expert Indian school teacher. Create a ${board} ${paperType} for Class ${classNumber} ${subject}.

${EXAM_FORMAT_RULES}
${isHindi ? HINDI_EXAM_RULES : ""}
${NCERT_ACCURACY}
${isHindi ? HINDI_COMPLETENESS : ""}

${contentSection}

${mixSection}
Duration: ${paperDuration}
Difficulty: ${paperDifficulty}
${internalChoiceStr}
Teacher instructions: ${additionalInstructions || "None"}

Format as a proper exam paper:
- School name / date / subject / class / duration header
- Clear sections (Section A: MCQ, Section B: 2-mark, Section C: 3-mark, Section D: Long Answer)
- Question numbers (Q1, Q2… continuous) and marks in brackets
- Space for student name and roll number
- General instructions at the top

DO NOT include the answer key in the question paper.
DO NOT mention chapter names anywhere in the paper.
DO NOT add any teacher or examiner notes.`;
  }

  if (generationType === "worksheet") {
    const mixSection = hasPerChapterMix
      ? `Chapter-wise question distribution:\n${buildChapterDistribution(chapterSelections)}`
      : questionMix
      ? `Question Mix: ${questionMixDescription(questionMix)}`
      : "Varied question types";

    return `You are an expert Indian school teacher. Create a practice worksheet for Class ${classNumber} ${subject} (${board} curriculum).

${GENERAL_FORMAT_RULES}
${NCERT_ACCURACY}
${isHindi ? HINDI_COMPLETENESS : ""}

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

${GENERAL_FORMAT_RULES}
${NCERT_ACCURACY}

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
    const { generationType, chapterSelections, generationMode } = body;

    console.log("[generate-with-chapters] Request:", { generationType, chapterCount: chapterSelections?.length, board: body.board, subject: body.subject, generationMode });

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
        const serviceClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        const { data: profile, error: profileError } = await serviceClient
          .from("profiles")
          .select("subscription_tier")
          .eq("id", userId)
          .single();
        if (profileError) console.error("[generate-with-chapters] Profile fetch error:", profileError);
        const isPremium = profile?.subscription_tier === "premium";
        console.log("[generate-with-chapters] User:", userId, "isPremium:", isPremium);
        if (!isPremium) {
          const userSupa = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            { global: { headers: { Authorization: `Bearer ${token}` } } }
          );
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

    // Step A — Gemini reads PDFs (skip if quick mode or FINALISE_AND_KEY)
    const isQuick = generationMode === "quick";
    const isFinalise = /^FINALISE_AND_KEY:/i.test(body.additionalInstructions || "");
    let geminiOutput = "";
    let isFallback = isQuick || isFinalise;

    if (!isFallback) {
      try {
        console.log(`[generate-with-chapters] Gemini analyzing ${chapterSelections.length} chapters…`);
        geminiOutput = await analyzeWithGemini(chapterSelections);
        console.log("[generate-with-chapters] Gemini done, output length:", geminiOutput.length);
      } catch (err) {
        console.warn("[generate-with-chapters] Gemini failed, falling back to chapter names:", err);
        isFallback = true;
      }
    } else {
      console.log("[generate-with-chapters] Skipping Gemini (quick mode or finalise)");
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

    const maxTokens = generationType === "exam-paper" || isFinalise ? 8000 : 4000;

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    });

    const rawDraft = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n");

    const draft = cleanNotes(rawDraft);

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
