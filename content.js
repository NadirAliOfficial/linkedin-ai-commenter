(function () {
  "use strict";

  const MODEL = "llama3.2";

  // ── Prompts ───────────────────────────────────────────────────────────────

  const SYSTEM = `You write short LinkedIn comments that sound like a real person typed them quickly.
Rules:
- ONE sentence only. Max 10 words (not counting the name).
- React to the post with genuine feeling — never summarize it.
- Include the poster's first name naturally once (start, middle, or end).
- Use contractions (it's, that's, I've, you're). Sound warm and real.
- No hyphens ( - ) anywhere. No em dashes. No filler like "Great post" or "Well said".
- No hashtags. No quotes around output. Output the comment text only.`;

  const SHOTS = {
    congratulate: [
      { role: "user",      content: "Post: Just got promoted to Senior Engineer after 3 years.\nPoster's first name: Raj\nComment:" },
      { role: "assistant", content: "Raj, three years of grinding — this one's earned." },
      { role: "user",      content: "Post: We just hit $1M ARR!\nPoster's first name: Leila\nComment:" },
      { role: "assistant", content: "Seven figures, Leila — that's real." },
    ],
    insightful: [
      { role: "user",      content: "Post: AI is changing how junior devs learn on the job.\nPoster's first name: Priya\nComment:" },
      { role: "assistant", content: "Priya, the bar just moved — not disappeared." },
      { role: "user",      content: "Post: Remote work is here to stay whether companies like it or not.\nPoster's first name: Tom\nComment:" },
      { role: "assistant", content: "Forcing it back, Tom, just speeds up the exits." },
    ],
    support: [
      { role: "user",      content: "Post: Burned out after 3 years of hustle culture. Taking a break.\nPoster's first name: Sara\nComment:" },
      { role: "assistant", content: "This needed courage, Sara — glad you chose yourself." },
      { role: "user",      content: "Post: Failed my first startup. Starting over.\nPoster's first name: James\nComment:" },
      { role: "assistant", content: "James, the ones who restart are the ones who eventually make it." },
    ],
    challenge: [
      { role: "user",      content: "Post: Passion is all you need to succeed as an entrepreneur.\nPoster's first name: Dan\nComment:" },
      { role: "assistant", content: "Dan, passion without margin is just an expensive hobby." },
    ],
    experience: [
      { role: "user",      content: "Post: Leadership is about giving credit, not taking it.\nPoster's first name: Omar\nComment:" },
      { role: "assistant", content: "Omar, I've seen this one shift change a team's entire energy." },
    ],
    addvalue: [
      { role: "user",      content: "Post: Most startups fail because they build the wrong thing.\nPoster's first name: Lena\nComment:" },
      { role: "assistant", content: "Lena, ten user calls would've caught it before the first sprint." },
    ],
    funny: [
      { role: "user",      content: "Post: Just had a 3-hour meeting that could have been an email.\nPoster's first name: Beth\nComment:" },
      { role: "assistant", content: "Beth, the email would've taken 3 minutes too 😂" },
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

  function askOllama(tone, postText, firstName) {
    const lang    = detectLanguage(postText);
    const langLine = lang !== "English" ? `Reply in ${lang}.` : "";
    const userMsg = [
      `Post: ${postText}`,
      firstName ? `Poster's first name: ${firstName}` : "",
      langLine,
      "Comment:",
    ].filter(Boolean).join("\n");

    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage({
          type: "ollama",
          payload: {
            model: MODEL,
            stream: false,
            options: { temperature: 0.85, num_predict: 40, num_ctx: 1024, keep_alive: -1 },
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

  function getPosterName(postEl) {
    // Scope search to the post actor container only — not likes/social-proof sections
    const actorContainers = [
      ".update-components-actor",
      ".feed-shared-actor",
      ".update-components-actor__container",
      ".feed-shared-actor__container",
    ];
    const nameSels = [
      "span[aria-hidden='true']",
      ".update-components-actor__name",
      ".feed-shared-actor__name",
    ];

    for (const containerSel of actorContainers) {
      const actorEl = postEl.querySelector(containerSel);
      if (!actorEl) continue;
      for (const s of nameSels) {
        const el = actorEl.querySelector(s);
        const raw = el?.innerText?.trim().split("\n")[0].trim();
        if (!raw || raw.length < 2 || raw.length > 60) continue;
        const cleaned = raw.replace(/[•·○●]\s*\d+(st|nd|rd|th)\+?/gi, "").trim();
        const firstName = cleaned.split(/\s+/)[0].replace(/[^a-zA-Z'-]/g, "").trim();
        if (firstName.length > 1) return firstName;
      }
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
    let node = btn.parentElement;
    for (let i = 0; i < 12; i++) {
      if (!node || node === document.body) break;
      if (node.querySelector("span[dir='ltr'], span.break-words, p")) return node;
      node = node.parentElement;
    }
    return btn.parentElement;
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn || !isMainPostCommentBtn(btn)) return;
    const postEl = findPostEl(btn);
    // Let LinkedIn open the box first, then generate
    setTimeout(() => generateAndInsert(postEl), 500);
  }, true);

})();
