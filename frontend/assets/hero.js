// Hero product screenshot: stream the AI answer in like a live product.
// Owns #heroAnswer's text (no data-en, so i18n.js won't touch it); replays on language change.
(function () {
  var pending = [];
  function clearAll() { pending.forEach(clearTimeout); pending = []; if (window.__heroIv) { clearInterval(window.__heroIv); window.__heroIv = null; } }

  function run(lang) {
    var ans = document.getElementById('heroAnswer');
    var typing = document.getElementById('heroTyping');
    var cite = document.getElementById('heroCite');
    if (!ans || !typing || !cite) return;
    clearAll();

    var text = ans.getAttribute('data-' + (lang === 'zh' ? 'zh' : 'en') + '-msg') || '';
    // reset to "typing…" state
    ans.textContent = '';
    ans.style.display = 'none';
    ans.classList.remove('typing-caret');
    cite.style.display = 'none';
    cite.classList.remove('reveal');
    typing.style.display = 'inline-flex';

    // after a beat, hide dots and stream the answer
    pending.push(setTimeout(function () {
      typing.style.display = 'none';
      ans.style.display = '';
      ans.classList.add('typing-caret');
      var i = 0;
      window.__heroIv = setInterval(function () {
        i++;
        ans.textContent = text.slice(0, i);
        if (i >= text.length) {
          clearInterval(window.__heroIv); window.__heroIv = null;
          ans.classList.remove('typing-caret');
          cite.style.display = '';
          cite.classList.add('reveal');
        }
      }, 16);
    }, 950));
  }

  document.addEventListener('DOMContentLoaded', function () { run(window.__lang || 'en'); });
  document.addEventListener('langchange', function (e) { run(e.detail); });
})();
