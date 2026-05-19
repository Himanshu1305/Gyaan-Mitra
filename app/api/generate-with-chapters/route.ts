import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { resolveAllPlaceholders } from "@/lib/svg-generator";

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

const EXAM_PAPER_SYSTEM_PROMPT = `
You are an expert Indian school exam paper setter with 20+ years of experience
setting papers for CBSE, ICSE, and State Board examinations for Classes 6–12.
You have deep knowledge of NCERT curriculum, NEP 2020 guidelines, and competency-based assessment.

═══════════════════════════════════════════════════════
SECTION 1 — PAPER FORMAT (ALWAYS FOLLOW)
═══════════════════════════════════════════════════════

Every exam paper must follow this exact CBSE structure:

HEADER:
[School Name]
[Subject] — Class [X]
Chapter: [Chapter Name]
Time Allowed: [X] Hours | Maximum Marks: [X]

INSTRUCTIONS TO STUDENTS:
1. All questions are compulsory.
2. Read each question carefully before answering.
3. Draw neat, labelled diagrams wherever required.
4. Write answers in the space provided.

---

Section A — Multiple Choice Questions (1 mark each)
Section B — Short Answer Questions (2 marks each)
Section C — Answer in Detail (3 marks each)
Section D — Long Answer / Case-Based Questions (5 marks each)

RULES:
- Section headings state marks per question — do NOT repeat marks on individual questions
- Number questions sequentially across all sections — do not restart per section
- Leave a blank line between each question
- For MCQs: provide exactly 4 options labeled (a), (b), (c), (d)

═══════════════════════════════════════════════════════
SECTION 2 — DIFFICULTY LEVEL RULES
═══════════════════════════════════════════════════════

── EASY ──────────────────────────────────────────────
QUESTIONS: Use exact NCERT textbook questions wherever possible. Remaining questions must be similar-style (same concept, different numbers or wording). No novel scenarios. Bloom's levels 1-2 only.

── STANDARD ──────────────────────────────────────────
QUESTIONS: Sections A & B — NCERT + similar-style mix. Sections C & D — application questions based on chapter concepts in new contexts. No out-of-syllabus content.

── CHALLENGING ───────────────────────────────────────
QUESTIONS: Section A — NCERT + application MCQs. Sections B, C, D — mostly novel scenarios, data interpretation, case-based questions. Chapter-locked always. No hallucination. Bloom's levels 3-6.

═══════════════════════════════════════════════════════
SECTION 3 — SUBJECT-SPECIFIC RULES
═══════════════════════════════════════════════════════

BIOLOGY: Include questions on life processes, cell biology, reproduction, and ecology as per chapter content.

PHYSICS: Include at least one numerical in Sections C or D. Format: given values → formula → substitution → answer with units.

CHEMISTRY: Balance all equations. Show complete step-by-step working for numericals. Never include reactions not in the specified chapter.

MATHEMATICS: Include geometry, algebra, and application-based questions as per chapter. Graphs must have labeled axes, marked origin, stated scale. Show all construction steps.

GEOGRAPHY: Always include map questions. Add "(Outline map to be provided separately to students)" for map-based questions.

HISTORY / POLITICAL SCIENCE / ECONOMICS / SOCIOLOGY: Focus on text-based, analytical questions appropriate to the chapter.

HINDI / ENGLISH / SANSKRIT: Focus on comprehension, grammar, writing, and literature questions. Paper content in the selected language.

═══════════════════════════════════════════════════════
SECTION 4 — QUALITY RULES (NEVER VIOLATE)
═══════════════════════════════════════════════════════

1. CHAPTER-LOCKED: Every question based on specified chapter only. No other chapters even if related.
2. NO HALLUCINATION: Every fact, formula, diagram description must match NCERT exactly. If uncertain, do not include it.
3. NO OUT-OF-SYLLABUS: No topics outside the specified class and chapter.
4. MARKS CONSISTENCY: No marks on individual questions. Section headings only.
5. QUESTIONS ONLY: Do not add any diagram placeholders, [FIGURE:], or [SVG:] tags. Diagrams are handled separately after generation.
6. COMPLETE QUESTIONS: Every question fully self-contained. Student needs only the paper and its diagrams.
7. LANGUAGE: Write paper content in selected language. For Hindi medium — Devanagari script for all question text and options.
8. NEP 2020: Easy = Bloom's 1-2. Standard = Bloom's 2-3. Challenging = Bloom's 3-6.
9. ANSWER SPACES: Do not add answer lines or boxes. Frontend handles this.
`;

