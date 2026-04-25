// Test: generate comments for 20 realistic LinkedIn post types
// Run: node test.mjs

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const __dir = dirname(fileURLToPath(import.meta.url));
const configSrc = readFileSync(join(__dir, "config.js"), "utf8");
const GROQ_KEYS = [...configSrc.matchAll(/"(gsk_[^"]+)"/g)].map(m => m[1]);
let keyIdx = 0;
const getKey = () => GROQ_KEYS[keyIdx % GROQ_KEYS.length];
const rotateKey = () => { keyIdx = (keyIdx + 1) % GROQ_KEYS.length; };

const SYSTEM = `Write a single LinkedIn comment that sounds natural — the kind of thing a real person types in a comment box and hits post.
Rules:
- ONE complete sentence. Match the length hint provided.
- Make a genuine observation tied to something SPECIFIC in the post — a number, a named thing, a concrete situation, a decision. Never write something that could fit any other post.
- BAD (too vague, fits any post): "This shift is happening much faster than expected." / "That's a really big cultural change happening quickly."
- GOOD (post-specific): "The gap between devs who use AI and those who don't is already showing up in standups, Sara." — references the actual claim from the post.
- NEVER refer to the person in third person — no "Sara did X", "Usman's product", "Welsh's approach", "his decision", "her post". The name must only appear as a direct address (e.g., "Raj," at the start or ", Raj." at the end) — once, or not at all.
- Do NOT write like you're having a private chat ("for me...", "happens to me too", "been there", "I've done that too").
- If the post asks a question, answer it directly as a statement.
- NAME RULE: most comments should have NO name. Only add the name when the comment genuinely sounds more natural with it — roughly 1 in 3 comments. When in doubt, leave the name out.
- Use contractions freely. Sound human, not corporate.
- NEVER use: "change everything", "going to change everything", "this is everything", "needed to hear this", "so important", "so powerful", "this hits different", "couldn't agree more", "love this", "so true", "preach", "this is gold", "dropping gems", "absolutely this", "thank you for sharing", "spot on", "100%", "keep it up", "speaks volumes", "words of wisdom", "really resonates", "fire post", "couldn't have said it better", "mic drop", "everyone needs to see this".
- No hyphens or em dashes as separators. No filler openers like "Great post", "Well said", "Congrats", "Amazing", "Inspiring".
- No hashtags. No quotes around output. Output only the comment text.
- If the post is very short (a single sentence or just a project title), pick the ONE most specific detail and make an observation about that — never fall back to "looks clean", "great work", or "impressive".
- NEVER end a comment with a bare compliment like "...which is impressive", "...which is amazing", "...is seriously impressive". The insight or observation IS the comment — do not trail it off into praise.
- NEVER use "a game changer for me", "lowkey crushing it", "killing it" or any "X is a great way to Y" generic-advice phrasing.`;

