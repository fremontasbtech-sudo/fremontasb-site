/**
 * Homecoming Court Nominations — Apps Script backend (Code.gs).
 * Bound to the nominations Google Sheet (Extensions → Apps Script).
 * Companion file: Index.html (the FUHSD-only nomination page).
 *
 * =====================================================================
 * HOW IDENTITY WORKS (the whole point — do not weaken this)
 * =====================================================================
 * The nominator is identified by Google Workspace itself, not by anything
 * typed into a form. There is NO email input anywhere.
 *
 *   - This project is owned by a FUHSD account and deployed as a Web App
 *     with  Execute as: Me (owner)  and  Who has access: Anyone within FUHSD.
 *   - Google forces the visitor to sign in to a FUHSD account before the
 *     page even loads.
 *   - Inside server functions, Session.getActiveUser().getEmail() returns
 *     the visitor's Google-verified email (same-Workspace exception: the
 *     owner and the visitor share the FUHSD Workspace, so the email is
 *     populated even though "Execute as: Me").
 *   - The server NEVER reads an email / name / identity claim from the
 *     client. Not from e.parameter, not from the nominees payload, not
 *     from anywhere. Defense in depth: the server also rejects an empty
 *     email or one that is not on an allowed domain
 *     (student.fuhsd.org, fuhsd.org).
 *
 * =====================================================================
 * TWO DEPLOYMENTS OF THIS ONE SCRIPT (same code, same Config tab)
 * =====================================================================
 *   1. PUBLIC CONFIG deployment  — Who has access: Anyone.
 *      The website (fremontasb.org) calls  <execUrl>?view=config  and gets
 *      JSON {open, mode, cycle, deadline}. That is all this deployment is
 *      for. If someone opens it without ?view=config it still renders the
 *      page, but Session.getActiveUser() is EMPTY for anonymous /
 *      out-of-domain visitors, so getState() reports signedIn:false and
 *      submitNominations() refuses with 'not-signed-in'. Nothing can be
 *      written through it.
 *      → paste its /exec URL into src/data/sources.js as homecomingNominationsApi
 *
 *   2. FUHSD-ONLY PAGE deployment — Who has access: Anyone within FUHSD.
 *      This /exec URL is the human nomination page the site links to.
 *      Submissions go through google.script.run from Index.html.
 *      → paste its /exec URL into src/data/sources.js as homecomingNominationsPage
 *
 *   Both: Deploy → New deployment → Web app → Execute as: Me.
 *   Redeploy a NEW VERSION only when Code.gs / Index.html change.
 *   Editing the Config tab (open, mode, cycle, deadline) needs NO redeploy.
 *
 * =====================================================================
 * SPREADSHEET LAYOUT (already exists — do not restructure)
 * =====================================================================
 * Tabs: Config, Nominations, Test Submissions.
 *
 * Config tab (column A = key, column B = value; any row order):
 *   open       yes | no          → whether submissions are accepted
 *   mode       test | live       → which tab a submission is written to
 *   cycle      Homecoming 2026    → label shown on the page (optional)
 *   deadline   Fri, Oct 3         → shown on the page if set (optional)
 *
 * Header row (row 1) for BOTH Nominations and Test Submissions, exact order:
 *   Timestamp | Nominator Email | N1 First | N1 Last | N2 First | N2 Last
 *             | N3 First | N3 Last | N4 First | N4 Last
 *
 * One row per student. Resubmitting UPSERTS: the student's existing row
 * (matched on column B, case-insensitive) is overwritten in place, so the
 * tab is already deduped when it is time to tally.
 */

// The spreadsheet holding the Config / Nominations / Test Submissions tabs. Set so this can run as a
// STANDALONE project owned by the school account (Google won't transfer ownership of a personal-Gmail
// Sheet to a school account, and it doesn't need to: the script only needs EDIT access to the Sheet).
// Leave '' only if this code is bound to the Sheet itself (Extensions -> Apps Script).
var SHEET_ID_ = '11Pm2zUc_O40E0oTZekYvsD_D8FenH9s7PiJ43m7JCH0';

function book_() {
  return SHEET_ID_ ? SpreadsheetApp.openById(SHEET_ID_) : SpreadsheetApp.getActive();
}

var ALLOWED_DOMAINS_ = ['student.fuhsd.org', 'fuhsd.org'];
var MAX_NOMINEES_ = 4;
var MAX_NAME_LEN_ = 60;

// ---------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------

function readConfig_() {
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
    else if (key === 'deadline') cfg.deadline = val;
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
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Homecoming Court Nominations')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

// POST is intentionally NOT a submission path. The old no-cors POST accepted
// an email from the request body; that would be an identity bypass. All
// submissions must go through google.script.run → submitNominations()
// from the FUHSD-only page, where identity comes from Session.
function doPost() {
  return json_({
    ok: false,
    error: 'use-page',
    message: 'Submissions are only accepted from the nomination page.'
  });
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
  email = email.trim().toLowerCase();
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
  s = s.replace(/[\t\n\r]/g, ' ');
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  s = s.replace(/\s+/g, ' ');
  return s.trim();
}

// Key used for duplicate detection: "first last", lowercase, single-spaced.
function normName_(first, last) {
  return (cleanName_(first) + ' ' + cleanName_(last)).replace(/\s+/g, ' ').trim().toLowerCase();
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
  var id = getIdentity_();
  var config = readConfig_();
  var existing = null;
  if (id.signedIn) {
    try {
      var sh = book_().getSheetByName(tabNameForMode_(config.mode));
      if (sh) existing = readOwnPicks_(sh, id.email);
    } catch (err) {
      existing = null;
    }
  }
  return {
    signedIn: id.signedIn,
    email: id.signedIn ? id.email : '',
    config: { open: config.open, mode: config.mode, cycle: config.cycle, deadline: config.deadline },
    existing: existing
  };
}

// Upsert the caller's nominations. Identity comes from Session only.
function submitNominations(nominees) {
  var id = getIdentity_();
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

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return { ok: false, error: 'busy',
      message: 'The server is busy right now. Please try again in a moment.' };
  }

  try {
    var tabName = tabNameForMode_(config.mode);
    var sh = book_().getSheetByName(tabName);
    if (!sh) {
      return { ok: false, error: 'no-tab',
        message: 'The "' + tabName + '" tab is missing from the spreadsheet. Please tell ASB.' };
    }

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

    var existingRow = findRowByEmail_(sh, id.email);
    if (existingRow > 0) {
      sh.getRange(existingRow, 1, 1, row.length).setValues([row]);
      return { ok: true, replaced: true };
    }
    sh.appendRow(row);
    return { ok: true, replaced: false };
  } catch (err) {
    // Sheet exception (not the lock). Same contract code, distinct message for triage.
    return { ok: false, error: 'busy',
      message: 'Couldn\'t save right now. Please try again in a moment.' };
  } finally {
    try { lock.releaseLock(); } catch (err2) { /* ignore */ }
  }
}