const DIAGRAM_CLASSIFIER_PROMPT = `You are a diagram classifier for Indian school exam papers (CBSE/ICSE Classes 6-12).

You will receive a complete exam paper. For EVERY question, decide which diagram category applies.

CATEGORY NONE — Student draws the diagram themselves:
Use when question contains ANY of these phrases:
"draw a diagram", "draw a neat", "draw a labelled", "draw a ray diagram",
"draw a circuit diagram", "draw and label", "sketch a diagram", "sketch the",
"with the help of a diagram explain", "with a neat diagram", "with a labelled diagram",
"draw the following", "draw a schematic", "construct a diagram"
→ Student draws it in the exam. Never provide a diagram.

CATEGORY FIGURE — Provide an NCERT textbook diagram for student to study/analyse:
Use when question contains ANY of these phrases:
"study the diagram", "study the figure", "refer to the diagram", "refer to the figure",
"the diagram below shows", "the figure below shows", "in the given figure",
"observe the diagram", "observe the following diagram", "based on the diagram",
"in the circuit shown", "the following diagram shows", "from the diagram",
"label the parts", "identify the parts marked", "name the parts shown"
→ Provide actual NCERT textbook image for student to study.

CATEGORY SVG — Generate a custom diagram for student to analyse:
Use ONLY for Physics, Maths, Chemistry when:
- Question provides specific values/measurements for a novel scenario
- No standard NCERT diagram would match (custom circuit values, specific geometry)
- Question says "the circuit below" or "the figure shows" with specific novel data
→ Generate SVG from description.

CATEGORY NONE for these always — regardless of subject:
- Any question asking student to "draw", "sketch", "construct"
- Questions about language/literature/history/economics/political science
  (these subjects rarely need diagrams in exam papers)

Return ONLY a valid JSON array. No markdown. No explanation. No code fences.
Start with [ and end with ].

Format:
[
  {
    "question_number": 1,
    "decision": "NONE",
    "keywords": [],
    "svg_description": ""
  },
  {
    "question_number": 5,
    "decision": "FIGURE",
    "keywords": ["human eye", "cornea", "iris", "crystalline lens", "retina", "ciliary muscles", "optic nerve"],
    "svg_description": ""
  },
  {
    "question_number": 8,
    "decision": "SVG",
    "keywords": [],
    "svg_description": "parallel circuit with 12V battery on left, three parallel branches: R1=4ohm top, R2=6ohm middle, R3=12ohm bottom, ammeter A in main wire, voltmeter V across R2, conventional current direction arrows, all components labeled"
  }
]

Rules:
- Include EVERY question number in the paper — even Section A MCQs
- MCQs are almost always NONE unless they show a diagram for student to identify
- Only output question_number, decision, keywords, svg_description
- keywords: 5-10 specific searchable terms for FIGURE decisions (empty array for NONE/SVG)
- svg_description: detailed description for SVG decisions (empty string for NONE/FIGURE)
- For FIGURE keywords: be specific — "human eye cross section" not just "eye"
  Include anatomical/technical terms teachers would search for
`;

