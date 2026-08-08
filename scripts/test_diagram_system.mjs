#!/usr/bin/env node
/**
 * End-to-end mechanical test for the exam-paper diagram system.
 *
 * WHAT IT DOES
 *   1. Ensures a local `next dev` server is running (auto-starts one if needed).
 *   2. Fires REAL /api/generate-with-chapters calls (guest / no-auth path) across a
 *      test matrix of Class 10 Science (Ch5, Ch10, combined, finalise), Class 10 Maths
 *      (geometry) and an unseeded Class 9 Science set.
 *   3. Saves every generated paper + answer key to scripts/test-runs/ as .txt evidence.
 *   4. Scans each paper's RAW text for the positive (P1,P2) and negative (N1-N8) checks.
 *   5. Snapshots missing_diagram_log before/after (N8) using SUPABASE_SERVICE_ROLE_KEY.
 *   6. Writes scripts/test-results.md with per-check "X of Y runs failed" frequency.
 *
 * It fixes NOTHING and commits NOTHING. Mechanical checks only — visual correctness
 * (right diagram / answer-leaking pixels) is human vetting, out of scope here.
 *
 * USAGE
 *   node scripts/test_diagram_system.mjs            # smoke matrix (7 runs)
 *   node scripts/test_diagram_system.mjs --full     # full matrix (21 runs)
 *   TEST_BASE_URL=http://localhost:3000 node scripts/test_diagram_system.mjs  # reuse a server
 */

import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, existsSync, openSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// ── Paths / config ────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const RUNS_DIR = join(__dirname, 'test-runs');
const REPORT_PATH = join(__dirname, 'test-results.md');
const SERVER_LOG = join(RUNS_DIR, '_server.log');

const FULL = process.argv.includes('--full') || process.env.MODE === 'full';
const MODE = FULL ? 'full' : 'smoke';
const PORT = process.env.TEST_PORT || '3010';
const BASE = (process.env.TEST_BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const REQ_TIMEOUT_MS = Number(process.env.TEST_REQ_TIMEOUT_MS || 300000);

mkdirSync(RUNS_DIR, { recursive: true });

// ── .env.local loader (for our own Supabase query — server loads it itself) ─────
function loadEnvLocal() {
  const out = {};
  const p = join(PROJECT_ROOT, '.env.local');
  if (!existsSync(p)) return out;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}
const ENV = loadEnvLocal();
const HAS_SERVICE_KEY = Boolean(ENV.SUPABASE_SERVICE_ROLE_KEY && ENV.NEXT_PUBLIC_SUPABASE_URL);

// ── Test matrix ────────────────────────────────────────────────────────────────
const REALISTIC_MIX = { mcq: 5, shortTwo: 3, shortThree: 3, longFour: 1, longFive: 2 }; // has 3m + 5m
const COMBINED_MIX = { mcq: 3, shortTwo: 2, shortThree: 2, longFour: 0, longFive: 1 };  // per chapter

function ch(chapterName, bookDisplayName, questionMix) {
  return { chapterName, bookDisplayName, filePath: null, questionMix };
}
function aggMix(mixes) {
  const s = { mcq: 0, shortTwo: 0, shortThree: 0, longFour: 0, longFive: 0 };
  for (const m of mixes) for (const k of Object.keys(s)) s[k] += m[k] || 0;
  return s;
}

const CH10 = () => ch('The Human Eye and the Colourful World', 'NCERT Science Class 10', { ...REALISTIC_MIX });
const CH5 = () => ch('Life Processes', 'NCERT Science Class 10', { ...REALISTIC_MIX });
const MATHS = () => ch('Triangles', 'NCERT Mathematics Class 10', { ...REALISTIC_MIX });
const C9SCI = () => ch('Matter in Our Surroundings', 'NCERT Science Class 9', { ...REALISTIC_MIX });

/**
 * category  : logical group
 * p1Applies : whether "≥2 pool images expected" (P1/P2) applies to this run's paper
 * expectZeroImages : unseeded — must have zero images (N6)
 * svgAllowed: SVG data URIs permitted (Maths only) (N3)
 * finalise  : do a draft call then a FINALISE_AND_KEY call and check the answer key (N7)
 */
const CATEGORIES = [
  { category: 'A_ch10_draft', classNumber: 10, subject: 'Science', label: 'C10-Sci-Ch10',
    chapters: () => [CH10()], smoke: 2, full: 5, p1Applies: true, isScience: true },
  { category: 'B_ch5_draft', classNumber: 10, subject: 'Science', label: 'C10-Sci-Ch5',
    chapters: () => [CH5()], smoke: 1, full: 5, p1Applies: true, isScience: true },
  { category: 'C_ch5_10_combined', classNumber: 10, subject: 'Science', label: 'C10-Sci-Ch5+10',
    chapters: () => [ch('Life Processes', 'NCERT Science Class 10', { ...COMBINED_MIX }),
                     ch('The Human Eye and the Colourful World', 'NCERT Science Class 10', { ...COMBINED_MIX })],
    smoke: 1, full: 3, p1Applies: true, isScience: true },
  { category: 'D_ch10_finalise', classNumber: 10, subject: 'Science', label: 'C10-Sci-Ch10-FINALISE',
    chapters: () => [CH10()], smoke: 1, full: 3, p1Applies: false, isScience: true, finalise: true },
  { category: 'E_maths_draft', classNumber: 10, subject: 'Mathematics', label: 'C10-Maths-Geometry',
    chapters: () => [MATHS()], smoke: 1, full: 3, p1Applies: false, isScience: false, svgAllowed: true },
  { category: 'F_c9_unseeded', classNumber: 9, subject: 'Science', label: 'C9-Sci-Unseeded',
    chapters: () => [C9SCI()], smoke: 1, full: 2, p1Applies: false, isScience: true, expectZeroImages: true },
];

function buildRuns() {
  const runs = [];
  let idx = 0;
  for (const c of CATEGORIES) {
    const n = MODE === 'full' ? c.full : c.smoke;
    for (let i = 0; i < n; i++) {
      idx++;
      runs.push({ ...c, run: i + 1, of: n, index: idx, chapters: c.chapters() });
    }
  }
  return runs;
}

// ── HTTP ────────────────────────────────────────────────────────────────────────
async function apiPost(body, timeoutMs = REQ_TIMEOUT_MS) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}/api/generate-with-chapters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* non-JSON error body */ }
    return { status: res.status, ok: res.ok, json, text };
  } catch (err) {
    return { status: 0, ok: false, json: null, text: '', error: String(err) };
  } finally {
    clearTimeout(t);
  }
}