const SHOTS = {
  congratulate: [
    { role: "user",      content: "Post: Just got promoted to Senior Engineer after 3 years of hard work.\nPoster's first name: Raj\nLength: 12–16 words.\nComment:" },
    { role: "assistant", content: "Three years in and you're already at Senior Engineer — that progression doesn't happen by accident, Raj." },
    { role: "user",      content: "Post: Our startup just crossed $1M ARR for the first time.\nPoster's first name: Leila\nLength: 12–16 words.\nComment:" },
    { role: "assistant", content: "A million in ARR before touching outside funding means you own the whole story, Leila." },
    { role: "user",      content: "Post: Excited to announce our SaaS just hit 1,000 paying customers — bootstrapped from zero in 14 months.\nPoster's first name: Usman\nLength: 12–16 words.\nComment:" },
    { role: "assistant", content: "1,000 paying customers before any outside money means the product did the selling itself, Usman." },
    { role: "user",      content: "Post: After 10 months of self-learning Python and data science, I just landed my first role as a Data Analyst at a tech company.\nPoster's first name: Anya\nLength: 12–16 words.\nComment:" },
    { role: "assistant", content: "Ten months of self-teaching Python and walking straight into a tech data role skips most of the traditional path, Anya." },
    { role: "user",      content: "Post: Completed my internship Task-2 building an eCommerce app with ReactJS and Tailwind CSS.\nPoster's first name: Syed\nLength: 12–16 words.\nComment:" },
    { role: "assistant", content: "Shipping a full eCommerce UI with ReactJS and Tailwind in a single internship task is no small thing, Syed." },
  ],
  insightful: [
    { role: "user",      content: "Post: AI is changing how junior devs learn on the job faster than anyone expected.\nPoster's first name: Priya\nLength: 12–16 words.\nComment:" },
    { role: "assistant", content: "The gap between devs who use AI well and those who don't is already showing up in standups." },
    { role: "user",      content: "Post: Remote work is here to stay whether companies like it or not.\nPoster's first name: Tom\nLength: 12–16 words.\nComment:" },
    { role: "assistant", content: "Every company still fighting remote work is basically running a slow exit interview at this point." },
  ],
  support: [
    { role: "user",      content: "Post: Burned out after 3 years of hustle culture. Taking a real break for once.\nPoster's first name: Sara\nLength: 12–16 words.\nComment:" },
    { role: "assistant", content: "Recognizing when three years of hustle has maxed out takes more self-awareness than most people have." },
    { role: "user",      content: "Post: My first startup failed and I'm starting over from scratch.\nPoster's first name: James\nLength: 12–16 words.\nComment:" },
    { role: "assistant", content: "Starting over after a first startup failure is genuinely harder than the launch itself was, James." },
  ],
  challenge: [
    { role: "user",      content: "Post: Passion is all you really need to succeed as an entrepreneur.\nPoster's first name: Dan\nLength: 12–16 words.\nComment:" },
    { role: "assistant", content: "Passion gets you started but it's the boring discipline that actually keeps the company alive." },
  ],
  addvalue: [
    { role: "user",      content: "Post: Most startups fail because they build the wrong thing for too long.\nPoster's first name: Lena\nLength: 12–16 words.\nComment:" },
    { role: "assistant", content: "Ten honest user conversations before the first sprint would save most startups months of wasted builds." },
  ],
  funny: [
    { role: "user",      content: "Post: Just sat through a 3-hour meeting that could have been a 2-line email.\nPoster's first name: Beth\nLength: 12–16 words.\nComment:" },
    { role: "assistant", content: "A 2-line email would've taken four minutes and everyone would've actually read it, Beth." },
  ],
};

