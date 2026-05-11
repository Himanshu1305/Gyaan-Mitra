import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";

type ChapterSelection = {
  chapterName: string;
  bookDisplayName: string;
  marks: number;
  questionType: string;
  filePath: string;
};

type RequestBody = {
  generationType: "lesson-plan" | "worksheet" | "exam-paper";
  chapterSelections: ChapterSelection[];
  additionalInstructions: string;
  board: string;
  classNumber: number;
  subject: string;
};

const STORAGE_BASE =
  "https://bpvakrgthezixqzslmng.supabase.co/storage/v1/object/public/ncert-books";

async function fetchPdfBase64(filePath: string): Promise<string | null> {
  try {
    const url = `${STORAGE_BASE}/${filePath}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return Buffer.from(buf).toString("base64");
  } catch {
    return null;
  }
}

async function analyzeWithGemini(chapters: ChapterSelection[]): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const parts: { inlineData: { data: string; mimeType: string } }[] = [];
  const loaded: string[] = [];

  for (const ch of chapters.slice(0, 20)) {
    const b64 = await fetchPdfBase64(ch.filePath);
    if (b64) {
      parts.push({ inlineData: { data: b64, mimeType: "application/pdf" } });
      loaded.push(`${ch.bookDisplayName}: ${ch.chapterName}`);
    }
  }

  if (parts.length === 0) throw new Error("No PDFs could be fetched");

  const prompt = `Analyze these NCERT textbook chapters: ${loaded.join(", ")}.
For each chapter extract: main topics, key concepts, important diagrams/figures mentioned, and sample questions from exercises.
Return structured JSON with chapter name as key.`;

  const result = await model.generateContent([prompt, ...parts]);
  return result.response.text();
}

function buildClaudePrompt(body: RequestBody, geminiOutput: string, isFallback: boolean): string {
  const { generationType, chapterSelections, additionalInstructions, board, classNumber, subject } = body;

  const chapterList = chapterSelections
    .map(
      (c) =>
        `${c.bookDisplayName} - ${c.chapterName}: ${c.marks} marks (${c.questionType})`
    )
    .join("\n");

  const contentSection = isFallback
    ? `Chapters to cover:\n${chapterList}`
    : `NCERT Chapter Content (extracted from actual textbooks):\n${geminiOutput}\n\nMarks distribution by chapter:\n${chapterList}`;

  if (generationType === "exam-paper") {
    return `You are an expert Indian school teacher. Create a ${board} exam paper for Class ${classNumber} ${subject}.

${contentSection}

Teacher instructions: ${additionalInstructions || "None"}

Format as a proper exam paper with clear sections (Section A, B, C etc.) and question numbers. Questions must come from the chapter content above. Do not include answer key — that is generated separately. Include marks for each question in brackets.`;
  }

  if (generationType === "worksheet") {
    return `You are an expert Indian school teacher. Create a practice worksheet for Class ${classNumber} ${subject} (${board} curriculum).

${contentSection}

Teacher instructions: ${additionalInstructions || "None"}

Create a well-structured worksheet with varied question types as specified per chapter. Include clear instructions for each section. Questions must be based on the chapter content above. Format clearly with question numbers and marks.`;
  }

  // lesson-plan
  return `You are an expert Indian school teacher. Create a detailed lesson plan for Class ${classNumber} ${subject} (${board} curriculum).

Chapters:
${chapterSelections.map((c) => `- ${c.bookDisplayName}: ${c.chapterName}`).join("\n")}

${isFallback ? "" : `Chapter content overview:\n${geminiOutput}\n`}
Teacher instructions: ${additionalInstructions || "None"}

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

export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json();
    const { generationType, chapterSelections } = body;

    if (!generationType || !chapterSelections || chapterSelections.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Step A — Gemini reads PDFs
    let geminiOutput = "";
    let isFallback = false;
    try {
      console.log(`[generate-with-chapters] Gemini analyzing ${chapterSelections.length} chapters…`);
      geminiOutput = await analyzeWithGemini(chapterSelections);
      console.log("[generate-with-chapters] Gemini done");
    } catch (err) {
      console.warn("[generate-with-chapters] Gemini failed, falling back to chapter names:", err);
      isFallback = true;
    }

    // Step B — Claude generates content
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }

    const client = new Anthropic({ apiKey: anthropicKey });
    const prompt = buildClaudePrompt(body, geminiOutput, isFallback);

    console.log(`[generate-with-chapters] Claude generating ${generationType}…`);
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    });

    const draft = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n");

    console.log("[generate-with-chapters] Done");

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
