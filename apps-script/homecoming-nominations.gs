/**
 * Homecoming Court Nominations — Apps Script backend (Code.gs).
 * Opens the nominations Google Sheet by ID (SHEET_ID_ below).
 *
 * =====================================================================
 * HOW IDENTITY WORKS (the whole point — do not weaken this)
 * =====================================================================
 * FUHSD blocks student accounts from authorizing Apps Script, so students never
 * touch this script. They sign in on fremontasb.org/homecoming-court with
 * "Sign in with Google"; the site's server (api/nominate.js) checks the ID token and
 * forwards it here, and doPost checks it AGAIN with Google (UrlFetchApp → tokeninfo):
 * signature, audience = our OAuth client ID, not expired, email_verified, and a
 * @student.fuhsd.org / @fuhsd.org address. The email is taken only from that token.
 * There is NO email input anywhere and no shared secret to leak.
 *
 * Deployment: ONE Web App, owned by the ASB Gmail, Execute as: Me, Who has
 * access: Anyone. GET ?view=config is the public open/mode JSON the site reads.
 * Redeploy a NEW VERSION of the same deployment (Manage deployments → Edit) when
 * this file changes, so the /exec URL stays the same. Config-tab edits need no redeploy.
 * (Index.html / google.script.run is the old in-script page; it stays harmless.)
 *
 * =====================================================================
 * SPREADSHEET LAYOUT (already exists — do not restructure)
 * =====================================================================
 * All in the Events spreadsheet (SHEET_ID_): Config, Nominations, Test Submissions.
 *
 * Config tab (column A = key, column B = value; any row order):
 *   open       yes | no          → whether submissions are accepted
 *   mode       test | live       → which tab a submission is written to
 *   cycle      Homecoming 2026    → label shown on the page (optional)
 *   deadline   Fri, Oct 3         → shown on the page; if the cell is a real DATE, nominations
 *                                  also close automatically at 11:59 PM that day (optional)
 *
 * Header row (row 1) for BOTH Nominations and Test Submissions, exact order:
 *   Timestamp | Nominator Email | N1 First | N1 Last | N2 First | N2 Last
 *             | N3 First | N3 Last | N4 First | N4 Last
 *
 * One row per student. Resubmitting (before the deadline) OVERWRITES that
 * student's row (matched on column B, case-insensitive), so the tab is already
 * one-row-per-student with their latest picks when it is time to tally.
 */

// The Events spreadsheet: its Config tab (open / mode / cycle / deadline) drives nominations, and
// its Nominations / Test Submissions tabs receive them.
var SHEET_ID_ = '11Pm2zUc_O40E0oTZekYvsD_D8FenH9s7PiJ43m7JCH0';

function book_() {
  return SHEET_ID_ ? SpreadsheetApp.openById(SHEET_ID_) : SpreadsheetApp.getActive();
}

// Nominations are written to the Nominations / Test Submissions tabs of the same Events
// spreadsheet (ASB's own sheet: ASB Tech, ASB Cabinet and the advisor).
var NOM_SHEET_PROP_ = 'NOM_SHEET_ID'; // only used by moveNominationsBack_() below
var NOM_HEADERS_ = ['Timestamp', 'Nominator Email', 'N1 First', 'N1 Last', 'N2 First', 'N2 Last',
  'N3 First', 'N3 Last', 'N4 First', 'N4 Last'];

function nomBook_() {
  return book_();
}

// ONE-TIME (Run from the editor, Sept 24 2026): copies any rows saved in the temporary separate
// spreadsheet back into the Events sheet tabs (newer row per email wins), then forgets that
// spreadsheet's id. Safe to re-run; does nothing once the id is gone.
function moveNominationsBack_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(NOM_SHEET_PROP_);
  if (!id) { Logger.log('Nothing to move back.'); return; }
  var src = SpreadsheetApp.openById(id);
  var dst = book_();
  ['Nominations', 'Test Submissions'].forEach(function (name) {
    var from = src.getSheetByName(name), to = dst.getSheetByName(name);
    if (!from || !to || from.getLastRow() < 2) return;
    var rows = from.getRange(2, 1, from.getLastRow() - 1, NOM_HEADERS_.length).getValues();
    rows.forEach(function (r) {
      var email = String(r[1] || '').trim();
      if (!email) return;
      var at = findRowByEmail_(to, email);
      if (at > 0) to.getRange(at, 1, 1, NOM_HEADERS_.length).setValues([r]);
      else to.appendRow(r);
    });
    Logger.log(name + ': moved ' + rows.length + ' row(s) back');
  });
  props.deleteProperty(NOM_SHEET_PROP_);
  Logger.log('Done. The separate spreadsheet can now be deleted: ' + src.getUrl());
}

