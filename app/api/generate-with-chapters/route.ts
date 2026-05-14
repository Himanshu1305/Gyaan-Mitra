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

// Diagram rules are inlined directly in the FINALISE_AND_KEY prompt to avoid unused-var lint error

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

function cleanAnswerSpaces(text: string): string {
  // Replace sequences of 2+ standalone --- lines (used incorrectly as answer lines) with underscore lines
  return text
    .replace(/^(---\n){2,}/gm, "_____________________________\n_____________________________\n_____________________________\n")
    .replace(/&nbsp;/g, " ");
}

function computeTotalMarks(chapters: ChapterSelection[], globalMix?: QuestionMix): number {
  const hasPerChapter = chapters.some(c => c.questionMix);
  if (hasPerChapter) {
    return chapters.reduce((sum, c) => {
      const qm = c.questionMix;
      if (!qm) return sum;
      return sum + qm.mcq + qm.shortTwo * 2 + qm.shortThree * 3 + qm.longFour * 4 + qm.longFive * 5;
    }, 0);
  }
  if (globalMix) {
    return globalMix.mcq + globalMix.shortTwo * 2 + globalMix.shortThree * 3 + globalMix.longFour * 4 + globalMix.longFive * 5;
  }
  return 80;
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
  return `\nINTERNAL CHOICE: Provide internal choice (OR questions) in ${named}. Format exactly as:\n**Q[N].** [First question] [X marks]\n**OR**\n**Q[N].** [Alternative question] [X marks]\n`;
}