const POSTS = [
  // Achievement / congratulate
  { text: "I'm thrilled to share that I just landed my first full-time job as a Frontend Developer at a fintech startup in Karachi! After 8 months of learning React, TypeScript, and Next.js on my own, the grind finally paid off.", name: "Hamza" },
  { text: "Just completed my Google UX Design Certificate after 6 months of evening study alongside my 9-to-5. It wasn't easy but I'm proud of the 5 case studies I built along the way.", name: "Amina" },
  { text: "My portfolio is finally live! Built it from scratch using HTML, CSS, and vanilla JavaScript. No frameworks, no templates. Every line written by me.", name: "Summaya" },
  { text: "Excited to announce that our SaaS product just crossed 1,000 paying customers! We started with zero budget 14 months ago and bootstrapped the whole way.", name: "Usman" },

  // Insight / opinion
  { text: "AI won't replace developers. But developers who use AI will replace those who don't. The gap between the two groups is already visible in every team I've worked with.", name: "Sara" },
  { text: "The best engineers I've worked with write the least code. They spend more time thinking about the problem than typing the solution. That's the real skill gap nobody talks about.", name: "Ali" },
  { text: "Cold emailing 200 recruiters with zero response taught me more about positioning than any course ever did. Your resume is not the problem. Your targeting is.", name: "Fatima" },

  // Tips / add value
  { text: "5 things I wish I knew before my first technical interview:\n1. They care more about your thinking than the right answer\n2. Talking through your logic matters more than silence\n3. Clarify the problem before writing a single line\n4. It's okay to say you don't know\n5. Ask questions at the end — they remember it", name: "Bilal" },
  { text: "Stop building side projects nobody uses. Here's what actually gets you hired:\n- Solve a real problem you personally have\n- Ship it publicly with a live URL\n- Write a post about what you built and why\nRecruiter DMs will follow.", name: "Zara" },

  // Short punchy post
  { text: "Rejected by 47 companies. Hired by the 48th. Keep going.", name: "Omar" },
  { text: "Your LinkedIn profile is your cold email that never gets deleted. Treat it like one.", name: "Nida" },

  // Support / mental health
  { text: "I had to take 3 months off work this year due to severe anxiety. It was the hardest decision of my career and also the best one. Mental health is not a weakness. It's maintenance.", name: "Ayesha" },

  // Funny / relatable
  { text: "Me before standup: I have no updates.\nMe during standup: Actually I deployed 3 features, fixed a critical bug, and refactored the auth module.\nEvery single time.", name: "Dev" },
  { text: "Client: Can you make the logo bigger?\nMe: That's the maximum size without breaking the layout.\nClient: What if we make everything else smaller?\nThis is my life.", name: "Hassan" },

  // Tech showcase / UI design
  { text: "One more example from Crypto Trading Dashboard UI. Clean and stylish UI that every trader will appreciate. The Valor app demonstrates that trading platforms can be both visually appealing and user-friendly.", name: "Sofia" },

  // Question post
  { text: "What's the one skill you wish you had learned earlier in your career? For me it's public speaking. Changed everything about how I'm perceived in the room.", name: "Kamran" },

  // Short post (image-only type)
  { text: "My latest UI design for a food delivery app.", name: "Maham" },

  // Experience / story
  { text: "I used to think working 80-hour weeks was a badge of honour. Then I burned out completely and spent 6 weeks unable to do anything. Now I work 40 focused hours and I produce more. Rest is not a reward. It's part of the process.", name: "Tariq" },

  // Unpopular opinion / challenge
  { text: "Unpopular opinion: most tech bootcamps are not worth the money. You can learn the same material in 4 months on YouTube for free. What you're actually paying for is accountability and a job guarantee that rarely holds up.", name: "Rana" },

  // Long motivational / long-game post (real-world failure case)
  { text: `The time is going to pass anyway. The only question is who you'll be when it gets here.\n\nI hear it all the time from aspiring founders: "I'm too old to start," "The market is too crowded," or "I'll wait until next year when I'm more ready." They treat their 30s or 40s like a finish line instead of a milestone.\n\nHere is the mathematical reality of your life:\n\nIf you're 25 today, you'll be 35 in ten years no matter what you do. You cannot stop the clock. You only have the choice of which version of that 35-year-old you want to be:\nOption A: The 35-year-old who built the business, mastered the skill, and took the risk.\nOption B: The 35-year-old who thought it was "too late" to start.\n\nWhy the "Long Game" is the only win:\nCompounding requires a start date: You don't see the massive gains until you've been in the game long enough for the math to work.\nGrit is the prerequisite: Almost everyone fails because they quit when it feels "too hard" early on. The crazy ones stick it out until they succeed.\nSimplicity scales: Don't overcomplicate the "10-year plan." Just do the next right thing today.\nMind your own business: Stop watching the news and start building your own assets. Your focus is your only leverage against the passing of time.\n\nI started from zero, and I can tell you from experience: the best time to start was yesterday. The second best time is right now.\n\nIf you could go back 10 years, what is the one thing you wish you had started then?`, name: "Tim" },
];

