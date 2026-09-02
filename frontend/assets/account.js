// Account settings controller (account.html). The only network path in the whole
// site is assets/local-llm.js — this file NEVER calls fetch; it talks to the
// local API exclusively through window.__bmaAuth / window.__bmaConsent.
//
// The login gate is visible by default and is removed ONLY on a verified session:
// no session, an expired/rotated token, a 401 or an offline API all keep the page
// gated (P0-14: no fake pass into account UI). All rendering is textContent + data
// attributes — never innerHTML — and bilingual strings carry data-en/data-zh so
// i18n.js re-renders them on the 'langchange' event.
(function () {
  var gate = document.getElementById('loginGate');
  var token = null;
  try { token = sessionStorage.getItem('bma-session'); } catch (ignore) {}

  function clearSession() {
    try {
      sessionStorage.removeItem('bma-session');
      sessionStorage.removeItem('bma-user');
    } catch (ignore) {}
  }
  function showGate() { gate.classList.remove('hidden'); }
  function hideGate() { gate.classList.add('hidden'); }

  // bilingual message renderer: stamp data-en/data-zh so i18n re-renders on toggle
  function setMsg(id, en, zh, good) {
    var el = document.getElementById(id);
    if (!el) return;
    el.setAttribute('data-en', en);
    el.setAttribute('data-zh', zh);
    el.textContent = t(en, zh);
    el.classList.toggle('good', !!good);
  }
  function clearMsg(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.removeAttribute('data-en');
    el.removeAttribute('data-zh');
    el.textContent = '';
    el.classList.remove('good');
  }

  var OFFLINE_EN = "Can't reach the account service — try again in a moment.";
  var OFFLINE_ZH = '暂时连不上账号服务,请稍后重试。';
  var acctBusy = false; // one in-flight account action at a time — no double-click races
  function pwShape(v) { return v.length >= 8 && v.length <= 128; }
  function emailShape(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

  // shared non-success renderer: 401 fails closed back to the gate (P0-14),
  // 429 says throttled, everything else is honestly "unreachable".
  function renderErr(id, res, badEn, badZh) {
    if (res && res.status === 401) { clearSession(); showGate(); return; }
    if (res && res.status === 403) { setMsg(id, badEn, badZh); return; }
    if (res && res.status === 429) {
      setMsg(id, 'Too many attempts — wait a minute and try again.', '尝试次数过多,请稍等一分钟再试。');
      return;
    }
    setMsg(id, OFFLINE_EN, OFFLINE_ZH);
  }

  // ---- profile rendering (name / email / verified badge) ----
  function setBilingual(id, en, zh) {
    var el = document.getElementById(id);
    if (!el) return;
    el.setAttribute('data-en', en);
    el.setAttribute('data-zh', zh);
    el.textContent = t(en, zh);
  }
  function renderVerified(verified) {
    var badge = document.getElementById('profVerified');
    if (!badge) return;
    if (verified) {
      badge.className = 'badge teal';
      setBilingual('profVerified', '✓ Verified', '✓ 已验证');
    } else {
      badge.className = 'badge gray';
      setBilingual('profVerified', 'Unverified — check your inbox', '未验证——请查收邮件');
    }
  }
  function renderProfile(u) {
    var name = String(u.name || '').slice(0, 80);
    var email = String(u.email || '');
    document.getElementById('profName').textContent = name;
    document.getElementById('profEmail').textContent = email;
    renderVerified(!!u.email_verified);
  }

  // ---- session bootstrap: fail closed unless /v1/auth/me confirms the token ----
  if (!token || !window.__bmaAuth) { showGate(); }
  else {
    window.__bmaAuth.me(token, function (err, res) {
      if (err || res.status !== 200 || !res.json.ok) { showGate(); return; } // offline/expired
      renderProfile(res.json.user);
      hideGate();
    });
  }

  // ---- log out (this device) ----
  var logoutBtn = document.getElementById('acctLogout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      if (token && window.__bmaAuth) window.__bmaAuth.logout(token, function () {});
      clearSession();
      showGate();
    });
  }

  // ---- change email ----
  document.getElementById('emBtn').addEventListener('click', function () {
    var nw = document.getElementById('emNew'), pw = document.getElementById('emPw');
    if (!emailShape(nw.value)) {
      setMsg('emMsg', 'Enter a valid email address.', '请输入有效的邮箱地址。');
      return;
    }
    if (!pwShape(pw.value)) {
      setMsg('emMsg', 'Enter your current password to confirm.', '请输入当前密码以确认。');
      return;
    }
    if (acctBusy) return;
    acctBusy = true;
    clearMsg('emMsg');
    window.__bmaAuth.changeEmail(token, { password: pw.value, new_email: nw.value },
      function (err, res) {
        acctBusy = false;
        if (err) { setMsg('emMsg', OFFLINE_EN, OFFLINE_ZH); return; }
        if (res.status === 200 && res.json.ok) {
          document.getElementById('profEmail').textContent = String(res.json.email || nw.value);
          renderVerified(false); // a fresh email is always unverified until confirmed
          nw.value = ''; pw.value = '';
          setMsg('emMsg',
            "Verification sent to your new email. It's unverified until you confirm.",
            '验证邮件已发送到你的新邮箱,确认前为未验证状态。', true);
          return;
        }
        if (res.status === 409) {
          setMsg('emMsg', 'That email is already in use.', '该邮箱已被使用。');
          return;
        }
        renderErr('emMsg', res, 'Current password is incorrect.', '当前密码不正确。');
      });
  });

  // ---- change password (mirror dashboard: adopt the rotated token on 200) ----
  document.getElementById('pwBtn').addEventListener('click', function () {
    var cur = document.getElementById('pwCur'), nw = document.getElementById('pwNew');
    if (!pwShape(cur.value) || !pwShape(nw.value)) {
      setMsg('pwMsg', 'Passwords must be 8–128 characters.', '密码需为 8–128 位。');
      return;
    }
    if (acctBusy) return;
    acctBusy = true;
    clearMsg('pwMsg');
    window.__bmaAuth.changePassword(token, { current_password: cur.value, new_password: nw.value },
      function (err, res) {
        acctBusy = false;
        if (err) { setMsg('pwMsg', OFFLINE_EN, OFFLINE_ZH); return; }
        if (res.status === 200 && res.json.ok) {
          // the server rotated every session, including this one — adopt the new token
          if (res.json.token) {
            token = res.json.token;
            try { sessionStorage.setItem('bma-session', token); } catch (ignore) {}
          }
          cur.value = ''; nw.value = '';
          setMsg('pwMsg', 'Password changed — all other devices were signed out.',
                 '密码已修改——其他所有设备已退出登录。', true);
          return;
        }
        renderErr('pwMsg', res, 'Current password is incorrect.', '当前密码不正确。');
      });
  });

  // ---- export my data (Blob download) ----
  document.getElementById('exportBtn').addEventListener('click', function () {
    if (acctBusy) return;
    acctBusy = true;
    clearMsg('acctMsg');
    window.__bmaAuth.exportData(token, function (err, res) {
      acctBusy = false;
      if (err) { setMsg('acctMsg', OFFLINE_EN, OFFLINE_ZH); return; }
      if (res.status !== 200 || !res.json.ok) {
        renderErr('acctMsg', res, OFFLINE_EN, OFFLINE_ZH);
        return;
      }
      var blob = new Blob([JSON.stringify(res.json, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'build-my-ai-account-data.json';
      document.body.appendChild(a); a.click();
      setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
      setMsg('acctMsg', 'Your data was downloaded as build-my-ai-account-data.json.',
             '你的数据已下载为 build-my-ai-account-data.json。', true);
    });
  });

  // ---- sign out everywhere (fail closed either way) ----
  document.getElementById('outAllBtn').addEventListener('click', function () {
    if (acctBusy) return;
    acctBusy = true;
    clearMsg('acctMsg');
    window.__bmaAuth.logoutAll(token, function (err, res) {
      acctBusy = false;
      if (err) { setMsg('acctMsg', OFFLINE_EN, OFFLINE_ZH); return; }
      if (res.status === 200 || res.status === 401) { // revoked either way: fail closed
        clearSession();
        showGate();
        return;
      }
      renderErr('acctMsg', res, OFFLINE_EN, OFFLINE_ZH);
    });
  });

  // ---- delete account (reveal → confirm with password) ----
  var delConfirm = document.getElementById('delConfirm');
  document.getElementById('delBtn').addEventListener('click', function () {
    delConfirm.classList.toggle('hidden');
  });
  document.getElementById('delCancel').addEventListener('click', function () {
    delConfirm.classList.add('hidden');
    document.getElementById('delPw').value = '';
    clearMsg('delMsg');
  });
  document.getElementById('delGo').addEventListener('click', function () {
    var pw = document.getElementById('delPw');
    if (!pwShape(pw.value)) {
      setMsg('delMsg', 'Enter your password to confirm.', '请输入密码以确认。');
      return;
    }
    if (acctBusy) return;
    acctBusy = true;
    clearMsg('delMsg');
    window.__bmaAuth.deleteAccount(token, { password: pw.value }, function (err, res) {
      acctBusy = false;
      if (err) { setMsg('delMsg', OFFLINE_EN, OFFLINE_ZH); return; }
      if (res.status === 200 && res.json.deleted) {
        clearSession();
        showGate(); // the gate returns; the account no longer exists
        return;
      }
      renderErr('delMsg', res, 'Password is incorrect.', '密码不正确。');
    });
  });

  // ---- anonymous usage statistics: opt-in toggle (privacy.html) ----
  // Consent is device-local via window.__bmaConsent (local-llm.js); the toggle
  // just reflects and flips it. Nothing is sent until it's on.
  var usageToggle = document.getElementById('usageToggle');
  if (usageToggle && window.__bmaConsent) {
    usageToggle.checked = window.__bmaConsent.get();
    usageToggle.addEventListener('change', function () {
      window.__bmaConsent.set(usageToggle.checked);
      if (usageToggle.checked) setMsg('usageMsg', 'Thanks — anonymous statistics are on.', '谢谢——匿名统计已开启。', true);
      else setMsg('usageMsg', 'Anonymous statistics are off. Nothing is sent.', '匿名统计已关闭,不会发送任何数据。', true);
    });
  }
})();