function draftBody(run) {
  return {
    generationType: 'exam-paper',
    chapterSelections: run.chapters,
    additionalInstructions: '',
    board: 'CBSE',
    classNumber: run.classNumber,
    subject: run.subject,
    questionMix: aggMix(run.chapters.map((c) => c.questionMix)),
    examType: 'Unit Test',
    duration: '2 hours',
    difficulty: 'Standard',
    generationMode: 'quick',
    internalChoice: { enabled: false, sections: [] },
  };
}
function finaliseBody(run, draftText) {
  return {
    generationType: 'exam-paper',
    chapterSelections: run.chapters,
    additionalInstructions: `FINALISE_AND_KEY:${draftText}`,
    board: 'CBSE',
    classNumber: run.classNumber,
    subject: run.subject,
    generationMode: 'quick',
  };
}

// ── Server management ────────────────────────────────────────────────────────────
async function serverUp() {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 3000);
  try {
    await fetch(BASE, { signal: ac.signal });
    return true;
  } catch { return false; } finally { clearTimeout(t); }
}

let serverProc = null;
async function ensureServer() {
  if (await serverUp()) {
    console.log(`✓ Reusing server already reachable at ${BASE}`);
    return;
  }
  if (process.env.TEST_BASE_URL) {
    throw new Error(`TEST_BASE_URL=${BASE} set but no server is reachable there. Start it first.`);
  }
  console.log(`↑ Starting "next dev" on port ${PORT} (logs → ${SERVER_LOG}) …`);
  const logFd = openSync(SERVER_LOG, 'w');
  serverProc = spawn('npm', ['run', 'dev'], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, PORT },
    stdio: ['ignore', logFd, logFd],
    detached: true,
  });
  serverProc.on('error', (e) => console.error('Server spawn error:', e));

  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    if (await serverUp()) { console.log(`✓ Server ready at ${BASE}`); return; }
  }
  throw new Error('Dev server did not become ready within 120s. Check ' + SERVER_LOG);
}
function stopServer() {
  if (serverProc && serverProc.pid) {
    try { process.kill(-serverProc.pid, 'SIGTERM'); } catch { /* already gone */ }
    console.log('■ Stopped dev server we started.');
  }
}