function detectTone(text) {
  const t = text.toLowerCase();
  if (/\b(congratulat|excited to (share|announce)|thrilled|just (got|joined|launched|hired|promoted)|new role|proud to|(hit|crossed|reached|celebrating) (a |my |our )?milestone|achievement|offer|passed|certified|degree|graduated)\b/.test(t)) return "congratulate";
  if (/\b(unpopular opinion|controversial|i disagree|myth|wrong about|actually|but wait|hot take|change my mind)\b/.test(t)) return "challenge";
  if (/\b(i (learned|realized|failed|struggled|went through|survived|made it|discovered|noticed))\b/.test(t)) return "experience";
  if (/\b(tip|tips|lesson|key to|mistake|avoid|should|must|always|never|here'?s how|step|steps|guide|framework|rule|rules)\b/.test(t)) return "addvalue";
  if (/\b(burnout|mental health|hard time|difficult|tough|quit|fired|lost|grief|anxiety|depression|struggling|lonely)\b/.test(t)) return "support";
  if (/\b(😂|🤣|lol|hilarious|funny|ironic|meanwhile|plot twist)\b/.test(t)) return "funny";
  if (/\?\s*$/.test(text.trim())) return "insightful";
  return "insightful";
}

function lengthHint(text) {
  const w = text.trim().split(/\s+/).length;
  if (w < 30) return "8–12 words";
  if (w < 80) return "12–16 words";
  return "14–20 words";
}

function isQuestion(text) {
  return /\?\s*$/.test(text.trim()) || /^(what|how|why|do you|have you|would you|should|can you|who|when|where)\b/i.test(text.trim());
}

const GENERIC_PATTERNS = [
  /change everything/i, /going to change/i, /this is everything/i,
  /needed to hear this/i, /so important/i, /so powerful/i,
  /this hits different/i, /couldn'?t agree more/i, /\blove this\b/i,
  /\bso true\b/i, /^preach/i, /this is gold/i, /dropping gems/i,
  /absolutely this/i, /\bwell said\b/i, /great post/i, /amazing post/i,
  /inspiring post/i, /^congrats?\b/i, /^congratulations\b/i,
  /keep (it up|going|pushing)/i,
  /this is (so |really )?(important|relevant|needed|powerful|huge)/i,
  /thank you for sharing/i, /thanks? for sharing/i,
  /\bspot on\b/i, /\b100%\b/i, /mic drop/i,
  // Vague "shift/trend/change" filler
  /\b(this|the) (shift|change|trend|movement|transition) is (happening|coming|real|here)/i,
  /\b(big|huge|major|massive|significant) (cultural |industry |societal )?(shift|change|trend)/i,
  /(happening|moving|changing|evolving) (much |so |really |very )?(faster|quicker|rapidly|quickly) than (expected|anticipated)/i,
  /happening (very |really |so )?(quickly|fast|rapidly) now/i,
  /\bthis is (a )?(huge|big|massive|major|significant|important|real) (shift|change|trend|move|moment|step)/i,
  /\b(things|everything|the world|the industry|the field) (is|are) (changing|shifting|evolving|moving) (fast|quickly|rapidly)/i,
  // Private-chat / "me too" style
  /\bhappens? to me\b/i, /\bme too\b/i, /\bsame here\b/i, /\bbeen there\b/i,
  /\bi('ve| have) (done|been|felt|had|seen) (that|this|the same)\b/i,
  /\b(in my|our) team\b/i, /\b(this|it) (happens?|occurred) (to me|in my)\b/i,
  /\b(a |total )?game changer for me\b/i,
  /^i wish i('d| had)\b/i, /^i should('ve| have)\b/i,
  // Empty flattery openers
  /^that'?s (a lot|really|so|very|quite|an? )?(impressive|amazing|incredible|great|awesome|huge|massive)\b/i,
  /^(that'?s|this is) (a )?classic\b/i,
  /^(what|that'?s) (a )?great\b/i,
  /probably got (a great|an amazing|a fantastic|a good)\b/i,
  /^(the layout|the design|the work|the ui|the interface) (looks?|is) (very |really |so )?(clean|nice|great|good|awesome|impressive)\b/i,
  // Flattery endings
  /(,| is) (incredibly|seriously|pretty|really|so|very|quite) (impressive|amazing|incredible|awesome)\s*[,.]?\s*\w*\.?$/i,
  /(is|that'?s|'s) (impressive|incredible|amazing|awesome|remarkable)( work| stuff| job)?\s*[,.]?\s*\w{0,20}\.?\s*$/i,
  /\bgot (a great|an amazing|a fantastic|a good) (hire|employee|team member|addition)\b/i,
  /\b(lowkey |always )?(crushing|killing) it\b/i,
  /\bgreat (persistence|effort|job|work|mindset|attitude|stuff)\b/i,
  // "for me" endings
  /\bfor me[,.]?\s*\w{0,20}\.?\s*$/i,
  // Generic advice
  /\b\w+ (is|are) (a |the )?(great|good|excellent|solid|perfect) way to\b/i,
];
function isGeneric(c) { return GENERIC_PATTERNS.some(p => p.test(c)); }

function clean(text) {
  return text
    .replace(/^["'\u201C\u201D]|["'\u201C\u201D]$/g, "")
    .replace(/^(Here'?s?[^:]*:|Sure[,!]?[^:]*:)\s*/i, "")
    .replace(/\s+[-–—]\s+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function callGroq(messages, temp = 0.7) {
  for (let attempt = 0; attempt < GROQ_KEYS.length; attempt++) {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getKey() },
      body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages, temperature: temp, max_tokens: 90, stream: false }),
    });
    if (r.status === 429) { rotateKey(); continue; }
    if (!r.ok) throw new Error("Groq " + r.status);
    const d = await r.json();
    return d.choices?.[0]?.message?.content || "";
  }
  throw new Error("All keys rate limited");
}

async function generateComment(post) {
  const tone = detectTone(post.text);
  const lang = "English";
  const hint = lengthHint(post.text);
  const qHint = isQuestion(post.text) ? "The post asks a question — answer it as a direct observation or bold statement tied to something specific in the post. Do NOT use 'I wish I had', 'I should have', or any first-person personal-wish phrasing." : "";

  const userMsg = [
    `Post: ${post.text}`,
    post.name ? `Poster's first name: ${post.name}` : "",
    `Length: ${hint}.`,
    qHint,
    "Comment:",
  ].filter(Boolean).join("\n");

  const messages = [
    { role: "system", content: SYSTEM },
    ...(SHOTS[tone] || SHOTS.insightful),
    { role: "user", content: userMsg },
  ];

  let comment = clean(await callGroq(messages, 0.7));
  if (isGeneric(comment)) {
    const retry = clean(await callGroq(messages, 0.75));
    if (!isGeneric(retry)) comment = retry;
  }
  return { comment, tone, generic: isGeneric(comment) };
}

// ── Run ───────────────────────────────────────────────────────────────────────

import { writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const W = (s, n) => s.length > n ? s.slice(0, n - 1) + "…" : s.padEnd(n);
const GREEN = "\x1b[32m", RED = "\x1b[31m", YELLOW = "\x1b[33m", RESET = "\x1b[0m", BOLD = "\x1b[1m";

console.log(`\n${BOLD}LinkedIn Comment Generator — ${POSTS.length} post test${RESET}\n`);
console.log("─".repeat(90));

let pass = 0, fail = 0;
const results = [];

for (let i = 0; i < POSTS.length; i++) {
  const post = POSTS[i];
  const num = String(i + 1).padStart(2, "0");
  process.stdout.write(`${num}. ${W(post.text.replace(/\n/g, " "), 55)} [${post.name}] → `);
  try {
    const { comment, tone, generic } = await generateComment(post);
    if (generic) {
      console.log(`${YELLOW}⚠ GENERIC${RESET} (${tone}): ${comment}`);
      fail++;
    } else {
      console.log(`${GREEN}✓${RESET} (${tone}): ${comment}`);
      pass++;
    }
    results.push({ post: post.text, name: post.name, tone, comment, generic, error: null });
  } catch (e) {
    console.log(`${RED}✗ ERROR: ${e.message}${RESET}`);
    fail++;
    results.push({ post: post.text, name: post.name, tone: null, comment: null, generic: null, error: e.message });
  }
  await new Promise(r => setTimeout(r, 300));
}

console.log("\n" + "─".repeat(90));
console.log(`${BOLD}Results: ${GREEN}${pass} passed${RESET} / ${fail > 0 ? RED : ""}${fail} failed${RESET}${BOLD} out of ${POSTS.length}${RESET}\n`);

// ── Save logs ─────────────────────────────────────────────────────────────────

const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const log = { timestamp: new Date().toISOString(), source: "test", total: POSTS.length, passed: pass, failed: fail, results };
mkdirSync(join(__dir, "logs"), { recursive: true });
writeFileSync(join(__dir, "logs", "latest.json"), JSON.stringify(log, null, 2));
writeFileSync(join(__dir, "logs", `test-${ts}.json`), JSON.stringify(log, null, 2));
console.log(`Log saved → logs/latest.json\n`);