var ALLOWED_DOMAINS_ = ['student.fuhsd.org', 'fuhsd.org'];
var MAX_NOMINEES_ = 4;
var MAX_NAME_LEN_ = 60;

// ---------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------

// Config is cached for 60 s so most requests don't have to open the (large) spreadsheet just
// to read four cells. A Config-tab edit therefore takes effect within about a minute.
function readConfig_() {
  var cache = CacheService.getScriptCache();
  var cfg = null;
  var hit = cache.get('cfg_v2');
  if (hit) { try { cfg = JSON.parse(hit); } catch (e) { cfg = null; } }
  if (!cfg) {
    cfg = readConfigFromSheet_();
    try { cache.put('cfg_v2', JSON.stringify(cfg), 60); } catch (e2) { /* best-effort */ }
  }
  // Automatic close: if the deadline cell is a real DATE, nominations close at the end of that
  // day even if nobody flips "open" to no. (A plain-text deadline is display-only.)
  if (cfg.deadlineEnd && Date.now() > cfg.deadlineEnd) cfg.open = false;
  return cfg;
}

function readConfigFromSheet_() {
  var cfg = { open: false, mode: 'test', cycle: '', deadline: '' };
  var sh = book_().getSheetByName('Config');
  if (!sh) return cfg;
  var values = sh.getDataRange().getValues();
  for (var i = 0; i < values.length; i++) {
    var key = String(values[i][0] || '').trim().toLowerCase();
    var val = cellText_(values[i][1]);
    if (key === 'open') cfg.open = /^(yes|true|y|1|open)$/i.test(val);
    else if (key === 'mode') cfg.mode = /^live$/i.test(val) ? 'live' : 'test';
    else if (key === 'cycle') cfg.cycle = val;
    else if (key === 'deadline') {
      cfg.deadline = val;
      var raw = values[i][1];
      if (Object.prototype.toString.call(raw) === '[object Date]' && !isNaN(raw.getTime())) {
        cfg.deadlineEnd = raw.getTime() + 24 * 60 * 60 * 1000 - 1; // 11:59:59 PM that day
      }
    }
  }
  return cfg;
}

// A Config cell that Sheets auto-parsed as a date (e.g. the deadline "Oct 3")
// comes back as a Date object; show it as "Fri, Oct 3" rather than Date.toString().
function cellText_(val) {
  if (val == null) return '';
  if (Object.prototype.toString.call(val) === '[object Date]') {
    if (isNaN(val.getTime())) return '';
    return Utilities.formatDate(val, Session.getScriptTimeZone(), 'EEE, MMM d');
  }
  return String(val).trim();
}

function tabNameForMode_(mode) {
  return mode === 'live' ? 'Nominations' : 'Test Submissions';
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------------
// HTTP entry points
// ---------------------------------------------------------------------

// GET — ?view=config returns the public JSON the website reads.
// Anything else renders the nomination page (Index.html).
function doGet(e) {
  var view = '';
  if (e && e.parameter && e.parameter.view != null) view = String(e.parameter.view);
  if (view === 'config') {
    var c = readConfig_();
    return json_({ open: c.open, mode: c.mode, cycle: c.cycle, deadline: c.deadline });
  }
  if (view === 'sheet') {
    var tab = e && e.parameter ? String(e.parameter.tab || '') : '';
    return ContentService.createTextOutput(publicTabCsv_(tab)).setMimeType(ContentService.MimeType.CSV);
  }
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Homecoming Court Nominations')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

// ---------------------------------------------------------------------
// PUBLIC TABS. The Events spreadsheet is private (no link sharing), so the website reads the few
// tabs that are meant to be public through here (GET ?view=sheet&tab=Spirit%20Points), as CSV.
// ONLY the tabs listed below can ever be read; Nominations, Test Submissions and Config cannot.
// ---------------------------------------------------------------------
var PUBLIC_TABS_ = ['Spirit Points', 'Events', 'Sports'];

function publicTabCsv_(tab) {
  if (PUBLIC_TABS_.indexOf(tab) < 0) return '';
  var cache = CacheService.getScriptCache();
  var key = 'tab_' + tab.replace(/\W/g, '_');
  var hit = cache.get(key);
  if (hit != null) return hit;
  var csv = '';
  // Same CSV the site used to get from the public link (gviz), fetched with the owner's access.
  try {
    var url = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID_ + '/gviz/tq?tqx=out:csv&sheet=' +
      encodeURIComponent(tab);
    var r = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true,
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } });
    var body = r.getContentText();
    if (r.getResponseCode() === 200 && body && body.charAt(0) !== '<') csv = body;
  } catch (err) { csv = ''; }
  // Fallback: build the CSV from the tab itself (dates as YYYY-MM-DD).
  if (!csv) {
    try {
      var ss = book_();
      var sh = ss.getSheetByName(tab);
      if (!sh) return '';
      var range = sh.getDataRange();
      var vals = range.getValues(), shown = range.getDisplayValues();
      var tz = ss.getSpreadsheetTimeZone();
      csv = shown.map(function (row, i) {
        return row.map(function (cell, j) {
          var v = vals[i][j];
          if (v instanceof Date && v.getFullYear() > 1900) cell = Utilities.formatDate(v, tz, 'yyyy-MM-dd');
          return '"' + String(cell).replace(/"/g, '""') + '"';
        }).join(',');
      }).join('\n');
    } catch (err2) { return ''; }
  }
  try { cache.put(key, csv, 60); } catch (err3) { /* too big to cache */ }
  return csv;
}

