#!/usr/bin/env node
/**
 * Verify the curated SKR03/SKR04 datasets against the official DATEV chart PDFs.
 *
 * Usage:
 *   npm run verify:datev -- <path/to/skr03.pdf> <path/to/skr04.pdf>
 *
 * The PDFs are the official DATEV charts ("DATEV-Kontenrahmen SKR 03/04,
 * gültig für <year>", Art.-Nr. 11174 and 11175). They are NOT part of this
 * repository — see docs/datev-verification.md for how to obtain them.
 *
 * For every account in src/data/skr03.json and src/data/skr04.json the script
 * checks that
 *   1. the account number exists as a named account in the chart,
 *   2. the account number is not marked "R" (reserved) in the chart,
 *   3. the dataset designation matches the chart designation.
 *
 * Exit code 0 = datasets match the charts, 1 = at least one finding.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as mupdf from "mupdf";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// Function codes DATEV prints in front of account numbers ("Programmverbindung").
// "R" marks a reserved account number.
const CODES = new Set(["R", "S", "F", "K", "KU", "V", "M", "AM", "AV", "G", "GK"]);

// Page geometry of the DATEV chart PDFs (Letter pages, two half-page columns,
// each: sidebar | account number | designation). Values in PDF points.
const HEADER_Y = 112; // everything above is page header / class title
const FOOTER_Y = 760;
const HALF_OFFSET = 239.3; // x distance between the two number columns
const ZONE_WIDTH = 120; // designation text starts within ~113pt right of the number; the next sidebar starts at ~123 (SKR04) / ~128 (SKR03)
const NUM_WINDOW = 8; // an entry's number starts within this distance of the number column
const NUM_WINDOW_CODED = 22; // ... or this distance when prefixed by a function code

/** Extract space-separated words with their positions and bold flag from one page. */
function pageWords(page) {
  const words = [];
  let cur = null;
  page.toStructuredText().walk({
    onChar(c, _origin, font, _size, quad) {
      if (c.trim() === "") {
        cur = null;
        return;
      }
      if (!cur) {
        cur = { x: quad[0], y: quad[1], text: "", bold: /bold/i.test(font.getName()) };
        words.push(cur);
      }
      cur.text += c;
    },
    endLine() {
      cur = null;
    },
  });
  return words.filter((w) => w.y > HEADER_Y && w.y < FOOTER_Y);
}

/** Most frequent rounded value. */
function mode(values) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

/**
 * Parse a DATEV chart PDF into named accounts and reserved account numbers.
 * Returns { named: Map<konto, designation>, reserved: Set<konto> }.
 */
