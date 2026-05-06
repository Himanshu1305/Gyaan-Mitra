import { anthropic } from "@/lib/anthropic";
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

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
    totalMarks,
    duration,
    questionMix,
    additionalInstructions,
    fileData,
  }: {
    mode?: "form" | "custom";
    customPrompt?: string;
    subject: string;
    grade: string;
    examType: string;
    board: string;
    chapters: string;
    totalMarks: number;
    duration: string;
    questionMix?: QuestionMix;
    additionalInstructions?: string;
    fileData?: FileData;
  } = await req.json();

  if (mode === "custom") {
    if (!customPrompt?.trim()) {
      return new Response("Prompt is required", { status: 400 });
    }
  } else {
    if (!chapters?.trim()) {
      return new Response("Chapters covered is required", { status: 400 });
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

  const mixLines = [
    mix.mcq > 0 ? `  - Section A — MCQs (1 mark each): ${mix.mcq} questions` : null,
    mix.shortTwo > 0 ? `  - Section B — Short Answer 2 marks: ${mix.shortTwo} questions` : null,
    mix.shortThree > 0 ? `  - Section C — Short Answer 3 marks: ${mix.shortThree} questions` : null,
    mix.longFour > 0 ? `  - Section D — Long Answer 4 marks: ${mix.longFour} questions` : null,
    mix.longFive > 0 ? `  - Section E — Long Answer 5 marks: ${mix.longFive} questions` : null,
  ].filter(Boolean).join("\n");

  const formPrompt = `You are an expert teacher creating an exam paper for Indian school students. Create a complete, print-ready exam paper.

**Exam Details:**
- Subject: ${subject}
- Grade: ${grade}
- Board: ${board}
- Exam Type: ${examType}
- Chapters / Topics Covered: ${chapters}
- Total Marks: ${totalMarks} (Question mix total: ${calcTotal})
- Duration: ${duration}
${additionalInstructions?.trim() ? `- Additional Instructions: ${additionalInstructions.trim()}` : ""}${chapterNote}

Generate the exam paper using the structure below. Set questions only from the chapters listed above. Use clear, grade-appropriate language.

---

## ${subject} — ${examType}

**Grade:** ${grade} | **Board:** ${board} | **Total Marks:** ${totalMarks} | **Time Allowed:** ${duration}

**Student Name:** _________________________________ &nbsp;&nbsp; **Roll No.:** _______ &nbsp;&nbsp; **Date:** _____________

---

### General Instructions
1. All questions are compulsory.
2. Read each question carefully before answering.
3. Write neat and legible answers.
[Add 1–2 more subject-specific instructions]

---

${mixLines}

[Create all questions section by section, with clear section headings, question numbers, and marks for each question. For MCQs include 4 options labelled A–D. Use Indian-context names and examples (Ramesh, Priya, Delhi, rupees, etc.). Ensure questions cover the chapters listed.]

---

## Answer Key & Marking Scheme

**[For Teacher Use Only]**

Provide the correct answer for every question. For MCQs: state the letter and full answer. For short/long answers: give a model answer with marks breakdown (e.g. 1 mark for definition, 1 mark for example).

Format the paper clearly with proper spacing. Make it print-ready.`;

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

  const stream = anthropic.messages.stream(
    {
      model: "claude-sonnet-4-6",
      max_tokens: 3500,
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
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Generation failed. Please try again.";
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
