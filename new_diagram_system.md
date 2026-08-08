# Claude Code Prompt — New Diagram System
# Single Pass + Code Validation + Targeted Fix
# ================================================================
# This replaces the two-pass classifier system entirely.
# Read ALL files before making any changes.
# ================================================================

Read these files completely before starting:
- app/api/generate-with-chapters/route.ts
- lib/svg-generator.ts

Then implement ALL changes below in order.

═══════════════════════════════════════════════════════
CHANGE 1 — Update EXAM_PAPER_SYSTEM_PROMPT (Pass 1)
═══════════════════════════════════════════════════════

In route.ts, find EXAM_PAPER_SYSTEM_PROMPT.

REMOVE entirely:
- SECTION 3 — DIAGRAM RULES (if still present)
- SECTION 2B — DIAGRAM QUESTION TYPES
- Any mention of [FIGURE:], [SVG:], %%DIAGRAM%%

ADD this as SECTION 3 in EXAM_PAPER_SYSTEM_PROMPT:

```
═══════════════════════════════════════════════════════
SECTION 3 — DIAGRAM MARKERS (READ CAREFULLY)
═══════════════════════════════════════════════════════

When a question PROVIDES a diagram for the student to study,
add a marker on the very next line after the question text.

MARKER FORMAT:
%%DIAGRAM:TYPE:description%%

TYPE is either FIGURE or SVG:

FIGURE — for anatomical/biological diagrams that exist in NCERT:
%%DIAGRAM:FIGURE:keyword1, keyword2, keyword3, keyword4%%
Use for: human eye structure, cell diagrams, plant diagrams,
         maps, biological processes

SVG — for physics/optics/geometry diagrams to be generated:
%%DIAGRAM:SVG:detailed description of what to draw%%
Use for: ray diagrams, circuit diagrams, prism diagrams,
         rainbow formation, atmospheric refraction,
         force diagrams, geometric constructions

WHEN TO ADD A MARKER:
Add %%DIAGRAM:%% ONLY when the question says:
"Study the diagram shown below"
"The figure below shows"
"Refer to the diagram"
"Observe the following diagram"
"In the circuit shown below"
"The ray diagram below shows"
"Study the ray diagram"

DO NOT ADD A MARKER when the question says:
"Draw a diagram"
"Draw a neat labelled diagram"
"Draw a ray diagram"
"With the help of a diagram"
"Sketch a diagram"
These are draw-yourself questions — student draws in exam.

EXAMPLES:

CORRECT — Study question with FIGURE marker:
Q11. Study the diagram of the human eye shown below and answer:
%%DIAGRAM:FIGURE:human eye cross section, cornea, iris, pupil, crystalline lens, ciliary muscles, retina, optic nerve%%
(a) Name any three parts visible in the diagram.
(b) Which part controls the amount of light entering the eye?

CORRECT — Study question with SVG marker:
Q12. Study the ray diagram shown below showing a defect of vision:
%%DIAGRAM:SVG:ray diagram of myopic eye, parallel rays from distant object converging in front of retina not on it, elongated eyeball, labels: parallel rays, eye lens, focal point in front of retina, retina%%
(a) Identify the defect shown.
(b) State two causes of this defect.

CORRECT — Draw question with NO marker:
Q13. Draw a neat labelled ray diagram to show the defect of myopia
and its correction using a concave lens.
[no marker — student draws this in the exam]

INCORRECT — Never do this:
Q14. Draw a neat labelled diagram of the human eye.
%%DIAGRAM:FIGURE:human eye%% ← WRONG — student draws this

SCIENCE/PHYSICS SUBJECT RULES:
- Ray diagrams (myopia, hypermetropia, prism, rainbow) → SVG
- Eye anatomy, cell diagrams, biological structures → FIGURE
- Circuit diagrams with specific values → SVG
- Maps, graphs → FIGURE

Every paper for Science, Physics, Chemistry, Biology MUST include
at least 2 questions where YOU provide the diagram (study questions).
These must have the %%DIAGRAM:%% marker.
```

═══════════════════════════════════════════════════════
CHANGE 2 — Remove two-pass classifier system
═══════════════════════════════════════════════════════

In route.ts:

REMOVE these entirely:
- DIAGRAM_CLASSIFIER_PROMPT constant
- ANSWER_KEY_DIAGRAM_PROMPT constant
- DiagramDecision interface
- runDiagramClassifier function
- insertDiagramPlaceholders function

KEEP:
- resolveAllPlaceholders (in svg-generator.ts) — still needed
- EXAM_PAPER_SYSTEM_PROMPT — updated in Change 1

═══════════════════════════════════════════════════════
CHANGE 3 — Add code validation layer
═══════════════════════════════════════════════════════

In route.ts, add this function before the POST handler:

