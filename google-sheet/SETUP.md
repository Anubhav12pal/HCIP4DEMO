# Sending surveys to a Google Sheet

When this is set up, every finished survey becomes one row in a Google Sheet that your team can open. It works the
same from localhost and from GitHub Pages, because both read the link from `config.js`.

## 1. Create the Sheet and the script (about 10 minutes, once)

1. Go to **sheets.google.com** and create a blank spreadsheet. Name it, for example, *Voice Assistant Study Responses*.
2. In the Sheet, open **Extensions → Apps Script**.
3. Delete the code that is there, and paste in everything from `Code.gs` (in this folder).
4. Optional: to get an email for every survey, put your address in the first setting, e.g.
   `const NOTIFY_EMAIL = 'you@utdallas.edu';`
5. Click the **Save** icon.

## 2. Publish it as a web app

1. Click **Deploy → New deployment**.
2. Click the gear next to *Select type* and choose **Web app**.
3. Set:
   - **Execute as:** *Me*
   - **Who has access:** *Anyone*. This lets the app send surveys without participants signing in. It does
     not let anyone read your Sheet.
4. Click **Deploy**. Google asks you to authorize: choose your account, then **Advanced → Go to (project)
   → Allow**. This screen appears because the script is yours and unverified, which is normal.
5. Copy the **Web app URL**. It looks like `https://script.google.com/macros/s/AKfy…/exec`.
6. Check it: open that URL in a browser tab. It should say *"The survey link is working."* Opening it also
   creates the three tabs described below.

## 3. Connect the app

Open `config.js` and paste the URL between the quotes:

```js
window.SURVEY_ENDPOINT = 'https://script.google.com/macros/s/AKfy…/exec';
```

Then:

- **localhost:** restart or refresh the app.
- **GitHub Pages:** commit and push the changed `config.js` (`git add config.js && git commit -m "Connect survey sheet" && git push`).

Both now send to the same Sheet. Do one test run of the survey and check that a row appears in the **Responses** tab.

## What you get

The Sheet has three tabs.

**Responses:** one row per participant, easy to read:

| Date | Participant | Name | Age | Age group | Order | Preferred | Standard: Easy to use … Not understood | Age-Adapted: Easy to use … Not understood | Comment |
|---|---|---|---|---|---|---|---|---|---|
| Nov 2, 2026 6:38 PM | P-KZOQ | Anonymous | 23 | under 55 | Standard → Age-Adapted | Age-Adapted | 5, 5, 1, 4, 1, 1, 0.9 min, 4 asked, 0 | 5, 5, 1, 5, 1, 1, 0.1 min, 0 asked, 0 | |

- The answers are always shown as **Standard** first, then **Age-Adapted**, whichever order the participant
  used, so you can compare across a row at a glance. The **Order** column shows what they actually did first.
- Each version has nine columns: the six statements (1 = disagree, 5 = agree), minutes spent, questions asked,
  and questions the assistant did not understand.
- Headers are colour-coded: grey-blue for general details, grey for Standard, blue for Age-Adapted.

**Summary:** updates by itself as surveys arrive. It shows the number of participants, how many are 55+, the
average age, the average of every statement for each version, and how many people preferred each version.

**Raw data:** the complete record of each session, including the conversation log. You don't need to look at it;
it's there for the analysis script. Download it with **File → Download → Comma-separated values (.csv)** while
this tab is open, then run `python3 analyze.py "Raw data.csv"`.

## Updating the script

If you had already set up an earlier version of the script:

1. Open **Extensions → Apps Script**, replace all the code with the new `Code.gs`, and click **Save**.
2. **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy.** The link stays the same, so
   `config.js` doesn't change.
3. Open the web app link once in a browser. The script renames your old tab to *Responses (old layout)*,
   builds the new tabs, and copies your earlier surveys into the new layout. Delete the old tab once you've
   checked the new one.

## Good to know

- **No internet during a session?** The survey is saved on the device and sent automatically the next time
  the app is opened online.
- **Changed `Code.gs` later?** Use **Deploy → Manage deployments → Edit → New version**, so the same URL
  keeps working.
- **Duplicates:** if the app resends a survey it wasn't sure about, the script stores it only once.
