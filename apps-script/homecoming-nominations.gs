/**
 * Homecoming Court Nominations — backend for the fremontasb.org in-page form.
 * Bound to the nominations Google Sheet (Extensions → Apps Script).
 *
 * TABS this spreadsheet must have:
 *   Config             — control cells (see layout below)
 *   Nominations        — real submissions (header in row 1)
 *   Test Submissions   — test submissions (same header)
 *
 * Config tab (column A = key, column B = value; any row order):
 *   open       yes | no          → shows / hides the form on the website
 *   mode       test | live       → which tab a submission is written to
 *   cycle      Homecoming 2026    → label shown on the page (optional)
 *   deadline   Fri, Oct 3         → shown on the page if set (optional)
 *
 * Header row (row 1) for BOTH Nominations and Test Submissions, in this order:
 *   Timestamp | Nominator Email | N1 First | N1 Last | N2 First | N2 Last | N3 First | N3 Last | N4 First | N4 Last
 *
 * DEPLOY: Deploy → New deployment → Web app → Execute as: Me,
 *   Who has access: Anyone. Copy the /exec URL into the site's sources.js
 *   (homecomingNominationsApi). Flipping open / test→live afterward is just a Config
 *   cell edit — NO redeploy needed. (Redeploy a NEW VERSION only if you edit THIS code.)
 */

function readConfig_() {
  var cfg = { open: false, mode: 'test', cycle: '', deadline: '' };
  var sh = SpreadsheetApp.getActive().getSheetByName('Config');
  if (!sh) return cfg;
  var values = sh.getDataRange().getValues();
  for (var i = 0; i < values.length; i++) {
    var key = String(values[i][0] || '').trim().toLowerCase();
    var val = String(values[i][1] == null ? '' : values[i][1]).trim();
    if (key === 'open') cfg.open = /^(yes|true|y|1|open)$/i.test(val);
    else if (key === 'mode') cfg.mode = /^live$/i.test(val) ? 'live' : 'test';
    else if (key === 'cycle') cfg.cycle = val;
    else if (key === 'deadline') cfg.deadline = val;
  }
  return cfg;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// GET — the website reads this to decide whether to show the form, and the cycle/deadline.
function doGet() {
  var c = readConfig_();
  return json_({ open: c.open, mode: c.mode, cycle: c.cycle, deadline: c.deadline });
}

// POST — append one nomination row. Called no-cors from the browser (response not read),
// so we return the same generic success whether the row was saved or dropped as a dup.
function doPost(e) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (err) { return json_({ ok: false, error: 'busy' }); }
  try {
    var c = readConfig_();
    if (!c.open) return json_({ ok: false, error: 'closed' });

    var p = (e && e.parameter) || {};
    var email = String(p.email || '').trim();
    if (!email) return json_({ ok: false, error: 'no-email' });

    var names = [];
    for (var i = 1; i <= 4; i++) {
      names.push(String(p['n' + i + 'First'] || '').trim());
      names.push(String(p['n' + i + 'Last'] || '').trim());
    }
    var hasOne = false;
    for (var j = 0; j < names.length; j += 2) { if (names[j] && names[j + 1]) { hasOne = true; break; } }
    if (!hasOne) return json_({ ok: false, error: 'no-nominees' });

    var tabName = c.mode === 'live' ? 'Nominations' : 'Test Submissions';
    var sh = SpreadsheetApp.getActive().getSheetByName(tabName);
    if (!sh) return json_({ ok: false, error: 'no-tab:' + tabName });

    // Best-effort dedup: one submission per email per tab. Column B (index 2) holds the email.
    var key = email.toLowerCase();
    var last = sh.getLastRow();
    if (last >= 2) {
      var existing = sh.getRange(2, 2, last - 1, 1).getValues();
      for (var k = 0; k < existing.length; k++) {
        if (String(existing[k][0] || '').trim().toLowerCase() === key) {
          return json_({ ok: true, dedup: true }); // silently drop; site shows generic success
        }
      }
    }

    sh.appendRow([new Date(), email].concat(names));
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) { /* ignore */ }
  }
}