```typescript
interface ValidationIssue {
  lineIndex: number;
  type: 'remove_marker' | 'remove_marks' | 'missing_marker';
  description: string;
  suggestedFix?: string;
}

function validatePaper(content: string): {
  issues: ValidationIssue[];
  hasIssues: boolean;
} {
  const lines = content.split('\n');
  const issues: ValidationIssue[] = [];

  const drawYourselfPhrases = [
    'draw a diagram', 'draw a neat', 'draw a labelled',
    'draw a ray diagram', 'draw a circuit', 'draw and label',
    'sketch a diagram', 'sketch the', 'with a neat diagram',
    'with the help of a diagram', 'with a labelled diagram',
    'draw the following', 'draw a schematic',
  ];

  const studyFigurePhrases = [
    'study the diagram', 'study the ray diagram',
    'study the figure', 'the figure below shows',
    'the diagram below shows', 'refer to the diagram',
    'observe the diagram', 'in the circuit shown',
    'the ray diagram below', 'shown below and answer',
    'given below and answer',
  ];

  const marksPattern = /\[\d+\s*marks?\]|\(\d+\s*marks?\)/gi;
  const markerPattern = /%%DIAGRAM:[A-Z]+:[^%]+%%/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase();

    // Check 1: marker after draw-yourself question
    const isDrawYourself = drawYourselfPhrases.some(p =>
      lineLower.includes(p)
    );
    if (isDrawYourself) {
      // Check next 3 lines for a marker
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        if (markerPattern.test(lines[j])) {
          issues.push({
            lineIndex: j,
            type: 'remove_marker',
            description: `Line ${j + 1}: %%DIAGRAM:%% marker after draw-yourself question on line ${i + 1}. Remove this marker.`,
          });
        }
      }
    }

    // Check 2: marks on individual questions
    if (marksPattern.test(line) && /^\*\*Q\d+/.test(line)) {
      issues.push({
        lineIndex: i,
        type: 'remove_marks',
        description: `Line ${i + 1}: Individual question has marks notation. Remove marks from question text.`,
        suggestedFix: line.replace(marksPattern, '').trim(),
      });
      marksPattern.lastIndex = 0;
    }
    marksPattern.lastIndex = 0;

    // Check 3: study-figure question missing marker
    const isStudyFigure = studyFigurePhrases.some(p =>
      lineLower.includes(p)
    );
    if (isStudyFigure) {
      // Check next 3 lines for a marker
      const hasMarker = [i + 1, i + 2, i + 3].some(
        j => j < lines.length && markerPattern.test(lines[j])
      );
      if (!hasMarker) {
        issues.push({
          lineIndex: i,
          type: 'missing_marker',
          description: `Line ${i + 1}: "Study the diagram" question has no %%DIAGRAM:%% marker on following lines.`,
        });
      }
    }
  }

  return { issues, hasIssues: issues.length > 0 };
}
```

═══════════════════════════════════════════════════════
CHANGE 4 — Add targeted fix function
═══════════════════════════════════════════════════════

In route.ts, add this function after validatePaper:

```typescript
async function applyTargetedFix(
  content: string,
  issues: ValidationIssue[],
  client: Anthropic
): Promise<string> {
  if (issues.length === 0) return content;

  const issueList = issues
    .map(issue => `- ${issue.description}`)
    .join('\n');

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      messages: [{
        role: 'user',
        content: `Fix ONLY these specific issues in the exam paper below. 
Do NOT change any questions, answers, or other content.
Do NOT regenerate or rewrite anything.
Make only the minimal changes needed to fix these issues:

ISSUES TO FIX:
${issueList}

For "remove_marker" issues: Delete the %%DIAGRAM:%% line entirely.
For "remove_marks" issues: Remove [X marks] or (X marks) from that line only.
For "missing_marker" issues: Add an appropriate %%DIAGRAM:%% marker on the line after the question. Use your judgment for FIGURE vs SVG and appropriate keywords/description.

Return the complete corrected paper with no other changes.

EXAM PAPER:
${content}`,
      }],
    });

    const fixed = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')
      .trim();

    return fixed || content;
  } catch (err) {
    console.error('[TARGETED FIX] Error:', err);
    return content; // Return original if fix fails
  }
}
```

═══════════════════════════════════════════════════════
CHANGE 5 — Wire validation into generation flow
═══════════════════════════════════════════════════════

In route.ts, find where rawDraft is assembled after the main
Claude call in the non-finalise path.

Replace the current post-processing (which calls 
runDiagramClassifier then insertDiagramPlaceholders) with:

