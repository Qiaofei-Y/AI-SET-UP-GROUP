// Build My AI — checkout return page (checkout-success.html).
// After Stripe redirects back, the subscription is applied server-side by the
// webhook, which can lag the redirect by a moment. So we poll /v1/auth/me (via
// window.__bmaAuth — the only network-capable file) until the plan reflects the
// purchase, then reveal the "go to your Control Center" CTA. Never fakes an
// upgrade: if the plan hasn't flipped yet we say it will update shortly, not
// that it's done. All text via textContent; visible strings re-render on langchange.
(function () {
  var TRIES = 6, DELAY_MS = 2000;   // ~12s of polling; the webhook is usually near-instant

  function planLabel(plan) {
    if (plan === 'business') return ['Business', '企业版'];
    if (plan === 'pro') return ['Pro', '专业版'];
    return ['Free', '免费版'];
  }

  document.addEventListener('DOMContentLoaded', function () {
    var statusEl = document.getElementById('checkoutPoll');
    if (!statusEl) return;   // not the success page
    var done = document.getElementById('checkoutDone');
    var state = { key: 'checking', plan: null };

    function render() {
      var en, zh;
      if (state.key === 'checking') { en = 'Confirming your subscription…'; zh = '正在确认你的订阅…'; }
      else if (state.key === 'active') {
        var lbl = planLabel(state.plan);
        en = "Payment received — you're on the " + lbl[0] + ' plan now. Thank you!';
        zh = '支付成功——你已升级到' + lbl[1] + ',谢谢!';
      } else if (state.key === 'pending') {
        en = 'Payment received. Your plan will update here in a moment.';
        zh = '支付成功。你的套餐稍后会在此更新。';
      } else { // offline / not logged in — still honest, no fake unlock
        en = 'Payment received. Sign in to your Control Center to see your updated plan.';
        zh = '支付成功。登录控制中心即可查看已更新的套餐。';
      }
      statusEl.setAttribute('data-en', en);
      statusEl.setAttribute('data-zh', zh);
      statusEl.textContent = t(en, zh);
      // the Control Center CTA is always safe to offer once we're off "checking"
      if (done) done.classList.toggle('hidden', state.key === 'checking');
    }
    document.addEventListener('langchange', render);
    render();

    var token = null;
    try { token = sessionStorage.getItem('bma-session'); } catch (ignore) {}
    if (!token || !window.__bmaAuth) { state.key = 'signedout'; render(); return; }

    var left = TRIES;
    function poll() {
      window.__bmaAuth.me(token, function (err, res) {
        if (err) { state.key = 'signedout'; render(); return; }  // offline: stop, be honest
        var plan = res && res.json && res.json.user && res.json.user.plan;
        if (res.status === 200 && plan && plan !== 'free') {
          state.key = 'active'; state.plan = plan; render(); return;
        }
        if (--left > 0) { setTimeout(poll, DELAY_MS); return; }
        state.key = 'pending'; render();   // webhook hasn't landed yet — say so truthfully
      });
    }
    poll();
  });
})();
