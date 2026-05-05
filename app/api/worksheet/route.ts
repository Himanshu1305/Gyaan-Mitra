import { anthropic } from "@/lib/anthropic";
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

interface FileData {
  type: "pdf" | "image" | "text";
  data?: string;
  text?: string;
  mimeType?: string;
  filename: string;
}

export async function POST(req: NextRequest) {
  const {
    subject,
    grade,
    topic,
    worksheetType,
    difficulty,
    numQuestions,
    board,
    additionalInstructions,
    fileData,
  }: {
    subject: string;
    grade: string;
    topic: string;
    worksheetType: string;
    difficulty: string;
    numQuestions: string;
    board: string;
    additionalInstructions?: string;
    fileData?: FileData;
  } = await req.json();

  if (!topic?.trim()) {
    return new Response("Topic is required", { status: 400 });
  }

  const chapterNote =
    fileData?.type === "text" && fileData.text
      ? `\n\nChapter Content (from "${fileData.filename}"):\n${fileData.text.slice(0, 8000)}`
      : fileData
      ? `\n\nA file named "${fileData.filename}" has been uploaded. Use its content to make the worksheet specific to the uploaded chapter.`
      : "";

  const questionFormatGuide =
    worksheetType === "Multi-level — Three Levels"
      ? `Divide the ${numQuestions} questions into three sections:
- **Section A – Basic (Easy):** Simple recall and recognition questions (approx. ${Math.ceil(parseInt(numQuestions) * 0.4)} questions)
- **Section B – Intermediate:** Application and understanding questions (approx. ${Math.floor(parseInt(numQuestions) * 0.35)} questions)
- **Section C – Advanced:** Analysis, evaluation, or creative questions (approx. ${Math.floor(parseInt(numQuestions) * 0.25)} questions)`
      : worksheetType === "Activity"
      ? `Create ${numQuestions} activity-based tasks — include hands-on activities, observations, investigations, or creative projects appropriate for ${grade}.`
      : `Create ${numQuestions} questions using a mix of formats: MCQs (with 4 options labelled A–D), fill-in-the-blanks, and short-answer questions. Adjust the ratio based on ${difficulty} difficulty.`;

  const prompt = `You are an experienced teacher creating a worksheet for Indian school students.

Subject: ${subject}
Grade: ${grade}
Board: ${board}
Topic: ${topic}
Worksheet Type: ${worksheetType}
Difficulty: ${difficulty}
Number of Questions: ${numQuestions}${chapterNote}
${additionalInstructions?.trim() ? `Additional Instructions: ${additionalInstructions.trim()}` : ""}

Create a complete, well-formatted worksheet using the structure below.

## Worksheet

**Subject:** ${subject} | **Grade:** ${grade} | **Topic:** ${topic} | **Board:** ${board}

**Name:** _________________________________ | **Date:** _____________ | **Roll No.:** _______

---

## Instructions for Students
[Write 2–3 clear, grade-appropriate instructions]

## Questions

${questionFormatGuide}

Use simple language appropriate for ${grade} students. Include Indian-context names, places, and examples where relevant (e.g. Ramesh, Priya, Delhi, cricket, rupees). Number every question clearly.

---

## Answer Key

**[Complete Answer Key — for teacher use only]**

Provide correct answers for every question. For MCQs state the letter and answer. For fill-in-the-blank give the exact word(s). For short answers give a model answer.

Format the worksheet clearly with proper spacing between questions. Make it print-ready.`;

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

  content.push({ type: "text", text: prompt });

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

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Generation failed. Please try again.";
        controller.enqueue(encoder.encode(`__STREAM_ERROR__${message}`));
      } finally {
        controller.close();
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
