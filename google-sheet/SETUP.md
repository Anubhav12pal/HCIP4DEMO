# Sending sessions to a Google Sheet

Every finished session becomes rows in a Google Sheet your team can open. It works the same from localhost
and from GitHub Pages, because both read the link from `config.js`.

## Use a fresh Sheet for the real study

The layout changed for P4 (SUS, NASA-TLX, per-task data), and your earlier test rows should not end up in the
dataset you submit. The cleanest way is a new Sheet:

1. Create a blank spreadsheet, e.g. *Voice Assistant Study – P4 Data*.
2. **Extensions → Apps Script**, delete the code there, paste all of `Code.gs`, click **Save**.
3. Optional: put your address in `NOTIFY_EMAIL` to get an email per session.
4. **Deploy → New deployment → Web app**, with **Execute as: Me** and **Who has access: Anyone**. Authorize
   when asked (Advanced → Go to project → Allow; the warning is normal for your own script).
5. Copy the **Web app URL** and open it once in a browser. It should say *"The survey link is working"* and
   create the tabs.
6. Paste the URL into `config.js`, then commit and push.

(If you'd rather keep the old Sheet: paste the new `Code.gs`, then **Deploy → Manage deployments → Edit →
New version → Deploy**. The URL stays the same and the new tabs are added next to your old ones.)

## What you get

| Tab | One row per | Use it for |
|---|---|---|
| **Summary** | – | Means and SDs by condition, success per task, preference counts. Descriptive only. |
| **Participants** | participant | Age range, voice-assistant experience, condition order, preference and comments |
| **Task Performance** | participant × condition × task | Completed?, outcome, time, errors, turns, Repeat/Help use (T1–T4 only; practice excluded) |
| **Survey Responses** | participant × condition | All 10 SUS answers + SUS score, all 6 TLX scales + raw TLX, difficulty comment |
| **Completion Log** | participant | ✓ for consent, both training tasks, both task sets, both questionnaires, final questions |
| **Raw data** | session | The full JSON record including the conversation log |
| **Test runs** | session | Anything sent from a link with `?test=1`. Never mixed into the other tabs. |

To export evidence for the submission: **File → Download → Microsoft Excel (.xlsx)** downloads every tab at once.

## Good to know

- No internet at submit time? The session is saved on the device and sent the next time the page is opened.
- Duplicate sends are stored only once.
- If you change `Code.gs` later, use **Manage deployments → Edit → New version** so the URL keeps working.
