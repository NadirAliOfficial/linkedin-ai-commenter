# LinkedIn AI Commenter

A Chrome/Brave browser extension that generates short, professional AI-powered comments on LinkedIn posts using a fully local Ollama model. No data leaves your machine.

Built by **Team NAK — Nadir Ali Khan**

---

## Features

- Injects an AI comment bar under every LinkedIn feed post
- 8 comment tones: Support, Insightful, Agree, Question, Congratulate, Challenge, Experience, Add Value
- Powered by local Ollama (llama3.2) — 100% private, no API keys, no subscriptions
- Auto-inserts the generated comment directly into the LinkedIn comment box
- Short, professional, grammar-perfect output — no hyphens, no emojis, no filler phrases
- Works across feed navigation without requiring a page refresh

---

## Requirements

- [Ollama](https://ollama.com) installed and running locally
- `llama3.2` model: `ollama pull llama3.2`
- Chrome or Brave browser

---

## Setup

### 1. Start Ollama

```bash
ollama serve
```

Or launch the Ollama desktop app. Confirm it is running at `http://localhost:11434`.

### 2. Load the Extension

1. Open `chrome://extensions` or `brave://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `linkedin-ai-commenter` folder

### 3. Use It

1. Open [LinkedIn Feed](https://www.linkedin.com/feed/)
2. Scroll to any post
3. Find the AI comment bar below the Like / Comment / Repost buttons
4. Click any tone button
5. The comment is generated and auto-inserted into LinkedIn's comment box
6. Press LinkedIn's **Post** button to publish

---

## Comment Tones

| Tone | What it generates |
|---|---|
| **Support** | Supportive, encouraging comment |
| **Insightful** | Observation about the post topic |
| **Agree** | Brief agreement with the post |
| **Question** | Thoughtful question about the topic |
| **Congratulate** | Congratulatory comment on an achievement |
| **Challenge** | Polite alternative perspective |
| **Experience** | Relevant professional perspective |
| **Add Value** | Adds a concrete insight to the post |

---

## Auto-start Ollama on Boot (macOS)

To run Ollama 24/7 without touching anything after a restart:

```bash
# Create launchd service
cat > ~/Library/LaunchAgents/com.ollama.server.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>com.ollama.server</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Applications/Ollama.app/Contents/Resources/ollama</string>
        <string>serve</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>OLLAMA_NO_CLOUD</key><string>true</string>
        <key>OLLAMA_ORIGINS</key><string>chrome-extension://*</string>
        <key>HOME</key><string>/Users/YOUR_USERNAME</string>
    </dict>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
</dict>
</plist>
EOF

launchctl load ~/Library/LaunchAgents/com.ollama.server.plist
```

---

## File Structure

```
linkedin-ai-commenter/
├── manifest.json     # Extension config (Manifest V3)
├── content.js        # Post detection, UI injection, Ollama integration
├── background.js     # Service worker — handles Ollama API fetch
├── styles.css        # Minimal panel styling
├── popup.html        # Extension popup (how-to guide)
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Privacy

All AI processing runs locally via Ollama. No text, no post content, and no personal data are ever sent to any external server.

---

## Author

**Nadir Ali Khan** — Founder & CEO, Team NAK  
GitHub: [NadirAliOfficial](https://github.com/NadirAliOfficial)
