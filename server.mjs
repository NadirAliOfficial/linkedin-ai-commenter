// Local log server — run this while using LinkedIn.
// Every comment attempt is saved to logs/production.json in real time.
// Usage: node server.mjs
// Then: node review.mjs --prod

import http from "http";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const PORT = 7331;
const __dir = dirname(fileURLToPath(import.meta.url));
const logFile = join(__dir, "logs", "production.json");

mkdirSync(join(__dir, "logs"), { recursive: true });

let entries = [];
if (existsSync(logFile)) {
  try { entries = JSON.parse(readFileSync(logFile, "utf8")); } catch (_) {}
}

const BOLD = "\x1b[1m", RESET = "\x1b[0m", GREEN = "\x1b[32m", YELLOW = "\x1b[33m", RED = "\x1b[31m", DIM = "\x1b[2m", CYAN = "\x1b[36m";

function save() {
  writeFileSync(logFile, JSON.stringify(entries, null, 2));
}

function printEntry(e) {
  const time = new Date(e.ts).toLocaleTimeString();
  const icon = e.filterTriggered && !e.filterFixed ? `${YELLOW}⚠ FILTERED${RESET}` : e.filterTriggered && e.filterFixed ? `${CYAN}↺ RETRIED+FIXED${RESET}` : e.kind === "user_retry" ? `${YELLOW}↺ USER RETRY${RESET}` : `${GREEN}✓${RESET}`;
  const tone = (e.tone || "?").padEnd(13);
  const name = e.firstName ? `[${e.firstName}]` : "";

  console.log(`\n${BOLD}${time}${RESET} ${icon} ${CYAN}${tone}${RESET} ${name}`);
  console.log(`${DIM}POST:${RESET} ${(e.postFull || e.postSnippet || "").replace(/\n/g, " ").slice(0, 120)}…`);

  if (e.kind === "gen") {
    if (e.filterTriggered) {
      console.log(`${YELLOW}1st attempt:${RESET} ${e.firstAttempt}`);
      console.log(`${e.filterFixed ? GREEN : RED}Final:${RESET}       ${e.comment}`);
    } else {
      console.log(`${GREEN}Comment:${RESET} ${e.comment}`);
    }
  }
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.writeHead(200); res.end(); return; }

  if (req.method === "POST" && req.url === "/log") {
    let body = "";
    req.on("data", c => body += c);
    req.on("end", () => {
      try {
        const entry = JSON.parse(body);
        entries.push(entry);
        save();
        printEntry(entry);
        res.writeHead(200); res.end("ok");
      } catch (_) {
        res.writeHead(400); res.end("bad json");
      }
    });
    return;
  }

  res.writeHead(404); res.end();
});

server.listen(PORT, () => {
  console.log(`\n${BOLD}LinkedIn Comment Logger${RESET}`);
  console.log(`Listening on http://localhost:${PORT}`);
  console.log(`Writing to  logs/production.json`);
  console.log(`${DIM}Reload the Chrome extension, then use LinkedIn.${RESET}`);
  console.log(`${DIM}Ctrl+C to stop. Run 'node review.mjs --prod' to analyze.\n${RESET}`);
  if (entries.length > 0) console.log(`${DIM}${entries.length} existing entries loaded.${RESET}\n`);
});