```typescript
// Layer 1: Code validation (instant, always)
const { issues, hasIssues } = validatePaper(rawDraft);
console.log('[VALIDATION] Issues found:', issues.length,
  hasIssues ? issues.map(i => i.type).join(', ') : 'none');

// Layer 2: Targeted fix (only when issues found)
let validatedDraft = rawDraft;
if (hasIssues) {
  console.log('[VALIDATION] Applying targeted fix...');
  validatedDraft = await applyTargetedFix(rawDraft, issues, client);
  console.log('[VALIDATION] Fix applied');
}

// Layer 3: Resolve %%DIAGRAM:%% markers to images/SVGs
// Update resolveAllPlaceholders to handle %%DIAGRAM:%% format
const {
  resolvedContent,
  ncertFiguresFound,
  ncertFiguresMissed,
  svgsGenerated,
  svgsFailed,
} = await resolveAllPlaceholders(
  validatedDraft,
  body.classNumber,
  body.subject,
  body.chapterNumber
);

// MCQ formatting
const formattedContent = formatMcqOptions(resolvedContent);
```

Also update the finalise path similarly:
After cleanedPaper is extracted:
```typescript
const { issues: finaliseIssues, hasIssues: finaliseHasIssues } = 
  validatePaper(cleanedPaper);

let validatedFinalPaper = cleanedPaper;
if (finaliseHasIssues) {
  validatedFinalPaper = await applyTargetedFix(
    cleanedPaper, finaliseIssues, client
  );
}

const {
  resolvedContent: resolvedFinalPaper,
} = await resolveAllPlaceholders(
  validatedFinalPaper,
  body.classNumber,
  body.subject,
  body.chapterNumber
);
const formattedFinalPaper = formatMcqOptions(resolvedFinalPaper);
```

═══════════════════════════════════════════════════════
CHANGE 6 — Update resolveAllPlaceholders for new format
═══════════════════════════════════════════════════════

In lib/svg-generator.ts, update the placeholder parsing to
handle BOTH old [FIGURE:] format AND new %%DIAGRAM:%% format.

Find extractFigurePlaceholders and extractSvgPlaceholders functions.

Add these new extraction functions (keep old ones for backward compat):

```typescript
// New format: %%DIAGRAM:FIGURE:keywords%%
function extractDiagramFigurePlaceholders(content: string): Array<{
  fullMatch: string;
  keywords: string[];
}> {
  const results = [];
  const regex = /%%DIAGRAM:FIGURE:([^%]+)%%/gi;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const keywords = match[1]
      .split(',')
      .map(k => k.trim())
      .filter(Boolean);
    results.push({ fullMatch: match[0], keywords });
  }
  return results;
}

// New format: %%DIAGRAM:SVG:description%%
function extractDiagramSvgPlaceholders(content: string): Array<{
  fullMatch: string;
  description: string;
}> {
  const results = [];
  const regex = /%%DIAGRAM:SVG:([^%]+)%%/gi;
  let match;
  while ((match = regex.exec(content)) !== null) {
    results.push({ fullMatch: match[0], description: match[1].trim() });
  }
  return results;
}
```

Then in resolveAllPlaceholders, after processing old [FIGURE:] 
and [SVG:] placeholders, add processing for new %%DIAGRAM:%% format:

```typescript
// Process new %%DIAGRAM:FIGURE:%% placeholders
const diagramFigurePlaceholders = extractDiagramFigurePlaceholders(resolved);
for (const placeholder of diagramFigurePlaceholders) {
  const figure = await searchNcertFigure(
    placeholder.keywords,
    classNumber,
    subject,
    chapterNumber
  );
  if (figure) {
    const imgMarkdown = `\n![${figure.figure_caption || 'Diagram'}](${figure.public_url})\n*${figure.figure_caption || 'Diagram'}*\n`;
    resolved = resolved.replace(placeholder.fullMatch, imgMarkdown);
    ncertFiguresFound++;
  } else {
    resolved = resolved.replace(placeholder.fullMatch, '');
    ncertFiguresMissed++;
  }
}

// Process new %%DIAGRAM:SVG:%% placeholders
const diagramSvgPlaceholders = extractDiagramSvgPlaceholders(resolved);
for (const placeholder of diagramSvgPlaceholders) {
  const svgCode = await generateSingleSvg(placeholder.description);
  if (svgCode) {
    const encoded = encodeURIComponent(svgCode);
    const imgMarkdown = `\n![${placeholder.description.slice(0, 50)}](data:image/svg+xml;charset=utf-8,${encoded})\n`;
    resolved = resolved.replace(placeholder.fullMatch, imgMarkdown);
    svgsGenerated++;
  } else {
    resolved = resolved.replace(placeholder.fullMatch, '');
    svgsFailed++;
  }
}
```

═══════════════════════════════════════════════════════
AFTER ALL CHANGES
═══════════════════════════════════════════════════════

Run npm run build — must pass with zero TypeScript errors.

Commit: "feat: single-pass diagram system with code validation and targeted fix"

Push to deploy.

Report:
1. Confirm DIAGRAM_CLASSIFIER_PROMPT and runDiagramClassifier are removed
2. Confirm validatePaper function exists
3. Confirm applyTargetedFix function exists
4. Confirm %%DIAGRAM:%% format is handled in svg-generator.ts
5. Show any TypeScript errors encountered and how they were resolved
6. Total lines changed