// POST — the ONLY submission path. fremontasb.org/api/nominate forwards the student's Google
// ID token (from "Sign in with Google" on the site) and this script checks it WITH GOOGLE
// itself (tokeninfo): signed by Google, audience = our OAuth client ID, not expired, verified
// @student.fuhsd.org / @fuhsd.org email. The email comes ONLY from that verified token, never
// from the request body, so nobody can nominate as someone else. No shared secret exists.
//
// Body (JSON): { credential: <Google ID token>, action: 'state' | 'submit', nominees?: [{first,last}] }
var GOOGLE_CLIENT_ID_ = '276898272987-f2qepltpkfs8um36rh6qpeesfk1u5i57.apps.googleusercontent.com';

function doPost(e) {
  var body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}') || {}; } catch (err) { body = {}; }

  var email = verifiedEmail_(body.credential);
  if (email === null) {
    return json_({ ok: false, error: 'signin', message: 'Your sign-in expired. Please sign in again.' });
  }
  var id = identityFrom_(email);
  if (!id.signedIn) {
    return json_({ ok: false, error: 'wrong-domain', email: email,
      message: 'Please sign in with your @student.fuhsd.org account to nominate.' });
  }

  if (body.action === 'state') return json_(stateFor_(id));
  if (body.action === 'submit') return json_(submitFor_(id, body.nominees));
  return json_({ ok: false, error: 'bad-action', message: 'Unknown action.' });
}

// Returns the lowercased verified email from a Google ID token, or null if Google doesn't vouch for it.
// Speed: a verified token is remembered in CacheService until it expires, so the student's
// "load my picks" call pays for the Google check once and their submit skips it (~1 s saved).
function verifiedEmail_(credential) {
  if (typeof credential !== 'string' || credential.length < 100 || credential.length > 4096) return null;
  var cache = CacheService.getScriptCache();
  var key = 'tok_' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, credential));
  var hit = cache.get(key);
  if (hit) return hit;
  var r;
  try {
    r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential),
      { muteHttpExceptions: true });
  } catch (err) { return null; }
  if (r.getResponseCode() !== 200) return null;
  var t;
  try { t = JSON.parse(r.getContentText()); } catch (err2) { return null; }
  var issOk = t.iss === 'accounts.google.com' || t.iss === 'https://accounts.google.com';
  var verified = t.email_verified === true || t.email_verified === 'true';
  var secsLeft = Math.floor(Number(t.exp) - Date.now() / 1000);
  if (t.aud !== GOOGLE_CLIENT_ID_ || !issOk || !verified || !(secsLeft > 0)) return null;
  var email = String(t.email || '').trim().toLowerCase();
  if (email && secsLeft > 30) {
    try { cache.put(key, email, Math.min(secsLeft - 10, 21600)); } catch (err3) { /* cache is best-effort */ }
  }
  return email;
}

// ---------------------------------------------------------------------
// Identity — from Session ONLY. Never from a client argument.
// ---------------------------------------------------------------------

function getIdentity_() {
  var email = '';
  try {
    email = String(Session.getActiveUser().getEmail() || '');
  } catch (err) {
    email = '';
  }
  return identityFrom_(email);
}

