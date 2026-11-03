/**
 * Receives finished surveys from the voice assistant study app and stores them in this
 * Google Sheet, in three tabs:
 *   Responses  one easy-to-read row per participant
 *   Summary    averages and counts that update by themselves
 *   Raw data   the complete record of each session, for the analysis script
 *
 * Setup: see SETUP.md in the same folder.
 */

// Put an email address here (in quotes) to get an email for every new survey, or leave it empty.
const NOTIFY_EMAIL = '';

const RESPONSES = 'Responses';
const SUMMARY = 'Summary';
const RAW = 'Raw data';

// The six statements asked after each version, rated 1 (disagree) to 5 (agree)
const ITEMS = [
  ['easy',        'Easy to use',        true],
  ['understood',  'Understood it',      true],
  ['effort',      'Took effort',        false],
  ['success',     'Did what I wanted',  true],
  ['frustrating', 'Frustrating',        false],
  ['would_use',   'Would use daily',    true],
];
const PER_VERSION = [...ITEMS.map(([, label]) => label), 'Minutes', 'Questions asked', 'Not understood'];
const VERSIONS = [['standard', 'Standard'], ['adapted', 'Age-Adapted']];
const GENERAL = ['Date', 'Participant', 'Name', 'Age', 'Age group', 'Order', 'Preferred'];
const HEADERS = [
  ...GENERAL,
  ...VERSIONS.flatMap(([, name]) => PER_VERSION.map(col => `${name}: ${col}`)),
  'Comment',
];
const COLORS = { general: '#e8eaf6', standard: '#eceff1', adapted: '#e3f2fd', comment: '#f3e5f5' };

// ---------------------------------------------------------------------------
// Web app endpoints
// ---------------------------------------------------------------------------

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000); // one write at a time, so rows never overlap
  try {
    const data = JSON.parse(e.postData.contents);
    const added = addRecord_(data);
    if (added && NOTIFY_EMAIL) emailSummary_(data);
    return reply_(added ? 'ok' : 'duplicate');
  } catch (err) {
    return reply_('error: ' + err);
  } finally {
    lock.releaseLock();
  }
}

// Opening the web app link in a browser shows this, which is a quick way to check the setup.
function doGet() {
  setUp_();
  return ContentService.createTextOutput('The survey link is working. Surveys will appear in the "Responses" tab.');
}

// Run this once from the editor (select "setUp" and press Run) to build the tabs straight away.
function setUp() { setUp_(); }

// ---------------------------------------------------------------------------
// Storing one survey
// ---------------------------------------------------------------------------

function addRecord_(data) {
  const { responses, raw } = setUp_();

  // The app may resend a survey if it was unsure the first send worked; keep only one copy.
  const key = `${data.participant_id}|${data.submitted_at}`;
  if (raw.getLastRow() > 1) {
    const keys = raw.getRange(2, 2, raw.getLastRow() - 1, 2).getValues().map(r => `${r[0]}|${r[1]}`);
    if (keys.includes(key)) return false;
  }

  raw.appendRow([new Date(), data.participant_id, data.submitted_at, JSON.stringify(data)]);
  responses.appendRow(toRow_(data));
  formatLastRow_(responses);
  return true;
}

function toRow_(data) {
  const parts = data.parts || [];
  const byMode = Object.fromEntries(parts.map(p => [p.mode, p]));
  const name = v => (VERSIONS.find(([m]) => m === v) || [, v])[1];
  const pref = data.preference || {};
  const preferred = pref.mode === 'none' || !pref.mode ? 'No preference' : name(pref.mode);

  const row = [
    data.submitted_at ? new Date(data.submitted_at) : new Date(),
    data.participant_id,
    data.name ? data.name : 'Anonymous',
    data.age != null && data.age !== '' ? data.age : '–',
    data.age_group || '–',
    (data.order || []).map(name).join(' → '),
    preferred,
  ];
  for (const [mode] of VERSIONS) {
    const part = byMode[mode] || {};
    const answers = part.answers || {};
    const events = eventsDuring_(data.events || [], part);
    row.push(
      ...ITEMS.map(([key]) => (answers[key] != null ? answers[key] : '')),
      minutes_(part),
      events.filter(ev => ev.type === 'user').length,
      events.filter(ev => ev.type === 'error').length,
    );
  }
  row.push(data.comments || '');
  return row;
}

