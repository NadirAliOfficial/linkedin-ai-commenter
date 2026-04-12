chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("[LCA] Installed v" + chrome.runtime.getManifest().version);
  }
});

const controllers = new Map();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "ollama") return;

  const tabId = sender.tab?.id ?? 0;
  controllers.get(tabId)?.abort();
  const ctrl = new AbortController();
  controllers.set(tabId, ctrl);

  fetch("http://localhost:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message.payload),
    signal: ctrl.signal,
  })
    .then(r => { if (!r.ok) throw new Error("Ollama " + r.status); return r.json(); })
    .then(data => { controllers.delete(tabId); sendResponse({ ok: true, text: data.message?.content || "" }); })
    .catch(err => {
      controllers.delete(tabId);
      if (err.name === "AbortError") return;
      sendResponse({ ok: false, error: err.message });
    });

  return true;
});

// Warmup
fetch("http://localhost:11434/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "llama3.2",
    stream: false,
    messages: [{ role: "user", content: "." }],
    options: { num_predict: 1, num_ctx: 256, keep_alive: -1 },
  }),
}).catch(() => {});