// Domain check shared by both paths. doPost passes the email the site's server verified.
function identityFrom_(raw) {
  var email = (typeof raw === 'string' ? raw : '').trim().toLowerCase();
  var at = email.indexOf('@');
  var domain = at >= 0 ? email.substring(at + 1) : '';
  var allowed = false;
  if (email && domain) {
    for (var i = 0; i < ALLOWED_DOMAINS_.length; i++) {
      if (domain === ALLOWED_DOMAINS_[i]) { allowed = true; break; }
    }
  }
  return { email: email, signedIn: allowed };
}

// ---------------------------------------------------------------------
// Sheet helpers
// ---------------------------------------------------------------------

// Returns the 1-based row number whose column B equals email (case-insensitive),
// or -1 if none. Reads column B in a single getRange call.
function findRowByEmail_(sheet, email) {
  var key = String(email || '').trim().toLowerCase();
  if (!key) return -1;
  var last = sheet.getLastRow();
  if (last < 2) return -1;
  var col = sheet.getRange(2, 2, last - 1, 1).getValues();
  for (var i = 0; i < col.length; i++) {
    if (String(col[i][0] == null ? '' : col[i][0]).trim().toLowerCase() === key) {
      return i + 2;
    }
  }
  return -1;
}

// Reads the caller's own row (columns A..J) and returns its non-empty
// nominee pairs, or null if the row does not exist / has no pairs.
function readOwnPicks_(sheet, email) {
  var row = findRowByEmail_(sheet, email);
  if (row < 0) return null;
  var vals = sheet.getRange(row, 1, 1, 2 + MAX_NOMINEES_ * 2).getValues()[0];
  var picks = [];
  for (var i = 0; i < MAX_NOMINEES_; i++) {
    var first = cleanName_(vals[2 + i * 2]);
    var last = cleanName_(vals[3 + i * 2]);
    if (first && last) picks.push({ first: first, last: last });
  }
  return picks.length ? picks : null;
}

// ---------------------------------------------------------------------
// Name normalization / validation
// ---------------------------------------------------------------------

// Coerce to string, turn tabs/newlines into spaces, strip the remaining control
// chars, collapse whitespace, trim. ("Maya\tChen" -> "Maya Chen", not "MayaChen".)
function cleanName_(v) {
  if (v == null) return '';
  // Only strings and numbers are meaningful names; objects/arrays/booleans
  // sent by a tampered client are treated as empty rather than stringified.
  if (typeof v !== 'string' && typeof v !== 'number') return '';
  var s;
  try { s = String(v); } catch (err) { s = ''; }
  try { s = s.normalize('NFKC'); } catch (err) { /* keep as is */ }
  s = s.replace(/\s/g, ' ');
  s = s.replace(/[\p{Cc}\p{Cf}]/gu, ''); // controls, zero-width, RTL/LTR overrides
  s = s.replace(/\s+/g, ' ');
  return s.trim();
}

