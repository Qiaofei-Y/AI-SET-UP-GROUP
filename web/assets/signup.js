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
    // plan label
    var pill = document.getElementById('planPill');
    if (pill) pill.textContent = isBiz ? t('Business plan', '企业版') : t('Pro plan', '专业版');
    // company field only for business
    var companyField = document.getElementById('companyField');
    if (companyField) companyField.style.display = isBiz ? '' : 'none';

    var form = document.getElementById('signupForm');
    var errName = document.getElementById('errName');
    var errEmail = document.getElementById('errEmail');
    var errCompany = document.getElementById('errCompany');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      errName.textContent = errEmail.textContent = errCompany.textContent = '';
      var name = document.getElementById('fName').value.trim();
      var email = document.getElementById('fEmail').value.trim();
      var company = document.getElementById('fCompany').value.trim();
      var okAll = true;
      if (!name) { errName.textContent = t('Please enter your name.', '请填写姓名。'); okAll = false; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errEmail.textContent = t('Please enter a valid email.', '请填写有效邮箱。'); okAll = false; }
      if (isBiz && !company) { errCompany.textContent = t('Company name is required for Business.', '企业版需填写公司名称。'); okAll = false; }
      if (!okAll) return;

      // Success — NO user input is inserted into the DOM (avoids any injection).
      document.getElementById('formView').classList.add('hidden');
      var s = document.getElementById('successView');
      s.classList.remove('hidden');
      // greet by first name safely via textContent (never innerHTML)
      var greet = document.getElementById('successGreet');
      var first = name.split(/\s+/)[0].slice(0, 40);
      greet.textContent = t("You're on the beta list, " + first + "!", '你已加入 Beta 名单,' + first + '!');
    });
  });
})();
