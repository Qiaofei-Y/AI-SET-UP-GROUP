// Shared bilingual toggle. Default English; choice persists across pages.
(function () {
  function apply(lang) {
    lang = (lang === 'zh') ? 'zh' : 'en'; // normalize (localStorage may hold junk)
    document.documentElement.setAttribute('data-lang', lang);
    document.documentElement.setAttribute('lang', lang === 'zh' ? 'zh-CN' : 'en');
    document.querySelectorAll('[data-' + lang + ']').forEach(function (el) {
      var txt = el.getAttribute('data-' + lang);
      if (el.children.length > 0) {
        // Element has child elements (links, markers): swap only the first
        // non-empty text node so children survive the language toggle.
        for (var i = 0; i < el.childNodes.length; i++) {
          var node = el.childNodes[i];
          if (node.nodeType === 3 && /\S/.test(node.nodeValue)) {
            node.nodeValue = txt;
            break;
          }
        }
      } else {
        el.textContent = txt;
      }
    });
    document.querySelectorAll('[data-' + lang + '-ph]').forEach(function (el) {
      el.setAttribute('placeholder', el.getAttribute('data-' + lang + '-ph'));
    });
    document.querySelectorAll('.langbtn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-lang') === lang);
    });
    window.__lang = lang;
    document.dispatchEvent(new CustomEvent('langchange', { detail: lang }));
  }
  window.setLang = function (lang) {
    try { localStorage.setItem('bma-lang', lang); } catch (e) {}
    apply(lang);
  };
  // t(en, zh) helper for JS-generated strings
  window.t = function (en, zh) { return window.__lang === 'zh' ? zh : en; };
  document.addEventListener('DOMContentLoaded', function () {
    var saved = 'en';
    try { saved = localStorage.getItem('bma-lang') || 'en'; } catch (e) {}
    apply(saved);
  });
})();
