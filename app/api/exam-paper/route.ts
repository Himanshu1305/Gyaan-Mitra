import { anthropic } from "@/lib/anthropic";
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

const FREE_LIMIT = 5;

function monthYear(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface QuestionMix {
  mcq: number;
  shortTwo: number;
  shortThree: number;
  longFour: number;
  longFive: number;
}

interface FileData {
  type: "pdf" | "image" | "text";
  data?: string;
  text?: string;
  mimeType?: string;
  filename: string;
}

export async function POST(req: NextRequest) {
  const {
    mode,
    customPrompt,
    subject,
    grade,
    examType,
    board,
    chapters,
    difficulty = "Standard",
    duration,
    questionMix,
    additionalInstructions,
    fileData,
    outputLanguage,
  }: {
    mode?: "form" | "custom";
    customPrompt?: string;
    subject: string;
    grade: string;
    examType: string;
    board: string;
    chapters: string;
    difficulty?: string;
    duration: string;
    questionMix?: QuestionMix;
    additionalInstructions?: string;
    fileData?: FileData;
    outputLanguage?: string;
  } = await req.json();

  const isHindiSubject = subject?.toLowerCase() === "hindi";
  const lang = outputLanguage || "auto";
  let languageInstruction = "";
  if (lang === "hindi" || (lang === "auto" && isHindiSubject)) {
    languageInstruction = `CRITICAL LANGUAGE REQUIREMENT: Generate ALL content in Hindi using Devanagari script. This includes: all questions, instructions, section headings, answer options, MCQ choices, examples, activities, homework questions, and the complete answer key. The entire output must be in Hindi — not English. Use simple, clear Hindi appropriate for Class ${grade} students. Only keep these in English: 'MCQ', 'Section A/B/C/D', marks in numerals, and internationally used scientific terms. Do not translate proper nouns, scientific formulas, or mathematical symbols.`;
  } else if (lang === "hinglish") {
    languageInstruction = `LANGUAGE REQUIREMENT: Generate content in Hinglish — a natural mix of Hindi and English as commonly spoken and written by Indian teachers. Write instructions and explanations in Hindi (Devanagari) but use English for technical terms, subject-specific vocabulary, and where English is more commonly used in Indian classrooms.`;
  } else {
    languageInstruction = `Generate all content in clear, simple English appropriate for Indian school students.`;
  }

  if (mode === "custom") {
    if (!customPrompt?.trim()) {
      return new Response("Prompt is required", { status: 400 });
    }
  } else {
    if (!chapters?.trim()) {
      return new Response("Chapters covered is required", { status: 400 });
    }
  }

  // Auth & usage-limit check
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  let userId: string | null = null;
  let userSupa: ReturnType<typeof createClient> | null = null;

  if (token) {
    const { data: { user } } = await supabase.auth.getUser(token);
    if (user) {
      userId = user.id;
      userSupa = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      );
      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_tier")
        .eq("id", userId)
        .single();
      const isPremium = profile?.subscription_tier === "premium";
      if (!isPremium) {
        const { count } = await userSupa
          .from("usage_tracking")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("month_year", monthYear());
        if ((count ?? 0) >= FREE_LIMIT) {
          return new Response(
            "You have used all 5 free generations this month. Upgrade to Premium for unlimited access.",
            { status: 429 }
          );
        }
      }
    }
  }

  const mix: QuestionMix = questionMix ?? { mcq: 10, shortTwo: 3, shortThree: 2, longFour: 1, longFive: 0 };
  const calcTotal = mix.mcq * 1 + mix.shortTwo * 2 + mix.shortThree * 3 + mix.longFour * 4 + mix.longFive * 5;

  const chapterNote =
    fileData?.type === "text" && fileData.text
      ? `\n\nUploaded Reference Material (from "${fileData.filename}"):\n${fileData.text.slice(0, 8000)}`
      : fileData
      ? `\n\nA file named "${fileData.filename}" has been uploaded as reference. Use its content to set questions from the uploaded chapters.`
      : "";

  const noChapterNote = !fileData
    ? `\n\nNo specific textbook content was provided. The teacher mentioned: "${chapters}". Generate questions based on standard NCERT curriculum for ${grade} ${subject}. If chapters are vague (e.g. "all chapters"), distribute questions evenly across all major topics of the standard NCERT syllabus for this class and subject. After each question, add in brackets which chapter/topic it is from.`
    : "";

  const mixLines = [
    mix.mcq > 0 ? `  - Section A — MCQs (1 mark each): ${mix.mcq} questions` : null,
    mix.shortTwo > 0 ? `  - Section B — Short Answer 2 marks: ${mix.shortTwo} questions` : null,
    mix.shortThree > 0 ? `  - Section C — Short Answer 3 marks: ${mix.shortThree} questions` : null,
    mix.longFour > 0 ? `  - Section D — Long Answer 4 marks: ${mix.longFour} questions` : null,
    mix.longFive > 0 ? `  - Section E — Long Answer 5 marks: ${mix.longFive} questions` : null,
  ].filter(Boolean).join("\n");

  const formattingRules = `
IMPORTANT FORMATTING RULES: Never use HTML entities like &emsp; &nbsp; &amp; or any HTML tags in your response. Use plain text only. For MCQ options use this exact format:
(a) option one   (b) option two   (c) option three   (d) option four
Use regular spaces between options. Never use HTML.

CRITICAL: In the QUESTION PAPER section (between ===QUESTION PAPER START=== and ===QUESTION PAPER END===), there must be ZERO answers, ZERO answer lines, ZERO "Answer: ______" lines, ZERO hints. The question paper section contains ONLY questions, marks, and instructions. All answers, answer keys, marking schemes, and model answers go ONLY in the ANSWER KEY section (between ===ANSWER KEY START=== and ===ANSWER KEY END===). This separation is absolute — no exceptions.`;

  const qualityRequirements = `${formattingRules}

Important quality requirements: (1) Every question must be clear, unambiguous, and grade-appropriate. (2) The answer key must cover EVERY question — no exceptions. (3) Marks must add up correctly to ${calcTotal}. (4) Follow the exact ${board} format specified. (5) Use Indian names, places, and contexts in word problems.${subject === "Science" ? " For Science papers: include at least 2 diagram-based questions — write the question and add '(Draw and label a diagram)' or specify the diagram name for the teacher to draw before printing." : ""}${subject === "Mathematics" ? " For Maths papers: include at least one real-life Indian context word problem per section — like GST calculation, field measurement, or cricket statistics. The answer key must show full working." : ""}`;

  const subjectInstruction = `\n${qualityRequirements}${noChapterNote}`;

  // Difficulty-level instruction
  let difficultyInstruction = "";
  if (difficulty === "Easy") {
    difficultyInstruction = "Difficulty: Create an accessible paper with approximately 70% straightforward recall and basic application questions, 20% medium questions, and 10% challenging questions. Use simple, clear language throughout.";
  } else if (difficulty === "Challenging") {
    difficultyInstruction = "Difficulty: Create a rigorous paper with approximately 20% recall questions, 40% application questions, and 40% higher-order thinking, analysis, and evaluation questions. Include complex word problems and multi-step questions.";
  } else {
    difficultyInstruction = "Difficulty: Create a balanced paper with approximately 40% easy recall questions, 40% medium application questions, and 20% challenging higher-order questions.";
  }

  // Output structure directive
  const outputStructure = `
Structure your output EXACTLY like this — use these delimiters precisely:

===QUESTION PAPER START===
[Complete formatted question paper — questions only, no answers, proper sections, marks per question, general instructions at top]
===QUESTION PAPER END===

===ANSWER KEY START===
[ FOR TEACHER USE ONLY ]
[Complete answer key with model answers and marking scheme for every single question — do not skip any question]
===ANSWER KEY END===`;

  const allThreeOutputStructure = `
Structure your output EXACTLY like this — use these delimiters precisely:

===EASY QUESTION PAPER START===
[Complete Easy-level question paper]
===EASY QUESTION PAPER END===
===EASY ANSWER KEY START===
[ FOR TEACHER USE ONLY — EASY PAPER ]
[Complete answer key for Easy paper]
===EASY ANSWER KEY END===

===STANDARD QUESTION PAPER START===
[Complete Standard-level question paper]
===STANDARD QUESTION PAPER END===
===STANDARD ANSWER KEY START===
[ FOR TEACHER USE ONLY — STANDARD PAPER ]
[Complete answer key for Standard paper]
===STANDARD ANSWER KEY END===

===CHALLENGING QUESTION PAPER START===
[Complete Challenging-level question paper]
===CHALLENGING QUESTION PAPER END===
===CHALLENGING ANSWER KEY START===
[ FOR TEACHER USE ONLY — CHALLENGING PAPER ]
[Complete answer key for Challenging paper]
===CHALLENGING ANSWER KEY END===`;

  let formPrompt: string;

  if (difficulty === "All Three Levels") {
    formPrompt = `You are an expert teacher creating exam papers for Indian school students. Generate THREE complete exam papers at different difficulty levels.

${languageInstruction}

**Exam Details (apply to all three papers):**
- Subject: ${subject}
- Grade: ${grade}
- Board: ${board}
- Exam Type: ${examType}
- Chapters / Topics Covered: ${chapters}
- Total Marks per paper: ${calcTotal}
- Duration: ${duration}
${additionalInstructions?.trim() ? `- Additional Instructions: ${additionalInstructions.trim()}` : ""}${chapterNote}

**Question Mix (same for all three papers):**
${mixLines}

**Paper 1 — Easy:** Create an accessible paper with approximately 70% straightforward recall and basic application questions, 20% medium questions, and 10% challenging questions. Use simple language.

**Paper 2 — Standard:** Create a balanced paper with approximately 40% easy recall questions, 40% medium application questions, and 20% challenging higher-order questions.

**Paper 3 — Challenging:** Create a rigorous paper with approximately 20% recall questions, 40% application questions, and 40% higher-order thinking, analysis, and evaluation questions. Include complex word problems.

${subjectInstruction}

${allThreeOutputStructure}`;
  } else {
    formPrompt = `You are an expert teacher creating an exam paper for Indian school students. Create a complete, print-ready exam paper.

${languageInstruction}

**Exam Details:**
- Subject: ${subject}
- Grade: ${grade}
- Board: ${board}
- Exam Type: ${examType}
- Chapters / Topics Covered: ${chapters}
- Total Marks: ${calcTotal}
- Duration: ${duration}
- ${difficultyInstruction}
${additionalInstructions?.trim() ? `- Additional Instructions: ${additionalInstructions.trim()}` : ""}${chapterNote}

**Question Mix:**
${mixLines}

Set questions only from the chapters listed above. Use clear, grade-appropriate language.

The exam paper header should be:
**${subject} — ${examType}**
Grade: ${grade} | Board: ${board} | Total Marks: ${calcTotal} | Time Allowed: ${duration}

**Student Name:** _________________________________ | **Roll No.:** _______ | **Date:** _____________

${subjectInstruction}

${outputStructure}`;
  }

  const finalPrompt = mode === "custom" ? customPrompt! + chapterNote : formPrompt;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content: any[] = [];

  if (fileData?.type === "image" && fileData.data && fileData.mimeType) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: fileData.mimeType, data: fileData.data },
    });
  }

  if (fileData?.type === "pdf" && fileData.data) {
    content.push({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: fileData.data },
    });
  }

  content.push({ type: "text", text: finalPrompt });

  const maxTokens = difficulty === "All Three Levels" ? 8000 : 3500;

  const stream = anthropic.messages.stream(
    {
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      messages: [
        { role: "user", content: content as Anthropic.MessageParam["content"] },
      ],
    },
    fileData?.type === "pdf"
      ? { headers: { "anthropic-beta": "pdfs-2024-09-25" } }
      : undefined
  );

  const encoder = new TextEncoder();
  let streamSucceeded = false;

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        streamSucceeded = true;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Generation failed. Please try again.";
        controller.enqueue(encoder.encode(`__STREAM_ERROR__${message}`));
      } finally {
        controller.close();
        if (userId && streamSucceeded && userSupa) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (userSupa as any).from("usage_tracking").insert([{
              user_id: userId,
              feature_used: "exam-paper",
              month_year: monthYear(),
            }]);
          } catch { /* non-critical */ }
        }
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