// A name must START with a letter (so nothing can become a spreadsheet formula: = + - @) and
// contain only letters, accents, spaces, hyphens, apostrophes and periods.
var NAME_OK_ = /^\p{Script=Latin}[\p{Script=Latin}\p{M} .'\u2019-]*$/u;

// Key used for duplicate detection: letters only, accents folded, lowercase
// ("José O'Brien" == "jose obrien").
function normName_(first, last) {
  return (cleanName_(first) + cleanName_(last)).normalize('NFD')
    .replace(/\p{M}/gu, '').replace(/[^A-Za-z]/g, '').toLowerCase();
}

function isArray_(v) {
  return Object.prototype.toString.call(v) === '[object Array]';
}

// Returns { ok: true, nominees: [{first,last}...] } or { ok: false, message }.
function validateNominees_(raw) {
  if (!isArray_(raw)) {
    return { ok: false, message: 'Please add at least one nominee (first and last name).' };
  }
  if (raw.length < 1) {
    return { ok: false, message: 'Please add at least one nominee (first and last name).' };
  }
  if (raw.length > MAX_NOMINEES_) {
    return { ok: false, message: 'You can nominate up to ' + MAX_NOMINEES_ + ' people.' };
  }

  var out = [];
  var seen = {};
  for (var i = 0; i < raw.length; i++) {
    var item = raw[i];
    var first = '';
    var last = '';
    if (item && typeof item === 'object') {
      first = cleanName_(item.first);
      last = cleanName_(item.last);
    }
    var n = i + 1;
    if (!first || !last) {
      return { ok: false, message: 'Nominee ' + n + ' needs both a first and a last name.' };
    }
    if (first.length > MAX_NAME_LEN_ || last.length > MAX_NAME_LEN_) {
      return { ok: false, message: 'Nominee ' + n + ': names must be ' + MAX_NAME_LEN_ + ' characters or fewer.' };
    }
    if (!NAME_OK_.test(first) || !NAME_OK_.test(last)) {
      return { ok: false, message: 'Nominee ' + n + ': use letters only (spaces, hyphens, apostrophes and periods are fine).' };
    }
    var key = normName_(first, last);
    if (Object.prototype.hasOwnProperty.call(seen, key)) {
      return { ok: false, message: 'You listed ' + seen[key] + ' more than once. Each nominee can only appear one time.' };
    }
    seen[key] = first + ' ' + last;
    out.push({ first: first, last: last });
  }
  return { ok: true, nominees: out };
}

// ---------------------------------------------------------------------
// Public API (called via google.script.run from Index.html)
// ---------------------------------------------------------------------

// Everything the page needs to render its initial state. `existing` is
// ONLY the caller's own row; other students' rows are never returned.
function getState() {
  return stateFor_(getIdentity_());
}

function stateFor_(id) {
  var config = readConfig_();
  var existing = null;
  if (id.signedIn) {
    try {
      var nb = nomBook_();
      var sh = nb && nb.getSheetByName(tabNameForMode_(config.mode));
      if (sh) existing = readOwnPicks_(sh, id.email);
    } catch (err) {
      return { ok: false, error: 'busy',
        message: 'Couldn\'t check your nominations right now. Please try again in a moment.' };
    }
  }
  return {
    signedIn: id.signedIn,
    email: id.signedIn ? id.email : '',
    config: { open: config.open, mode: config.mode, cycle: config.cycle, deadline: config.deadline },
    existing: existing
  };
}

// Save the caller's nominations (one row per student; a change overwrites it).
function submitNominations(nominees) {
  return submitFor_(getIdentity_(), nominees);
}

function submitFor_(id, nominees) {
  if (!id.email) {
    return { ok: false, error: 'not-signed-in',
      message: 'You need to be signed in to your school Google account to nominate.' };
  }
  if (!id.signedIn) {
    return { ok: false, error: 'wrong-domain',
      message: 'Please sign in with your @student.fuhsd.org account to nominate.' };
  }

  var config = readConfig_();
  if (!config.open) {
    return { ok: false, error: 'closed',
      message: 'Nominations are not open right now.' };
  }

  var v = validateNominees_(nominees);
  if (!v.ok) {
    return { ok: false, error: 'invalid', message: v.message };
  }

  // Open the spreadsheet BEFORE taking the lock so the locked section stays short.
  var tabName = tabNameForMode_(config.mode);
  var sh;
  try {
    var nb = nomBook_();
    sh = nb && nb.getSheetByName(tabName);
  } catch (err) {
    return { ok: false, error: 'busy',
      message: 'Couldn\'t save right now. Please try again in a moment.' };
  }
  if (!sh) {
    return { ok: false, error: 'no-tab',
      message: 'The "' + tabName + '" tab is missing from the spreadsheet. Please tell ASB.' };
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
  } catch (err) {
    return { ok: false, error: 'busy',
      message: 'The server is busy right now. Please try again in a moment.' };
  }

  try {

    var row = [new Date(), id.email];
    for (var i = 0; i < MAX_NOMINEES_; i++) {
      if (i < v.nominees.length) {
        row.push(v.nominees[i].first);
        row.push(v.nominees[i].last);
      } else {
        row.push('');
        row.push('');
      }
    }

    // ONE row per student. A student may change their picks until nominations close: the new set
    // OVERWRITES their row (under the script lock, so two saves can't create two rows), and only
    // the latest set counts. After the deadline config.open is false and we never get here.
    var existingRow = findRowByEmail_(sh, id.email);
    var at = existingRow > 0 ? existingRow : sh.getLastRow() + 1;
    // Names are stored as plain text, never interpreted (dates, numbers, formulas).
    sh.getRange(at, 3, 1, row.length - 2).setNumberFormat('@');
    if (existingRow > 0) {
      sh.getRange(existingRow, 1, 1, row.length).setValues([row]);
      SpreadsheetApp.flush();
      return { ok: true, replaced: true };
    }
    sh.getRange(at, 1, 1, row.length).setValues([row]);
    SpreadsheetApp.flush();
    return { ok: true, replaced: false };
  } catch (err) {
    // Sheet exception (not the lock). Same contract code, distinct message for triage.
    return { ok: false, error: 'busy',
      message: 'Couldn\'t save right now. Please try again in a moment.' };
  } finally {
    try { lock.releaseLock(); } catch (err2) { /* ignore */ }
  }
}
