// Build My AI — signup + login. Reads ?plan=pro|business and ?mode=login.
// Real auth via window.__bmaAuth (local-llm.js -> self-hosted API, users.db).
// When the API is unreachable both flows show an explicit error instead of
// pretending to succeed (P0-14: a silently dropped signup is data loss, a
// login that always passes is a fake). No user input into innerHTML, ever.
(function () {
  function plan() {
    var p = (location.search.match(/[?&]plan=([a-z]+)/) || [])[1];
    return p === 'business' ? 'business' : 'pro';
  }
  var P = plan();
  var LOGIN = /[?&]mode=login\b/.test(location.search);

  // swap a bilingual label: attributes keep langchange working, textContent shows now
  function relabel(id, en, zh) {
    var el = document.getElementById(id);
    if (!el) return;
    el.setAttribute('data-en', en);
    el.setAttribute('data-zh', zh);
    el.textContent = t(en, zh);
  }

  function hide(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  }

  document.addEventListener('DOMContentLoaded', function () {
    var isBiz = P === 'business';
    // plan label (re-set on every language toggle)
    var pill = document.getElementById('planPill');
    function setPill() {
      if (pill) pill.textContent = isBiz ? t('Business plan', '企业版') : t('Pro plan', '专业版');
    }
    setPill();
    // company field only for business
    var companyField = document.getElementById('companyField');
    if (companyField) companyField.style.display = isBiz ? '' : 'none';

    if (LOGIN) {
      relabel('suEyebrow', 'LOG IN', '登录');
      relabel('suTitle', 'Welcome back', '欢迎回来');
      relabel('suLead', 'Log in with the email you used for the beta.', '用你注册 Beta 时的邮箱登录。');
      relabel('suSubmit', 'Log in', '登录');
      var titleEl = document.querySelector('title');
      if (titleEl) {
        titleEl.setAttribute('data-en', 'Build My AI — Log in');
        titleEl.setAttribute('data-zh', 'Build My AI — 登录');
      }
      document.title = t('Build My AI — Log in', 'Build My AI — 登录');
      hide('planPill'); hide('betaNote'); hide('nameField'); hide('companyField'); hide('privacyLine');
      hide('agreeField'); // clickwrap is a signup-time consent; login re-accepts nothing
      document.getElementById('altSignup').classList.add('hidden');
      document.getElementById('altLogin').classList.remove('hidden');
    }

    var form = document.getElementById('signupForm');
    var fName = document.getElementById('fName');
    var fEmail = document.getElementById('fEmail');
    var fCompany = document.getElementById('fCompany');
    var fPassword = document.getElementById('fPassword');
    var errName = document.getElementById('errName');
    var errEmail = document.getElementById('errEmail');
    var errCompany = document.getElementById('errCompany');
    var errPassword = document.getElementById('errPassword');
    var errForm = document.getElementById('errForm');
    var fAgree = document.getElementById('fAgree');
    var errAgree = document.getElementById('errAgree');
    if (LOGIN && fPassword) fPassword.setAttribute('autocomplete', 'current-password');

    // Current validation state, so visible errors re-render on language toggle.
    var errs = { name: false, email: false, company: false, password: false, agree: false,
                 emailTaken: false, badCred: false, api: false, throttled: false };
    function renderErrs() {
      errName.textContent = errs.name ? t('Please enter your name.', '请填写姓名。') : '';
      errEmail.textContent = errs.email ? t('Please enter a valid email.', '请填写有效邮箱。')
        : (errs.emailTaken ? t('This email is already registered — log in instead.', '该邮箱已注册,请直接登录。') : '');
      errCompany.textContent = errs.company ? t('Company name is required for Business.', '企业版需填写公司名称。') : '';
      errPassword.textContent = errs.password ? t('Password must be at least 8 characters.', '密码至少 8 位。')
        : (errs.badCred ? t('Email or password is incorrect.', '邮箱或密码不正确。') : '');
      errAgree.textContent = errs.agree
        ? t('Please accept the Terms of Service and Privacy Policy to continue.', '请先勾选同意服务条款与隐私政策。') : '';
      errForm.textContent = errs.api
        ? t("Can't reach the account service right now — please try again in a moment.",
            '暂时连不上账号服务,请稍后重试。')
        : (errs.throttled ? t('Too many attempts — please wait a minute and try again.',
                              '尝试次数过多,请稍等一分钟再试。') : '');
    }
    function mark(input, bad) {
      if (bad) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }

    // Keep pill + any visible errors in the active language.
    document.addEventListener('langchange', function () {
      setPill();
      renderErrs();
    });

    // Success — NO user input is inserted into the DOM (avoids any injection).
    function showSuccess(name) {
      document.getElementById('formView').classList.add('hidden');
      var s = document.getElementById('successView');
      s.classList.remove('hidden');
      // greet by first name safely via textContent (never innerHTML)
      var greet = document.getElementById('successGreet');
      var first = name.split(/\s+/)[0].slice(0, 40);
      var greetEn = "You're on the beta list, " + first + '!';
      var greetZh = '你已加入 Beta 名单,' + first + '!';
      greet.textContent = t(greetEn, greetZh);
      // keep the personalized greeting across language toggles
      // (setAttribute + textContent only — never innerHTML)
      greet.setAttribute('data-en', greetEn);
      greet.setAttribute('data-zh', greetZh);
    }

    function rememberSession(res) {
      // session-scoped only (cleared when the tab closes); token comes from
      // the local API and never leaves this machine
      try {
        sessionStorage.setItem('bma-session', res.json.token);
        sessionStorage.setItem('bma-user', res.json.user.name);
      } catch (ignore) { /* private mode: still works, just not remembered */ }
    }

    var busy = false;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;
      var name = fName.value.trim();
      var email = fEmail.value.trim();
      var company = fCompany.value.trim();
      var password = fPassword.value;
      errs.name = !LOGIN && !name;
      errs.email = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      errs.company = !LOGIN && isBiz && !company;
      errs.password = password.length < 8;
      errs.agree = !LOGIN && !(fAgree && fAgree.checked); // clickwrap: consent is required to sign up
      errs.emailTaken = false;
      errs.badCred = false;
      errs.api = false;
      errs.throttled = false;
      renderErrs();
      mark(fName, errs.name);
      mark(fEmail, errs.email);
      mark(fCompany, errs.company);
      mark(fPassword, errs.password);
      var firstBad = errs.name ? fName : (errs.email ? fEmail
        : (errs.company ? fCompany : (errs.password ? fPassword : (errs.agree ? fAgree : null))));
      if (firstBad) { firstBad.focus(); return; }

      var auth = window.__bmaAuth;

      // No fake pass in either direction (P0-14): if the API can't confirm it,
      // the UI reports it — a login must never "succeed" offline, a signup must
      // never claim success while the data was dropped.
      if (LOGIN) {
        if (!auth) { errs.api = true; renderErrs(); return; }
        busy = true;
        auth.login({ email: email, password: password }, function (err, res) {
          busy = false;
          if (err) { errs.api = true; renderErrs(); return; }
          if (res.status === 200 && res.json.ok) {
            rememberSession(res);
            location.href = 'dashboard.html';
            return;
          }
          if (res.status === 429) { errs.throttled = true; renderErrs(); return; }
          errs.badCred = true;
          renderErrs();
          fPassword.focus();
        });
        return;
      }

      if (!auth) { errs.api = true; renderErrs(); return; }
      var body = { name: name, email: email, password: password,
                   plan: isBiz ? 'business' : 'pro',
                   accept_tos: true }; // clickwrap checked (validated above); server records the version
      if (isBiz) body.company = company;
      busy = true;
      auth.signup(body, function (err, res) {
        busy = false;
        if (err) { errs.api = true; renderErrs(); return; }
        if (res.status === 200 && res.json.ok) {
          rememberSession(res);
          showSuccess(name);
          return;
        }
        if (res.status === 409) {
          errs.emailTaken = true;
          renderErrs();
          mark(fEmail, true);
          fEmail.focus();
          return;
        }
        if (res.status === 429) { errs.throttled = true; renderErrs(); return; }
        errs.api = true; // unexpected server shape: error out honestly
        renderErrs();
      });
    });
  });
})();