function buildClaudePrompt(body: RequestBody, geminiOutput: string, isFallback: boolean): string {
  const { generationType, chapterSelections, additionalInstructions, board, classNumber, subject, questionMix, examType, duration, difficulty, internalChoice } = body;

  const chapterList = chapterSelections
    .map((c) => `- ${c.bookDisplayName}: ${c.chapterName}`)
    .join("\n");

  const contentSection = isFallback
    ? `Chapters to cover (use your knowledge of NCERT ${subject} Class ${classNumber}):\n${chapterList}`
    : `NCERT Chapter Content (extracted from actual textbooks):\n${geminiOutput}\n\nChapters:\n${chapterList}`;

  const hasPerChapterMix = chapterSelections.some(c => c.questionMix);
  const isHindi = /hindi|हिंदी/i.test(subject);
  const totalMarks = computeTotalMarks(chapterSelections, questionMix);

  // Handle FINALISE_AND_KEY: prefix — generate cleaned paper + answer key in one call
  if (/^FINALISE_AND_KEY:/i.test(additionalInstructions || "")) {
    const originalDraft = additionalInstructions.replace(/^FINALISE_AND_KEY:/i, "").trim();
    return `You are generating a complete, finalised exam paper and answer key.

DRAFT PAPER TO FINALISE:
${originalDraft}

YOUR TASKS:
1. Clean the exam paper: remove all chapter references, examiner notes, and teacher notes. Keep every question identical — do not alter wording or marks.
2. Generate a COMPLETE answer key for every single question.

ANSWER KEY REQUIREMENTS:
- Provide complete answers for EVERY question — do not skip any
- MCQ section: First list all answers in format: Q1-(B), Q2-(A), Q3-(C)... then write a brief explanation for each
- For short and long answers: write complete model answers matching NCERT content
- For numerical problems: show complete step-by-step working with units
- For diagram questions:
  [DIAGRAM: Name of diagram]
  +---------------------------+
  |       Component A         |
  |   +----------+           |
  |   |  Part B  |           |
  |   +----------+           |
  +---------------------------+
  Labels: (1) Component A  (2) Part B
- All answers must match NCERT textbook content exactly
${isHindi ? "- Write everything in Hindi (Devanagari script)" : ""}
- Do not add any teacher notes or meta-commentary
- Mark allocation: show marks awarded for each step in long answers

OUTPUT FORMAT — use EXACTLY these delimiters:
===CLEAN PAPER START===
[Cleaned exam paper — no chapter names, no teacher notes, all questions intact]
===CLEAN PAPER END===

===ANSWER KEY START===
[Complete answer key with model answers, mark allocations, and ASCII diagrams]
===ANSWER KEY END===`;
  }

  if (generationType === "exam-paper") {
    const chapterDistribution = hasPerChapterMix
      ? buildChapterDistribution(chapterSelections)
      : questionMix
      ? `All chapters combined: ${questionMixDescription(questionMix)}`
      : "Balanced mix — approximately 20 MCQ, 5 short (2m), 5 short (3m), 3 long (5m)";

    const questionMixSummary = hasPerChapterMix
      ? `Total ${totalMarks} marks across ${chapterSelections.length} chapter(s)`
      : questionMix
      ? questionMixDescription(questionMix)
      : "Standard CBSE pattern";

    const paperType = examType || "Exam Paper";
    const paperDuration = duration || "3 hours";
    const paperDifficulty = difficulty || "Standard";
    const internalChoiceStr = internalChoice ? buildInternalChoiceInstruction(internalChoice) : "";
    const year = new Date().getFullYear();

    return `You are an expert CBSE exam paper setter with 20 years of experience creating board exam papers.

${contentSection}

EXAM PAPER REQUIREMENTS:
- Class: ${classNumber}
- Subject: ${subject}
- Board: ${board}
- Exam Type: ${paperType}
- Difficulty: ${paperDifficulty}
- Duration: ${paperDuration}

CHAPTER-WISE QUESTION DISTRIBUTION:
${chapterDistribution}

TOTAL QUESTION MIX:
${questionMixSummary}

STRICT FORMATTING RULES — FOLLOW EXACTLY:

1. START with exam header:
   [SCHOOL NAME]
   ${paperType.toUpperCase()} EXAMINATION (${year})
   Class: ${classNumber}    Subject: ${subject}    Max. Marks: ${totalMarks}
   Time: ${paperDuration}         Date: ___________
   Name: ___________________________    Roll No.: _______

2. GENERAL INSTRUCTIONS (5-7 points in standard CBSE format):
   - All questions are compulsory unless internal choice is provided
   - Write legibly, show all working for numerical questions
   - etc.

3. SECTIONS — use EXACTLY this format:

   ## SECTION A — Multiple Choice Questions
   (X questions × 1 mark each = X marks)

   **Q1.** [Question text]
   (a) option  (b) option  (c) option  (d) option
   Answer: [ ]

   ## SECTION B — Short Answer Questions
   (X questions × 2 marks each = X marks)

   **Q[N].** [Question text] [2 marks]
   _____________________________
   _____________________________
   _____________________________

   ## SECTION C — Short Answer Questions
   (X questions × 3 marks each = X marks)

   **Q[N].** [Question text] [3 marks]
   _____________________________
   _____________________________
   _____________________________
   _____________________________
   _____________________________

   ## SECTION D — Long Answer Questions
   (X questions × 4/5 marks each = X marks)

   **Q[N].** [Question text] [5 marks]
   _____________________________
   _____________________________
   _____________________________
   _____________________________
   _____________________________
   _____________________________
   _____________________________
   _____________________________

4. ANSWER SPACES — use ONLY underscore lines (_____________________________), NEVER use --- for answer spaces. Use --- ONLY as a section divider between major sections.

5. QUESTION NUMBERING: Q1, Q2, Q3... continuous across ALL sections — never restart.

6. INTERNAL CHOICE (if applicable):
   **Q[N].** [Question] [X marks]
   **OR**
   **Q[N].** [Alternative question] [X marks]

${internalChoiceStr}
Teacher instructions: ${additionalInstructions || "None"}

CRITICAL RULES:
- DO NOT mention chapter names anywhere in the paper
- DO NOT add examiner notes, teacher notes, or meta-commentary
- ALL questions must come strictly from the NCERT chapter content above
- Generate EXACTLY the number of questions specified — no more, no less
- Questions must be factually accurate and match NCERT book content
${isHindi ? "- All questions, options, and instructions in Devanagari script only\n- Hindi grammar questions must specify type: संधि/समास/अलंकार etc." : ""}

Now generate the complete ${paperType} paper:`;
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

    // Post-process: remove examiner notes, fix answer space formatting
    const draft = cleanAnswerSpaces(cleanNotes(rawDraft));

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
