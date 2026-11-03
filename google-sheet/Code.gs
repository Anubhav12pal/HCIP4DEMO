/**
 * Receives finished sessions from the voice assistant study app (P4 pilot study)
 * and stores them in this Google Sheet:
 *
 *   Participants       one row per participant: age range, voice assistant experience, order, preference
 *   Task Performance   one row per participant × condition × task (T1–T4; the practice task is not included)
 *   Survey Responses   one row per participant × condition: SUS items + score, NASA-TLX scales + raw TLX
 *   Completion Log     which study steps each participant completed (evidence for the submission)
 *   Summary            averages by condition, updating by itself
 *   Raw data           the complete record of every session, including the conversation log
 *   Test runs          sessions sent from a link with ?test=1 (kept out of every other tab)
 *
 * Setup: see SETUP.md in the same folder.
 */

const NOTIFY_EMAIL = '';   // put an address in the quotes to get an email for each new session

const T = {
  participants: 'Participants', tasks: 'Task Performance', surveys: 'Survey Responses',
  log: 'Completion Log', summary: 'Summary', raw: 'Raw data', test: 'Test runs',
};
const COND = { standard: 'Standard', adapted: 'Age-Adapted' };
const TASK_NAMES = { T1: 'Weather', T2: 'Reminder', T3: 'Timer', T4: 'Date' };
const TLX_KEYS = ['mental', 'physical', 'temporal', 'performance', 'effort', 'frustration'];

const HEAD = {
  participants: ['Participant ID', 'Submitted', 'Age range', 'Voice assistant use', 'Voice assistants used',
    'Condition order', 'Order assigned by', 'Preferred', 'Why', 'Suggested improvement', 'Speech input available'],
  tasks: ['Participant ID', 'Condition', 'Position', 'Task', 'Task name', 'Completed?', 'Outcome',
    'Time (s)', 'Errors', 'Turns', 'Repeats', 'Help', 'Voice turns', 'Typed turns'],
  surveys: ['Participant ID', 'Condition', 'Position',
    'SUS Q1', 'SUS Q2', 'SUS Q3', 'SUS Q4', 'SUS Q5', 'SUS Q6', 'SUS Q7', 'SUS Q8', 'SUS Q9', 'SUS Q10', 'SUS score',
    'TLX Mental', 'TLX Physical', 'TLX Temporal', 'TLX Performance', 'TLX Effort', 'TLX Frustration', 'Raw TLX',
    'What made it difficult'],
  log: ['Participant ID', 'Consent', 'Background questions', 'Training task (1st condition)', '1st condition tasks',
    '1st condition SUS + TLX', 'Training task (2nd condition)', '2nd condition tasks', '2nd condition SUS + TLX',
    'Final questions', 'Submitted'],
  raw: ['Received', 'Participant ID', 'Submitted at (device)', 'Full record (JSON)'],
};

// ---------------------------------------------------------------------------
// Web app endpoints
// ---------------------------------------------------------------------------

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const data = JSON.parse(e.postData.contents);
    const added = addRecord_(data);
    if (added && NOTIFY_EMAIL && !data.is_test) {
      MailApp.sendEmail(NOTIFY_EMAIL, `New study session: ${data.participant_id}`,
        `${data.participant_id} finished the study.\n${SpreadsheetApp.getActiveSpreadsheet().getUrl()}`);
    }
    return reply_(added ? 'ok' : 'duplicate');
  } catch (err) {
    return reply_('error: ' + err);
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  setUp_();
  return ContentService.createTextOutput('The survey link is working. Sessions will appear in the "Participants" tab.');
}
function setUp() { setUp_(); }

// ---------------------------------------------------------------------------
// Storing one session
// ---------------------------------------------------------------------------