function eventsDuring_(events, part) {
  if (!part.started_at || !part.ended_at) return [];
  const start = new Date(part.started_at), end = new Date(part.ended_at);
  return events.filter(ev => { const t = new Date(ev.time); return t >= start && t <= end; });
}

function minutes_(part) {
  if (!part.started_at || !part.ended_at) return '';
  return Math.round((new Date(part.ended_at) - new Date(part.started_at)) / 6000) / 10;
}

// ---------------------------------------------------------------------------
// Building and formatting the tabs
// ---------------------------------------------------------------------------

function setUp_() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  let responses = book.getSheetByName(RESPONSES);

  // A "Responses" tab from the earlier version of this script has different columns:
  // keep it under another name and copy its surveys into the new layout.
  let oldTab = null;
  if (responses && responses.getLastRow() > 0 &&
      responses.getRange(1, 1, 1, responses.getLastColumn()).getValues()[0].join('|') !== HEADERS.join('|')) {
    oldTab = responses.setName(`${RESPONSES} (old layout)`);
    responses = null;
  }

  if (!responses) {
    responses = book.insertSheet(RESPONSES, 0);
    buildResponses_(responses);
  }
  let raw = book.getSheetByName(RAW);
  if (!raw) {
    raw = book.insertSheet(RAW);
    raw.appendRow(['Received', 'Participant', 'Submitted at (device)', 'Full record (JSON)']);
    raw.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground(COLORS.general);
    raw.setFrozenRows(1);
    raw.setColumnWidth(4, 600);
  }
  if (!book.getSheetByName(SUMMARY)) buildSummary_(book.insertSheet(SUMMARY, 1));

  if (oldTab) importOld_(oldTab, responses, raw);
  return { responses, raw };
}

function buildResponses_(sheet) {
  sheet.appendRow(HEADERS);
  const n = HEADERS.length, per = PER_VERSION.length, g = GENERAL.length;
  const header = sheet.getRange(1, 1, 1, n);
  header.setFontWeight('bold').setWrap(true).setVerticalAlignment('middle').setHorizontalAlignment('center');
  sheet.getRange(1, 1, 1, g).setBackground(COLORS.general);
  sheet.getRange(1, g + 1, 1, per).setBackground(COLORS.standard);
  sheet.getRange(1, g + per + 1, 1, per).setBackground(COLORS.adapted);
  sheet.getRange(1, n).setBackground(COLORS.comment);
  sheet.setRowHeight(1, 54);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(3);
  sheet.setColumnWidth(1, 150);
  sheet.setColumnWidths(2, 2, 110);
  sheet.setColumnWidths(4, 2, 70);
  sheet.setColumnWidths(6, 2, 170);
  sheet.setColumnWidths(g + 1, per * 2, 92);
  sheet.setColumnWidth(n, 320);
  // thick borders between the general, Standard and Age-Adapted groups
  [g, g + per].forEach(col => sheet.getRange(1, col, 1000, 1)
    .setBorder(null, null, null, true, null, null, '#90a4ae', SpreadsheetApp.BorderStyle.SOLID_MEDIUM));
}

function formatLastRow_(sheet) {
  const r = sheet.getLastRow(), n = HEADERS.length, g = GENERAL.length;
  sheet.getRange(r, 1).setNumberFormat('mmm d, yyyy h:mm am/pm');
  sheet.getRange(r, 4, 1, n - 4).setHorizontalAlignment('center');
  sheet.getRange(r, n).setHorizontalAlignment('left').setWrap(true);
  sheet.getRange(r, g + 1, 1, PER_VERSION.length).setBackground(r % 2 ? '#ffffff' : '#f7f9fa');
  sheet.getRange(r, g + PER_VERSION.length + 1, 1, PER_VERSION.length).setBackground(r % 2 ? '#ffffff' : '#f3f9fe');
}

