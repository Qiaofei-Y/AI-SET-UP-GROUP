// Build My AI — account recovery & email verification (P0-15).
// One flow family across three pages: forgot-password.html (request a reset
// link), reset-password.html (spend it), verify-email.html (confirm an email).
// Network ONLY via window.__bmaAuth (local-llm.js is the sole network-capable
// file — this file never fetches). No user input ever reaches innerHTML: all
// text is written via textContent, and visible strings re-render on langchange.
(function () {
  // one-time link tokens are 48 hex chars (server: secrets.token_hex(24)); a
  // value that doesn't match is a broken link — handled without calling the API
  function urlToken() {
    return (location.search.match(/[?&]token=([0-9a-f]{48})/) || [])[1] || '';
  }

  function show(id) { var el = document.getElementById(id); if (el) el.classList.remove('hidden'); }
  function hide(id) { var el = document.getElementById(id); if (el) el.classList.add('hidden'); }
  // Move focus to a freshly-revealed view so screen-reader / keyboard users land
  // on the new content (a11y: focus follows the view swap). Targets the heading if
  // present, else the container; makes it programmatically focusable first.
  function focusView(id) {
    var el = document.getElementById(id);
    if (!el) return;
    var target = el.querySelector('h1, h2, [role="alert"]') || el;
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    try { target.focus(); } catch (e) {}
  }
  function txt(id, en, zh) {  // set bilingual text via textContent, keep attrs for langchange
    var el = document.getElementById(id);
    if (!el) return;
    el.setAttribute('data-en', en);
    el.setAttribute('data-zh', zh);
    el.textContent = t(en, zh);
  }

  var OFFLINE_EN = "Can't reach the account service right now — please try again in a moment.";
  var OFFLINE_ZH = '暂时连不上账号服务,请稍后重试。';
  var THROTTLED_EN = 'Too many attempts — please wait a minute and try again.';
  var THROTTLED_ZH = '尝试次数过多,请稍等一分钟再试。';

  document.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('forgotForm')) initForgot();
    else if (document.getElementById('resetForm')) initReset();
    else if (document.getElementById('verifyStatus')) initVerify();
  });

  // ---- forgot: request a reset link. Constant confirmation UI — the page must
  //      not reveal whether an account exists, matching the server (no enumeration) ----
  function initForgot() {
    var form = document.getElementById('forgotForm');
    var fEmail = document.getElementById('fEmail');
    var errEmail = document.getElementById('errEmail');
    var errForm = document.getElementById('errForm');
    var errs = { email: false, api: false, throttled: false };
    function render() {
      errEmail.textContent = errs.email ? t('Please enter a valid email.', '请填写有效邮箱。') : '';
      errForm.textContent = errs.api ? t(OFFLINE_EN, OFFLINE_ZH)
        : (errs.throttled ? t(THROTTLED_EN, THROTTLED_ZH) : '');
    }
    document.addEventListener('langchange', render);
    var busy = false;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;
      var email = fEmail.value.trim();
      errs.email = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      errs.api = false; errs.throttled = false;
      render();
      if (errs.email) { fEmail.focus(); return; }
      if (!window.__bmaAuth) { errs.api = true; render(); return; }
      busy = true;
      window.__bmaAuth.forgot({ email: email }, function (err, res) {
        busy = false;
        if (err) { errs.api = true; render(); return; }
        if (res.status === 429) { errs.throttled = true; render(); return; }
        // any real answer (the server returns a constant 200 either way): show
        // the same confirmation and reveal nothing about the account's existence
        hide('formView'); show('sentView'); focusView('sentView');
      });
    });
  }

  // ---- reset: spend the emailed token to set a new password ----
  function initReset() {
    var token = urlToken();
    if (!token) {  // missing/broken link: don't call the API, point back to forgot
      hide('formView'); show('invalidView'); focusView('invalidView');
      return;
    }
    var form = document.getElementById('resetForm');
    var fPassword = document.getElementById('fPassword');
    var fConfirm = document.getElementById('fConfirm');
    var errPassword = document.getElementById('errPassword');
    var errConfirm = document.getElementById('errConfirm');
    var errForm = document.getElementById('errForm');
    var errs = { password: false, confirm: false, api: false, throttled: false, expired: false };
    function render() {
      errPassword.textContent = errs.password ? t('Password must be at least 8 characters.', '密码至少 8 位。') : '';
      errConfirm.textContent = errs.confirm ? t('Passwords do not match.', '两次输入的密码不一致。') : '';
      errForm.textContent = errs.api ? t(OFFLINE_EN, OFFLINE_ZH)
        : (errs.throttled ? t(THROTTLED_EN, THROTTLED_ZH)
          : (errs.expired ? t('This reset link is invalid or has expired. Request a new one.',
                             '此重置链接无效或已过期,请重新申请。') : ''));
    }
    document.addEventListener('langchange', render);
    var busy = false;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;
      var pw = fPassword.value, confirm = fConfirm.value;
      errs.password = pw.length < 8;
      errs.confirm = !errs.password && pw !== confirm;
      errs.api = false; errs.throttled = false; errs.expired = false;
      render();
      var firstBad = errs.password ? fPassword : (errs.confirm ? fConfirm : null);
      if (firstBad) { firstBad.focus(); return; }
      if (!window.__bmaAuth) { errs.api = true; render(); return; }
      busy = true;
      window.__bmaAuth.reset({ token: token, new_password: pw }, function (err, res) {
        busy = false;
        if (err) { errs.api = true; render(); return; }
        if (res.status === 200 && res.json && res.json.ok) {
          hide('formView'); show('successView'); focusView('successView');
          return;
        }
        if (res.status === 429) { errs.throttled = true; render(); return; }
        // 400 invalid_token (expired / already used / unknown) or any other shape
        errs.expired = true; render();
      });
    });
  }

  // ---- verify: confirm the email by spending the token, on page load ----
  function initVerify() {
    var state = 'checking';
    function render() {
      var m = {
        checking: ['Verifying your email…', '正在验证你的邮箱…'],
        ok:       ['Your email is verified. Thanks!', '你的邮箱已验证成功,谢谢!'],
        invalid:  ['This verification link is invalid or has expired.', '此验证链接无效或已过期。'],
        offline:  [OFFLINE_EN, OFFLINE_ZH],
        throttled:[THROTTLED_EN, THROTTLED_ZH]
      }[state];
      txt('verifyStatus', m[0], m[1]);
      // the success call-to-action only makes sense once verified
      if (state === 'ok') show('verifyDone'); else hide('verifyDone');
    }
    document.addEventListener('langchange', render);
    render();
    // announce the terminal outcome to SR/keyboard users (once, not on langchange)
    function settle(s) { state = s; render(); focusView('verifyStatus'); }
    var token = urlToken();
    if (!token) { settle('invalid'); return; }
    if (!window.__bmaAuth) { settle('offline'); return; }
    window.__bmaAuth.verify({ token: token }, function (err, res) {
      if (err) { settle('offline'); return; }
      if (res.status === 200 && res.json && res.json.verified) { settle('ok'); return; }
      if (res.status === 429) { settle('throttled'); return; }
      settle('invalid');
    });
  }
})();