function addRecord_(data) {
  const s = setUp_();
  const target = data.is_test ? s.test : s.raw;
  const key = `${data.participant_id}|${data.submitted_at}`;
  if (target.getLastRow() > 1) {
    const keys = target.getRange(2, 2, target.getLastRow() - 1, 2).getValues().map(r => `${r[0]}|${r[1]}`);
    if (keys.includes(key)) return false;
  }
  target.appendRow([new Date(), data.participant_id, data.submitted_at, JSON.stringify(data)]);
  if (data.is_test) return true;

  const rows = rowsFor_(data);
  s.participants.appendRow(rows.participant);
  appendRows_(s.tasks, rows.tasks);
  appendRows_(s.surveys, rows.surveys);
  s.log.appendRow(rows.log);
  return true;
}

// Turns one session into rows for each tab. Kept free of Sheet calls so it can be tested.
function rowsFor_(data) {
  const parts = data.parts || [];
  const cond = m => COND[m] || m;
  const info = data.info || {};
  const pref = data.preference || {};
  const pid = data.participant_id;

  const participant = [
    pid, data.submitted_at ? new Date(data.submitted_at) : new Date(), info.age_range || '', info.va_frequency || '',
    (info.va_used || []).join(', '), (data.order || []).map(cond).join(' → '), data.order_source || '',
    pref.mode === 'none' || !pref.mode ? 'No preference' : cond(pref.mode),
    data.why || '', data.improve || '', data.speech_input_available ? 'Yes' : 'No',
  ];

  const tasks = [];
  const surveys = [];
  parts.forEach(p => {
    (p.trials || []).filter(t => !t.practice).forEach(t => tasks.push([
      pid, cond(p.mode), p.position, t.task, TASK_NAMES[t.task] || t.task,
      t.result === 'success' ? 'Yes' : 'No',
      t.result === 'success' ? 'Success' : t.result === 'timeout' ? 'Timed out' : 'Skipped',
      t.seconds, t.errors, t.turns, t.repeats, t.help, t.voice, t.typed,
    ]));
    const sus = p.sus || {}, tlx = p.tlx || {};
    surveys.push([
      pid, cond(p.mode), p.position,
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => sus['q' + i] != null ? sus['q' + i] : ''),
      p.sus_score != null ? p.sus_score : '',
      ...TLX_KEYS.map(k => tlx[k] != null ? tlx[k] : ''),
      p.tlx_raw != null ? p.tlx_raw : '',
      p.difficulty || '',
    ]);
  });

  const done = b => b ? '✓' : '';
  const practiced = p => !!(p && (p.trials || []).some(t => t.practice));
  const tasksDone = p => !!(p && (p.trials || []).filter(t => !t.practice).length === 4);
  const surveyed = p => !!(p && p.sus_score != null && p.tlx_raw != null);
  const log = [pid, '✓', done(info.age_range),
    done(practiced(parts[0])), done(tasksDone(parts[0])), done(surveyed(parts[0])),
    done(practiced(parts[1])), done(tasksDone(parts[1])), done(surveyed(parts[1])),
    done(pref.choice), data.submitted_at ? new Date(data.submitted_at) : ''];

  return { participant, tasks, surveys, log };
}

function appendRows_(sheet, rows) {
  if (!rows.length) return;
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

// ---------------------------------------------------------------------------
// Building the tabs
// ---------------------------------------------------------------------------

function setUp_() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  const tab = (name, head, color) => {
    let sh = book.getSheetByName(name);
    if (!sh) {
      sh = book.insertSheet(name);
      sh.appendRow(head);
      sh.getRange(1, 1, 1, head.length).setFontWeight('bold').setBackground(color).setWrap(true).setVerticalAlignment('middle');
      sh.setFrozenRows(1);
    }
    return sh;
  };
  const s = {
    participants: tab(T.participants, HEAD.participants, '#e8eaf6'),
    tasks: tab(T.tasks, HEAD.tasks, '#e3f2fd'),
    surveys: tab(T.surveys, HEAD.surveys, '#e8f5e9'),
    log: tab(T.log, HEAD.log, '#fff8e1'),
    raw: tab(T.raw, HEAD.raw, '#eceff1'),
    test: tab(T.test, HEAD.raw, '#fce4ec'),
  };
  if (!book.getSheetByName(T.summary)) buildSummary_(book.insertSheet(T.summary, 0));
  return s;
}

