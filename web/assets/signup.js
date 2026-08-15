// Build My AI — signup (beta). Reads ?plan=pro|business, shows the right fields.
// Static demo: no backend, no data echoed into innerHTML (XSS-safe by construction).
(function () {
  function plan() {
    var p = (location.search.match(/[?&]plan=([a-z]+)/) || [])[1];
    return p === 'business' ? 'business' : 'pro';
  }
  var P = plan();

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

    var form = document.getElementById('signupForm');
    var fName = document.getElementById('fName');
    var fEmail = document.getElementById('fEmail');
    var fCompany = document.getElementById('fCompany');
    var errName = document.getElementById('errName');
    var errEmail = document.getElementById('errEmail');
    var errCompany = document.getElementById('errCompany');

    // Current validation state, so visible errors re-render on language toggle.
    var errs = { name: false, email: false, company: false };
    function renderErrs() {
      errName.textContent = errs.name ? t('Please enter your name.', '请填写姓名。') : '';
      errEmail.textContent = errs.email ? t('Please enter a valid email.', '请填写有效邮箱。') : '';
      errCompany.textContent = errs.company ? t('Company name is required for Business.', '企业版需填写公司名称。') : '';
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

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = fName.value.trim();
      var email = fEmail.value.trim();
      var company = fCompany.value.trim();
      errs.name = !name;
      errs.email = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      errs.company = isBiz && !company;
      renderErrs();
      mark(fName, errs.name);
      mark(fEmail, errs.email);
      mark(fCompany, errs.company);
      var firstBad = errs.name ? fName : (errs.email ? fEmail : (errs.company ? fCompany : null));
      if (firstBad) { firstBad.focus(); return; }

      // Success — NO user input is inserted into the DOM (avoids any injection).
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
    });
  });
})();
