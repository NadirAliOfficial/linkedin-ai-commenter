// Reads logs/*.json, prints quality report, and asks Groq to suggest improvements.
// Run: node review.mjs          (test logs)
//      node review.mjs --prod   (production.json from server.mjs)
//      node review.mjs --all    (all log files)

import { readFileSync, readdirSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// ── Load keys ────────────────────────────────────────────────────────────────

const configSrc = readFileSync(join(__dir, "config.js"), "utf8");
const GROQ_KEYS = [...configSrc.matchAll(/"(gsk_[^"]+)"/g)].map(m => m[1]);
let keyIdx = 0;
const getKey = () => GROQ_KEYS[keyIdx % GROQ_KEYS.length];
const rotateKey = () => { keyIdx = (keyIdx + 1) % GROQ_KEYS.length; };

// ── Load logs ────────────────────────────────────────────────────────────────

const logsDir = join(__dir, "logs");
if (!existsSync(logsDir) || !readdirSync(logsDir).some(f => f.endsWith(".json"))) {
  console.error("No logs found. Run node test.mjs first, or export logs from the extension popup.");
  process.exit(1);
}

const prodFlag = process.argv.includes("--prod");
const allFlag  = process.argv.includes("--all");

let fileNames;
if (prodFlag) {
  if (!existsSync(join(logsDir, "production.json"))) {
    console.error("No production.json found. Run 'node server.mjs' first and use the extension.");
    process.exit(1);
  }
  fileNames = ["production.json"];
} else if (allFlag) {
  fileNames = readdirSync(logsDir).filter(f => f.endsWith(".json")).sort();
} else {
  fileNames = existsSync(join(logsDir, "latest.json"))
    ? ["latest.json"]
    : readdirSync(logsDir).filter(f => f.endsWith(".json")).sort().slice(-1);
}

const files = fileNames.map(f => JSON.parse(readFileSync(join(logsDir, f), "utf8")));

// Merge all results across files (dedupe by post+comment)
const seen = new Set();
const all = [];
for (const file of files) {
  const entries = Array.isArray(file) ? file : (file.results || file.entries || []);
  for (const e of entries) {
    const key = (e.post || e.postSnippet || "") + "|" + (e.comment || "");
    if (!seen.has(key)) { seen.add(key); all.push({ ...e, source: file.source || "test" }); }
  }
}

const valid     = all.filter(e => e.comment && !e.error);
const failures  = valid.filter(e => e.generic || e.filterTriggered);
const passed    = valid.filter(e => !e.generic && !e.filterTriggered);

// ── Print report ─────────────────────────────────────────────────────────────

const BOLD = "\x1b[1m", RESET = "\x1b[0m", GREEN = "\x1b[32m", RED = "\x1b[31m", YELLOW = "\x1b[33m", DIM = "\x1b[2m";

console.log(`\n${BOLD}── Comment Quality Report ──────────────────────────────────────${RESET}`);
console.log(`Total entries : ${all.length}  (${files.length} log file${files.length > 1 ? "s" : ""})`);
console.log(`Passed        : ${GREEN}${passed.length}${RESET}`);
console.log(`Flagged       : ${failures.length > 0 ? YELLOW : GREEN}${failures.length}${RESET} (${Math.round(failures.length / (valid.length || 1) * 100)}%)`);

// Per-tone breakdown
const tones = {};
for (const e of valid) {
  if (!e.tone) continue;
  if (!tones[e.tone]) tones[e.tone] = { pass: 0, fail: 0 };
  (e.generic || e.filterTriggered) ? tones[e.tone].fail++ : tones[e.tone].pass++;
}
console.log(`\n${BOLD}Per-tone:${RESET}`);
for (const [tone, counts] of Object.entries(tones)) {
  const total = counts.pass + counts.fail;
  const rate  = Math.round(counts.fail / total * 100);
  const bar   = rate > 30 ? RED : rate > 10 ? YELLOW : GREEN;
  console.log(`  ${tone.padEnd(14)} ${bar}${counts.fail} fail / ${total} total (${rate}%)${RESET}`);
}

console.log(`\n${BOLD}── All generated comments ──────────────────────────────────────${RESET}`);
for (let i = 0; i < valid.length; i++) {
  const e   = valid[i];
  const bad = e.generic || e.filterTriggered;
  const icon = bad ? `${YELLOW}⚠${RESET}` : `${GREEN}✓${RESET}`;
  const post = (e.post || e.postSnippet || "").replace(/\n/g, " ").slice(0, 60);
  console.log(`${String(i + 1).padStart(2)}. ${icon} [${(e.tone || "?").padEnd(13)}] ${DIM}${post}…${RESET}`);
  console.log(`       → ${bad ? YELLOW : ""}${e.comment}${RESET}`);
}

if (failures.length === 0) {
  console.log(`\n${GREEN}${BOLD}No failures found — nothing to improve.${RESET}\n`);
  process.exit(0);
}

// ── Send failures to Groq for analysis ───────────────────────────────────────

console.log(`\n${BOLD}── Groq analysis (${failures.length} failure${failures.length > 1 ? "s" : ""}) ────────────────────────────────────${RESET}`);
console.log("Sending to Groq…\n");

const failList = failures.map((e, i) => {
  const post = (e.post || e.postSnippet || "").replace(/\n/g, " ").slice(0, 200);
  return `${i + 1}. Tone: ${e.tone || "?"}\n   Post: ${post}\n   Bad comment: ${e.comment}`;
}).join("\n\n");

const prompt = `You are reviewing a LinkedIn comment AI. These comments were flagged as too generic, sycophantic, or off-topic.

${failList}

Do two things:

1. PATTERNS — List the failure patterns you see (e.g. "private-chat openers", "empty flattery", "vague observation"). Be specific and name which comment numbers share each pattern.

2. FIXES — For each pattern, give:
   a) A regex (JavaScript syntax) to add to the GENERIC_PATTERNS filter
   b) A one-sentence rule to add to the system prompt

Format:
PATTERN: <name>
COMMENTS: <numbers>
REGEX: /<pattern>/i
RULE: <one sentence>

Output only the patterns and fixes. No intro, no summary.`;

async function callGroq(content) {
  for (let attempt = 0; attempt < GROQ_KEYS.length; attempt++) {
    const r = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getKey() },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content }],
        temperature: 0.3,
        max_tokens: 600,
        stream: false,
      }),
    });
    if (r.status === 429) { rotateKey(); continue; }
    if (!r.ok) throw new Error("Groq " + r.status);
    const d = await r.json();
    return d.choices?.[0]?.message?.content?.trim() || "";
  }
  throw new Error("All keys rate limited");
}

try {
  const analysis = await callGroq(prompt);
  console.log(analysis);
  console.log(`\n${DIM}── Apply suggestions manually in content.js GENERIC_PATTERNS and SYSTEM prompt ──${RESET}\n`);
} catch (e) {
  console.error(`${RED}Groq error: ${e.message}${RESET}`);
}