export function parseChart(pdfPath) {
  const doc = mupdf.Document.openDocument(readFileSync(pdfPath), "application/pdf");
  const accounts = new Map(); // konto -> { tokens, code }
  const ranges = []; // { start, end, code }
  let current = null;

  for (let i = 0; i < doc.countPages(); i++) {
    const words = pageWords(doc.loadPage(i));
    const numTokens = words.filter((w) => /^\d{4}$/.test(w.text) && w.x >= 150 && w.x <= 220);
    // legend / footnote pages contain prose, not chart columns — skip them
    if (numTokens.length < 10) continue;
    const leftNumX = mode(numTokens.map((w) => Math.round(w.x)));

    for (const zoneX of [leftNumX, leftNumX + HALF_OFFSET]) {
      const zone = words
        .filter((w) => w.x >= zoneX - 10 && w.x < zoneX + ZONE_WIDTH)
        .sort((a, b) => a.y - b.y || a.x - b.x);
      const lines = new Map();
      for (const w of zone) {
        const key = Math.round(w.y / 4);
        if (!lines.has(key)) lines.set(key, []);
        lines.get(key).push(w);
      }
      let prevY = -Infinity;
      let currentBold = false;
      for (const key of [...lines.keys()].sort((a, b) => a - b)) {
        const line = lines.get(key).sort((a, b) => a.x - b.x);
        const lineY = line[0].y;
        const gap = lineY - prevY;
        prevY = lineY;
        // Bold lines that neither start an account entry nor continue a bold
        // entry are section headings ("Kalkulatorische Kosten", ...): they end
        // the current entry.
        const allBold = line.every((w) => w.bold);
        const startsEntry =
          (/^\d{4}$/.test(line[0].text) && line[0].x < zoneX + NUM_WINDOW) ||
          (line[1] && CODES.has(line[0].text) && /^\d{4}$/.test(line[1].text) && line[0].x < zoneX + NUM_WINDOW);
        if (allBold && !startsEntry && (current === null || !currentBold || gap > 11)) {
          current = null;
          continue;
        }
        // rare kerning artifact: a 4-digit number split into two 2-digit words
        if (
          line.length >= 2 &&
          /^\d{2}$/.test(line[0].text) &&
          /^\d{2}$/.test(line[1].text) &&
          line[0].x < zoneX + NUM_WINDOW &&
          line[1].x - line[0].x < 12
        ) {
          line.splice(0, 2, { ...line[0], text: line[0].text + line[1].text });
        }
        let i = 0;
        let code = null;
        if (line[0] && CODES.has(line[0].text) && line[0].x < zoneX + NUM_WINDOW) {
          code = line[0].text;
          i = 1;
        }
        const numWindow = code ? NUM_WINDOW_CODED : NUM_WINDOW;
        if (line[i] && /^\d{4}$/.test(line[i].text) && line[i].x < zoneX + numWindow) {
          current = line[i].text;
          currentBold = line[i].bold;
          accounts.set(current, { tokens: [], code });
          i += 1;
        } else if (line[i] && /^-\d{2}$/.test(line[i].text) && line[i].x < zoneX + 12 && current) {
          ranges.push({ start: current, end: current.slice(0, 2) + line[i].text.slice(1), code: accounts.get(current)?.code ?? null });
          i += 1;
        } else if (code) {
          i = 0; // stray code-like token — keep it as text
        }
        if (current) {
          for (const w of line.slice(i)) accounts.get(current).tokens.push(w.text);
        }
      }
    }
  }

  const named = new Map();
  const reserved = new Set();
  for (const [konto, info] of accounts) {
    // strip footnote markers ("Rücklagen17)" -> "Rücklagen")
    let tokens = info.tokens
      .map((t) => t.replace(/(?<=[\p{L}.%)])\d{1,2}\)$/u, ""))
      .filter(Boolean);
    // join hyphenated line wraps ("gegen-" + "über" -> "gegenüber")
    const out = [];
    for (const t of tokens) {
      const prev = out[out.length - 1];
      if (
        prev &&
        prev.endsWith("-") &&
        prev.length > 1 &&
        /\p{L}/u.test(prev[prev.length - 2]) &&
        /^\p{Ll}/u.test(t) &&
        !/^(?:und\b|oder\b|bzw\.)/u.test(t)
      ) {
        out[out.length - 1] = prev.slice(0, -1) + t;
      } else {
        out.push(t);
      }
    }
    const name = out.join(" ").trim();
    if (info.code === "R" && name === "") reserved.add(konto);
    else named.set(konto, name);
  }
  for (const { start, end, code } of ranges) {
    for (let n = Number(start) + 1; n <= Number(end); n++) {
      const konto = String(n).padStart(4, "0");
      if (code === "R") reserved.add(konto);
      else if (!named.has(konto)) named.set(konto, named.get(start) ?? "");
    }
  }
  return { named, reserved };
}

/** Normalize a designation for comparison (layout artifacts, not content). */
export function norm(s) {
  return s
    .normalize("NFC")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/(\p{L})- (?=\p{Lu})/gu, "$1-") // wrap at an explicit compound hyphen
    .replace(/(\d) ?%/g, "$1 %")
    .replace(/§ /g, "§")
    .trim()
    .toLowerCase();
}

function verify(label, pdfPath, dataPath) {
  const { named, reserved } = parseChart(pdfPath);
  const data = JSON.parse(readFileSync(dataPath, "utf8"));
  const findings = [];
  let exact = 0;
  for (const konto of data.konten) {
    if (reserved.has(konto.konto)) {
      findings.push(`${label} ${konto.konto} is marked R (reserved) in the chart but the dataset names it "${konto.name}"`);
    } else if (!named.has(konto.konto)) {
      findings.push(`${label} ${konto.konto} "${konto.name}" does not exist in the chart`);
    } else if (norm(konto.name) !== norm(named.get(konto.konto))) {
      findings.push(
        `${label} ${konto.konto} designation mismatch\n    dataset: ${konto.name}\n    chart:   ${named.get(konto.konto)}`
      );
    } else {
      exact++;
    }
  }
  console.log(
    `${label}: chart has ${named.size} named + ${reserved.size} reserved accounts; ` +
      `dataset ${data.konten.length} accounts, ${exact} verified, ${findings.length} findings`
  );
  for (const f of findings) console.log(`  ${f}`);
  return findings.length;
}

const [skr03Pdf, skr04Pdf] = process.argv.slice(2);
if (!skr03Pdf || !skr04Pdf) {
  console.error("Usage: npm run verify:datev -- <skr03.pdf> <skr04.pdf>");
  console.error("See docs/datev-verification.md for how to obtain the DATEV chart PDFs.");
  process.exit(2);
}
const total =
  verify("SKR03", skr03Pdf, path.join(ROOT, "src/data/skr03.json")) +
  verify("SKR04", skr04Pdf, path.join(ROOT, "src/data/skr04.json"));
process.exit(total > 0 ? 1 : 0);
