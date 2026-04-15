importScripts("config.js");
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const controllers = new Map();

function groqHeaders() {
  return { "Content-Type": "application/json", "Authorization": "Bearer " + getGroqKey() };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "ollama") return;

  const tabId = sender.tab?.id ?? 0;
  controllers.get(tabId)?.abort();
  const ctrl = new AbortController();
  controllers.set(tabId, ctrl);

  const { messages, options = {} } = message.payload;
  const body = {
    model: "llama-3.3-70b-versatile",
    messages,
    temperature: options.temperature ?? 0.65,
    ...(options.num_predict && options.num_predict > 0 ? { max_tokens: options.num_predict } : {}),
    stream: false,
  };

  async function tryFetch(attempt) {
    const r = await fetch(GROQ_URL, {
      method: "POST",
      headers: groqHeaders(),
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      if (r.status === 429) {
        rotateGroqKey();
        if (attempt < GROQ_API_KEYS.length) return tryFetch(attempt + 1);
        const wait = r.headers.get("retry-after") || "60";
        throw new Error("Rate limited — wait " + Math.ceil(Number(wait) || 60) + "s");
      }
      throw new Error("Groq " + r.status);
    }
    return r.json();
  }

  tryFetch(1)
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
