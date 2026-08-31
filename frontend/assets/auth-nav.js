// Site-wide login state (P1). If a valid session exists, turn the header
// "Log in" link into an "Account" link. Network only via window.__bmaAuth
// (local-llm.js). No fetch, no innerHTML here.
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var token = null;
    try { token = sessionStorage.getItem('bma-session'); } catch (e) { token = null; }
    if (!token || !window.__bmaAuth || typeof window.__bmaAuth.me !== 'function') return;

    var link = document.querySelector('a[href="signup.html?mode=login"]');
    if (!link) return;

    window.__bmaAuth.me(token, function (err, res) {
      // Fail closed / offline: on any error or non-OK response, leave "Log in".
      if (err || !res || res.status !== 200 || !res.json || !res.json.ok) return;

      // Confirmed session: turn the login control into an Account link.
      var apply = function () {
        var label = (typeof t === 'function') ? t('Account', '账号') : 'Account';
        link.setAttribute('href', 'account.html');
        link.setAttribute('data-en', 'Account');
        link.setAttribute('data-zh', '账号');
        link.textContent = label;
      };
      apply();
      // Keep the label correct across language switches (only while logged in).
      // i18n.js dispatches 'langchange' on `document` (bubbles:false), so the
      // listener must be on document — a window listener would never fire.
      document.addEventListener('langchange', apply);
    });
  });
})();
