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
function verifiedEmail_(credential) {
  if (typeof credential !== 'string' || credential.length < 100 || credential.length > 4096) return null;
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
  var fresh = Number(t.exp) * 1000 > Date.now();
  if (t.aud !== GOOGLE_CLIENT_ID_ || !issOk || !verified || !fresh) return null;
  return String(t.email || '').trim().toLowerCase();
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
  return stateFor_(getIdentity_());
}

function stateFor_(id) {
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
