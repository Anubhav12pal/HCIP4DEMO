# Everyday Voice Assistant

A voice assistant prototype for studying age-adapted interface design, from a CS 6326 Human-Computer Interaction
project at The University of Texas at Dallas.

It runs entirely in the browser with no server: answers come from a fixed bank of
common questions, each written twice, once for each version of the interface.

## The two versions

| | Standard | Age-adapted |
|---|---|---|
| Replies | Conversational, with extra detail | One to three short, plain sentences |
| Speech | Normal speed | Slower |
| Text | Small captions, dark theme | Large, high-contrast text |
| "I heard" box | – | Shows what was recognised |
| Timers and reminders | Set immediately | Read back and confirmed with Yes/No first |
| Repeat and Help | By voice only | Also as on-screen buttons |
| Misunderstandings | "Sorry, I didn't understand that." | An example first, then a full list of options |

## What a participant goes through (about 5 minutes)

1. **Consent:** "This is a UTD CS-6326 HCI survey… Are you sure you want to proceed?"
2. **"Are you 65 or older?"** This decides which version comes first. Everyone tries both.
3. **How it works:** three short lines.
4. **First version:** ask a few questions. A "You can ask" list is always next to the assistant, so there's
   nothing to remember. Then three quick 1–5 questions: easy to use, understood what it said, took effort.
5. **Second version:** the same again.
6. **Which did you prefer?** Plus an optional comment.

A switch at the top always shows which version is in use (Standard or Age-Adapted), and participants can
use it to compare the two.

## Where the results go

**Google Sheet (recommended).** Follow `google-sheet/SETUP.md` once, then paste the Sheet's web app link into
`config.js`. Every finished survey is added as a row in that Sheet, from localhost and from GitHub Pages alike.
You can also get an email for each survey.

**Backup on the device.** Every survey is also kept in the browser:

- The thank-you screen has a **Download results** button that saves that participant's JSON file.
- Open the page with `?free=1&study=1` and use **Export all saved sessions** to download every survey kept on
  that device.
- If the internet is down when someone submits, the survey is sent automatically the next time the app is
  opened online.

## Run it locally

Open `index.html` in a browser, or for working speech recognition, serve the folder:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000 in Google Chrome. Add `?free=1` to skip the study flow and just use the assistant.

## Deploy to GitHub Pages

1. Create a new **public** repository on github.com, for example `voice-assistant-study`. Don't add a README.
2. In this folder, run:
   ```bash
   git init
   git add .
   git commit -m "Voice assistant study prototype"
   git branch -M main
   git remote add origin https://github.com/<your-username>/voice-assistant-study.git
   git push -u origin main
   ```
3. On GitHub, open **Settings → Pages**. Under *Build and deployment*, choose **Deploy from a branch**, then
   **main** and **/ (root)**, and click **Save**.
4. After a minute or two, the site is live at `https://<your-username>.github.io/voice-assistant-study/`.

GitHub Pages serves over HTTPS, so the microphone works in Chrome.

## Adding questions

Questions live in `questions.js`. Copy an entry, give it a new `id`, list some trigger phrases in `match`, and
write both answers:

```js
{ id:'tea', topic:'Cooking',
  match:[/make (a )?tea/, /brew tea/],
  standard:"Boil fresh water, pour it over a tea bag, and let it steep for three to five minutes...",
  adapted:"Pour boiling water over the tea bag. Wait three to five minutes, then remove it." },
```

Keep the age-adapted answer to one to three short sentences, in plain words, without talking down to the reader.

## Files

| File | What it is |
|------|------------|
| `index.html` | Page layout and styles |
| `app.js` | The assistant: speech, the answer engine, the two versions, the study flow and questionnaires |
| `questions.js` | The question bank and the simulated weather |
| `config.js` | Where surveys are sent: paste the Google Sheet link here |
| `google-sheet/` | The Google Sheet script (`Code.gs`) and setup steps (`SETUP.md`) |