function buildSummary_(sheet) {
  const col = header => `${RESPONSES}!${letter_(HEADERS.indexOf(header) + 1)}2:${letter_(HEADERS.indexOf(header) + 1)}`;
  const avg = header => `=IFERROR(ROUND(AVERAGE(${col(header)}),2),"–")`;
  const rows = [
    ['Voice Assistant Study: Summary', '', '', ''],
    ['Updates automatically as new surveys arrive. Scores: 1 = disagree, 5 = agree.', '', '', ''],
    ['', '', '', ''],
    ['Participants', `=COUNTA(${col('Participant')})`, '', ''],
    ['Aged 55 or older', `=COUNTIF(${col('Age group')},"55+")`, '', ''],
    ['Average age (of those who gave it)', `=IFERROR(ROUND(AVERAGE(${col('Age')}),1),"–")`, '', ''],
    ['', '', '', ''],
    ['Statement', 'Standard', 'Age-Adapted', 'Better when'],
    ...ITEMS.map(([, label, higher]) => [label, avg(`Standard: ${label}`), avg(`Age-Adapted: ${label}`), higher ? 'higher' : 'lower']),
    ['Minutes per version', avg('Standard: Minutes'), avg('Age-Adapted: Minutes'), '–'],
    ['Questions asked', avg('Standard: Questions asked'), avg('Age-Adapted: Questions asked'), '–'],
    ['Not understood', avg('Standard: Not understood'), avg('Age-Adapted: Not understood'), 'lower'],
    ['', '', '', ''],
    ['Preferred version', 'People', '', ''],
    ['Standard', `=COUNTIF(${col('Preferred')},"Standard")`, '', ''],
    ['Age-Adapted', `=COUNTIF(${col('Preferred')},"Age-Adapted")`, '', ''],
    ['No preference', `=COUNTIF(${col('Preferred')},"No preference")`, '', ''],
  ];
  sheet.getRange(1, 1, rows.length, 4).setValues(rows);
  sheet.getRange('A1').setFontSize(16).setFontWeight('bold');
  sheet.getRange('A2').setFontColor('#607d8b').setFontStyle('italic');
  sheet.getRange('A4:A6').setFontWeight('bold');
  const tableTop = 8, tableRows = ITEMS.length + 4;
  sheet.getRange(tableTop, 1, 1, 4).setFontWeight('bold').setBackground(COLORS.general);
  sheet.getRange(tableTop, 2).setBackground(COLORS.standard);
  sheet.getRange(tableTop, 3).setBackground(COLORS.adapted);
  sheet.getRange(tableTop, 1, tableRows, 4).setBorder(true, true, true, true, true, true, '#cfd8dc', SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(tableTop, 2, tableRows, 3).setHorizontalAlignment('center');
  const prefTop = tableTop + tableRows + 1;
  sheet.getRange(prefTop, 1, 1, 2).setFontWeight('bold').setBackground(COLORS.general);
  sheet.getRange(prefTop, 1, 4, 2).setBorder(true, true, true, true, true, true, '#cfd8dc', SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(prefTop, 2, 4, 1).setHorizontalAlignment('center');
  sheet.setColumnWidth(1, 280);
  sheet.setColumnWidths(2, 3, 120);
  sheet.setFrozenRows(0);
}

// Copies surveys from a tab made by the earlier version of this script (its last column held the full record).
function importOld_(oldTab, responses, raw) {
  const values = oldTab.getDataRange().getValues();
  const headers = values[0];
  const jsonCol = headers.indexOf('Full record (JSON)');
  if (jsonCol < 0) return;
  values.slice(1).forEach(r => {
    try { addRecordInto_(JSON.parse(r[jsonCol]), responses, raw); } catch (e) { /* skip unreadable rows */ }
  });
}

function addRecordInto_(data, responses, raw) {
  raw.appendRow([new Date(), data.participant_id, data.submitted_at, JSON.stringify(data)]);
  responses.appendRow(toRow_(data));
  formatLastRow_(responses);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emailSummary_(data) {
  const row = toRow_(data);
  const at = h => row[HEADERS.indexOf(h)];
  const line = name => `${name}: ` + ITEMS.map(([, label]) => `${label} ${at(`${name}: ${label}`)}`).join(', ');
  MailApp.sendEmail(NOTIFY_EMAIL, `New survey: ${data.participant_id}`,
    `${at('Name')} (age ${at('Age')}, ${at('Age group')}) finished the study.\n` +
    `Order: ${at('Order')}\nPreferred: ${at('Preferred')}\n\n` +
    `${line('Standard')}\n${line('Age-Adapted')}\n` +
    (data.comments ? `\nComment: ${data.comments}\n` : '') +
    `\nAll responses: ${SpreadsheetApp.getActiveSpreadsheet().getUrl()}`);
}

function letter_(n) {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function reply_(status) {
  return ContentService.createTextOutput(JSON.stringify({ status })).setMimeType(ContentService.MimeType.JSON);
}
