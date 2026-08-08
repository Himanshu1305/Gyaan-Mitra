# Claude Code Prompt — Two-Pass Diagram System
# Gyaan Mitra Project
# ================================================================
# This is a significant architectural change. Read everything
# carefully before making any changes.
# Make changes in the exact order listed.
# ================================================================

I need to implement a two-pass diagram system for the exam paper
generator. This replaces the current approach where Claude decides
diagram placement during question generation.

NEW APPROACH:
- Pass 1: Claude generates questions ONLY — no diagram decisions
- Pass 2: A second Claude call classifies each question and decides
  diagram type (NONE / FIGURE / SVG) returning clean JSON
- Code inserts placeholders based on JSON — not Claude

Read ALL files before making any changes:
- app/api/generate-with-chapters/route.ts (complete file)
- lib/svg-generator.ts (complete file)

Report what you find, then proceed with changes.

═══════════════════════════════════════════════════════
CHANGE 1 — Simplify Pass 1 (question generation prompt)
═══════════════════════════════════════════════════════

In route.ts, find EXAM_PAPER_SYSTEM_PROMPT constant.

REMOVE these sections entirely from EXAM_PAPER_SYSTEM_PROMPT:
- SECTION 2 difficulty rules FIGURES paragraphs (the lines about
  [FIGURE:] and [SVG:] under EASY, STANDARD, CHALLENGING)
- SECTION 3 — DIAGRAM RULES entirely (both TYPE 1 and TYPE 2)
- SECTION 4 subject rules diagram references (lines about
  [FIGURE:] and [SVG:] for each subject)
- SECTION 5 Quality Rule 5 DIAGRAM COMPLETENESS

Keep everything else in EXAM_PAPER_SYSTEM_PROMPT exactly as-is.

Also find STRICT FORMATTING RULES block (BLOCK 6 in the prompt).
REMOVE Section 7 "DIAGRAM QUESTIONS — MANDATORY" entirely.

The result: Pass 1 prompt has ZERO mention of diagrams, [FIGURE:],
or [SVG:]. Claude generates only questions in Pass 1.

Also add this single line to SECTION 5 Quality Rules as rule 5:
```
5. QUESTIONS ONLY: Do not add any diagram placeholders, [FIGURE:],
   or [SVG:] tags. Diagrams are handled separately after generation.
```

═══════════════════════════════════════════════════════
CHANGE 2 — Add Pass 2 diagram classifier
═══════════════════════════════════════════════════════

In route.ts, add a new constant after EXAM_PAPER_SYSTEM_PROMPT:

```typescript
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
```

═══════════════════════════════════════════════════════
CHANGE 3 — Add runDiagramClassifier function to route.ts
═══════════════════════════════════════════════════════

In route.ts, add this function after the DIAGRAM_CLASSIFIER_PROMPT
constant and before the POST handler:

