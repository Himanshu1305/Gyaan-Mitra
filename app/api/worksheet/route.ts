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
  const body = await req.json();
  const {
    mode,
    customPrompt,
    subject,
    grade,
    topic,
    worksheetType,
    difficulty,
    questionMix,
    board,
    additionalInstructions,
    fileData,
  }: {
    mode?: "form" | "custom";
    customPrompt?: string;
    subject: string;
    grade: string;
    topic: string;
    worksheetType: string;
    difficulty: string;
    questionMix?: QuestionMix;
    board: string;
    additionalInstructions?: string;
    fileData?: FileData;
  } = body;

  if (mode === "custom") {
    if (!customPrompt?.trim()) {
      return new Response("Prompt is required", { status: 400 });
    }
  } else {
    if (!topic?.trim()) {
      return new Response("Topic is required", { status: 400 });
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

  const mix: QuestionMix = questionMix ?? { mcq: 10, shortTwo: 0, shortThree: 0, longFour: 0, longFive: 0 };
  const totalMarks = mix.mcq * 1 + mix.shortTwo * 2 + mix.shortThree * 3 + mix.longFour * 4 + mix.longFive * 5;

  const chapterNote =
    fileData?.type === "text" && fileData.text
      ? `\n\nChapter Content (from "${fileData.filename}"):\n${fileData.text.slice(0, 8000)}`
      : fileData
      ? `\n\nA file named "${fileData.filename}" has been uploaded. Use its content to make the worksheet specific to the uploaded chapter.`
      : "";

  const mixLines = [
    mix.mcq > 0 ? `- **MCQs (1 mark each):** ${mix.mcq} questions (4 options A–D)` : null,
    mix.shortTwo > 0 ? `- **Short Answer – 2 marks:** ${mix.shortTwo} questions` : null,
    mix.shortThree > 0 ? `- **Short Answer – 3 marks:** ${mix.shortThree} questions` : null,
    mix.longFour > 0 ? `- **Long Answer – 4 marks:** ${mix.longFour} questions` : null,
    mix.longFive > 0 ? `- **Long Answer – 5 marks:** ${mix.longFive} questions` : null,
  ].filter(Boolean).join("\n");

  const questionFormatGuide =
    worksheetType === "Multi-level — Three Levels"
      ? `Divide the questions into three sections:
- **Section A – Basic (Easy):** Simple recall and recognition questions
- **Section B – Intermediate:** Application and understanding questions
- **Section C – Advanced:** Analysis, evaluation, or creative questions

Question Mix across all sections:
${mixLines}

Total Marks: ${totalMarks}`
      : worksheetType === "Activity"
      ? `Create activity-based tasks matching this question mix:
${mixLines}

Total Marks: ${totalMarks}

Include hands-on activities, observations, investigations, or creative projects appropriate for ${grade}.`
      : `Create questions using the following mix:
${mixLines}

Total Marks: ${totalMarks}

Adjust question formats based on ${difficulty} difficulty.`;

  const formPrompt = `You are an experienced teacher creating a worksheet for Indian school students.

Subject: ${subject}
Grade: ${grade}
Board: ${board}
Topic: ${topic}
Worksheet Type: ${worksheetType}
Difficulty: ${difficulty}${chapterNote}
${additionalInstructions?.trim() ? `Additional Instructions: ${additionalInstructions.trim()}` : ""}

Create a complete, well-formatted worksheet using the structure below.

## Worksheet

**Subject:** ${subject} | **Grade:** ${grade} | **Topic:** ${topic} | **Board:** ${board} | **Total Marks:** ${totalMarks}

**Name:** _________________________________ | **Date:** _____________ | **Roll No.:** _______

---

## Instructions for Students
[Write 2–3 clear, grade-appropriate instructions]

## Questions

${questionFormatGuide}

Use simple language appropriate for ${grade} students. Include Indian-context names, places, and examples where relevant (e.g. Ramesh, Priya, Delhi, cricket, rupees). Number every question clearly. Group questions by type with clear section headings and marks.

---

## Answer Key

**[Complete Answer Key — for teacher use only]**

Provide correct answers for every question. For MCQs state the letter and answer. For fill-in-the-blank give the exact word(s). For short/long answers give a model answer with marks breakdown.

Format the worksheet clearly with proper spacing between questions. Make it print-ready.`;

  const finalPrompt = mode === "custom" ? customPrompt! + chapterNote : formPrompt;

  // Build multimodal content array
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

  const stream = anthropic.messages.stream(
    {
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
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
              feature_used: "worksheet",
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
