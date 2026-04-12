(function () {
  "use strict";

  const PROCESSED_ATTR = "data-lca-done";
  const MODEL = "llama3.2";
  const seenComments = new WeakMap(); // wrap → Set<string> for cycling retry

  const TONES = [
    { label: "Support",      type: "support",      icon: "🤝" },
    { label: "Insightful",   type: "insightful",   icon: "💡" },
    { label: "Agree",        type: "agree",        icon: "👍" },
    { label: "Question",     type: "question",     icon: "🤔" },
    { label: "Congratulate", type: "congratulate", icon: "🎉" },
    { label: "Challenge",    type: "challenge",    icon: "⚡" },
    { label: "Experience",   type: "experience",   icon: "🎯" },
    { label: "Add Value",    type: "addvalue",     icon: "➕" },
    { label: "Funny",        type: "funny",        icon: "😂" },
  ];

  const SYSTEM = `You write punchy one-line LinkedIn comments that feel human, emotional, and real.
Rules:
- ONE short sentence. Max 8 words (not counting the name).
- React to the post — don't summarize it. Show a feeling or sharp thought.
- Naturally include the poster's first name once — start, middle, or end. Vary it.
- Use contractions (it's, that's, I've). Sound like a real person, not a robot.
- No openers: "Great post", "Well said", "So true", "Absolutely", "This is".
- No hashtags. No quotes around output.
- Output the comment text only. Nothing else.`;

  const SHOTS = {
    support: [
      { role: "user",      content: "Post: Burned out after 3 years of hustle culture. Finally taking a break.\nPoster's first name: Sara\nSupportive comment:" },
      { role: "assistant", content: "This needed courage, Sara — glad you chose yourself." },
      { role: "user",      content: "Post: Quit my corporate job to start a business with no safety net.\nPoster's first name: James\nSupportive comment:" },
      { role: "assistant", content: "James, most people never even get close to that leap." },
    ],
    insightful: [
      { role: "user",      content: "Post: AI is replacing junior developers faster than anyone expected.\nPoster's first name: Priya\nInsightful comment:" },
      { role: "assistant", content: "Priya, the bar just moved — not disappeared." },
      { role: "user",      content: "Post: Remote work killed office culture and it's not coming back.\nPoster's first name: Tom\nInsightful comment:" },
      { role: "assistant", content: "Forcing it back, Tom, is just speeding up the exits." },
    ],
    agree: [
      { role: "user",      content: "Post: Hiring for attitude over credentials transformed how I build teams.\nPoster's first name: Ali\nAgree comment:" },
      { role: "assistant", content: "Ali, you can teach skills — you can't teach hunger." },
      { role: "user",      content: "Post: Meetings with no agenda waste everyone's time.\nPoster's first name: Nina\nAgree comment:" },
      { role: "assistant", content: "No agenda, Nina, means no respect for anyone's time." },
    ],
    question: [
      { role: "user",      content: "Post: We cut our team 30% and productivity went up.\nPoster's first name: Chris\nQuestion comment:" },
      { role: "assistant", content: "Chris, what did you cut first — headcount or meetings?" },
      { role: "user",      content: "Post: I replaced performance reviews with weekly check-ins.\nPoster's first name: Mia\nQuestion comment:" },
      { role: "assistant", content: "How do you handle the tough feedback, Mia?" },
    ],
    congratulate: [
      { role: "user",      content: "Post: After 2 years building in stealth, we just launched.\nPoster's first name: Raj\nCongratulatory comment:" },
      { role: "assistant", content: "Raj, two years of silence paid off loud." },
      { role: "user",      content: "Post: Hit $1M ARR without a single paid ad.\nPoster's first name: Leila\nCongratulatory comment:" },
      { role: "assistant", content: "Seven figures on trust alone, Leila — that's the real flex." },
    ],
    challenge: [
      { role: "user",      content: "Post: Passion is all you need to succeed as an entrepreneur.\nPoster's first name: Dan\nChallenge comment:" },
      { role: "assistant", content: "Dan, passion without margin is just an expensive hobby." },
      { role: "user",      content: "Post: College degrees are worthless in tech today.\nPoster's first name: Zara\nChallenge comment:" },
      { role: "assistant", content: "Some doors still need that key, Zara." },
    ],
    experience: [
      { role: "user",      content: "Post: Leadership is about giving credit, not taking it.\nPoster's first name: Omar\nExperience comment:" },
      { role: "assistant", content: "Omar, I watched this one thing transform a whole team's energy." },
      { role: "user",      content: "Post: Customer retention beats acquisition every time.\nPoster's first name: Eva\nExperience comment:" },
      { role: "assistant", content: "Eva, we almost killed our product chasing the wrong number." },
    ],
    addvalue: [
      { role: "user",      content: "Post: Personal branding on LinkedIn changed my career completely.\nPoster's first name: Sam\nAdd value comment:" },
      { role: "assistant", content: "Sam, showing up consistently beats going viral once." },
      { role: "user",      content: "Post: Most startups fail because they build the wrong thing.\nPoster's first name: Lena\nAdd value comment:" },
      { role: "assistant", content: "Lena, ten user calls would've caught it before the first sprint." },
    ],
    funny: [
      { role: "user",      content: "Post: Woke up at 5am every day for a month for my side project.\nPoster's first name: Mike\nFunny comment:" },
      { role: "assistant", content: "Mike at 5am vs Mike at 2pm are two different people 😂" },
      { role: "user",      content: "Post: Just had a 3-hour meeting that could have been an email.\nPoster's first name: Beth\nFunny comment:" },
      { role: "assistant", content: "Beth, the email would've taken 3 minutes too 😂" },
    ],
  };

  const TONE_PROMPT = {
    support:      "Supportive comment:",
    insightful:   "Insightful comment:",
    agree:        "Agree comment:",
    question:     "Question comment:",
    congratulate: "Congratulatory comment:",
    challenge:    "Challenge comment:",
    experience:   "Experience comment:",
    addvalue:     "Add value comment:",
    funny:        "Funny comment:",
  };

  // ── Ollama via background worker ─────────────────────────────────────────

  // ── Language detection (simple heuristic) ───────────────────────────────
  function detectLanguage(text) {
    if (/[\u0600-\u06FF]/.test(text)) return "Arabic or Urdu";
    if (/[\u0900-\u097F]/.test(text)) return "Hindi";
    if (/[\u4E00-\u9FFF]/.test(text)) return "Chinese";
    if (/[\u0400-\u04FF]/.test(text)) return "Russian";
    const spanishWords = /\b(de|la|el|en|que|por|con|una|los|las|del|para|como|pero|más|muy)\b/gi;
    if ((text.match(spanishWords) || []).length >= 3) return "Spanish";
    return "English";
  }

  function askOllama(type, postText, posterName, seen = new Set()) {
    const nameLine = posterName ? `Poster's first name: ${posterName}` : "";
    const lang     = detectLanguage(postText);
    const langLine = lang !== "English" ? `Reply in ${lang}.` : "";
    const avoidLine = seen.size
      ? `Do NOT write any of these (must be different):\n${[...seen].map(s => `- ${s}`).join("\n")}`
      : "";
    const userMsg = [`Post: ${postText}`, nameLine, langLine, avoidLine, TONE_PROMPT[type]]
      .filter(Boolean).join("\n");

    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage({
          type: "ollama",
          payload: {
            model: MODEL,
            stream: false,
            options: { temperature: 0.9, num_predict: 40, num_ctx: 1024, keep_alive: -1 },
            messages: [
              { role: "system", content: SYSTEM },
              ...SHOTS[type],
              { role: "user", content: userMsg },
            ],
          },
        }, (resp) => {
          if (chrome.runtime.lastError) return reject(new Error("Refresh the page and try again"));
          if (!resp?.ok) return reject(new Error(resp?.error || "No response from Ollama"));
          resolve(clean(resp.text, type === "funny"));
        });
      } catch (e) {
        reject(new Error("Refresh the page and try again"));
      }
    });
  }

  function clean(text, keepEmoji = false) {
    let t = text
      .replace(/^["'\u201C\u201D]|["'\u201C\u201D]$/g, "")
      .replace(/^(Here'?s?[^:]*:|Sure[,!]?[^:]*:)\s*/i, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!keepEmoji) {
      t = t.replace(/[\u{1F000}-\u{1FAFF}]/gu, "").replace(/[\u2600-\u27BF]/g, "");
    }
    return t;
  }

  // ── Auto-detect best tone from post text ─────────────────────────────────
  function autoDetectTone(text) {
    const t = text.toLowerCase();
    if (/\b(congratulat|excited to (share|announce)|thrilled|just (got|joined|launched|hired|promoted)|new role|proud to|milestone|achievement|offer)\b/.test(t))
      return "congratulate";
    if (/\b(unpopular opinion|controversial|i disagree|myth|wrong about|actually|but wait)\b/.test(t))
      return "challenge";
    if ((/\?/.test(t) && t.length < 200) || /\b(what do you think|your thoughts|curious|wonder)\b/.test(t))
      return "question";
    if (/\b(i (learned|realized|discovered|failed|struggled|lost|faced|went through|made it|survived))\b/.test(t))
      return "experience";
    if (/\b(tip|lesson|key to|secret|mistake|avoid|should|must|always|never|here'?s how)\b/.test(t))
      return "addvalue";
    if (/\b(support|help|burnout|mental health|hard time|difficult|tough|challeng)\b/.test(t))
      return "support";
    return "insightful";
  }

  // ── Text extraction ───────────────────────────────────────────────────────

  function getPosterName(postEl) {
    const selectors = [
      ".update-components-actor__name span[aria-hidden='true']",
      ".feed-shared-actor__name span[aria-hidden='true']",
      ".update-components-actor__name",
      ".feed-shared-actor__name",
      "a.app-aware-link span[aria-hidden='true']",
    ];
    for (const s of selectors) {
      const el = postEl.querySelector(s);
      const raw = el?.innerText?.trim().split("\n")[0].trim();
      if (!raw || raw.length < 2 || raw.length > 60) continue;
      // Strip LinkedIn degree indicators (• 1st, ○ 3rd+, etc.) and take only first word
      const cleaned = raw.replace(/[•·○●]\s*\d+(st|nd|rd|th)\+?/gi, "").trim();
      const firstName = cleaned.split(/\s+/)[0].replace(/[^a-zA-Z'-]/g, "").trim();
      if (firstName.length > 1) return firstName;
    }
    return "";
  }

  function getPostText(postEl) {
    const tries = [
      ".feed-shared-update-v2__description",
      ".feed-shared-text-view",
      ".update-components-text",
      ".feed-shared-text",
      "span.break-words",
    ];
    for (const s of tries) {
      const el = postEl.querySelector(s);
      if (el && el.innerText.trim().length > 10) return el.innerText.trim().slice(0, 500);
    }
    const clone = postEl.cloneNode(true);
    clone.querySelectorAll("button,script,style,[aria-hidden='true']").forEach(e => e.remove());
    return clone.innerText.replace(/\s+/g, " ").trim().slice(0, 500);
  }

  // ── UI ────────────────────────────────────────────────────────────────────

  function buildPanel(postEl) {
    const wrap = document.createElement("div");
    wrap.className = "lca-wrap";

    const postText    = getPostText(postEl);
    const suggested   = autoDetectTone(postText);

    const header = document.createElement("div");
    header.className = "lca-header";
    header.innerHTML = `<span class="lca-logo">✦</span><span class="lca-title">AI Comment</span>`;
    wrap.appendChild(header);

    const row = document.createElement("div");
    row.className = "lca-row";

    TONES.forEach(({ label, type, icon }) => {
      const btn = document.createElement("button");
      btn.className = "lca-pill";
      btn.dataset.type = type;
      if (type === "funny")    btn.classList.add("lca-pill-funny");
      if (type === suggested)  btn.classList.add("lca-pill-suggested");
      btn.innerHTML = `<span class="lca-icon">${icon}</span>${label}${type === suggested ? ' <span class="lca-suggested-dot"></span>' : ""}`;
      btn.addEventListener("click", () => onTone(type, postEl, wrap));
      row.appendChild(btn);
    });

    wrap.appendChild(row);
    return wrap;
  }

  async function onTone(type, postEl, wrap) {
    // Remove old output
    wrap.querySelectorAll(".lca-out, .lca-variations").forEach(el => el.remove());

    const loading = document.createElement("div");
    loading.className = "lca-out lca-loading";
    loading.innerHTML = `<span class="lca-spinner"></span><span>Writing 3 variations…</span>`;
    wrap.appendChild(loading);
    wrap.querySelectorAll(".lca-pill").forEach(b => (b.disabled = true));

    const text = getPostText(postEl);
    const name = getPosterName(postEl);

    // Seen comments for cycling retry
    if (!seenComments.has(wrap)) seenComments.set(wrap, new Set());
    const seen = seenComments.get(wrap);

    try {
      // Generate 3 variations in parallel
      const results = await Promise.all([
        askOllama(type, text, name, seen),
        askOllama(type, text, name, seen),
        askOllama(type, text, name, seen),
      ]);

      // Deduplicate
      const unique = [...new Set(results.filter(Boolean))];
      unique.forEach(c => seen.add(c));

      loading.remove();
      showVariations(unique, type, wrap);
    } catch (err) {
      loading.className = "lca-out lca-err";
      loading.textContent = err.message;
      wrap.querySelectorAll(".lca-pill").forEach(b => (b.disabled = false));
    }
  }

  function showVariations(comments, type, wrap) {
    const container = document.createElement("div");
    container.className = "lca-variations";

    comments.forEach((comment, i) => {
      const card = document.createElement("div");
      card.className = "lca-card";

      // Editable text area
      const txt = document.createElement("div");
      txt.className = "lca-text";
      txt.contentEditable = "true";
      txt.textContent = comment;
      txt.spellcheck = true;
      card.appendChild(txt);

      // Actions row
      const actions = document.createElement("div");
      actions.className = "lca-card-actions";

      const ins = document.createElement("button");
      ins.className = "lca-act lca-ins";
      ins.textContent = "Use this";
      ins.addEventListener("click", () => {
        const finalText = txt.textContent.trim();
        triggerCommentBox(wrap);
        setTimeout(() => {
          const input = findInput(wrap);
          if (input) {
            pasteInto(input, finalText);
            ins.textContent = "✓ Inserted";
            ins.className = "lca-act lca-ins lca-ok";
          }
        }, 400);
      });

      actions.appendChild(ins);
      card.appendChild(actions);
      container.appendChild(card);
    });

    // Retry row
    const retryRow = document.createElement("div");
    retryRow.className = "lca-retry-row";
    const retry = document.createElement("button");
    retry.className = "lca-act lca-retry";
    retry.textContent = "↺ New variations";
    retry.addEventListener("click", () => {
      container.remove();
      onTone(type, wrap._postEl, wrap);
    });
    retryRow.appendChild(retry);
    container.appendChild(retryRow);

    wrap.appendChild(container);
    wrap.querySelectorAll(".lca-pill").forEach(b => (b.disabled = false));
  }

  // ── Insert into LinkedIn comment box ─────────────────────────────────────

  function triggerCommentBox(wrap) {
    // wrap is inserted right after the action bar — previousElementSibling IS that bar
    const bar = wrap.previousElementSibling;
    if (!bar) return;
    // Only search within the action bar — never fall back to document.body
    const btn = Array.from(bar.querySelectorAll("button")).find(b =>
      (b.getAttribute("aria-label") || b.textContent || "").toLowerCase().includes("comment")
    );
    if (btn) btn.click();
  }

  // Scoped search — starts near wrap and walks up max 6 levels
  function findInput(wrap) {
    const sels = [
      ".ql-editor[contenteditable='true']",
      "div[contenteditable='true'][data-placeholder*='comment' i]",
      "div.comments-comment-texteditor div[contenteditable='true']",
      "div[contenteditable='true'][role='textbox']",
    ];

    // Best signal: whatever has focus right now
    const active = document.activeElement;
    if (active && active.getAttribute("contenteditable") === "true") return active;

    // Walk up from wrap, searching each ancestor's subtree
    let node = wrap.parentElement;
    for (let i = 0; i < 6; i++) {
      if (!node || node === document.body) break;
      for (const s of sels) {
        const el = node.querySelector(s);
        if (el) return el;
      }
      node = node.parentElement;
    }
    return null;
  }

  function pasteInto(el, text) {
    el.focus();
    el.innerHTML = "";
    const ok = document.execCommand("insertText", false, text);
    if (!ok || !el.textContent.includes(text.slice(0, 10))) {
      const p = document.createElement("p");
      p.textContent = text;
      el.appendChild(p);
      el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    }
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
  }

  // ── Injection ─────────────────────────────────────────────────────────────

  function inExcludedArea(el) {
    let p = el;
    for (let i = 0; i < 12; i++) {
      if (!p || p === document.body) break;
      const cls = (p.className || "").toString().toLowerCase();
      if (
        cls.includes("share-box") ||
        cls.includes("share-creation") ||
        cls.includes("editor") ||
        cls.includes("comment-box") ||
        cls.includes("comments-comment") ||
        cls.includes("comments-reply") ||
        cls.includes("comments-list") ||
        cls.includes("comment-list") ||
        cls.includes("reply") ||
        cls.includes("feed-shared-main-content__comment") ||
        p.tagName === "FORM" ||
        p.getAttribute("contenteditable") === "true" ||
        p.getAttribute("role") === "textbox"
      ) return true;
      p = p.parentElement;
    }
    return false;
  }

  function scan() {
    document.querySelectorAll("button").forEach(btn => {
      const label = (btn.getAttribute("aria-label") || btn.innerText || "").toLowerCase();
      if (!label.includes("comment")) return;
      if (inExcludedArea(btn)) return;

      // Walk up exactly 3 levels to land on the action bar wrapper
      const bar = btn.parentElement?.parentElement?.parentElement;
      if (!bar || bar === document.body) return;
      if (bar.hasAttribute(PROCESSED_ATTR)) return;

      // Only inject on the main post action bar — it always has Repost + Send alongside Comment
      // Reply/comment-thread buttons never have these, so this filters them out completely
      const barBtns = Array.from(bar.querySelectorAll("button")).map(b =>
        (b.getAttribute("aria-label") || b.textContent || "").toLowerCase()
      );
      const hasRepost = barBtns.some(t => t.includes("repost"));
      const hasSend   = barBtns.some(t => t.includes("send"));
      if (!hasRepost && !hasSend) return;

      bar.setAttribute(PROCESSED_ATTR, "true");

      // Find the post container — closest ancestor that has post text
      let postEl = bar.parentElement;
      for (let i = 0; i < 10; i++) {
        if (!postEl || postEl === document.body) { postEl = bar.parentElement; break; }
        if (postEl.querySelector("span[dir='ltr'], span.break-words, p")) break;
        postEl = postEl.parentElement;
      }

      const panel = buildPanel(postEl || bar.parentElement);
      panel._postEl = postEl || bar.parentElement;
      bar.parentNode.insertBefore(panel, bar.nextSibling);
    });
  }

  function observe() {
    let timer = null;
    new MutationObserver(mutations => {
      const relevant = mutations.some(m => {
        if (!m.addedNodes.length) return false;
        // Ignore mutations inside comment threads / input areas
        if (inExcludedArea(m.target)) return false;
        return true;
      });
      if (!relevant) return;
      if (timer) return;
      timer = setTimeout(() => { scan(); timer = null; }, 600);
    }).observe(document.body, { childList: true, subtree: true });
  }

  function onNav() {
    document.querySelectorAll(`[${PROCESSED_ATTR}]`).forEach(el => el.removeAttribute(PROCESSED_ATTR));
    document.querySelectorAll(".lca-wrap").forEach(el => el.remove());
    setTimeout(scan, 1200);
  }

  window.addEventListener("popstate", onNav);
  const _push = history.pushState.bind(history);
  history.pushState = function (...a) { _push(...a); onNav(); };

  if (window.location.hostname === "www.linkedin.com") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => { scan(); observe(); });
    } else {
      scan();
      observe();
    }
  }
})();
