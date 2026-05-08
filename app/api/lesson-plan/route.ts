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
    topic,
    board,
    duration,
    additionalInstructions,
    fileData,
    outputLanguage,
  }: {
    mode?: "form" | "custom";
    customPrompt?: string;
    subject: string;
    grade: string;
    topic: string;
    board: string;
    duration: string;
    additionalInstructions?: string;
    fileData?: FileData;
    outputLanguage?: string;
  } = await req.json();

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

  const chapterNote =
    fileData?.type === "text" && fileData.text
      ? `\n\n**Uploaded Chapter Content (from "${fileData.filename}"):**\n${fileData.text.slice(0, 8000)}`
      : fileData
      ? `\n\nA file named "${fileData.filename}" has been uploaded as reference material. Use its content to tailor the lesson plan to the specific chapter.`
      : "";

  const formPrompt = `You are an expert teacher trainer and curriculum designer specialising in Indian school education. Create a detailed, ready-to-use lesson plan for a classroom teacher.

${languageInstruction}

IMPORTANT FORMATTING RULES: Never use HTML entities like &emsp; &nbsp; &amp; or any HTML tags in your response. Use plain text only. For MCQ options use this exact format:
(a) option one   (b) option two   (c) option three   (d) option four
Use regular spaces between options. Never use HTML.

**Lesson Details:**
- Subject: ${subject}
- Grade: ${grade}
- Topic: ${topic}
- Board: ${board}
- Duration: ${duration}
${additionalInstructions?.trim() ? `- Additional Instructions: ${additionalInstructions.trim()}` : ""}${chapterNote}

Generate a structured lesson plan using the sections below. Keep timings realistic for a ${duration} class. Write in clear, practical language a teacher can directly follow.

## Learning Objectives
List 3–5 measurable objectives using Bloom's Taxonomy action verbs (e.g. identify, explain, apply, analyse, create).

## Materials & Resources
Bullet list of everything needed: textbook chapters, manipulatives, charts, worksheets, digital tools, etc.

## Prior Knowledge
What students should already know or be able to do before this lesson.

## Lesson Plan

### Warm-Up / Hook (5 min)
An engaging opening activity, question, or demonstration to capture curiosity and link to prior knowledge.

### Introduction to New Concept (approx. ${Math.round(parseInt(duration) * 0.3)} min)
Step-by-step explanation of the core concept with key vocabulary, examples, and teacher talk points. Include at least one relatable, India-specific example.

### Guided Practice (approx. ${Math.round(parseInt(duration) * 0.25)} min)
Classroom activities where students practise with teacher support — think-pair-share, board work, group tasks, Q&A.

### Independent / Group Activity (approx. ${Math.round(parseInt(duration) * 0.25)} min)
Task students complete on their own or in small groups to consolidate learning.

### Closure & Recap (5 min)
Exit ticket, quick quiz, or class discussion to summarise and check understanding.

## Assessment Strategy
- **Formative (during class):** How you will check understanding throughout the lesson.
- **Summative (post-class):** Homework or assignment to assess learning outcomes.

## Differentiation
- **Support (struggling learners):** Scaffolds, simplified tasks, peer support.
- **Extension (advanced learners):** Challenge questions, research tasks, creative projects.

## ${board}-Specific Notes
Key curriculum alignments, chapter references, or pedagogy notes specific to ${board} for this topic.

Format clearly using headings, bullet points, and timing labels. Make it immediately usable.`;

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
      max_tokens: 2500,
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
              feature_used: "lesson-plan",
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
