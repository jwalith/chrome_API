# Resume Job Matcher – Chrome Extension + Website

Improve ATS alignment between your resume and a LinkedIn Job Description. Extract a JD from LinkedIn, analyze alignment, rewrite resume bullets to add missing JD skills, generate a cover letter, and proofread it — powered by Chrome’s on-device AI APIs, with an optional Gemini fallback.

## Live Demo / Access
- Website: host `Ext_plus_site/website/index.html` on a static host (Netlify/Vercel/Cloudflare or local at `http://127.0.0.1:5500/`).
- Extension: load unpacked `Ext_plus_site/extension` in Chrome.

## Problem
Job seekers struggle to tailor resumes quickly to unique job descriptions, leading to low ATS match rates and recruiter pass-through. This app automates analysis and rewriting so bullets explicitly reflect the JD and improve ATS alignment.

## What It Does
- Chrome Extension Popup
  - Analyze Resume vs JD (Prompt API) → readable cards: score, missing skills, strengths, recommendations
  - Summarize JD (Summarizer API)
  - Rewrite Resume Points (opens website, transfers JD+resume via extension storage)
- Website
  - Auto-ingests JD + resume from extension
  - Chat using Prompt API; fallback to Gemini if Prompt is unavailable
  - Rewrite resume points using two-step plan → Rewriter API (few-shot-style examples)
  - Generate cover letter (Writer API)
  - Proofread with side-by-side diff (Proofreader API) and resilient Prompt fallback

## APIs Used
- Chrome AI APIs:
  - Prompt API (`LanguageModel`)
  - Summarizer
  - Rewriter
  - Writer
  - Proofreader
- Optional fallback
  - Gemini Developer API (`gemini-1.5-flash`)

## Project Structure
```
extension/
  manifest.json
  background.js
  content.js
  popup.html
  popup.js
website/
  index.html
```

## Setup

### 1) Website (local or hosted)
- Serve the `website/` folder through a static server. For local testing, ensure the URL is `http://127.0.0.1:5500/Ext_plus_site/website/index.html` so the extension can connect.
- The page automatically reads data from the extension when opened with `?src=ext&extId=...` and will persist the `extId` for resume handoff.

### 2) Load Extension (Manifest V3)
- Chrome → `chrome://extensions` → enable Developer mode → Load unpacked → select `Ext_plus_site/extension`.
- Open a LinkedIn job page, then click the extension icon.

### 3) Resume
- On the website, upload your resume (PDF/TXT). It stores a copy in `localStorage` and in extension storage so the popup and website stay in sync.

### 4) Optional: Gemini API Key (chat fallback)
If the Prompt API is unavailable on a machine, the chat will prompt once for a Gemini key.
- Get a key: `https://ai.google.dev/`
- When prompted, paste your key (stored as `geminiApiKey` in `localStorage`).
- Or set manually:
```
localStorage.setItem('geminiApiKey', 'YOUR_API_KEY');
```

## How to Use
1. On a LinkedIn job page, open the popup:
   - Analyze Resume vs JD → see score, missing skills, strengths, recommendations
   - Summarize JD → concise, readable summary
   - Rewrite Resume Points → opens the website with JD + resume loaded
2. On the website:
   - Click “Rewrite Resume Points” → see improved bullets that add missing JD skills/tools
   - Generate Cover Letter → then “Proofread” to apply grammar/spelling fixes and view side-by-side diff
   - Use chat for guidance; falls back to Gemini when Prompt is unavailable

## License
MIT – see `LICENSE` in this folder.
