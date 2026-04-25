(function () {
  "use strict";

  const MODEL = "llama-3.3-70b-versatile";

  // ── Prompts ───────────────────────────────────────────────────────────────

  let learnedRules = "";
  try {
    chrome.storage?.local?.get({ lca_extra_rules: "" }, ({ lca_extra_rules }) => {
      learnedRules = lca_extra_rules || "";
    });
  } catch (_) {}

  function getSystem() {
    return learnedRules
      ? SYSTEM + "\nAdditional rules (learned from past failures):\n" + learnedRules
      : SYSTEM;
  }

  const SYSTEM = `Write a single LinkedIn comment that sounds natural — the kind of thing a real person types in a comment box and hits post.
Rules:
- ONE complete sentence. Match the length hint provided.
- Make a genuine observation tied to something SPECIFIC in the post — a number, a named thing, a concrete situation, a decision. Never write something that could fit any other post.
- BAD (too vague, fits any post): "This shift is happening much faster than expected." / "That's a really big cultural change happening quickly."
- GOOD (post-specific): "The gap between devs who use AI and those who don't is already showing up in standups, Sara." — references the actual claim from the post.
- NEVER refer to the person in third person — no "Sara did X", "Usman's product", "Welsh's approach", "his decision", "her post". The name must only appear as a direct address (e.g., "Raj," at the start or ", Raj." at the end) — once, or not at all.
- Do NOT write like you're having a private chat ("for me...", "happens to me too", "been there", "I've done that too").
- If the post asks a question, answer it directly as a statement.
- NAME RULE: use the poster's name in roughly 1 in 2 comments — add it when it makes the comment feel more personal or direct. Drop it only when the sentence genuinely reads better without it.
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
      { role: "assistant", content: "The gap between devs who use AI well and those who don't is already showing up in standups, Priya." },
      { role: "user",      content: "Post: Remote work is here to stay whether companies like it or not.\nPoster's first name: Tom\nLength: 12–16 words.\nComment:" },
      { role: "assistant", content: "Every company still fighting remote work is basically running a slow exit interview at this point." },
    ],
    support: [
      { role: "user",      content: "Post: Burned out after 3 years of hustle culture. Taking a real break for once.\nPoster's first name: Sara\nLength: 12–16 words.\nComment:" },
      { role: "assistant", content: "Recognizing when three years of hustle has maxed out takes more self-awareness than most people have, Sara." },
      { role: "user",      content: "Post: My first startup failed and I'm starting over from scratch.\nPoster's first name: James\nLength: 12–16 words.\nComment:" },
      { role: "assistant", content: "Starting over after a first startup failure is genuinely harder than the launch itself was, James." },
    ],
    challenge: [
      { role: "user",      content: "Post: Passion is all you really need to succeed as an entrepreneur.\nPoster's first name: Dan\nLength: 12–16 words.\nComment:" },
      { role: "assistant", content: "Passion gets you started but it's the boring discipline that actually keeps the company alive, Dan." },
    ],
    experience: [
      { role: "user",      content: "Post: True leadership is about giving credit, not taking it.\nPoster's first name: Omar\nLength: 12–16 words.\nComment:" },
      { role: "assistant", content: "Giving credit instead of taking it is the one thing that completely changes team energy, Omar." },
    ],
    addvalue: [
      { role: "user",      content: "Post: Most startups fail because they build the wrong thing for too long.\nPoster's first name: Lena\nLength: 12–16 words.\nComment:" },
      { role: "assistant", content: "Ten honest user conversations before the first sprint would save most startups months of wasted builds, Lena." },
    ],
    funny: [
      { role: "user",      content: "Post: Just sat through a 3-hour meeting that could have been a 2-line email.\nPoster's first name: Beth\nLength: 12–16 words.\nComment:" },
      { role: "assistant", content: "A 2-line email would've taken four minutes and everyone would've actually read it, Beth." },
    ],
  };

  // ── Auto-detect best tone ─────────────────────────────────────────────────

  function detectTone(text) {
    const t = text.toLowerCase();
    if (/\b(congratulat|excited to (share|announce)|thrilled|just (got|joined|launched|hired|promoted)|new role|proud to|(hit|crossed|reached|celebrating) (a |my |our )?milestone|achievement|offer|passed|certified|degree|graduated)\b/.test(t))
      return "congratulate";
    if (/\b(unpopular opinion|controversial|i disagree|myth|wrong about|actually|but wait|hot take|change my mind)\b/.test(t))
      return "challenge";
    if (/\b(i (learned|realized|failed|struggled|went through|survived|made it|discovered|noticed))\b/.test(t))
      return "experience";
    if (/\b(tip|tips|lesson|key to|mistake|avoid|should|must|always|never|here'?s how|step|steps|guide|framework|rule|rules)\b/.test(t))
      return "addvalue";
    if (/\b(burnout|mental health|hard time|difficult|tough|quit|fired|lost|grief|anxiety|depression|struggling|lonely)\b/.test(t))
      return "support";
    if (/\b(😂|🤣|lol|hilarious|funny|ironic|meanwhile|plot twist)\b/.test(t))
      return "funny";
    // Post ends with a question → direct answer tone
    if (/\?\s*$/.test(text.trim())) return "insightful";
    return "insightful";
  }

  // Detect if the post is asking a direct question
  function isQuestion(text) {
    return /\?\s*$/.test(text.trim()) || /^(what|how|why|do you|have you|would you|should|can you|who|when|where)\b/i.test(text.trim());
  }

  // Word count hint based on post length
  function lengthHint(postText) {
    const words = postText.trim().split(/\s+/).length;
    if (words < 30)  return "8–12 words";
    if (words < 80)  return "12–16 words";
    return "14–20 words";
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

  function escHtml(s) {
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  // Detect generic phrases that could apply to any post
  const GENERIC_PATTERNS = [
    /change everything/i, /going to change/i, /this is everything/i,
    /needed to hear this/i, /so important/i, /so powerful/i,
    /this hits different/i, /couldn'?t agree more/i, /love this/i,
    // Vague "shift/trend/change" filler
    /\b(this|the) (shift|change|trend|movement|transition) is (happening|coming|real|here)/i,
    /\b(big|huge|major|massive|significant) (cultural |industry |societal )?(shift|change|trend)/i,
    /(happening|moving|changing|evolving) (much |so |really |very )?(faster|quicker|rapidly|quickly) than (expected|anticipated)/i,
    /happening (very |really |so )?(quickly|fast|rapidly) now/i,
    /\bthis is (a )?(huge|big|massive|major|significant|important|real) (shift|change|trend|move|moment|step)/i,
    /\b(things|everything|the world|the industry|the field) (is|are) (changing|shifting|evolving|moving) (fast|quickly|rapidly)/i,
    /so true/i, /^preach/i, /this is gold/i, /dropping gems/i,
    /absolutely this/i, /well said/i, /great post/i, /amazing post/i,
    /inspiring post/i, /^congrats?\b/i, /^congratulations\b/i,
    /keep (it up|going|pushing)/i, /you('re| are) (amazing|incredible|awesome|killing it)/i,
    /this is (so |really )?(important|relevant|needed|powerful|huge)/i,
    /everyone (needs?|should|must) (see|read|know)/i,
    /couldn'?t have said (it )?better/i, /speaks? (volumes?|for itself)/i,
    /words? of wisdom/i, /thank you for sharing/i, /thanks? for sharing/i,
    /really (resonates?|hits home)/i, /spot on/i, /100(%| percent)/i,
    /mic drop/i, /fire (post|content|tweet)/i,
    // Private-chat / "me too" style — explicitly banned in prompt but still slips through
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
    // Flattery endings — comment trails off into a standalone compliment rather than a specific point
    /(,| is) (incredibly|seriously|pretty|really|so|very|quite) (impressive|amazing|incredible|awesome)\s*[,.]?\s*\w*\.?$/i,
    /(is|that'?s|'s) (impressive|incredible|amazing|awesome|remarkable)( work| stuff| job)?\s*[,.]?\s*\w{0,20}\.?\s*$/i,
    /\bgot (a great|an amazing|a fantastic|a good) (hire|employee|team member|addition)\b/i,
    /\b(lowkey |always )?(crushing|killing) it\b/i,
    /\bgreat (persistence|effort|job|work|mindset|attitude|stuff)\b/i,
    // "for me" endings — private-chat signal
    /\bfor me[,.]?\s*\w{0,20}\.?\s*$/i,
    // Generic advice that fits any post ("X is a great way to Y")
    /\b\w+ (is|are) (a |the )?(great|good|excellent|solid|perfect) way to\b/i,
  ];
  function isGeneric(comment) {
    return GENERIC_PATTERNS.some(p => p.test(comment));
  }

  // Strip common English suffixes for loose word matching (adapt ↔ adapted, clean ↔ cleaner)
  function stemWord(w) {
    return w
      .replace(/ations?$/, "ate").replace(/tion$/, "te")
      .replace(/ings?$/, "").replace(/edly$/, "")
      .replace(/ed$/, "").replace(/ness$/, "").replace(/ment$/, "")
      .replace(/ful$/, "").replace(/ive$/, "").replace(/ing$/, "")
      .replace(/ly$/, "").replace(/er$/, "").replace(/est$/, "")
      .replace(/able$/, "").replace(/ible$/, "").replace(/al$/, "")
      .replace(/s$/, "");
  }

  function isRelevant(comment, postText) {
    const stopWords = new Set(["the","a","an","is","in","on","of","to","and","or","that","this","it","for","with","be","was","are","have","has","i","you","we","they","but","not","so","as","at","by","from","up","do","if","my","your","just","been","than","had","can","its","who","what","when","will","would","could","should","know","like","think","make","time","more","also","very","even","here","well","good","work","need","want","take","people","thing","things","every","really","never","always","still","first","years","year","dont","doesnt","about","after","before"]);
    const postStems = new Set(
      (postText.toLowerCase().match(/[a-z]{4,}/g) || [])
        .filter(w => !stopWords.has(w))
        .map(stemWord)
    );
    const commentStems = (comment.toLowerCase().match(/[a-z]{4,}/g) || [])
      .filter(w => !stopWords.has(w))
      .map(stemWord);
    const matches = commentStems.filter(w => postStems.has(w)).length;
    // Max threshold 2 — stemming already handles word-form gaps
    const threshold = postStems.size < 6 ? 1 : 2;
    return matches >= threshold;
  }

  function logEvent(entry) {
    try { chrome.runtime?.sendMessage({ type: "log", entry: { ts: Date.now(), ...entry } }); } catch (_) {}
  }

  // Guard against chrome.runtime becoming undefined after extension reload
  function runtimeSendMessage(payload) {
    return new Promise((resolve, reject) => {
      try {
        if (!chrome?.runtime?.sendMessage) throw new Error("Extension reloaded — refresh page");
        chrome.runtime.sendMessage(payload, (resp) => {
          if (chrome.runtime.lastError) return reject(new Error("Refresh page and retry"));
          if (!resp?.ok) return reject(new Error(resp?.error || "API error"));
          resolve(resp);
        });
      } catch (e) {
        reject(new Error("Refresh page and retry"));
      }
    });
  }

  function sendOllamaRequest(userMsg, tone, temperature = 0.7) {
    return runtimeSendMessage({
      type: "ollama",
      payload: {
        model: MODEL,
        stream: false,
        options: { temperature, num_predict: 90, num_ctx: 4096, keep_alive: -1 },
        messages: [
          { role: "system", content: getSystem() },
          ...(SHOTS[tone] || SHOTS.insightful),
          { role: "user", content: userMsg },
        ],
      },
    }).then(resp => clean(resp.text, tone === "funny"));
  }

  function buildUserMsg(tone, postText, firstName) {
    const lang     = detectLanguage(postText);
    const langLine = lang !== "English" ? `Reply in ${lang}.` : "";
    const hint     = lengthHint(postText);
    const qHint    = isQuestion(postText) ? "The post asks a question — answer it as a direct observation or bold statement tied to something specific in the post. Do NOT use 'I wish I had', 'I should have', or any first-person personal-wish phrasing." : "";

    return [
      `Post: ${postText}`,
      firstName ? `Poster's first name: ${firstName}` : "",
      `Length: ${hint}.`,
      langLine,
      qHint,
      "Comment:",
    ].filter(Boolean).join("\n");
  }

  async function generateVariants(tone, postText, firstName) {
    const userMsg = buildUserMsg(tone, postText, firstName);
    const firstAttempt = await sendOllamaRequest(userMsg, tone, 0.7);
    const filterTriggered = isGeneric(firstAttempt) || !isRelevant(firstAttempt, postText);
    let finalComment = firstAttempt;
    let filterFixed = false;
    if (filterTriggered) {
      try {
        const retry = await sendOllamaRequest(userMsg, tone, 0.75);
        if (!isGeneric(retry) && isRelevant(retry, postText)) {
          finalComment = retry;
          filterFixed = true;
        }
      } catch (_) {}
    }
    logEvent({ kind: "gen", tone, firstName, postFull: postText, postSnippet: postText.slice(0, 80), firstAttempt, comment: finalComment, filterTriggered, filterFixed });
    return [finalComment];
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

  const UI_NOISE_PATTERN = /^(Like|Comment|Repost|Send|Follow|Connect|View image|View video|View document|View poll|\u2022|•)$/i;
  const REACTION_LINE_PATTERN = /^\d[\d,]*\s*(reactions?|comments?|reposts?|likes?|shares?)\d*/i;
  const URL_ONLY_PATTERN = /^https?:\/\/\S+$/;
  const HASHTAG_LINE_PATTERN  = /^(#\w+\s*){2,}$/;
  const JOB_TITLE_PATTERN     = /^.{3,100}\|.{2,60}\|.{2,}/; // "Sr. Designer | Mobile App | Webdesign | ..."
  const BOOK_APPT_PATTERN     = /^(book an appointment|follow|connect|message|view profile)/i;

  function sanitizeText(text) {
    return text
      .split("\n")
      .filter(line => {
        const t = line.trim();
        if (!t) return false;
        if (SOCIAL_PROOF_PATTERN.test(t))   return false;
        if (REACTION_COUNT_PATTERN.test(t)) return false;
        if (SOCIAL_BANNER_PATTERN.test(t))  return false;
        if (UI_NOISE_PATTERN.test(t))       return false; // "Like", "Comment", "Repost", "Send", "•"
        if (REACTION_LINE_PATTERN.test(t))  return false; // "705 reactions705", "197 comments"
        if (URL_ONLY_PATTERN.test(t))       return false; // bare URLs add no context
        if (HASHTAG_LINE_PATTERN.test(t))   return false; // "#ReactJS #WebDevelopment ..."
        if (JOB_TITLE_PATTERN.test(t))      return false; // "Sr. Designer | Mobile App | Webdesign"
        if (BOOK_APPT_PATTERN.test(t))      return false; // "Book an appointment", "Follow", etc.
        return true;
      })
      .join("\n")
      .trim();
  }

  function stripSocialProof(text) {
    return sanitizeText(text);
  }

  // Click "see more" so we read the full post, not the truncated preview
  function expandSeeMore(postEl) {
    const btn = postEl.querySelector([
      "button.feed-shared-inline-show-more-text__see-more-less-toggle",
      ".update-components-text__see-more button",
      "button[aria-label*='see more' i]",
      ".feed-shared-see-more-less-text button",
    ].join(","));
    if (btn && /see more/i.test((btn.textContent || btn.getAttribute("aria-label") || ""))) {
      try { btn.click(); } catch (_) {}
    }
  }

  const ACTOR_SELS = [
    ".update-components-actor",
    ".update-components-actor__container",
    ".update-components-actor__meta",
    ".update-components-actor__description",
    ".update-components-actor__sub-description",
    ".feed-shared-actor",
    ".feed-shared-actor__meta",
    ".feed-shared-actor__description",
    ".feed-shared-actor__sub-description",
    ".artdeco-entity-lockup",
  ];

  function getPostText(postEl) {
    const TEXT_SELS = [
      ".feed-shared-update-v2__description",
      ".feed-shared-text-view",
      ".update-components-text",
      ".feed-shared-text",
      "span.break-words",
    ];
    const RESHARED_SELS = [
      ".feed-shared-mini-update-v2",
      ".update-components-mini-update-v2",
      ".feed-shared-update-v2__reshared-content",
    ];

    // Read from the live node — innerText works on attached elements, not clones.
    // Skip elements that are inside reshared/quoted wrappers (not the author's text).
    for (const sel of TEXT_SELS) {
      for (const el of postEl.querySelectorAll(sel)) {
        if (RESHARED_SELS.some(rs => el.closest(rs))) continue;
        const t = sanitizeText((el.innerText || el.textContent || "").trim());
        if (t.length > 10) return t.slice(0, 3000);
      }
    }

    // Fallback: reshared / quoted post content
    for (const rs of RESHARED_SELS) {
      const reshared = postEl.querySelector(rs);
      if (!reshared) continue;
      for (const sel of TEXT_SELS) {
        const el = reshared.querySelector(sel);
        if (!el) continue;
        const t = sanitizeText((el.innerText || el.textContent || "").trim());
        if (t.length > 10) return t.slice(0, 3000);
      }
    }

    // Last resort: full post innerText
    return sanitizeText((postEl.innerText || "").trim()).slice(0, 3000);
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
    // Prefer the active focused editor ONLY if it lives inside this post
    const active = document.activeElement;
    if (active?.getAttribute("contenteditable") === "true" && postEl.contains(active)) return active;

    // Search within postEl first (most reliable — LinkedIn renders the box inside the card)
    for (const s of sels) {
      const el = postEl.querySelector(s);
      if (el) return el;
    }
    // Walk up cautiously — STOP the moment we enter a container that holds another post card,
    // otherwise we'd paste into a sibling post's box.
    let node = postEl.parentElement;
    for (let i = 0; i < 5; i++) {
      if (!node || node === document.body) break;
      const postCount = node.querySelectorAll(".feed-shared-update-v2, .occludable-update").length;
      if (postCount > 1) break;
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
  STYLE.textContent = `
    @keyframes lca-spin{to{transform:rotate(360deg)}}
    @keyframes lca-in{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
    #lca-picker{animation:lca-in 0.18s ease}
    #lca-picker .lca-opt:hover{background:#2a2a2a !important}
    #lca-picker .lca-opt:active{background:#333 !important}
  `;
  document.head.appendChild(STYLE);

  let activePicker = null;

  function closePicker() {
    activePicker?.remove();
    activePicker = null;
  }

  function showPicker(variants, box, tone, postText, firstName) {
    closePicker();
    hidePill(0);

    const panel = document.createElement("div");
    panel.id = "lca-picker";
    panel.style.cssText = `
      position:fixed;bottom:20px;left:50%;transform:translateX(-50%);
      z-index:2147483647;background:#1e1e1e;border:1px solid #0a66c2;
      border-radius:14px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      font-size:13px;color:#d4d4d4;box-shadow:0 8px 32px rgba(0,0,0,0.55);
      min-width:320px;max-width:520px;width:max-content;overflow:hidden;
    `;
    activePicker = panel;

    // Header
    const hdr = document.createElement("div");
    hdr.style.cssText = "display:flex;align-items:center;justify-content:space-between;padding:10px 14px 8px;border-bottom:1px solid #333;";
    const title = document.createElement("span");
    title.style.cssText = "font-size:11px;font-weight:700;color:#aaa;letter-spacing:0.04em;text-transform:uppercase;";
    title.textContent = "💬 Choose a comment";
    const regenBtn = document.createElement("button");
    regenBtn.style.cssText = "background:#333;color:#ccc;border:none;border-radius:10px;padding:3px 10px;font-size:11px;cursor:pointer;";
    regenBtn.textContent = "↺ New options";
    regenBtn.addEventListener("click", async () => {
      regenBtn.textContent = "…";
      regenBtn.disabled = true;
      try {
        const next = await generateVariants(tone, postText, firstName);
        showPicker(next, box, tone, postText, firstName);
      } catch (e) {
        showPill(`<span style="color:#ef4444">⚠ ${escHtml(e.message)}</span>`, "#ef4444");
        hidePill(3000);
      }
    });
    hdr.appendChild(title);
    hdr.appendChild(regenBtn);
    panel.appendChild(hdr);

    // Options
    variants.forEach((text, i) => {
      const row = document.createElement("div");
      row.className = "lca-opt";
      row.style.cssText = `display:flex;align-items:flex-start;gap:10px;padding:10px 14px;cursor:pointer;border-bottom:1px solid #2a2a2a;transition:background 0.1s;`;

      const num = document.createElement("span");
      num.style.cssText = "min-width:18px;height:18px;border-radius:50%;background:#0a66c2;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;";
      num.textContent = i + 1;

      const txt = document.createElement("span");
      txt.style.cssText = "line-height:1.5;word-break:break-word;";
      txt.textContent = text;

      row.appendChild(num);
      row.appendChild(txt);
      row.addEventListener("click", () => {
        pasteInto(box, text);
        closePicker();
        showPill(`<span style="color:#22c55e">✓ Inserted</span>`, "#22c55e");
        hidePill(2000);
      });
      panel.appendChild(row);
    });

    // Footer hint
    const foot = document.createElement("div");
    foot.style.cssText = "padding:7px 14px;font-size:10px;color:#555;text-align:center;";
    foot.textContent = "Click a comment to insert · Press Esc to close";
    panel.appendChild(foot);

    document.documentElement.appendChild(panel);

    // Close on Esc or outside click
    const onKey = (e) => { if (e.key === "Escape") { closePicker(); document.removeEventListener("keydown", onKey); } };
    document.addEventListener("keydown", onKey);
    setTimeout(() => {
      document.addEventListener("mousedown", function outsideClick(e) {
        if (!panel.contains(e.target)) { closePicker(); document.removeEventListener("mousedown", outsideClick); }
      });
    }, 100);
  }

  function showSuccessPill(comment, box, tone, postText, firstName) {
    showPill(
      `<span style="color:#22c55e">✓</span>
       <span style="color:#d4d4d4;flex:1;max-width:320px;overflow:hidden;text-overflow:ellipsis">${escHtml(comment)}</span>
       <button id="lca-retry-btn" style="background:#333;color:#ccc;border:none;border-radius:12px;padding:3px 10px;font-size:11px;cursor:pointer">↺ Retry</button>`,
      "#22c55e"
    );
    document.getElementById("lca-retry-btn")?.addEventListener("click", async () => {
      logEvent({ kind: "user_retry", tone, firstName, postFull: postText, postSnippet: postText.slice(0, 80) });
      showPill(`${SPINNER} <span>Retrying…</span>`);
      try {
        const [next] = await generateVariants(tone, postText, firstName);
        pasteInto(box, next);
        showSuccessPill(next, box, tone, postText, firstName);
      } catch (e) {
        showPill(`<span style="color:#ef4444">⚠ ${escHtml(e.message)}</span>`, "#ef4444");
        hidePill(3000);
      }
    });
    hidePill(6000);
  }

  async function generateAndInsert(postEl) {
    if (!postEl || !postEl.isConnected) {
      showPill(`<span style="color:#ef4444">⚠ Post re-rendered, click Comment again</span>`, "#ef4444");
      hidePill(3500);
      return;
    }

    // Click "see more" BEFORE extracting text, then wait for React to update the DOM
    const seeMoreBtn = postEl.querySelector([
      "button.feed-shared-inline-show-more-text__see-more-less-toggle",
      ".update-components-text__see-more button",
      "button[aria-label*='see more' i]",
      ".feed-shared-see-more-less-text button",
      "span.feed-shared-inline-show-more-text__see-more-less-toggle",
    ].join(","));
    if (seeMoreBtn && /see more/i.test(seeMoreBtn.textContent || seeMoreBtn.getAttribute("aria-label") || "")) {
      try { seeMoreBtn.click(); } catch (_) {}
      await new Promise(r => setTimeout(r, 450));
    }

    let postText = getPostText(postEl);
    // One retry in case DOM needed more time
    if (!postText || postText.trim().length < 15) {
      await new Promise(r => setTimeout(r, 400));
      postText = getPostText(postEl);
    }
    if (!postText || postText.trim().length < 15) {
      showPill(`<span style="color:#ef4444">⚠ Couldn't read post text</span>`, "#ef4444");
      hidePill(4000);
      return;
    }
    const firstName = getPosterName(postEl);
    const tone      = detectTone(postText);

    closePicker();
    showPill(`${SPINNER} <span>Writing comment…</span>`);

    try {
      const [comment] = await generateVariants(tone, postText, firstName);

      let tries = 0;
      const t = setInterval(() => {
        tries++;
        const box = findCommentBox(postEl);
        if (box) {
          clearInterval(t);
          pasteInto(box, comment);
          showSuccessPill(comment, box, tone, postText, firstName);
        } else if (tries >= 30) {
          clearInterval(t);
          showPill(`<span style="color:#ef4444">⚠ Comment box not found</span>`, "#ef4444");
          hidePill(3000);
        }
      }, 200);
    } catch (e) {
      showPill(`<span style="color:#ef4444">⚠ ${escHtml(e.message)}</span>`, "#ef4444");
      hidePill(3000);
    }
  }

  // ── Intercept Comment button clicks ──────────────────────────────────────

  function isMainPostCommentBtn(btn) {
    const label = (btn.getAttribute("aria-label") || btn.textContent || "").toLowerCase().trim();
    if (!label.includes("comment")) return false;

    // Exclude Reply buttons inside comment threads — they also say "comment" but belong to a comment, not the post
    if (btn.closest([
      ".comments-comment-item",
      ".comments-comment-entity",
      ".comments-comment-social-bar",
      ".comments-comment-list",
      ".comments-comments-list",
    ].join(","))) return false;

    // Walk up to 6 levels to find the main action bar.
    // A real post action bar ALWAYS has repost OR send alongside like+comment.
    // Reply bars on comments never have repost/send — so requiring one cleanly separates them.
    let bar = btn.parentElement;
    for (let i = 0; i < 6; i++) {
      if (!bar || bar === document.body) return false;
      const btns = Array.from(bar.querySelectorAll("button"));
      if (btns.length >= 3) {
        const labels    = btns.map(b => (b.getAttribute("aria-label") || b.textContent || "").toLowerCase());
        const hasLike   = labels.some(l => l.includes("like") || l.includes("react"));
        const hasComment= labels.some(l => l.includes("comment"));
        const hasRepost = labels.some(l => l.includes("repost"));
        const hasSend   = labels.some(l => l.includes("send"));
        if (hasLike && hasComment && (hasRepost || hasSend)) return true;
      }
      bar = bar.parentElement;
    }
    return false;
  }

  function findPostEl(btn) {
    const postCardSels = [
      ".feed-shared-update-v2",           // main feed + profile activity
      ".occludable-update",               // main feed lazy-load wrapper
      ".profile-creator-shared-feed-update__container", // profile page posts
      ".profile-creator-shared-feed-update",
      "[data-view-name='profile-component-entity']",    // newer profile layout
      ".artdeco-card.pv-shared-text-with-see-more",
      "li.profile-creator-shared-feed-update",
      ".scaffold-finite-scroll__content > div > div",   // activity page
    ];
    let node = btn.parentElement;
    for (let i = 0; i < 25; i++) {
      if (!node || node === document.body) break;
      if (postCardSels.some(s => { try { return node.matches(s); } catch (_) { return false; } })) return node;
      node = node.parentElement;
    }
    // Better fallback: nearest artdeco-card that contains this exact button
    // This is correct for recommended posts, notification posts, etc.
    const card = btn.closest(".artdeco-card, [data-id], [data-urn]");
    if (card && card !== document.body) return card;
    // Last resort: walk up 6 levels — but cap at a node that contains the button
    let fallback = btn;
    for (let i = 0; i < 6; i++) fallback = fallback.parentElement || fallback;
    return fallback;
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn || !isMainPostCommentBtn(btn)) return;
    const postEl = findPostEl(btn);
    setTimeout(() => generateAndInsert(postEl), 500);
  }, true);

})();