```typescript
interface DiagramDecision {
  question_number: number;
  decision: 'NONE' | 'FIGURE' | 'SVG';
  keywords: string[];
  svg_description: string;
}

async function runDiagramClassifier(
  paperContent: string
): Promise<DiagramDecision[]> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: DIAGRAM_CLASSIFIER_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Classify diagrams for every question in this exam paper:\n\n${paperContent}`,
        },
      ],
    });

    const rawText = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')
      .trim();

    // Extract JSON array
    const startIdx = rawText.indexOf('[');
    const endIdx = rawText.lastIndexOf(']');
    if (startIdx === -1 || endIdx === -1) return [];

    const jsonStr = rawText.slice(startIdx, endIdx + 1);
    const decisions: DiagramDecision[] = JSON.parse(jsonStr);
    return decisions;
  } catch (err) {
    console.error('Diagram classifier error:', err);
    return [];
  }
}
```

═══════════════════════════════════════════════════════
CHANGE 4 — Add insertDiagramPlaceholders function to route.ts
═══════════════════════════════════════════════════════

Add this function after runDiagramClassifier:

```typescript
function insertDiagramPlaceholders(
  paperContent: string,
  decisions: DiagramDecision[]
): string {
  // Filter to only FIGURE and SVG decisions
  const diagramDecisions = decisions.filter(
    (d) => d.decision === 'FIGURE' || d.decision === 'SVG'
  );

  if (diagramDecisions.length === 0) return paperContent;

  let result = paperContent;

  for (const decision of diagramDecisions) {
    // Find the question in the paper
    // Questions are formatted as **Q15.** or Q15. or Q15)
    const patterns = [
      new RegExp(`(\\*\\*Q${decision.question_number}\\.[^*]*\\*\\*)`, 'g'),
      new RegExp(`(Q${decision.question_number}\\.\\s[^\n]+)`, 'g'),
    ];

    let placeholder = '';
    if (decision.decision === 'FIGURE') {
      placeholder = `\n[FIGURE: ${decision.keywords.join(', ')}]`;
    } else if (decision.decision === 'SVG') {
      placeholder = `\n[SVG: ${decision.svg_description}]`;
    }

    // Try to insert placeholder after the question line
    // Find the question line and insert placeholder after it
    const lines = result.split('\n');
    let inserted = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Match question number pattern
      if (
        line.match(new RegExp(`Q${decision.question_number}[.)\\s]`)) &&
        line.length > 5
      ) {
        // Find the end of this question (next blank line or next question)
        let insertAt = i + 1;
        while (
          insertAt < lines.length &&
          lines[insertAt].trim() !== '' &&
          !lines[insertAt].match(/^[\*]?Q\d+[.)]/
          )
        ) {
          insertAt++;
        }
        // Insert placeholder before the blank line
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
```

═══════════════════════════════════════════════════════
CHANGE 5 — Wire Pass 2 into the generation flow
═══════════════════════════════════════════════════════

In route.ts, find the non-finalise path where rawDraft is
assembled after the main Claude call (Pass 1).

After rawDraft is assembled, add Pass 2:

```typescript
// Pass 2: Classify diagrams for each question
const diagramDecisions = await runDiagramClassifier(rawDraft);

// Insert placeholders based on classifier decisions
const paperWithPlaceholders = insertDiagramPlaceholders(
  rawDraft,
  diagramDecisions
);

// Pass 3: Resolve placeholders to actual images/SVGs
const {
  resolvedContent,
  ncertFiguresFound,
  ncertFiguresMissed,
  svgsGenerated,
  svgsFailed,
} = await resolveAllPlaceholders(
  paperWithPlaceholders,
  body.classNumber,
  body.subject,
  body.chapterNumber
);
```

Then use resolvedContent in the response (not rawDraft).

═══════════════════════════════════════════════════════
CHANGE 6 — Fix finalise path to also use resolvedContent
═══════════════════════════════════════════════════════

In route.ts, find the isFinalise branch.
After cleanedPaper is extracted from rawDraft:

1. Run diagram classifier on cleanedPaper
2. Insert placeholders
3. Resolve placeholders
4. Use resolved paper in the response

```typescript
// In finalise path, after extracting cleanedPaper:
const finaliseDecisions = await runDiagramClassifier(cleanedPaper);
const finaliseWithPlaceholders = insertDiagramPlaceholders(
  cleanedPaper,
  finaliseDecisions
);
const {
  resolvedContent: resolvedFinalPaper,
  ncertFiguresFound,
  ncertFiguresMissed,
  svgsGenerated,
  svgsFailed,
} = await resolveAllPlaceholders(
  finaliseWithPlaceholders,
  body.classNumber,
  body.subject,
  body.chapterNumber
);
// Use resolvedFinalPaper instead of cleanedPaper in the response
```

═══════════════════════════════════════════════════════
CHANGE 7 — Fix marks in internal choice (OR questions)
═══════════════════════════════════════════════════════

In route.ts, find buildInternalChoiceInstruction function.
Find where it generates [X marks] on individual OR question lines.
Remove [X marks] from both question lines.
Marks are stated in section headings only.

═══════════════════════════════════════════════════════
CHANGE 8 — Update diagram_type filtering in svg-generator.ts
═══════════════════════════════════════════════════════

In lib/svg-generator.ts, update the NcertFigure interface:

```typescript
interface NcertFigure {
  public_url: string;
  figure_caption: string;
  figure_number: string | null;
  description: string;
  diagram_type: string;
  match_score: number;
}
```

Replace the entire searchNcertFigure function with:

```typescript
async function searchNcertFigure(
  keywords: string[],
  classNumber: number,
  subject: string,
  chapterNumber?: number
): Promise<NcertFigure | null> {
  // For Science/Physics/Chemistry/Biology/Maths reject photographs
  const strictSubjects = [
    'science', 'physics', 'chemistry', 'biology', 'mathematics', 'maths'
  ];
  const isStrictSubject = strictSubjects.some((s) =>
    subject?.toLowerCase().includes(s)
  );
  const acceptedTypes = isStrictSubject
    ? ['diagram', 'circuit', 'geometric_figure', 'biological_diagram',
       'chemical_structure', 'graph', 'flowchart']
    : null;

  const filterByType = (data: any[]): any[] => {
    if (!acceptedTypes || !data) return data || [];
    return data.filter((d) => acceptedTypes.includes(d.diagram_type));
  };

  try {
    // First try: chapter-specific search
    if (chapterNumber) {
      const { data } = await getServiceClient().rpc('search_ncert_figures', {
        p_keywords: keywords,
        p_class: classNumber,
        p_subject: subject,
        p_chapter: chapterNumber,
        p_limit: 10,
      });
      const filtered = filterByType(data);
      if (filtered.length > 0 && filtered[0].match_score >= 2) {
        return filtered[0];
      }
    }

    // Second try: subject-wide search
    const { data: data2 } = await getServiceClient().rpc('search_ncert_figures', {
      p_keywords: keywords,
      p_class: classNumber,
      p_subject: subject,
      p_chapter: null,
      p_limit: 10,
    });
    const filtered2 = filterByType(data2);
    if (filtered2.length > 0 && filtered2[0].match_score >= 2) {
      return filtered2[0];
    }

    return null;
  } catch {
    return null;
  }
}
```

═══════════════════════════════════════════════════════
VALIDATION — Check all before finishing
═══════════════════════════════════════════════════════

1. EXAM_PAPER_SYSTEM_PROMPT has ZERO mention of [FIGURE:] or [SVG:]
2. STRICT FORMATTING RULES has no Section 7 diagram instructions
3. DIAGRAM_CLASSIFIER_PROMPT constant exists
4. runDiagramClassifier function exists
5. insertDiagramPlaceholders function exists
6. Pass 2 is called after rawDraft in non-finalise path
7. Pass 2 is called after cleanedPaper in finalise path
8. resolveAllPlaceholders is called after insertDiagramPlaceholders
9. resolvedContent is used in both paths' responses
10. searchNcertFigure filters by diagram_type for strict subjects
11. Marks removed from internal choice OR question lines
12. Run npm run build — ZERO TypeScript errors
13. Commit and push

Show me the complete diff summary after all changes.

═══════════════════════════════════════════════════════
CHANGE 9 — Update loading UI for two-pass generation
═══════════════════════════════════════════════════════

In app/exam-papers/page.tsx, find the loading/generating state
shown to the teacher during paper generation.

Add cycling stage messages that rotate every 8 seconds:

Add this state near other state declarations:
const [generationStage, setGenerationStage] = useState(0);
const generationStages = [
  "Generating questions from NCERT content...",
  "Classifying diagram requirements...",
  "Fetching textbook figures...",
  "Almost done — finalising your paper...",
];

Add this effect that cycles through stages during loading:
useEffect(() => {
  if (!loading) {
    setGenerationStage(0);
    return;
  }
  const interval = setInterval(() => {
    setGenerationStage(prev =>
      prev < generationStages.length - 1 ? prev + 1 : prev
    );
  }, 8000);
  return () => clearInterval(interval);
}, [loading]);

Then find where the loading message is displayed and replace
the static loading text with the cycling stage message.

Also update the estimated time message to:
"Estimated time: 60-90 seconds — Analysing NCERT content and adding diagrams"
