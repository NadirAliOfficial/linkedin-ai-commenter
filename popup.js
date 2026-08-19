document.addEventListener("DOMContentLoaded", () => {
  const keyInput  = document.getElementById("api-key-input");
  const keyStatus = document.getElementById("key-status");
  const eyeBtn    = document.getElementById("eye-btn");
  const toggle    = document.getElementById("lcaEnabled");

  // Load saved state
  chrome.storage.local.get({ lca_groq_key: "", lcaEnabled: true }, ({ lca_groq_key, lcaEnabled }) => {
    if (lca_groq_key) {
      keyInput.value = lca_groq_key;
      keyStatus.innerHTML = `<span style="color:#0a66c2;font-weight:600;">✓ Key saved</span>`;
    } else {
      keyStatus.innerHTML = `<span style="color:#888;">No key — get one free at console.groq.com</span>`;
    }
    toggle.checked = lcaEnabled;
  });

  // On/off toggle
  toggle.addEventListener("change", () => {
    chrome.storage.local.set({ lcaEnabled: toggle.checked });
  });

  // Eye toggle
  eyeBtn.addEventListener("click", () => {
    keyInput.type = keyInput.type === "password" ? "text" : "password";
    eyeBtn.textContent = keyInput.type === "password" ? "◉" : "○";
  });

  // Save key
  document.getElementById("save-key-btn").addEventListener("click", () => {
    // Strip anything outside printable ASCII — pasting from WhatsApp/chat apps can
    // silently inject invisible Unicode formatting characters that break the
    // Authorization header (fetch throws "non ISO-8859-1 code point").
    const val = keyInput.value.replace(/[^\x20-\x7E]/g, "").trim();
    if (!val) { keyStatus.innerHTML = `<span style="color:#ef4444;">Enter a key first.</span>`; return; }
    keyInput.value = val;
    chrome.storage.local.set({ lca_groq_key: val }, () => {
      keyStatus.innerHTML = `<span style="color:#0a66c2;font-weight:600;">✓ Saved</span>`;
    });
  });

  // Clear key
  document.getElementById("clear-key-btn").addEventListener("click", () => {
    chrome.storage.local.remove("lca_groq_key", () => {
      keyInput.value = "";
      keyStatus.innerHTML = `<span style="color:#555;">Cleared</span>`;
    });
  });
});