const ANSWER_KEY_DIAGRAM_PROMPT = `You are a diagram classifier for Indian school exam paper ANSWER KEYS (not question papers).

You will receive an answer key. For every answer that involves a diagram, decide which category applies.

CATEGORY FIGURE — Show an NCERT textbook diagram as model answer:
Use when the answer mentions ANY of these:
"draw a neat labelled diagram", "draw a ray diagram",
"draw a circuit diagram", "draw a schematic",
"the diagram shows", "refer to diagram", "as shown in figure",
"label the following parts", "the following diagram",
"draw and label", "sketch showing"
→ This is a model answer — teacher needs to see the correct diagram.

CATEGORY SVG — Generate a custom diagram as model answer:
Use for Physics, Maths, Chemistry when answer describes a specific novel diagram with measurements or circuit values.

CATEGORY NONE — No diagram needed:
Use for text-only answers, MCQ explanations, definitions, numerical calculations without diagrams.

Return ONLY a valid JSON array. No markdown. No explanation.
Start with [ and end with ].

Format:
[
  {
    "question_number": 5,
    "decision": "FIGURE",
    "keywords": ["human eye", "cornea", "iris", "lens", "retina", "ciliary muscles", "optic nerve"],
    "svg_description": ""
  },
  {
    "question_number": 8,
    "decision": "SVG",
    "keywords": [],
    "svg_description": "ray diagram showing myopic eye correction with concave lens, object on left, rays converging in front of retina without lens, concave lens added, rays now focus on retina, labels: object, concave lens, retina, focal point"
  },
  {
    "question_number": 3,
    "decision": "NONE",
    "keywords": [],
    "svg_description": ""
  }
]

Rules:
- Include every question number that has a diagram-related answer
- For FIGURE keywords: be very specific — include exact anatomical or technical terms
- MCQ answer explanations are usually NONE unless they reference a specific diagram
- For "draw a ray diagram showing myopia" → FIGURE with keywords for myopia ray diagram
- For "draw a circuit with R1=4ohm R2=6ohm in parallel" → SVG
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
  return `\nINTERNAL CHOICE: Provide internal choice (OR questions) in ${named}. Format exactly as:\n**Q[N].** [First question]\n**OR**\n**Q[N].** [Alternative question]\n`;
}

interface DiagramDecision {
  question_number: number;
  decision: 'NONE' | 'FIGURE' | 'SVG';
  keywords: string[];
  svg_description: string;
}

async function runDiagramClassifier(
  paperContent: string,
  client: Anthropic,
  isAnswerKey: boolean = false
): Promise<DiagramDecision[]> {
  try {
    const systemPrompt = isAnswerKey
      ? ANSWER_KEY_DIAGRAM_PROMPT
      : DIAGRAM_CLASSIFIER_PROMPT;

    // Extract only Sections C and D for classification
    // Full paper is too long - classifier only needs higher-mark questions
    let content: string;
    const cdMatch = paperContent.match(/##\s*SECTION\s*[CD]/i);
    if (cdMatch && cdMatch.index) {
      const cdContent = paperContent.slice(cdMatch.index);
      content = cdContent.slice(0, 4000);
    } else {
      content = paperContent.slice(0, 4000);
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Classify diagrams for every question:\n\n${content}`,
        },
      ],
    });

    const rawText = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')
      .trim();

    console.log('[CLASSIFIER RAW OUTPUT]:', rawText.slice(0, 500));

    // Strategy 1: find outermost [ ]
    let jsonStr = '';
    const startIdx = rawText.indexOf('[');
    const endIdx = rawText.lastIndexOf(']');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      jsonStr = rawText.slice(startIdx, endIdx + 1);
    }

    // Strategy 2: strip markdown fences
    if (!jsonStr && rawText.includes('```')) {
      const match = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) jsonStr = match[1].trim();
    }

    if (!jsonStr) {
      console.log('[CLASSIFIER] No JSON found in response');
      return [];
    }

    // Pre-validate before parsing
    if (!jsonStr.startsWith('[') || !jsonStr.endsWith(']') || jsonStr.length <= 2) {
      console.log('[CLASSIFIER] Invalid JSON structure, skipping parse');
      return [];
    }

    try {
      const parsed = JSON.parse(jsonStr);
      if (!Array.isArray(parsed)) return [];
      console.log('[CLASSIFIER SUCCESS] decisions:', parsed.length,
        'non-NONE:', parsed.filter((d: DiagramDecision) => d.decision !== 'NONE').length);
      return parsed;
    } catch (parseErr) {
      console.error('[CLASSIFIER PARSE FAIL]', parseErr, 'jsonStr preview:', jsonStr.slice(0, 200));
      return [];
    }
  } catch (err) {
    console.error('[CLASSIFIER ERROR] non-fatal:', err);
    return [];
  }
}