function buildSummary_(sh) {
  const tk = c => `'${T.tasks}'!${c}2:${c}`;
  const sv = c => `'${T.surveys}'!${c}2:${c}`;
  const pp = c => `'${T.participants}'!${c}2:${c}`;
  // Task Performance columns: B Condition, D Task, F Completed?, H Time, I Errors
  // Survey Responses columns: B Condition, N SUS score, U Raw TLX
  const byCond = (name, f) => [name, f('Standard'), f('Age-Adapted')];
  const rate = c => `=IFERROR(ROUND(COUNTIFS(${tk('B')},"${c}",${tk('F')},"Yes")/COUNTIFS(${tk('B')},"${c}")*100,1),"–")`;
  const avgT = (col, c) => `=IFERROR(ROUND(AVERAGEIFS(${tk(col)},${tk('B')},"${c}"),2),"–")`;
  const avgS = (col, c) => `=IFERROR(ROUND(AVERAGEIFS(${sv(col)},${sv('B')},"${c}"),2),"–")`;
  const sdS = (col, c) => `=IFERROR(ROUND(STDEV(FILTER(${sv(col)},${sv('B')}="${c}")),2),"–")`;
  const taskRate = (task, c) => `=IFERROR(COUNTIFS(${tk('B')},"${c}",${tk('D')},"${task}",${tk('F')},"Yes")&" / "&COUNTIFS(${tk('B')},"${c}",${tk('D')},"${task}"),"–")`;
  const rows = [
    ['Voice Assistant Study: Summary', '', ''],
    ['Descriptive only; updates as sessions arrive. Test runs are excluded. Run the paired tests on the exported data.', '', ''],
    ['', '', ''],
    ['Participants', `=COUNTA(${pp('A')})`, ''],
    ['Aged 65 or older', `=COUNTIF(${pp('C')},"65–74")+COUNTIF(${pp('C')},"75–84")+COUNTIF(${pp('C')},"85 or older")`, ''],
    ['Standard first', `=COUNTIF(${pp('F')},"Standard → Age-Adapted")`, ''],
    ['Age-Adapted first', `=COUNTIF(${pp('F')},"Age-Adapted → Standard")`, ''],
    ['', '', ''],
    ['Measure', 'Standard', 'Age-Adapted'],
    byCond('Task success rate, T1–T4 (%)', c => rate(c)),
    byCond('Mean time per task (s)', c => avgT('H', c)),
    byCond('Mean errors per task', c => avgT('I', c)),
    byCond('Mean SUS score (0–100, higher = more usable)', c => avgS('N', c)),
    byCond('SD of SUS score', c => sdS('N', c)),
    byCond('Mean raw NASA-TLX (0–100, higher = more workload)', c => avgS('U', c)),
    byCond('SD of raw NASA-TLX', c => sdS('U', c)),
    ['', '', ''],
    ['Tasks completed', 'Standard', 'Age-Adapted'],
    ...Object.keys(TASK_NAMES).map(t => byCond(`${t} ${TASK_NAMES[t]}`, c => taskRate(t, c))),
    ['', '', ''],
    ['Preferred version', 'People', ''],
    ['Standard', `=COUNTIF(${pp('H')},"Standard")`, ''],
    ['Age-Adapted', `=COUNTIF(${pp('H')},"Age-Adapted")`, ''],
    ['No preference', `=COUNTIF(${pp('H')},"No preference")`, ''],
  ];
  sh.getRange(1, 1, rows.length, 3).setValues(rows);
  sh.getRange('A1').setFontSize(16).setFontWeight('bold');
  sh.getRange('A2').setFontColor('#607d8b').setFontStyle('italic');
  [9, 18, 24].forEach(r => sh.getRange(r, 1, 1, 3).setFontWeight('bold').setBackground('#e8eaf6'));
  sh.getRange(4, 2, rows.length - 3, 2).setHorizontalAlignment('center');
  sh.setColumnWidth(1, 360);
  sh.setColumnWidths(2, 2, 130);
}

function reply_(status) {
  return ContentService.createTextOutput(JSON.stringify({ status })).setMimeType(ContentService.MimeType.JSON);
}
