(function () {
  "use strict";

  const PROCESSED_ATTR = "data-lca-done";
  const MODEL = "llama3.2";

  const TONES = [
    { label: "Support",      type: "support" },
    { label: "Insightful",   type: "insightful" },
    { label: "Agree",        type: "agree" },
    { label: "Question",     type: "question" },
    { label: "Congratulate", type: "congratulate" },
    { label: "Challenge",    type: "challenge" },
    { label: "Experience",   type: "experience" },
    { label: "Add Value",    type: "addvalue" },
  ];

  const SYSTEM = `You write short LinkedIn comments.
Rules:
- One sentence only, strictly 8 to 12 words.
- Flawless grammar, correct word order, and proper punctuation.
- Professional, natural, human tone.
- Never address or mention any person's name.
- No hyphens, no emojis, no hashtags, no exclamation marks.
- No filler phrases like "Great post", "Well said", "This is so true", or "Absolutely".
- No surrounding quotes.
- Output the comment text only. Nothing else.`;

  const TONE_PROMPT = {
    support:      "Write a short supportive comment about the specific topic in this post.",
    insightful:   "Write a short insightful observation directly about this post's topic.",
    agree:        "Write a short comment that agrees with the specific point made in this post.",
    question:     "Write a short, specific question about the core idea in this post.",
    congratulate: "Write a short congratulatory comment referencing what was actually achieved.",
    challenge:    "Write a short, respectful alternative perspective on the specific claim in this post.",
    experience:   "Write a short comment connecting a professional insight to this post's topic.",
    addvalue:     "Write a short comment that adds one concrete, relevant point to this post.",
  };

  // ── Ollama via background worker ─────────────────────────────────────────

  function askOllama(type, postText) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage({
          type: "ollama",
          payload: {
            model: MODEL,
            system: SYSTEM,
            prompt: TONE_PROMPT[type] + "\n\nPost: " + postText,
            stream: false,
            options: { temperature: 0.75, num_predict: 60 },
          },
        }, (resp) => {
          if (chrome.runtime.lastError) {
            return reject(new Error("Refresh the page and try again"));
          }
          if (!resp || !resp.ok) return reject(new Error(resp ? resp.error : "No response from Ollama"));
          resolve(clean(resp.text));
        });
      } catch (e) {
        reject(new Error("Refresh the page and try again"));
      }
    });
  }

  function clean(text) {
    return text
      .replace(/^["'\u201C\u201D]|["'\u201C\u201D]$/g, "")
      .replace(/-/g, " ")
      .replace(/[\u{1F000}-\u{1FAFF}]/gu, "")
      .replace(/[\u2600-\u27BF]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  // ── Text extraction ───────────────────────────────────────────────────────

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

    const row = document.createElement("div");
    row.className = "lca-row";

    TONES.forEach(({ label, type }) => {
      const btn = document.createElement("button");
      btn.className = "lca-pill";
      btn.textContent = label;
      btn.addEventListener("click", () => onTone(type, postEl, wrap));
      row.appendChild(btn);
    });

    wrap.appendChild(row);
    return wrap;
  }

  async function onTone(type, postEl, wrap) {
    let out = wrap.querySelector(".lca-out");
    if (!out) {
      out = document.createElement("div");
      out.className = "lca-out";
      wrap.appendChild(out);
    }

    wrap.querySelectorAll(".lca-pill").forEach(b => (b.disabled = true));
    out.className = "lca-out lca-loading";
    out.innerHTML = "<span>Generating...</span>";

    try {
      const text = getPostText(postEl);
      const comment = await askOllama(type, text);
      // Auto-insert immediately
      triggerCommentBox(wrap);
      autoInsert(comment, out, wrap);
    } catch (err) {
      out.className = "lca-out lca-err";
      out.textContent = err.message;
      wrap.querySelectorAll(".lca-pill").forEach(b => (b.disabled = false));
    }
  }

  function autoInsert(comment, out, wrap) {
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      const input = findInput(wrap);
      if (input) {
        clearInterval(t);
        pasteInto(input, comment);
        showDone(out, comment, wrap);
      } else if (tries >= 25) {
        clearInterval(t);
        // Fallback: show Insert button scoped to this post
        out.className = "lca-out lca-done";
        out.innerHTML = "";
        const txt = document.createElement("span");
        txt.className = "lca-text";
        txt.textContent = comment;
        out.appendChild(txt);
        const ins = document.createElement("button");
        ins.className = "lca-act lca-ins";
        ins.textContent = "Insert";
        ins.addEventListener("click", () => {
          triggerCommentBox(wrap);
          setTimeout(() => {
            const input = findInput(wrap);
            if (input) { pasteInto(input, comment); ins.textContent = "Done"; ins.className = "lca-act lca-ins lca-ok"; }
          }, 700);
        });
        out.appendChild(ins);
        appendRetry(out, wrap);
        wrap.querySelectorAll(".lca-pill").forEach(b => (b.disabled = false));
      }
    }, 200);
  }

  function showDone(out, comment, wrap) {
    out.className = "lca-out lca-done";
    out.innerHTML = "";
    const txt = document.createElement("span");
    txt.className = "lca-text";
    txt.textContent = comment;
    out.appendChild(txt);
    appendRetry(out, wrap);
    wrap.querySelectorAll(".lca-pill").forEach(b => (b.disabled = false));
  }

  function appendRetry(out, wrap) {
    const retry = document.createElement("button");
    retry.className = "lca-act lca-retry";
    retry.textContent = "Retry";
    retry.addEventListener("click", () => {
      out.remove();
      wrap.querySelectorAll(".lca-pill").forEach(b => (b.disabled = false));
    });
    out.appendChild(retry);
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
    if (!ok || !el.textContent.includes(text)) {
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