// ── Supabase (N8) ────────────────────────────────────────────────────────────────
async function snapshotMissingLog() {
  if (!HAS_SERVICE_KEY) return { available: false, rows: [] };
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(ENV.NEXT_PUBLIC_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await sb.from('missing_diagram_log').select('*');
    if (error) return { available: false, rows: [], error: error.message };
    return { available: true, rows: data || [] };
  } catch (err) {
    return { available: false, rows: [], error: String(err) };
  }
}

// ── Text scanning ────────────────────────────────────────────────────────────────
const IMG_RE = /!\[[^\]]*\]\(([^)]*)\)/g;

function classifyUrl(url) {
  const u = (url || '').trim();
  if (!u) return 'empty';
  if (/^data:image\/svg/i.test(u)) return 'svg';
  if (/^data:/i.test(u)) return 'data-other';
  if (/^https?:\/\//i.test(u)) return 'http';
  return 'other';
}
function isPoolUrl(url) {
  // Current architecture: the only http images embedded are diagram-pool images.
  return classifyUrl(url) === 'http';
}
function isValidPoolUrl(url) {
  const u = (url || '').trim();
  return /^https?:\/\//i.test(u) && /supabase\.co/i.test(u) && /diagram[-_]?pool/i.test(u);
}

function allImages(text) {
  const imgs = [];
  let m;
  IMG_RE.lastIndex = 0;
  while ((m = IMG_RE.exec(text)) !== null) {
    imgs.push({ raw: m[0], url: m[1], kind: classifyUrl(m[1]), index: m.index });
  }
  return imgs;
}

function questionHeaderPositions(text) {
  const re = /\*\*Q\d+[.)]/g;
  const idxs = [];
  let m;
  while ((m = re.exec(text)) !== null) idxs.push(m.index);
  return idxs;
}

/**
 * Build per-question blocks with CORRECT image attribution.
 *
 * The pipeline attaches a diagram ADJACENT to its question — but empirically it
 * lands EITHER on the line just BEFORE the `**Qn.**` header (e.g. an image for a
 * "study the diagram below" question) OR just AFTER the header, before the answer
 * lines (e.g. "Study the diagram given above" identify questions). Neither a
 * pure before- nor after-rule is correct on its own.
 *
 * So we attribute each image to the NEAREST question header by text distance —
 * the header physically closest to the image, which is exactly what a reader sees
 * the image sitting next to. This makes N5 (draw-question must have no image) and
 * N1 (>1 image per question) attribute to the right question in both layouts.
 */
function questionBlocks(text) {
  const headers = questionHeaderPositions(text);
  if (headers.length === 0) return [];
  const owned = headers.map(() => []);
  for (const img of allImages(text)) {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < headers.length; i++) {
      const d = Math.abs(headers[i] - img.index);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    owned[best].push(img);
  }
  return headers.map((h, i) => ({
    text: text.slice(h, headers[i + 1] ?? text.length).trim(),
    imgs: owned[i],
  }));
}

