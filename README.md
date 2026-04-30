# LinkedIn AI Commenter

A Chrome/Brave browser extension that generates short, professional AI-powered comments on LinkedIn posts using the Groq API.

Built by **Team NAK — Nadir Ali Khan**

---

## Features

- Injects an AI comment bar under every LinkedIn feed post
- 8 comment tones: Support, Insightful, Agree, Question, Congratulate, Challenge, Experience, Add Value
- Powered by Groq API (llama-3.3-70b-versatile) — fast, free tier available
- Auto-inserts the generated comment directly into the LinkedIn comment box
- Short, professional, grammar-perfect output — no hyphens, no emojis, no filler phrases
- Optional: bring your own Groq API key via the extension popup
- Works across feed navigation without requiring a page refresh

---

## Requirements

- Chrome or Brave browser
- A Groq API key (free): [console.groq.com](https://console.groq.com)

---

## Setup

### 1. Get a Groq API Key

1. Sign up at [console.groq.com](https://console.groq.com)
2. Go to **API Keys** and create a new key

### 2. Load the Extension

1. Open `chrome://extensions` or `brave://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `linkedin-ai-commenter` folder

### 3. Add Your Key

1. Click the extension icon in the toolbar
2. Find the **Groq API Key** section
3. Paste your key and click **Save key**

The extension will not work until a key is saved.

### 4. Use It

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

## File Structure

```
linkedin-ai-commenter/
├── manifest.json     # Extension config (Manifest V3)
├── config.js         # Groq API key rotation
├── content.js        # Post detection, UI injection, Groq integration
├── background.js     # Service worker — handles Groq API fetch
├── popup.html        # Extension popup (how-to guide, key input, stats)
├── popup.js          # Popup logic — stats, self-improvement, key management
├── styles.css        # Minimal panel styling
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Privacy

Post text is sent to the Groq API for comment generation. Groq does not use API request data for model training. No data is stored or shared beyond the API call.

---

## Author

**Nadir Ali Khan** — Founder & CEO, Team NAK  
GitHub: [NadirAliOfficial](https://github.com/NadirAliOfficial)