function insertDiagramPlaceholders(
  paperContent: string,
  decisions: DiagramDecision[]
): string {
  const diagramDecisions = decisions.filter(
    (d) => d.decision === 'FIGURE' || d.decision === 'SVG'
  );

  if (diagramDecisions.length === 0) return paperContent;

  let result = paperContent;

  for (const decision of diagramDecisions) {
    let placeholder = '';
    if (decision.decision === 'FIGURE') {
      placeholder = `\n[FIGURE: ${decision.keywords.join(', ')}]`;
    } else if (decision.decision === 'SVG') {
      placeholder = `\n[SVG: ${decision.svg_description}]`;
    }

    const lines = result.split('\n');
    let inserted = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (
        line.match(new RegExp(`Q${decision.question_number}[.)\\s]`)) &&
        line.length > 5
      ) {
        let insertAt = i + 1;
        while (
          insertAt < lines.length &&
          lines[insertAt].trim() !== '' &&
          !lines[insertAt].match(/^[\*]?Q\d+[.)]/)
        ) {
          insertAt++;
        }
        lines.splice(insertAt, 0, placeholder.trim());
        inserted = true;
        break;
      }
    }

    if (inserted) {
      result = lines.join('\n');
    }
  }

  return result;
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

  // Handle FINALISE_AND_KEY: prefix — clean paper only (answer key generated in separate calls)
  if (/^FINALISE_AND_KEY:/i.test(additionalInstructions || "")) {
    const originalDraft = additionalInstructions.replace(/^FINALISE_AND_KEY:/i, "").trim();
    return `You are finalising an exam paper draft.

DRAFT PAPER TO FINALISE:
${originalDraft}

YOUR TASK:
Clean the exam paper: remove all chapter references, examiner notes, and teacher notes. Keep every question identical — do not alter wording or marks.

OUTPUT FORMAT — use EXACTLY these delimiters:
===CLEAN PAPER START===
[Cleaned exam paper — no chapter names, no teacher notes, all questions intact]
===CLEAN PAPER END===`;
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

    return `${EXAM_PAPER_SYSTEM_PROMPT}

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

   (a) [Option A]
   (b) [Option B]
   (c) [Option C]
   (d) [Option D]

   Answer: [ ]

   ## SECTION B — Short Answer Questions
   (X questions × 2 marks each = X marks)

   **Q[N].** [Question text]
   _____________________________
   _____________________________
   _____________________________

   ## SECTION C — Short Answer Questions
   (X questions × 3 marks each = X marks)

   **Q[N].** [Question text]
   _____________________________
   _____________________________
   _____________________________
   _____________________________
   _____________________________

   ## SECTION D — Long Answer Questions
   (X questions × 4/5 marks each = X marks)

   **Q[N].** [Question text]
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
   **Q[N].** [Question]
   **OR**
   **Q[N].** [Alternative question]

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

function formatMcqOptions(content: string): string {
  return content.replace(
    /\(([abcd])\)\s+([^([\n]+?)(?=\s*\([abcd]\)|\n|$)/gi,
    (match, letter, text) => `\n(${letter}) ${text.trim()}`
  );
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
    let draft: string;
    let ncertFiguresFound = 0;
    let ncertFiguresMissed = 0;
    let svgsGenerated = 0;
    let svgsFailed = 0;

    if (isFinalise) {
      // Parse cleaned paper from Call 1
      const PAPER_START = "===CLEAN PAPER START===";
      const PAPER_END = "===CLEAN PAPER END===";
      const psi = rawDraft.indexOf(PAPER_START);
      const pei = rawDraft.indexOf(PAPER_END);
      const cleanedPaper = psi !== -1 && pei > psi
        ? rawDraft.slice(psi + PAPER_START.length, pei).trim()
        : cleanAnswerSpaces(cleanNotes(rawDraft));

      // Pass 2: Classify diagrams for cleaned paper
      const finaliseDecisions = await runDiagramClassifier(cleanedPaper, client);
      const finaliseWithPlaceholders = insertDiagramPlaceholders(cleanedPaper, finaliseDecisions);
      const resolveResult = await resolveAllPlaceholders(
        finaliseWithPlaceholders,
        body.classNumber,
        body.subject,
      );
      const resolvedFinalPaper = resolveResult.resolvedContent;
      ncertFiguresFound = resolveResult.ncertFiguresFound;
      ncertFiguresMissed = resolveResult.ncertFiguresMissed;
      svgsGenerated = resolveResult.svgsGenerated;
      svgsFailed = resolveResult.svgsFailed;
      const formattedFinalPaper = formatMcqOptions(resolvedFinalPaper);

      const paperForKey = formattedFinalPaper || body.additionalInstructions.replace(/^FINALISE_AND_KEY:/i, "").trim();
      const isHindi = /hindi|हिंदी/i.test(body.subject);

      // Count total questions by scanning for Q\d+[.)] pattern
      const qNumMatches = paperForKey.match(/\bQ(\d+)[.)]/g) || [];
      const qNums = qNumMatches
        .map(m => parseInt(m.replace(/\D/g, ''), 10))
        .filter(n => !isNaN(n) && n > 0);
      const totalQuestions = qNums.length > 0 ? Math.max(...qNums) : 30;
      const halfQ = Math.ceil(totalQuestions / 2);
      console.log(`[generate-with-chapters] Answer key: totalQuestions=${totalQuestions}, halfQ=${halfQ}`);

      // Call 3a: answer Q1 to Q[halfQ]
      const prompt3a = `Generate the answer key for questions Q1 to Q${halfQ} ONLY.
Do not mention marks for individual questions.
${isHindi ? "Write everything in Hindi (Devanagari script).\n" : ""}
You must answer exactly these question numbers: Q1 to Q${halfQ}.
Count carefully. Do not skip any. If you finish early, you have missed questions — go back and complete all.

For MCQ answers: List every answer as Q1-(d), Q2-(c), Q3-(b)...
Then write one paragraph explanation for each MCQ.

For short and long answer questions: Write complete model answers for every question.

For diagram questions: describe the diagram clearly in words with all labels.
Do NOT draw ASCII art.
For answers involving diagrams: write a clear description of what the diagram shows, then on the next line write:
[Diagram: brief description of what to draw]
This helps the system generate the correct diagram for the model answer.
Do not add teacher notes or meta-commentary.

EXAM PAPER:
${paperForKey}`;

      const msg3a = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8000,
        messages: [{ role: "user", content: prompt3a }],
      });

      const responseA = msg3a.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("\n");

      // Call 3b: answer Q[halfQ+1] to Q[totalQuestions]
      const prompt3b = `Generate the answer key for questions Q${halfQ + 1} to Q${totalQuestions} ONLY.
Do not mention marks for individual questions.
${isHindi ? "Write everything in Hindi (Devanagari script).\n" : ""}
You must answer exactly these question numbers: Q${halfQ + 1} to Q${totalQuestions}.
Count carefully. Do not skip any. If you finish early, you have missed questions — go back and complete all.
Use all available tokens if needed — completeness is mandatory.

Write complete model answers covering all key points for every question.
For numericals: given → formula → substitution → answer with units.

For diagram questions: describe the diagram clearly in words with all labels.
Do NOT draw ASCII art.
For answers involving diagrams: write a clear description of what the diagram shows, then on the next line write:
[Diagram: brief description of what to draw]
This helps the system generate the correct diagram for the model answer.
Do not add teacher notes or meta-commentary.

EXAM PAPER:
${paperForKey}`;

      const msg3b = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8000,
        messages: [{ role: "user", content: prompt3b }],
      });

      const responseB = msg3b.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("\n");

      let combinedAnswerKey = cleanNotes(responseA) + "\n\n---\n\n" + cleanNotes(responseB);

      // Validation: find which question numbers appear in the combined answer key
      const answeredNums = new Set<number>();
      for (const qm of (combinedAnswerKey.match(/\bQ(\d+)\b/g) || [])) {
        const n = parseInt(qm.slice(1), 10);
        if (n > 0) answeredNums.add(n);
      }
      const missing = Array.from({ length: totalQuestions }, (_, i) => i + 1)
        .filter(n => !answeredNums.has(n));

      if (missing.length > 0) {
        console.log("[generate-with-chapters] Answer key missing questions:", missing);
        const promptCatchup = `The answer key is missing answers for these questions: ${missing.map(n => `Q${n}`).join(', ')}.
Generate ONLY the missing answers now. Do not repeat already-answered questions.
${isHindi ? "Write everything in Hindi (Devanagari script).\n" : ""}

EXAM PAPER:
${paperForKey}`;

        const msgCatchup = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 4000,
          messages: [{ role: "user", content: promptCatchup }],
        });

        const responseCatchup = msgCatchup.content
          .filter((b) => b.type === "text")
          .map((b) => (b as { type: "text"; text: string }).text)
          .join("\n");

        combinedAnswerKey = combinedAnswerKey + "\n\n---\n\n" + cleanNotes(responseCatchup);
      }

      // Classify and add diagrams to answer key
      const answerKeyDecisions = await runDiagramClassifier(
        combinedAnswerKey,
        client,
        true // isAnswerKey flag
      );
      const answerKeyWithPlaceholders = insertDiagramPlaceholders(
        combinedAnswerKey,
        answerKeyDecisions
      );
      const {
        resolvedContent: resolvedAnswerKey,
      } = await resolveAllPlaceholders(
        answerKeyWithPlaceholders,
        body.classNumber,
        body.subject
      );

      draft = `===CLEAN PAPER START===\n${formattedFinalPaper}\n===CLEAN PAPER END===\n\n===ANSWER KEY START===\n${resolvedAnswerKey}\n===ANSWER KEY END===`;
    } else {
      // Pass 2: Classify diagrams for each question
      const diagramDecisions = await runDiagramClassifier(rawDraft, client);
      const paperWithPlaceholders = insertDiagramPlaceholders(rawDraft, diagramDecisions);
      const resolveResult = await resolveAllPlaceholders(
        paperWithPlaceholders,
        body.classNumber,
        body.subject,
      );
      ncertFiguresFound = resolveResult.ncertFiguresFound;
      ncertFiguresMissed = resolveResult.ncertFiguresMissed;
      svgsGenerated = resolveResult.svgsGenerated;
      svgsFailed = resolveResult.svgsFailed;
      const formattedContent = formatMcqOptions(resolveResult.resolvedContent);
      draft = cleanAnswerSpaces(cleanNotes(formattedContent));
    }

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
      ncertFiguresFound,
      ncertFiguresMissed,
      svgsGenerated,
      svgsFailed,
    });
  } catch (err) {
    console.error("[generate-with-chapters] Error:", err);
    return NextResponse.json(
      { error: "Generation failed. Please try again.", detail: String(err) },
      { status: 500 }
    );
  }
}