function findMarkers(text) {
  const found = [];
  const patterns = [
    { name: '%%DIAGRAM', re: /%%DIAGRAM[^\n]*/g },
    { name: '[SVG:', re: /\[SVG:[^\n]*/g },
    { name: '[FIGURE:', re: /\[FIGURE:[^\n]*/g },
    { name: '[DIAGRAM:', re: /\[DIAGRAM:[^\n]*/g },
  ];
  for (const p of patterns) {
    let m;
    p.re.lastIndex = 0;
    while ((m = p.re.exec(text)) !== null) found.push({ marker: p.name, snippet: m[0].slice(0, 120) });
  }
  return found;
}

function scanText(text) {
  const imgs = allImages(text);
  const blocks = questionBlocks(text);
  return {
    imgs,
    poolImages: imgs.filter((i) => isPoolUrl(i.url)),
    svgImages: imgs.filter((i) => i.kind === 'svg'),
    emptyImages: imgs.filter((i) => i.kind === 'empty'),
    blocks,
    markers: findMarkers(text),
  };
}

const CHECK_META = {
  P1: { gate: 'NOW', desc: 'Diagram-heavy paper has ≥2 pool images' },
  P2: { gate: 'NOW', desc: 'Pool image URLs are valid (supabase diagram-pool)' },
  N1: { gate: 'NOW', desc: 'No question block has >1 image' },
  N2: { gate: 'NOW', desc: 'Zero data:image/svg in any Science paper' },
  N3: { gate: 'NOW', desc: 'SVG allowed ONLY in Maths runs' },
  N4: { gate: 'NOW', desc: 'No raw %%DIAGRAM / [SVG: / [FIGURE: / [DIAGRAM: markers' },
  N5: { gate: 'GATE', desc: 'draw/sketch/label-the-diagram questions have NO image' },
  N6: { gate: 'NOW', desc: 'Unseeded runs: zero images, no crash, no orphan markers' },
  N7: { gate: 'NOW', desc: 'Answer-key text passes N1–N4' },
  N8: { gate: 'NOW', desc: 'missing_diagram_log gained rows during the run' },
  PF: { gate: 'NOW', desc: 'Finalise preserves the draft\'s pool images (no silent strip)' },
};

/** Evaluate all applicable checks for one run's paper text (+ optional answer key). */
function evaluateRun(run, paperText, answerKeyText) {
  const scan = scanText(paperText || '');
  const results = {}; // check -> { applicable, pass, detail, evidence: [] }

  const set = (k, applicable, pass, detail, evidence = []) => {
    results[k] = { applicable, pass, detail, evidence };
  };

  // Crash guard (used by N6 and general)
  const crashed = run._crashed;

  // P1 — ≥2 pool images (imageExpected drafts). BLOCKED if no service key.
  if (run.p1Applies) {
    if (!HAS_SERVICE_KEY) {
      set('P1', true, null, 'BLOCKED: SUPABASE_SERVICE_ROLE_KEY missing — pool lookup returns nothing');
    } else {
      const n = scan.poolImages.length;
      set('P1', true, n >= 2, `${n} pool image(s) found`, n >= 2 ? [] : [`only ${n} pool image(s)`]);
    }
  }

  // P2 — pool URLs valid
  if (run.p1Applies) {
    if (!HAS_SERVICE_KEY) {
      set('P2', true, null, 'BLOCKED: SUPABASE_SERVICE_ROLE_KEY missing');
    } else {
      const bad = scan.poolImages.filter((i) => !isValidPoolUrl(i.url));
      const empties = scan.emptyImages;
      const ok = bad.length === 0 && empties.length === 0;
      set('P2', true, ok, ok ? 'all pool URLs valid' : `${bad.length} suspicious + ${empties.length} empty`,
        [...bad.map((b) => `suspicious URL: ${b.url}`), ...empties.map(() => 'empty image URL')]);
    }
  }

  // N1 — no block with >1 image
  const multi = scan.blocks.filter((b) => b.imgs.length > 1);
  set('N1', true, multi.length === 0, `${multi.length} block(s) with >1 image`,
    multi.map((b) => `${b.text.slice(0, 300)}\n   → images: ${b.imgs.map((i) => i.url).join(' , ')}`));

  // N2 — zero svg in Science papers
  if (run.isScience) {
    set('N2', true, scan.svgImages.length === 0, `${scan.svgImages.length} svg data-uri(s)`,
      scan.svgImages.map((s) => s.url.slice(0, 80)));
  }

  // N3 — svg only in Maths
  {
    const svgAllowed = Boolean(run.svgAllowed);
    const violation = !svgAllowed && scan.svgImages.length > 0;
    set('N3', true, !violation,
      svgAllowed ? `svg allowed (Maths); ${scan.svgImages.length} present` : `${scan.svgImages.length} svg where none allowed`,
      violation ? scan.svgImages.map((s) => s.url.slice(0, 80)) : []);
  }

  // N4 — no raw markers
  set('N4', true, scan.markers.length === 0, `${scan.markers.length} raw marker(s)`,
    scan.markers.map((m) => `${m.marker} → ${m.snippet}`));

  // N5 [GATE] — draw/sketch/label questions must have no image
  {
    const drawRe = /\bdraw\b|\bsketch\b|label the diagram/i;
    const offenders = scan.blocks.filter((b) => drawRe.test(b.text) && b.imgs.length > 0);
    set('N5', true, offenders.length === 0, `${offenders.length} draw-question(s) with an image`,
      offenders.map((b) => `${b.text.slice(0, 300)}\n   → attached image(s): ${b.imgs.map((i) => i.url).join(' , ')}`));
  }

  // N6 — unseeded: zero images, no crash, no markers
  if (run.expectZeroImages) {
    const problems = [];
    if (crashed) problems.push('request crashed / non-success response');
    if (scan.imgs.length > 0) problems.push(`${scan.imgs.length} image(s) present (expected 0)`);
    if (scan.markers.length > 0) problems.push(`${scan.markers.length} orphan marker(s)`);
    set('N6', true, problems.length === 0, problems.length ? problems.join('; ') : 'clean: 0 images, no crash, no markers',
      problems);
  }

  // PF — finalisation must not silently drop the draft's pool images.
  // (Discovered during smoke testing: a HTTP-200 "success" finalise returned a
  // clean paper with 0 images while its draft had several.)
  if (run.finalise) {
    const draftPool = run._draftPoolCount || 0;
    if (!HAS_SERVICE_KEY) {
      set('PF', true, null, 'BLOCKED: SUPABASE_SERVICE_ROLE_KEY missing');
    } else if (draftPool === 0) {
      results.PF = { applicable: false, pass: null, detail: 'draft had 0 pool images — nothing to preserve', evidence: [] };
    } else {
      const finalPool = scan.poolImages.length;
      const pass = finalPool >= draftPool;
      set('PF', true, pass, `draft ${draftPool} → finalised ${finalPool} pool image(s)`,
        pass ? [] : [`Finalisation dropped ${draftPool - finalPool} of ${draftPool} pool image(s) — final printable paper is missing diagrams.`]);
    }
  }

  // N7 — answer key passes N1–N4
  if (run.finalise) {
    if (!answerKeyText) {
      set('N7', true, false, 'BLOCKED/FAIL: no answer key text extracted', ['answer key missing']);
    } else {
      const ks = scanText(answerKeyText);
      const kMulti = ks.blocks.filter((b) => b.imgs.length > 1);
      const kSvg = run.isScience ? ks.svgImages.length : 0; // N2 within key (science)
      const kMarkers = ks.markers;
      const evidence = [];
      if (kMulti.length) evidence.push(...kMulti.map((b) => 'key >1 image: ' + b.text.slice(0, 300)));
      if (kSvg) evidence.push(...ks.svgImages.map((s) => 'key svg: ' + s.url.slice(0, 80)));
      if (kMarkers.length) evidence.push(...kMarkers.map((m) => 'key marker: ' + m.marker + ' → ' + m.snippet));
      const pass = kMulti.length === 0 && kSvg === 0 && kMarkers.length === 0;
      set('N7', true, pass,
        `key: ${kMulti.length} multi-img, ${kSvg} svg(science), ${kMarkers.length} marker(s)`, evidence);
    }
  }

  return { scan, results };
}

// ── Runner ────────────────────────────────────────────────────────────────────────
function parseFinalise(draft) {
  const PS = '===CLEAN PAPER START===', PE = '===CLEAN PAPER END===';
  const KS = '===ANSWER KEY START===', KE = '===ANSWER KEY END===';
  const psi = draft.indexOf(PS), pei = draft.indexOf(PE);
  const ksi = draft.indexOf(KS), kei = draft.indexOf(KE);
  const paper = psi !== -1 ? (pei > psi ? draft.slice(psi + PS.length, pei) : draft.slice(psi + PS.length)).trim() : '';
  const key = ksi !== -1 ? (kei > ksi ? draft.slice(ksi + KS.length, kei) : draft.slice(ksi + KS.length)).trim() : '';
  return { paper, key };
}

function clearOldRunFiles() {
  for (const f of readdirSync(RUNS_DIR)) {
    if (/^\d+_.*\.txt$/.test(f)) { try { unlinkSync(join(RUNS_DIR, f)); } catch {} }
  }
}

async function runOne(run) {
  const tag = String(run.index).padStart(2, '0');
  const fileBase = `${tag}_${run.label}_r${run.run}`;
  const file = `${fileBase}.txt`;
  console.log(`\n▶ [${run.index}] ${run.label} (run ${run.run}/${run.of})${run.finalise ? ' + FINALISE' : ''}`);

  // 1) Draft call
  const dRes = await apiPost(draftBody(run));
  run._crashed = !(dRes.ok && dRes.json && dRes.json.success);
  const draftText = dRes.json?.draft ?? '';
  let paperText = draftText;
  let answerKeyText = '';
  let fileContent = `# ${run.label} — run ${run.run}/${run.of}\n# HTTP ${dRes.status} ok=${dRes.ok} success=${dRes.json?.success}\n`;
  fileContent += `# ncertFiguresFound=${dRes.json?.ncertFiguresFound} svgsGenerated=${dRes.json?.svgsGenerated}\n`;
  if (dRes.error) fileContent += `# FETCH ERROR: ${dRes.error}\n`;
  if (dRes.json?.error) fileContent += `# API ERROR: ${dRes.json.error} :: ${dRes.json.detail ?? ''}\n`;
  fileContent += `\n===== DRAFT =====\n${draftText || dRes.text}\n`;

  // 2) Finalise call (only D)
  if (run.finalise && draftText) {
    console.log('   … finalising for answer key');
    const fRes = await apiPost(finaliseBody(run, draftText));
    if (fRes.ok && fRes.json?.success) {
      const parsed = parseFinalise(fRes.json.draft || '');
      paperText = parsed.paper || draftText;   // check the finalised clean paper
      answerKeyText = parsed.key;
      fileContent += `\n===== FINALISED (HTTP ${fRes.status}) =====\n${fRes.json.draft}\n`;
    } else {
      run._crashed = true;
      fileContent += `\n===== FINALISE FAILED HTTP ${fRes.status} =====\n${fRes.text}\n`;
    }
  }

  // Capture a human-readable generation error (invalid key, 500, etc.)
  const errMsg = dRes.error || dRes.json?.error || (dRes.ok ? '' : `HTTP ${dRes.status}`);
  run._error = run._crashed ? (dRes.json?.detail || errMsg || 'unknown generation error') : '';

  // For finalise runs, remember how many pool images the DRAFT had (PF check).
  run._draftPoolCount = run.finalise ? allImages(draftText).filter((i) => isPoolUrl(i.url)).length : 0;

  writeFileSync(join(RUNS_DIR, file), fileContent);
  const { scan, results } = evaluateRun(run, paperText, answerKeyText);
  const poolN = HAS_SERVICE_KEY ? scan.poolImages.length : 'n/a';
  if (run._crashed) console.log(`   ⚠ GENERATION FAILED: ${String(run._error).slice(0, 120)}`);
  console.log(`   saved ${file} | images=${scan.imgs.length} pool=${poolN} svg=${scan.svgImages.length} markers=${scan.markers.length}`);
  return { run, file, paperText, answerKeyText, scan, results, errored: run._crashed, errorMsg: run._error };
}

// ── Report ────────────────────────────────────────────────────────────────────────
function buildReport(runResults, n8) {
  const lines = [];
  const now = new Date().toISOString();
  const total = runResults.length;

  const erroredRuns = runResults.filter((r) => r.errored);
  const okRuns = runResults.filter((r) => !r.errored);

  // Aggregate over runs that actually produced output. Errored runs are reported
  // separately — they must NOT count as passes (empty text trivially "passes").
  const agg = {};
  for (const k of Object.keys(CHECK_META)) agg[k] = { applicable: 0, failed: 0, blocked: 0, failRuns: [] };
  for (const rr of okRuns) {
    for (const [k, res] of Object.entries(rr.results)) {
      if (!res.applicable) continue;
      agg[k].applicable++;
      if (res.pass === null) agg[k].blocked++;
      else if (res.pass === false) { agg[k].failed++; agg[k].failRuns.push(rr); }
    }
  }

  lines.push(`# Diagram System — Mechanical Test Results`);
  lines.push('');
  lines.push(`- **Generated:** ${now}`);
  lines.push(`- **Mode:** ${MODE.toUpperCase()} (${total} runs, ${okRuns.length} produced output, ${erroredRuns.length} errored)`);
  lines.push(`- **Server:** ${BASE}`);
  lines.push(`- **Service key present (P1/P2/N8 enabled):** ${HAS_SERVICE_KEY ? 'YES' : 'NO — those checks BLOCKED'}`);
  lines.push('');
  if (erroredRuns.length) {
    lines.push(`> ⛔ **${erroredRuns.length} of ${total} runs failed to generate any output** (see "Generation errors" below). Their checks are excluded from the counts — an empty paper would otherwise trivially "pass" the negative checks. Fix the generation error and re-run for meaningful results.`);
    lines.push('');
  }
  lines.push(`> Mechanical checks only. Visual correctness (right diagram, answer-leaking pixels) is human vetting and NOT tested here.`);
  lines.push('');

  // Summary table
  lines.push(`## Summary`);
  lines.push('');
  lines.push(`| Check | Gate | Description | Result (failed / applicable) |`);
  lines.push(`|-------|------|-------------|-------------------------------|`);
  for (const k of Object.keys(CHECK_META)) {
    const a = agg[k];
    const meta = CHECK_META[k];
    let verdict;
    if (a.applicable === 0) verdict = 'n/a';
    else if (a.blocked === a.applicable) verdict = `⛔ BLOCKED (${a.blocked})`;
    else if (a.failed === 0) verdict = `✅ 0 / ${a.applicable}`;
    else verdict = `❌ ${a.failed} / ${a.applicable} FAILED`;
    lines.push(`| ${k} | ${meta.gate} | ${meta.desc} | ${verdict} |`);
  }
  lines.push('');

  // Grouped by gate
  for (const gate of ['NOW', 'GATE']) {
    const keys = Object.keys(CHECK_META).filter((k) => CHECK_META[k].gate === gate);
    lines.push(`### [${gate}] checks`);
    for (const k of keys) {
      const a = agg[k];
      if (a.applicable === 0) { lines.push(`- **${k}** — not applicable in this matrix.`); continue; }
      if (a.blocked === a.applicable) { lines.push(`- **${k}** — ⛔ BLOCKED on all ${a.applicable} applicable runs (missing service key).`); continue; }
      const flag = a.failed === 0 ? '✅' : '❌';
      lines.push(`- **${k}** — ${flag} ${a.failed} of ${a.applicable} applicable runs failed${a.blocked ? ` (${a.blocked} blocked)` : ''}.`);
    }
    lines.push('');
  }

  // Generation errors (crashes / bad output)
  if (erroredRuns.length) {
    lines.push(`## Generation errors`);
    lines.push('');
    for (const rr of erroredRuns) {
      lines.push(`- \`scripts/test-runs/${rr.file}\` — **${rr.run.label} r${rr.run.run}**: ${String(rr.errorMsg || 'unknown error').slice(0, 300)}`);
    }
    lines.push('');
  }

  // Frequency by category
  lines.push(`## Frequency by category`);
  lines.push('');
  const cats = [...new Set(okRuns.map((r) => r.run.category))];
  for (const cat of cats) {
    const rs = okRuns.filter((r) => r.run.category === cat);
    const label = rs[0].run.label;
    const perCheck = {};
    for (const rr of rs) {
      for (const [k, res] of Object.entries(rr.results)) {
        if (!res.applicable) continue;
        perCheck[k] = perCheck[k] || { app: 0, fail: 0, blocked: 0 };
        perCheck[k].app++;
        if (res.pass === null) perCheck[k].blocked++;
        else if (res.pass === false) perCheck[k].fail++;
      }
    }
    const parts = Object.entries(perCheck).map(([k, v]) =>
      `${k}: ${v.blocked === v.app ? 'blocked' : `${v.fail}/${v.app} failed`}`);
    lines.push(`- **${label}** (${rs.length} run${rs.length > 1 ? 's' : ''}) — ${parts.join(', ') || 'no applicable checks'}`);
  }
  lines.push('');

  // N8 detail
  lines.push(`## N8 — missing_diagram_log`);
  lines.push('');
  if (!n8.enabled) {
    lines.push(`⛔ BLOCKED — ${n8.reason}`);
  } else {
    lines.push(`- Rows before: ${n8.before}, after: ${n8.after}`);
    if (n8.added.length === 0 && n8.increased.length === 0) {
      lines.push(`- ⚠️ No new/updated rows detected during the run.`);
      lines.push(`  Note: rows are only logged when Claude emits a \`[DIAGRAM:key]\` for a topic key that has no approved image. Unseeded subjects (Class 9 / Maths) are offered NO topic keys, so they cannot log here by design.`);
    } else {
      if (n8.added.length) lines.push(`- ✅ New topic_keys logged: ${n8.added.map((r) => `\`${r.topic_key}\``).join(', ')}`);
      if (n8.increased.length) lines.push(`- ✅ Existing rows incremented: ${n8.increased.map((r) => `\`${r.topic_key}\``).join(', ')}`);
    }
  }
  lines.push('');

  // Per-failure detail
  lines.push(`## Failures — evidence`);
  lines.push('');
  let anyFail = false;
  for (const rr of okRuns) {
    const failing = Object.entries(rr.results).filter(([, res]) => res.applicable && res.pass === false);
    if (failing.length === 0) continue;
    anyFail = true;
    lines.push(`### ${rr.run.label} — run ${rr.run.run}  \`scripts/test-runs/${rr.file}\``);
    for (const [k, res] of failing) {
      lines.push(`- **${k} FAILED** (${CHECK_META[k].gate}): ${res.detail}`);
      for (const ev of res.evidence.slice(0, 3)) {
        lines.push('');
        lines.push('```');
        lines.push(String(ev).slice(0, 600));
        lines.push('```');
      }
    }
    lines.push('');
  }
  if (!anyFail) lines.push(okRuns.length ? `No mechanical failures detected across ${okRuns.length} runs that produced output. 🎉` : `No runs produced output — nothing to check.`);
  lines.push('');

  // Evidence index
  lines.push(`## Raw evidence files`);
  lines.push('');
  for (const rr of runResults) {
    const s = rr.scan;
    lines.push(`- \`scripts/test-runs/${rr.file}\` — ${rr.run.label} r${rr.run.run}: images=${s.imgs.length}, pool=${HAS_SERVICE_KEY ? s.poolImages.length : 'n/a'}, svg=${s.svgImages.length}, markers=${s.markers.length}`);
  }
  lines.push('');
  return lines.join('\n');
}

// ── Main ────────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n=== Diagram system E2E test — MODE=${MODE} — ${new Date().toISOString()} ===`);
  console.log(`Service key: ${HAS_SERVICE_KEY ? 'present (P1/P2/N8 active)' : 'MISSING (P1/P2/N8 will be BLOCKED)'}`);

  const runs = buildRuns();
  console.log(`Planned runs: ${runs.length}`);
  clearOldRunFiles();

  await ensureServer();

  // N8 before-snapshot
  const beforeSnap = await snapshotMissingLog();

  const runResults = [];
  try {
    for (const run of runs) {
      try {
        runResults.push(await runOne(run));
      } catch (err) {
        console.error(`  ✗ run ${run.index} threw:`, err);
        run._crashed = true;
        const { scan, results } = evaluateRun(run, '', '');
        runResults.push({ run, file: `${String(run.index).padStart(2, '0')}_${run.label}_r${run.run}.txt`, scan, results, errored: true, errorMsg: String(err) });
      }
    }
  } finally {
    // N8 after-snapshot + diff
    const afterSnap = await snapshotMissingLog();
    let n8;
    if (!beforeSnap.available || !afterSnap.available) {
      n8 = { enabled: false, reason: beforeSnap.error || afterSnap.error || 'SUPABASE_SERVICE_ROLE_KEY missing' };
    } else {
      const beforeMap = new Map(beforeSnap.rows.map((r) => [r.topic_key, r.request_count ?? 0]));
      const added = afterSnap.rows.filter((r) => !beforeMap.has(r.topic_key));
      const increased = afterSnap.rows.filter((r) => beforeMap.has(r.topic_key) && (r.request_count ?? 0) > beforeMap.get(r.topic_key));
      n8 = { enabled: true, before: beforeSnap.rows.length, after: afterSnap.rows.length, added, increased };
    }

    const report = buildReport(runResults, n8);
    writeFileSync(REPORT_PATH, report);
    stopServer();
    console.log(`\n=== DONE. ${runResults.length} runs. ===`);
    console.log(`Report: ${REPORT_PATH}`);
  }
}

process.on('SIGINT', () => { stopServer(); process.exit(130); });
main().catch((e) => { console.error(e); stopServer(); process.exit(1); });
