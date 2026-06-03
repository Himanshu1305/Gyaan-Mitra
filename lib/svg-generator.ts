import Anthropic from "@anthropic-ai/sdk";

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

// ── Types ─────────────────────────────────────────────────────

export interface SvgPlaceholder {
  fullMatch: string;
  description: string;
}

interface NcertFigure {
  public_url: string;
  figure_caption: string;
  figure_number: string | null;
  description: string;
  diagram_type: string;
  match_score: number;
}

// ── Helpers ───────────────────────────────────────────────────

function generateFallbackSvg(label: string): string {
  const safe = label.slice(0, 50)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 200" width="100%" height="auto">
  <rect width="500" height="200" fill="#f8f9fa" stroke="#dee2e6" stroke-width="2" rx="8"/>
  <rect x="10" y="10" width="480" height="180" fill="none" stroke="#adb5bd" stroke-width="1.5" stroke-dasharray="8,4" rx="4"/>
  <text x="250" y="85" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" fill="#6c757d">[ Diagram: ${safe} ]</text>
  <text x="250" y="112" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" fill="#adb5bd">Refer to textbook for this diagram</text>
</svg>`;
}

function svgToMarkdown(svgCode: string, label: string): string {
  const encoded = encodeURIComponent(svgCode);
  const dataUri = `data:image/svg+xml;charset=utf-8,${encoded}`;
  const shortLabel = label.split(",")[0].trim().slice(0, 60)
    .replace(/[[\]]/g, ""); // remove brackets from alt text
  return `\n![${shortLabel}](${dataUri})\n`;
}

function formatNcertFigure(figure: NcertFigure): string {
  const caption = figure.figure_caption || figure.description || "NCERT Textbook Figure";
  const figNum = figure.figure_number ? `Fig. ${figure.figure_number} — ` : "";
  return `\n![${caption}](${figure.public_url})\n*${figNum}${caption}*\n`;
}

// ── Extract Placeholders ──────────────────────────────────────

function extractFigurePlaceholders(content: string) {
  const regex = /\[FIGURE:\s*([^\]]+)\]/gi;
  const seen = new Set<string>();
  const results: { fullMatch: string; keywords: string[] }[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (!seen.has(match[0])) {
      seen.add(match[0]);
      const keywords = match[1]
        .split(",")
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean);
      results.push({ fullMatch: match[0], keywords });
    }
  }
  return results;
}

function extractSvgPlaceholders(content: string): SvgPlaceholder[] {
  // Match [SVG: ...] where ] is followed by whitespace or end of string
  // The 'm' flag makes $ match end of line; we use \s*(\n|$) for reliability
  const regex = /\[SVG:([\s\S]*?)\][ \t]*(\n|$)/gi;
  const seen = new Set<string>();
  const results: SvgPlaceholder[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    // fullMatch includes the trailing newline — trim for replacement key
    const fullMatch = match[0].trimEnd();
    if (!seen.has(fullMatch)) {
      seen.add(fullMatch);
      results.push({ fullMatch, description: match[1].trim() });
    }
  }
  return results;
}

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
  console.log('[EXTRACT-FIGURE] Found:', results.length);
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
  console.log('[EXTRACT-SVG] Found:', results.length);
  return results;
}

// ── Search NCERT Figures ──────────────────────────────────────

/* eslint-disable @typescript-eslint/no-unused-vars */
async function searchNcertFigure(
  keywords: string[],
  classNumber: number,
  subject: string,
  chapterNumber?: number
): Promise<NcertFigure | null> {
  // Diagram pool system now handles all image lookup
  return null;
}
/* eslint-enable @typescript-eslint/no-unused-vars */

// ── Question-type context detector ───────────────────────────
// Looks at the 400 chars before the marker position to decide whether
// the surrounding question is "study the diagram" (identify parts)
// or a process/explanation question (full labels OK).
function inferQuestionType(content: string, markerIndex: number): 'study' | 'process' {
  const before = content.slice(Math.max(0, markerIndex - 400), markerIndex).toLowerCase();
  const studyPhrases = [
    'study the diagram', 'study the ray diagram', 'study the figure',
    'shown below', 'diagram shown', 'figure shown', 'diagram below',
    'refer to the diagram', 'observe the diagram', 'shown below and answer',
    'given below and answer', 'the following diagram',
  ];
  return studyPhrases.some(p => before.includes(p)) ? 'study' : 'process';
}

// ── Retry Helper ──────────────────────────────────────────────

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function callAnthropicWithRetry<T>(
  apiCallFn: () => Promise<T>,
  retries = 3,
  delayMs = 1000
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await apiCallFn();
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      const isTransient = status === 529 || status === 429;
      const isLastRetry = i === retries - 1;
      if (isTransient && !isLastRetry) {
        console.log(`[SVG RETRY] Overloaded (${status}). Attempt ${i + 1}/${retries} in ${delayMs}ms`);
        await delay(delayMs);
        delayMs *= 2;
        continue;
      }
      throw err;
    }
  }
  throw new Error('Max retries exceeded');
}

// ── Generate SVG ──────────────────────────────────────────────

export async function generateSingleSvg(
  description: string,
  questionType: 'study' | 'process' = 'process'
): Promise<string | null> {
  try {
    const BIOLOGY_KEYWORDS = [
      'eye', 'heart', 'brain', 'digestive', 'neuron', 'nephron',
      'kidney', 'flower', 'stomata', 'reflex', 'excretory',
      'reproductive', 'cell', 'tissue', 'organ', 'anatomy',
      'biological', 'organism', 'muscle', 'nerve', 'blood',
      'lung', 'liver', 'stomach', 'intestine', 'artery', 'vein'
    ];
    const descLower = description.toLowerCase();
    const isBiology = BIOLOGY_KEYWORDS.some(kw => descLower.includes(kw));
    if (isBiology) {
      console.log('[SVG] Blocked biology SVG for:', description.slice(0, 80));
      return null;
    }

    console.log('[SVG] Generating for:', description.slice(0, 100), '| type:', questionType);

    const baseSystem = `You are an SVG diagram generator for Indian school science textbooks (CBSE Class 6-12). Output ONLY valid SVG code starting with <svg and ending with </svg>. Do not include any explanation, thinking, or markdown. Generate clean educational diagrams. Do not include 'Key Points', answer summaries, or explanatory text boxes inside the diagram. Use viewBox that fits the content — for complex diagrams with many elements use 0 0 800 500 maximum. Keep text font-size minimum 14px so it remains readable when scaled.

Draw ONLY geometric shapes, graphs, ray diagrams with lines and arrows, or circuit diagrams with standard symbols.
NEVER draw anatomy, biology, or organism diagrams.
Use ONLY letters A, B, C, D as part labels — never write full anatomical or physics term names as labels on diagram parts.

CRITICAL: Use only black (#000000) for all lines, borders and text. Use only white (#ffffff) or very light grey (#f5f5f5) for fills. No colours whatsoever. This is for a printed exam paper.

Ensure all text labels fit within the viewBox: start text at x=10 minimum near left edge, end text at viewBox width minus 20px near right edge.`;

    const typeSpecific = questionType === 'study'
      ? `

DIAGRAM TYPE: STUDY / IDENTIFY
This diagram will be shown to students who must IDENTIFY the parts.
ABSOLUTE RULE: Use ONLY letters A, B, C, D, E as markers on parts.
NO text labels anywhere on diagram parts except the diagram title.
NO colour names (Violet, Red, Blue etc.)
NO anatomical names (Retina, Cornea, Lens etc.)
NO physics terms as labels on diagram parts.
Students must identify these parts themselves.`
      : `

DIAGRAM TYPE: PROCESS / EXPLANATION
This diagram explains how something works — full labels are required.

BANNED labels (never include — they reveal answers to students):
- "Image formed in front of retina" or "Image formed behind retina" → label as "Image" only
- "Focal point in front of retina" or "Focal point behind retina" → label as "F" only
- "Violet deviates most", "Red deviates least", "Most deviated", "Least deviated" → label as "Violet" or "Red" only
- "Correct position", "Incorrect position", "Blurred", "Clear image" → omit entirely
- "Eye too long", "Eye too short", "Elongated eyeball", "Shortened eyeball" → label the structure only (e.g. "Eyeball")
- "Rays converge before/behind retina" → draw the ray path without the explanatory text label
- "Defect: myopia", "Defect: hypermetropia" → omit defect labels
Rule: label WHAT a structure IS, never WHAT IT MEANS or WHY it matters.`;

    const response = await callAnthropicWithRetry(() =>
      getAnthropic().messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 3000,
        system: baseSystem + typeSpecific,
        messages: [{ role: "user", content: `Generate an SVG diagram for:\n\n${description}` }],
      })
    );

    const rawText = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("")
      .trim();

    console.log('[SVG] Raw response length:', rawText.length, 'starts with:', rawText.slice(0, 50));
    console.log('[SVG] Ends with:', rawText.slice(-50));
    console.log('[SVG] Has closing tag:', rawText.includes('</svg>'));

    // Strip markdown fences including ```xml variant
    let svgCode = rawText;
    if (rawText.includes("```")) {
      const m = rawText.match(/```(?:svg|xml)?\s*([\s\S]*?)```/);
      svgCode = m ? m[1].trim() : rawText;
    }

    // Also try to extract just the SVG if buried in text
    if (!svgCode.includes('<svg')) {
      const svgMatch = svgCode.match(/<svg[\s\S]*<\/svg>/i);
      if (svgMatch) {
        svgCode = svgMatch[0];
      }
    }

    console.log('[SVG] svgCode after strip, last 50:', svgCode.slice(-50));

    // Validate it's SVG
    if (!svgCode.includes("<svg") || !svgCode.includes("</svg>")) {
      console.log('[SVG] FAILED validation - not valid SVG');
      return null;
    }

    // Ensure xmlns (required for data URI rendering in all browsers)
    if (!svgCode.includes("xmlns=")) {
      svgCode = svgCode.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    // Ensure responsive sizing
    if (!svgCode.includes('width="100%"')) {
      svgCode = svgCode.replace("<svg", '<svg width="100%" height="auto"');
    }

    console.log('[SVG] SUCCESS - SVG length:', svgCode.length);
    return svgCode;
  } catch (err) {
    console.error('[SVG] All retries failed:', err);
    return `<svg width="100%" height="auto" viewBox="0 0 500 120" xmlns="http://www.w3.org/2000/svg">
  <rect width="500" height="120" fill="#fff9e6" stroke="#f0ad4e" stroke-width="2" rx="8"/>
  <text x="250" y="45" text-anchor="middle" font-family="Arial" font-size="14" fill="#856404" font-weight="bold">Diagram temporarily unavailable</text>
  <text x="250" y="70" text-anchor="middle" font-family="Arial" font-size="12" fill="#856404">Please refer to your NCERT textbook for this diagram.</text>
  <text x="250" y="92" text-anchor="middle" font-family="Arial" font-size="11" fill="#856404" font-style="italic">(Server was busy — regenerate the paper to try again)</text>
</svg>`;
  }
}

// ── Main Export ───────────────────────────────────────────────
// Resolves BOTH [FIGURE: keywords] and [SVG: description] in one pass.
// All parameters are optional — safe for custom prompt mode.

export async function resolveAllPlaceholders(
  content: string,
  classNumber?: number,
  subject?: string,
  chapterNumber?: number
): Promise<{
  resolvedContent: string;
  ncertFiguresFound: number;
  ncertFiguresMissed: number;
  svgsGenerated: number;
  svgsFailed: number;
}> {
  let resolvedContent = content;
  let ncertFiguresFound = 0;
  let ncertFiguresMissed = 0;
  let svgsGenerated = 0;
  let svgsFailed = 0;

  console.log('[FIGURES] Input placeholders found:', {
    figures: extractFigurePlaceholders(content).map(p => p.fullMatch),
    svgs: extractSvgPlaceholders(content).map(p => p.fullMatch.slice(0, 50)),
  });

  // ── Step 1: [FIGURE: keywords] → NCERT images ──────────────
  const figurePlaceholders = extractFigurePlaceholders(resolvedContent);

  // Parallel DB searches (fast)
  const figureResolutions = await Promise.all(
    figurePlaceholders.map(async (p) => ({
      placeholder: p,
      figure:
        classNumber && subject
          ? await searchNcertFigure(p.keywords, classNumber, subject, chapterNumber)
          : null,
    }))
  );

  for (const { placeholder, figure } of figureResolutions) {
    const replacement = figure
      ? formatNcertFigure(figure)
      : svgToMarkdown(
          generateFallbackSvg(placeholder.keywords.join(", ")),
          placeholder.keywords.join(", ")
        );
    // split+join replaces ALL occurrences, not just first
    resolvedContent = resolvedContent.split(placeholder.fullMatch).join(replacement);
    if (figure) { ncertFiguresFound++; } else { ncertFiguresMissed++; }
  }

  // ── Step 2: [SVG: description] → generated SVGs ────────────
  const svgPlaceholders = extractSvgPlaceholders(resolvedContent);

  // Parallel SVG generation (independent calls, avoids timeout)
  const svgResolutions = await Promise.all(
    svgPlaceholders.map(async (p) => ({
      placeholder: p,
      svgCode: await generateSingleSvg(p.description),
    }))
  );

  for (const { placeholder, svgCode } of svgResolutions) {
    const replacement = svgCode
      ? svgToMarkdown(svgCode, placeholder.description)
      : svgToMarkdown(
          generateFallbackSvg(placeholder.description.slice(0, 50)),
          placeholder.description
        );
    resolvedContent = resolvedContent.split(placeholder.fullMatch).join(replacement);
    if (svgCode) { svgsGenerated++; } else { svgsFailed++; }
  }

  // ── Step 3: %%DIAGRAM:FIGURE:%% → NCERT images ─────────────
  const diagramFigurePlaceholders = extractDiagramFigurePlaceholders(resolvedContent);
  for (const placeholder of diagramFigurePlaceholders) {
    const figure = classNumber && subject
      ? await searchNcertFigure(placeholder.keywords, classNumber, subject, chapterNumber)
      : null;
    if (figure) {
      const imgMarkdown = `\n![${figure.figure_caption || 'Diagram'}](${figure.public_url})\n*${figure.figure_caption || 'Diagram'}*\n`;
      resolvedContent = resolvedContent.split(placeholder.fullMatch).join(imgMarkdown);
      ncertFiguresFound++;
    } else {
      resolvedContent = resolvedContent.split(placeholder.fullMatch).join('');
      ncertFiguresMissed++;
    }
  }

  // ── Step 4: %%DIAGRAM:SVG:%% → generated SVGs ──────────────
  const diagramSvgPlaceholders = extractDiagramSvgPlaceholders(resolvedContent);
  console.log('[DIAGRAM-SVG] Found:', diagramSvgPlaceholders.length);

  for (const placeholder of diagramSvgPlaceholders) {
    const markerIndex = resolvedContent.indexOf(placeholder.fullMatch);
    const questionType = inferQuestionType(resolvedContent, markerIndex);
    console.log('[DIAGRAM-SVG] Question type:', questionType, 'for:', placeholder.description.slice(0, 50));
    let svgCode = await generateSingleSvg(placeholder.description, questionType);
    if (svgCode) {
      // Post-process: strip answer-revealing text patterns
      const answerPatterns = [
        />[^<]*(?:behind retina|in front of retina|most deviated|least deviated|elongated eyeball|shortened eyeball|focal point behind|image forms|forms behind|forms in front|correct position|incorrect position)[^<]*</gi,
      ];
      for (const pattern of answerPatterns) {
        svgCode = svgCode.replace(pattern, (match) => {
          return match.replace(/>([^<]+)</, '><');
        });
      }

      const encoded = encodeURIComponent(svgCode);
      const imgMarkdown = `\n![${placeholder.description.slice(0, 50)}](data:image/svg+xml;charset=utf-8,${encoded})\n`;
      resolvedContent = resolvedContent.split(placeholder.fullMatch).join(imgMarkdown);
      svgsGenerated++;
      console.log('[DIAGRAM-SVG] Inserted SVG for:',
        placeholder.description.slice(0, 50));
    } else {
      resolvedContent = resolvedContent.split(placeholder.fullMatch).join('');
      svgsFailed++;
      console.log('[DIAGRAM-SVG] FAILED for:',
        placeholder.description.slice(0, 50));
    }
  }

  console.log('[FIGURES] Resolution results:', {
    ncertFiguresFound,
    ncertFiguresMissed,
    svgsGenerated,
    svgsFailed,
  });

  return {
    resolvedContent,
    ncertFiguresFound,
    ncertFiguresMissed,
    svgsGenerated,
    svgsFailed,
  };
}
