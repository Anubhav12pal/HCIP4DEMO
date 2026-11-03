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

## What a participant goes through (about 15–20 minutes)

1. **Consent:** what the study is, what is recorded (no audio, no names), and that they can stop at any time.
2. **About you:** age range, how often they use voice assistants, which ones they have used.
3. **How it works:** read the task, press Start task, speak or type, move on.
4. **Version 1:** a practice task (how to boil an egg, not scored), then four timed tasks:
   T1 tomorrow's weather, T2 a reminder to take medication at 8 PM, T3 a 5-minute timer, T4 today's date.
   A task counts as **completed** when the assistant reaches the goal state (for example, a 5-minute timer is
   actually running). Participants can skip a task; after 3 minutes it is recorded as timed out.
5. **SUS** (10 standard items) and **raw NASA-TLX** (6 scales, 0–100), plus an optional "what made it difficult?"
6. **Version 2:** the same practice task, the same four tasks, the same two questionnaires.
7. **Preference** (Version 1 / Version 2 / no preference), why, and one suggested improvement.

Participants only ever see "Version 1" and "Version 2". The version switch and the example list are hidden during
the study, and the assistant only responds while a task is running.

## Links to send (counterbalancing)

| Link | Use for |
|---|---|
| `…/index.html?order=1&pid=P01` | Odd-numbered participants: Standard first |
| `…/index.html?order=2&pid=P02` | Even-numbered participants: Age-Adapted first |
| `…/index.html?test=1` | Your own test runs: saved to the **Test runs** tab only |
| `…/index.html?free=1` | Demo mode with the version switch, no data saved to the Sheet |

`pid` is optional (format P01–P999). Without it, a random ID like `P-K3ZQ` is used. Without `order`, the order is
random. Keep a short private list of which ID went to whom, separate from the data.

## Measures recorded per task

| Field | Meaning |
|---|---|
| Completed? / Outcome | Success when the goal state is reached; otherwise Skipped or Timed out (180 s) |
| Time (s) | From pressing Start task to reaching the goal |
| Errors | Requests the assistant did not understand, plus unclear answers to a Yes/No confirmation |
| Turns, Repeats, Help | Number of requests, Repeat uses, Help uses |
| Voice / typed turns | How each request was entered |

## Run it locally

Open `index.html` in a browser, or for working speech recognition, serve the folder:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000/?test=1 in Google Chrome.

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
