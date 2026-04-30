const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const controllers = new Map();

function getUserKey() {
  return new Promise(resolve => {
    chrome.storage.local.get({ lca_groq_key: "" }, ({ lca_groq_key }) => {
      resolve(lca_groq_key.trim() || null);
    });
  });
}

async function callGroq(messages, { temperature = 0.65, max_tokens, signal } = {}) {
  const key = await getUserKey();
  if (!key) throw new Error("No API key — add your Groq key in the extension popup.");
  const body = {
    model: "llama-3.3-70b-versatile",
    messages,
    temperature,
    ...(max_tokens ? { max_tokens } : {}),
    stream: false,
  };
  const r = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
    body: JSON.stringify(body),
    signal,
  });
  if (!r.ok) {
    if (r.status === 429) {
      const wait = r.headers.get("retry-after") || "60";
      throw new Error("Rate limited — wait " + Math.ceil(Number(wait) || 60) + "s");
    }
    throw new Error("Groq " + r.status);
  }
  return r.json();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "log") {
    chrome.storage.local.get({ lca_log: [] }, ({ lca_log }) => {
      lca_log.push(message.entry);
      if (lca_log.length > 500) lca_log.splice(0, lca_log.length - 500);
      chrome.storage.local.set({ lca_log });
    });
    fetch("http://localhost:7331/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message.entry),
    }).catch(() => {});
    return;
  }

  if (message.type === "analyze") {
    const { failures } = message;
    const failList = failures.map((f, i) =>
      `${i + 1}. Tone: ${f.tone}\n   Post: ${f.postSnippet}\n   Bad comment: ${f.comment}`
    ).join("\n\n");

    const prompt = `You are improving a LinkedIn comment AI. Below are comments it generated that were flagged as too generic or irrelevant to their posts.\n\n${failList}\n\nIdentify the 2-3 most common failure patterns. Then write exactly 2-3 SHORT, SPECIFIC rules (one sentence each) to add to the system prompt to prevent these failures.\nOutput ONLY the rules, one per line, starting with "- ". No explanations, no headers, nothing else.`;

    callGroq([{ role: "user", content: prompt }], { temperature: 0.3, max_tokens: 200 })
      .then(data => sendResponse({ ok: true, rules: data.choices?.[0]?.message?.content?.trim() || "" }))
      .catch(err => sendResponse({ ok: false, error: err.message }));

    return true;
  }

  if (message.type !== "ollama") return;

  const tabId = sender.tab?.id ?? 0;
  controllers.get(tabId)?.abort();
  const ctrl = new AbortController();
  controllers.set(tabId, ctrl);

  const { messages, options = {} } = message.payload;

  callGroq(messages, {
    temperature: options.temperature ?? 0.65,
    max_tokens: options.num_predict > 0 ? options.num_predict : undefined,
    signal: ctrl.signal,
  })
    .then(data => {
      controllers.delete(tabId);
      sendResponse({ ok: true, text: data.choices?.[0]?.message?.content || "" });
    })
    .catch(err => {
      controllers.delete(tabId);
      if (err.name === "AbortError") return;
      sendResponse({ ok: false, error: err.message });
    });

  return true;
});
