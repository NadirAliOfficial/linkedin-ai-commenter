(function () {
  "use strict";

  const MODEL = "llama-3.3-70b-versatile";

  // ── Prompts ───────────────────────────────────────────────────────────────

  const SYSTEM = `Write a single LinkedIn comment that sounds like a real person — natural, warm, specific to the post.
Rules:
- ONE complete sentence. Between 12 and 18 words total (including the name).
- React with genuine feeling. Do not summarize the post.
- If a name is provided, use ONLY that exact name once, naturally placed. Never use any other name from the post.
- If no name is provided, write without any name.
- Use contractions freely. Sound like a human, not a bot.
- No hyphens, no em dashes, no filler like "Great post", "Well said", "Congrats", "Amazing".
- No hashtags. No quotes around output. Output only the comment text.`;

  const SHOTS = {
    congratulate: [
      { role: "user",      content: "Post: Just got promoted to Senior Engineer after 3 years of hard work.\nPoster's first name: Raj\nComment:" },
      { role: "assistant", content: "Three years of showing up every day, Raj, and now it's showing up for you." },
      { role: "user",      content: "Post: Our startup just crossed $1M ARR for the first time.\nPoster's first name: Leila\nComment:" },
      { role: "assistant", content: "Leila, that first million hits different when you know what it took to get there." },
    ],
    insightful: [
      { role: "user",      content: "Post: AI is changing how junior devs learn on the job faster than anyone expected.\nPoster's first name: Priya\nComment:" },
      { role: "assistant", content: "Priya, the ones who learn how to use it well are going to move incredibly fast." },
      { role: "user",      content: "Post: Remote work is here to stay whether companies like it or not.\nPoster's first name: Tom\nComment:" },
      { role: "assistant", content: "Tom, the companies still fighting it are basically just running a slow exit interview." },
    ],
    support: [
      { role: "user",      content: "Post: Burned out after 3 years of hustle culture. Taking a real break for once.\nPoster's first name: Sara\nComment:" },
      { role: "assistant", content: "Sara, recognizing when to stop takes more strength than pushing through ever could." },
      { role: "user",      content: "Post: My first startup failed and I'm starting over from scratch.\nPoster's first name: James\nComment:" },
      { role: "assistant", content: "James, starting over after a failure is genuinely harder than the first time and you're doing it." },
    ],
    challenge: [
      { role: "user",      content: "Post: Passion is all you really need to succeed as an entrepreneur.\nPoster's first name: Dan\nComment:" },
      { role: "assistant", content: "Dan, passion gets you started but it's the boring discipline that actually keeps you alive." },
    ],
    experience: [
      { role: "user",      content: "Post: True leadership is about giving credit, not taking it.\nPoster's first name: Omar\nComment:" },
      { role: "assistant", content: "Omar, I've watched this exact thing completely change the energy of an entire team before." },
    ],
    addvalue: [
      { role: "user",      content: "Post: Most startups fail because they build the wrong thing for too long.\nPoster's first name: Lena\nComment:" },
      { role: "assistant", content: "Lena, ten honest user conversations would've caught that before the first sprint even started." },
    ],
    funny: [
      { role: "user",      content: "Post: Just sat through a 3-hour meeting that could have been a 2-line email.\nPoster's first name: Beth\nComment:" },
      { role: "assistant", content: "Beth, the email would've taken four minutes and everyone would've actually read it." },
    ],
  };

  // ── Auto-detect best tone ─────────────────────────────────────────────────

  function detectTone(text) {
    const t = text.toLowerCase();
    if (/\b(congratulat|excited to (share|announce)|thrilled|just (got|joined|launched|hired|promoted)|new role|proud to|milestone|achievement|offer)\b/.test(t))
      return "congratulate";
    if (/\b(unpopular opinion|controversial|i disagree|myth|wrong about|actually|but wait)\b/.test(t))
      return "challenge";
    if (/\b(i (learned|realized|failed|struggled|went through|survived|made it))\b/.test(t))
      return "experience";
    if (/\b(tip|lesson|key to|mistake|avoid|should|must|always|never|here'?s how)\b/.test(t))
      return "addvalue";
    if (/\b(burnout|mental health|hard time|difficult|tough|quit|fired|lost)\b/.test(t))
      return "support";
    if (/\b(😂|lol|hilarious|funny|ironic|meanwhile)\b/.test(t))
      return "funny";
    return "insightful";
  }

  // ── Language detection ────────────────────────────────────────────────────

  function detectLanguage(text) {
    if (/[\u0600-\u06FF]/.test(text)) return "Arabic or Urdu";
    if (/[\u0900-\u097F]/.test(text)) return "Hindi";
    if (/[\u4E00-\u9FFF]/.test(text)) return "Chinese";
    if (/[\u0400-\u04FF]/.test(text)) return "Russian";
    const es = /\b(de|la|el|en|que|por|con|una|los|las|del|para|como|pero|más)\b/gi;
    if ((text.match(es) || []).length >= 3) return "Spanish";
    return "English";
  }

  // ── Ollama ────────────────────────────────────────────────────────────────

  // Sanity check: comment should share at least 1 meaningful word with the post
  function isRelevant(comment, postText) {
    const stopWords = new Set(["the","a","an","is","in","on","of","to","and","or","that","this","it","for","with","be","was","are","have","has","i","you","we","they","but","not","so","as","at","by","from","up","do","if","my","your","just","been","than","had","can","its","who","what","when","will","would","could","should"]);
    const postWords = new Set(postText.toLowerCase().match(/[a-z]{4,}/g)?.filter(w => !stopWords.has(w)) || []);
    const commentWords = (comment.toLowerCase().match(/[a-z]{4,}/g) || []).filter(w => !stopWords.has(w));
    return commentWords.some(w => postWords.has(w));
  }

  function sendOllamaRequest(userMsg, tone) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage({
          type: "ollama",
          payload: {
            model: MODEL,
            stream: false,
            options: { temperature: 0.7, num_predict: 80, num_ctx: 1024, keep_alive: -1 },
            messages: [
              { role: "system", content: SYSTEM },
              ...(SHOTS[tone] || SHOTS.insightful),
              { role: "user", content: userMsg },
            ],
          },
        }, (resp) => {
          if (chrome.runtime.lastError) return reject(new Error("Reload page and retry"));
          if (!resp?.ok) return reject(new Error(resp?.error || "Ollama error"));
          resolve(clean(resp.text, tone === "funny"));
        });
      } catch (e) {
        reject(new Error("Reload page and retry"));
      }
    });
  }

  async function askOllama(tone, postText, firstName) {
    const lang    = detectLanguage(postText);
    const langLine = lang !== "English" ? `Reply in ${lang}.` : "";
    const userMsg = [
      `Post: ${postText}`,
      firstName ? `Poster's first name: ${firstName}` : "",
      langLine,
      "Comment:",
    ].filter(Boolean).join("\n");

    let comment = await sendOllamaRequest(userMsg, tone);

    // If comment seems completely off-topic, retry once with a higher-temperature nudge
    if (!isRelevant(comment, postText)) {
      const retry = await sendOllamaRequest(userMsg, tone);
      if (isRelevant(retry, postText)) comment = retry;
    }

    return comment;
  }

  function clean(text, keepEmoji = false) {
    let t = text
      .replace(/^["'\u201C\u201D]|["'\u201C\u201D]$/g, "")
      .replace(/^(Here'?s?[^:]*:|Sure[,!]?[^:]*:)\s*/i, "")
      .replace(/\s+[-–—]\s+/g, " ")   // strip hyphens/dashes used as separators
      .replace(/\s+/g, " ")
      .trim();
    if (!keepEmoji) t = t.replace(/[\u{1F000}-\u{1FAFF}]/gu, "").replace(/[\u2600-\u27BF]/g, "");
    return t;
  }

  // ── Text / name extraction ────────────────────────────────────────────────

  // ── Social proof / header exclusions ─────────────────────────────────────

  // Containers that hold the social-proof actor (liker/commenter), NOT the actual post author.
  // NOTE: do NOT add reshared-content wrappers here — those wrap the real post being surfaced.
  const HEADER_CONTAINERS = [
    ".update-components-header",
    ".update-components-activity-header",
    ".update-components-header-v2",
    ".feed-shared-header",
    ".feed-shared-mini-update-v2",
  ];

  // Elements that contain social proof ("X likes this", "X commented") — excluded everywhere
  const SOCIAL_PROOF_SELS = [
    ".update-components-header",
    ".feed-shared-header",
    ".update-components-actor__sub-description",
    ".feed-shared-actor__sub-description",
    ".feed-shared-social-actions",
    "[data-test-id='social-actions']",
  ].join(",");

  const SOCIAL_PROOF_PATTERN = /^.{1,60}?\s+(likes|supports|loves|celebrated|commented|shared|reposted)\s+(this|a post|an article)/im;

  // Also matches "X and 73 others" reaction lines and "X commented" social proof banners
  const REACTION_COUNT_PATTERN = /\band\s+\d+\s+others?\b/i;
  const SOCIAL_BANNER_PATTERN  = /^.{1,80}?\s+(likes|supports|loves|celebrated|commented)\s*$/i;

  function sanitizeText(text) {
    return text
      .split("\n")
      .filter(line => {
        const t = line.trim();
        if (!t) return false;
        if (SOCIAL_PROOF_PATTERN.test(t))  return false;  // "X likes this"
        if (REACTION_COUNT_PATTERN.test(t)) return false; // "X and 73 others"
        if (SOCIAL_BANNER_PATTERN.test(t))  return false; // "X commented"
        return true;
      })
      .join("\n")
      .trim();
  }

  function stripSocialProof(text) {
    return sanitizeText(text);
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
      if (el && el.innerText.trim().length > 10) return sanitizeText(el.innerText.trim()).slice(0, 500);
    }
    const clone = postEl.cloneNode(true);
    clone.querySelectorAll([
      "button", "script", "style", "[aria-hidden='true']",
      // social proof / activity headers (liker info)
      ...SOCIAL_PROOF_SELS.split(",").map(s => s.trim()),
      ...HEADER_CONTAINERS,
      // reaction counts ("Ishtiaque Ali and 1 other")
      ".social-details-social-counts",
      ".feed-shared-social-counts",
      ".social-counts-reactions",
      ".reactions-icon",
      // comments section — never read other people's comments
      ".comments-comments-list",
      ".comment-item",
      ".feed-shared-main-content__comment-action",
      ".comments-comment-list",
      ".comments-comment-item",
    ].join(",")).forEach(e => e.remove());
    const raw = clone.innerText.replace(/\s+/g, " ").trim();
    return stripSocialProof(raw).slice(0, 500);
  }

  function getPosterName(postEl) {
    // Key insight: in LinkedIn's DOM the actual poster's actor element is always the NEAREST
    // preceding sibling (or ancestor's preceding sibling) of the post content text element.
    // The social-proof actor ("X commented/likes this") sits further back.
    //
    // Strategy: anchor on the content element, then walk UP through ancestors checking
    // previousElementSiblings at each level — nearest-first. First actor name found = actual poster.

    const contentEl = postEl.querySelector(
      ".feed-shared-update-v2__description, .feed-shared-text-view, " +
      ".update-components-text, .feed-shared-text"
    );
    if (!contentEl) return "";

    const NAME_SELS = [
      ".update-components-actor__title span[aria-hidden='true']",
      ".update-components-actor__name span[aria-hidden='true']",
      ".feed-shared-actor__title span[aria-hidden='true']",
      ".feed-shared-actor__name span[aria-hidden='true']",
    ];

    function extractFirst(el) {
      const raw = el.innerText.trim().split("\n")[0].trim();
      if (!raw || raw.length < 2 || raw.length > 60) return "";
      return raw
        .replace(/[•·○●]\s*\d+(st|nd|rd|th)\+?/gi, "").trim()
        .split(/\s+/)[0]
        .replace(/[^a-zA-Z'-]/g, "")
        .trim();
    }

    // Names that appear in reaction counts ("X and N others") are reactors, not the poster
    const fullText = postEl.innerText || "";
    function isReactionName(name) {
      return new RegExp(`\\b${name}\\b[^\\n]{0,60}\\band\\s+\\d+\\s+others?`, "i").test(fullText) ||
             new RegExp(`\\b${name}\\b[^\\n]{0,30}\\b(commented|likes|supports|loves|celebrated)\\b`, "i").test(fullText);
    }

    let node = contentEl;
    for (let depth = 0; depth < 8; depth++) {
      if (!node || node === document.body) break;
      // Check preceding siblings at this level (nearest → furthest)
      let sib = node.previousElementSibling;
      while (sib) {
        for (const sel of NAME_SELS) {
          for (const nameEl of sib.querySelectorAll(sel)) {
            const first = extractFirst(nameEl);
            if (first.length >= 2 && !isReactionName(first)) return first;
          }
        }
        sib = sib.previousElementSibling;
      }
      if (node === postEl) break;
      node = node.parentElement;
    }
    return "";
  }

  // ── Insert into comment box ───────────────────────────────────────────────

  function findCommentBox(postEl) {
    const sels = [
      ".ql-editor[contenteditable='true']",
      "div[contenteditable='true'][data-placeholder*='comment' i]",
      "div.comments-comment-texteditor div[contenteditable='true']",
      "div[contenteditable='true'][role='textbox']",
    ];
    const active = document.activeElement;
    if (active?.getAttribute("contenteditable") === "true") return active;
    let node = postEl;
    for (let i = 0; i < 8; i++) {
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
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(r);
  }

  // ── Status pill (tiny floating indicator) ─────────────────────────────────

  let pill = null;
  let pillTimer = null;

  function getPill() {
    if (pill) return pill;
    pill = document.createElement("div");
    pill.id = "lca-pill";
    pill.style.cssText = `
      position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
      z-index: 2147483647; display: none; align-items: center; gap: 8px;
      padding: 7px 14px; background: #1e1e1e; border: 1px solid #0a66c2;
      border-radius: 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 12px; color: #d4d4d4; box-shadow: 0 4px 18px rgba(0,0,0,0.45);
      white-space: nowrap; cursor: default;
    `;
    document.documentElement.appendChild(pill);
    return pill;
  }

  function showPill(html, borderColor = "#0a66c2") {
    clearTimeout(pillTimer);
    const p = getPill();
    p.innerHTML = html;
    p.style.borderColor = borderColor;
    p.style.display = "flex";
  }

  function hidePill(delay = 3000) {
    pillTimer = setTimeout(() => { if (pill) pill.style.display = "none"; }, delay);
  }

  // ── Core: generate & insert ───────────────────────────────────────────────

  const SPINNER = `<span style="display:inline-block;width:10px;height:10px;border:2px solid #444;border-top-color:#0a66c2;border-radius:50%;animation:lca-spin 0.7s linear infinite"></span>`;
  const STYLE   = document.createElement("style");
  STYLE.textContent = "@keyframes lca-spin{to{transform:rotate(360deg)}}";
  document.head.appendChild(STYLE);

  async function generateAndInsert(postEl) {
    const postText  = getPostText(postEl);
    const firstName = getPosterName(postEl);
    const tone      = detectTone(postText);

    showPill(`${SPINNER} <span>Writing comment…</span>`);

    try {
      const comment = await askOllama(tone, postText, firstName);

      // Wait for LinkedIn to open the comment box
      let tries = 0;
      const t = setInterval(() => {
        tries++;
        const box = findCommentBox(postEl);
        if (box) {
          clearInterval(t);
          pasteInto(box, comment);

          showPill(
            `<span style="color:#22c55e">✓</span>
             <span style="color:#d4d4d4;flex:1;max-width:320px;overflow:hidden;text-overflow:ellipsis">${comment}</span>
             <button id="lca-retry-btn" style="background:#333;color:#ccc;border:none;border-radius:12px;padding:3px 10px;font-size:11px;cursor:pointer">↺ Retry</button>`,
            "#22c55e"
          );

          document.getElementById("lca-retry-btn")?.addEventListener("click", async () => {
            showPill(`${SPINNER} <span>Retrying…</span>`);
            try {
              const next = await askOllama(tone, postText, firstName);
              pasteInto(box, next);
              showPill(
                `<span style="color:#22c55e">✓</span>
                 <span style="color:#d4d4d4;flex:1;max-width:320px;overflow:hidden;text-overflow:ellipsis">${next}</span>
                 <button id="lca-retry-btn" style="background:#333;color:#ccc;border:none;border-radius:12px;padding:3px 10px;font-size:11px;cursor:pointer">↺ Retry</button>`,
                "#22c55e"
              );
            } catch (e) {
              showPill(`<span style="color:#ef4444">⚠ ${e.message}</span>`, "#ef4444");
              hidePill(3000);
            }
          });

          hidePill(6000);
        } else if (tries >= 30) {
          clearInterval(t);
          showPill(`<span style="color:#ef4444">⚠ Could not find comment box</span>`, "#ef4444");
          hidePill(3000);
        }
      }, 200);
    } catch (e) {
      showPill(`<span style="color:#ef4444">⚠ ${e.message}</span>`, "#ef4444");
      hidePill(3000);
    }
  }

  // ── Intercept Comment button clicks ──────────────────────────────────────

  function isMainPostCommentBtn(btn) {
    const label = (btn.getAttribute("aria-label") || btn.textContent || "").toLowerCase();
    if (!label.includes("comment")) return false;
    // Must be on the main post action bar (has Repost + Send nearby)
    const bar = btn.parentElement?.parentElement?.parentElement;
    if (!bar) return false;
    const barLabels = Array.from(bar.querySelectorAll("button"))
      .map(b => (b.getAttribute("aria-label") || b.textContent || "").toLowerCase());
    return barLabels.some(l => l.includes("repost")) || barLabels.some(l => l.includes("send"));
  }

  function findPostEl(btn) {
    // Walk up looking for a known LinkedIn post card container.
    // Deliberately NOT including [data-urn] — that can match the outer
    // activity-aggregate wrapper which includes the social-proof liker actor.
    const postCardSels = [
      ".feed-shared-update-v2",
      ".occludable-update",
    ];
    let node = btn.parentElement;
    for (let i = 0; i < 20; i++) {
      if (!node || node === document.body) break;
      if (postCardSels.some(s => node.matches?.(s))) return node;
      node = node.parentElement;
    }
    // Fallback: 4 levels up (tight scope, avoids comments section)
    let fallback = btn;
    for (let i = 0; i < 4; i++) fallback = fallback.parentElement || fallback;
    return fallback;
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn || !isMainPostCommentBtn(btn)) return;
    const postEl = findPostEl(btn);
    // Let LinkedIn open the box first, then generate
    setTimeout(() => generateAndInsert(postEl), 500);
  }, true);

})();
