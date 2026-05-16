import Anthropic from "@anthropic-ai/sdk";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

let _serviceClient: SupabaseClient | null = null;
function getServiceClient(): SupabaseClient {
  if (!_serviceClient) {
    _serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _serviceClient;
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
}

// ── SVG System Prompt ─────────────────────────────────────────

const SVG_SYSTEM_PROMPT = `
You are an expert SVG diagram generator for Indian school science and mathematics textbooks (Classes 6-12).
You generate clean, accurate, educational SVG diagrams based on text descriptions.

STRICT OUTPUT RULES:
- Output ONLY the raw SVG code — nothing else
- Start with <svg xmlns="http://www.w3.org/2000/svg" and end with </svg>
- No markdown, no explanation, no code fences, no comments outside SVG
- No <?xml?> declaration

SVG TECHNICAL RULES:
- Always use viewBox="0 0 500 350" as default (adjust height for tall diagrams)
- Always include width="100%" height="auto" for responsive scaling
- Always include a white background: <rect width="100%" height="100%" fill="white"/>
- Font: font-family="Arial, sans-serif"
- All text clearly readable: minimum font-size="12"
- stroke-width="1.5" for main lines, "1" for secondary lines
- Colors: black for main elements, #0066cc for light rays, #cc0000 for force arrows

ALWAYS INCLUDE THESE ARROWHEAD MARKERS IN <defs>:
<defs>
  <marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
    <polygon points="0 0, 10 3.5, 0 7" fill="#000000"/>
  </marker>
  <marker id="bluearrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
    <polygon points="0 0, 10 3.5, 0 7" fill="#0066cc"/>
  </marker>
  <marker id="redarrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
    <polygon points="0 0, 10 3.5, 0 7" fill="#cc0000"/>
  </marker>
</defs>

PHYSICS RAY DIAGRAMS:
- Principal axis: long horizontal line with arrows at both ends
- Lens: vertical line with curved ends (biconvex or biconcave)
- Light rays: blue (#0066cc) with bluearrow marker, direction arrows
- Object: solid upward arrow on left side
- Image: dashed arrow (inverted for real image, upright for virtual)
- Label F, 2F on both sides, O for object, I for image

PHYSICS CIRCUIT DIAGRAMS:
- Battery: two parallel lines (long thin = +, short thick = -)
- Resistor: small rectangle with value label (R1=2Ω)
- Ammeter/Voltmeter: circle with A or V inside
- Draw circuits as neat closed rectangles — components on the sides
- Show current direction with arrows on wires

PHYSICS FORCE DIAGRAMS:
- Forces as bold red arrows (#cc0000) with redarrow marker
- Label W (weight down), N (normal perpendicular to surface), f (friction along surface)
- Object as simple rectangle, inclined plane as right triangle
- Show angle of inclination with arc and degree label

MATHS GEOMETRY:
- Label vertices with capital letters A, B, C
- Show measurements along sides
- Right angle: small square symbol at corner
- Angles: small arc with degree label
- Construction lines: dashed (#cc6600)
- Parallel lines: small arrow marks on each parallel line

MATHS GRAPHS:
- X and Y axes with arrows at positive ends
- Label axes, mark origin O at intersection
- Points as small filled circles (r=3) with coordinate labels
- Lines and curves drawn smoothly
- Shaded regions: light fill with opacity="0.2"

CHEMISTRY APPARATUS:
- Beakers: trapezoid shape open at top with liquid fill
- Electrodes: vertical rectangles partially submerged
- Bubbles: small circles near electrodes
- Label all parts with leader lines (thin lines from part to label)
- Show liquid level with horizontal line
`.trim();

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

// ── Search NCERT Figures ──────────────────────────────────────

async function searchNcertFigure(
  keywords: string[],
  classNumber: number,
  subject: string,
  chapterNumber?: number
): Promise<NcertFigure | null> {
  try {
    // First try: chapter-specific search
    if (chapterNumber) {
      const { data } = await getServiceClient().rpc("search_ncert_figures", {
        p_keywords: keywords,
        p_class: classNumber,
        p_subject: subject,
        p_chapter: chapterNumber,
        p_limit: 5,
      });
      if (data && data.length > 0 && data[0].match_score >= 2) {
        return data[0];
      }
    }

    // Second try: subject-wide search (no chapter filter)
    const { data: data2 } = await getServiceClient().rpc("search_ncert_figures", {
      p_keywords: keywords,
      p_class: classNumber,
      p_subject: subject,
      p_chapter: null,
      p_limit: 5,
    });

    if (data2 && data2.length > 0 && data2[0].match_score >= 2) {
      return data2[0];
    }

    // No confident match found — return null so fallback SVG is used
    // This prevents wrong images from appearing
    return null;
  } catch {
    return null;
  }
}

// ── Generate SVG ──────────────────────────────────────────────

async function generateSingleSvg(description: string): Promise<string | null> {
  try {
    const response = await getAnthropic().messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: SVG_SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Generate an SVG diagram for:\n\n${description}` }],
    });

    const rawText = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("")
      .trim();

    // Strip markdown fences if present
    let svgCode = rawText;
    if (rawText.includes("```")) {
      const m = rawText.match(/```(?:svg)?\s*([\s\S]*?)```/);
      svgCode = m ? m[1].trim() : rawText;
    }

    // Validate it's SVG
    if (!svgCode.includes("<svg") || !svgCode.includes("</svg>")) return null;

    // Ensure xmlns (required for data URI rendering in all browsers)
    if (!svgCode.includes("xmlns=")) {
      svgCode = svgCode.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    // Ensure responsive sizing
    if (!svgCode.includes('width="100%"')) {
      svgCode = svgCode.replace("<svg", '<svg width="100%" height="auto"');
    }

    return svgCode;
  } catch {
    return null;
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

  return {
    resolvedContent,
    ncertFiguresFound,
    ncertFiguresMissed,
    svgsGenerated,
    svgsFailed,
  };
}
