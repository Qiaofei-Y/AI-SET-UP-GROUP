// Build My AI — interactive chat demo (product-like). Local RAG assistant:
// multi-conversation, streamed answers with citations, copy + 👍/👎 feedback
// (Teach My AI), and a knowledge panel that simulates adding & indexing files.
// User-typed text is escaped (esc) and rendered via textContent — never raw innerHTML.
(function () {
  // ---- sample knowledge base (answers are static; multi-line via pre-wrap) ----
  var KB = [
    { id: 'payment', k: ['payment', 'cycle', 'supplier a', '付款', '周期', 'a 供应商'],
      en: 'Per the contract, the payment cycle with Supplier A is 45 days after acceptance, with a 2% early-payment discount if paid within 10 days.',
      zh: '根据合同,与 A 供应商的付款周期为验收后 45 天,10 天内付款可享 2% 提前付款折扣。',
      cite: { file_en: '2024_Procurement_SupplierA.pdf', file_zh: '2024采购合同_A供应商.pdf', loc_en: '· p.3 · Payment terms', loc_zh: '· 第 3 页 · 付款条款' } },
    { id: 'inventory', k: ['inventory', 'q2', 'stock', '库存', '报表'],
      en: 'Q2 inventory summary:\n• Closing inventory: 42,600 units (down 8% vs Q1)\n• Biggest drop: packaging category (−19%)\n• Slow movers: 3 SKUs above 120 days on hand\nRecommendation: review packaging reorder points.',
      zh: 'Q2 库存摘要:\n• 期末库存:42,600 件(较 Q1 下降 8%)\n• 降幅最大:包装类(−19%)\n• 滞销:3 个 SKU 在手超 120 天\n建议:复核包装类的再订货点。',
      cite: { file_en: 'Q2_Inventory.xlsx', file_zh: 'Q2库存报表.xlsx', loc_en: '· Summary sheet · rows 12–18', loc_zh: '· 汇总表 · 第 12–18 行' } },
    { id: 'penalty', k: ['penalty', 'late', 'delivery', '违约', '延迟', '交付'],
      en: 'The late-delivery penalty is 0.5% of the order value per day, capped at 10% of the total contract value.',
      zh: '延迟交付违约金为每日订单金额的 0.5%,上限为合同总额的 10%。',
      cite: { file_en: '2024_Procurement_SupplierA.pdf', file_zh: '2024采购合同_A供应商.pdf', loc_en: '· p.5 · Clause 7', loc_zh: '· 第 5 页 · 第 7 条' } },
    { id: 'approval', k: ['approve', 'approval', 'policy', 'purchase', '审批', '采购', '制度'],
      en: 'Purchases above $10,000 require two-level approval: the department head, then finance. Below that, the department head alone can approve.',
      zh: '金额超过 $10,000 的采购需两级审批:先部门负责人,再财务。低于该金额,部门负责人单独审批即可。',
      cite: { file_en: 'Supplier_Policy.docx', file_zh: '供应商管理制度.docx', loc_en: '· Section 3.2', loc_zh: '· 第 3.2 节' } }
  ];
  var KBBYID = {}; KB.forEach(function (e) { KBBYID[e.id] = e; });
  var FALLBACK = {
    en: "I couldn't find that in your files. Try the Supplier A contract, the Q2 inventory report, or the purchase approval policy — or add more documents from the Knowledge panel (top right).",
    zh: '我在你的文件里没找到相关内容。可以问 A 供应商合同、Q2 库存报表、或采购审批制度——也可以从右上角"知识库"面板添加更多文档。'
  };
  var GREET = {
    en: "Hi! I've read your documents. Ask me anything about your contracts, reports or policies — I'll answer with the source.",
    zh: '你好!我已经读完你的文件。关于合同、报表或制度尽管问——我会带来源回答。'
  };
  var CONVERSATIONS = {
    proc: [ { r: 'u', en: "For our 2024 contract with Supplier A, what's the payment cycle?", zh: '2024 年和 A 供应商的合同,付款周期是多少天?' }, { r: 'a', key: 'payment' } ],
    pay: [ { r: 'u', en: 'Compare payment cycles across our suppliers.', zh: '对比一下各供应商的付款周期。' },
           { r: 'a', en: 'Across your contracts:\n• Supplier A — 45 days after acceptance (2% early-pay discount)\n• Supplier B — 30 days, net\n• Supplier C — 60 days, 1% monthly late interest\nSupplier A has the best early-payment incentive; Supplier C gives the most float.',
             zh: '各合同的付款周期:\n• A 供应商 — 验收后 45 天(2% 提前付款折扣)\n• B 供应商 — 30 天,net\n• C 供应商 — 60 天,逾期每月 1% 利息\nA 供应商提前付款激励最好;C 供应商账期最长。',
             cite: { file_en: 'Supplier_Policy.docx', file_zh: '供应商管理制度.docx', loc_en: '· Section 4 · Payment terms', loc_zh: '· 第 4 节 · 付款条款' } } ],
    inv: [ { r: 'u', en: 'Summarize the Q2 inventory report.', zh: '总结一下 Q2 库存报表。' }, { r: 'a', key: 'inventory' } ]
  };

  var FILES = [
    { t: 'pdf', en: '2024_Procurement_SupplierA.pdf', zh: '2024采购合同_A供应商.pdf', me: '2.4 MB · 18 pages', mz: '2.4 MB · 18 页', st: 'ok' },
    { t: 'xls', en: 'Q2_Inventory.xlsx', zh: 'Q2库存报表.xlsx', me: '860 KB · 6 sheets', mz: '860 KB · 6 个工作表', st: 'ok' },
    { t: 'doc', en: 'Supplier_Policy.docx', zh: '供应商管理制度.docx', me: '220 KB · 9 pages', mz: '220 KB · 9 页', st: 'ok' },
    { t: 'eml', en: 'Quote emails (37)', zh: '报价往来邮件(37 封)', me: '1.1 MB', mz: '1.1 MB', st: 'ok' },
    { t: 'pdf', en: 'Delivery_Terms.pdf', zh: '交付条款.pdf', me: '540 KB · 6 pages', mz: '540 KB · 6 页', st: 'ok' }
  ];
  var NEWNAMES = [ { en: 'NDA_2025.pdf', zh: '保密协议_2025.pdf' }, { en: 'Vendor_List.xlsx', zh: '供应商清单.xlsx' }, { en: 'Board_Minutes.docx', zh: '董事会纪要.docx' } ];
  var newIdx = 0, fileCount = 12, teachCount = 317, activeStream = null, toastT = null;

  function lang() { return window.__lang === 'zh' ? 'zh' : 'en'; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;'); }
  var inner, scroll;
  function toBottom() { if (scroll) scroll.scrollTop = scroll.scrollHeight; }
  function toast(msg) {
    var el = document.getElementById('toast'); if (!el) return;
    el.textContent = msg; el.classList.add('show');
    if (toastT) clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }
  function labelSpan(en, zh) { var s = document.createElement('span'); s.setAttribute('data-en', en); s.setAttribute('data-zh', zh); s.textContent = lang() === 'zh' ? zh : en; return s; }

  // fast-complete any in-flight streamed answer: cancel its timers, write the
  // full text and run its finish() so it never freezes mid-sentence.
  function fastComplete() {
    if (!activeStream) return;
    var s = activeStream; activeStream = null;
    if (s.delay) clearTimeout(s.delay);
    if (s.iv) clearInterval(s.iv);
    s.done();
  }

  function match(q) {
    var s = q.toLowerCase();
    for (var i = 0; i < KB.length; i++) if (KB[i].k.some(function (kw) { return s.indexOf(kw) !== -1; })) return KB[i];
    return null;
  }

  // ---- message builders ----
  function addUser(en, zh) {
    var row = document.createElement('div'); row.className = 'chat-msg u';
    row.innerHTML = '<div class="av" data-en="You" data-zh="你">' + t('You', '你') +
      '</div><div class="chat-bub" data-en-msg="' + esc(en) + '" data-zh-msg="' + esc(zh) + '"></div>';
    row.querySelector('.chat-bub').textContent = lang() === 'zh' ? zh : en;
    inner.appendChild(row); toBottom();
  }

  function buildCite(c) {
    var d = document.createElement('div'); d.className = 'chat-cite';
    var fi = document.createElement('span'); fi.className = 'fi'; fi.textContent = c.file_en.split('.').pop().toUpperCase().slice(0, 3);
    var wrap = document.createElement('span');
    var b = document.createElement('b'); b.setAttribute('data-en', c.file_en); b.setAttribute('data-zh', c.file_zh); b.textContent = lang() === 'zh' ? c.file_zh : c.file_en;
    var s = document.createElement('span'); s.setAttribute('data-en', c.loc_en); s.setAttribute('data-zh', c.loc_zh); s.textContent = lang() === 'zh' ? c.loc_zh : c.loc_en;
    wrap.appendChild(b); wrap.appendChild(document.createTextNode(' ')); wrap.appendChild(s);
    d.appendChild(fi); d.appendChild(wrap); return d;
  }

  function buildActions(bub) {
    var wrap = document.createElement('div'); wrap.className = 'msg-actions';
    var copy = document.createElement('button'); copy.type = 'button'; copy.className = 'iconbtn';
    copy.appendChild(document.createTextNode('⧉ ')); copy.appendChild(labelSpan('Copy', '复制'));
    copy.onclick = function () {
      var txt = bub.textContent;
      function good() { toast(t('Copied to clipboard', '已复制')); }
      function legacy() {
        var ta = document.createElement('textarea');
        ta.value = txt; ta.setAttribute('readonly', 'readonly');
        ta.style.position = 'fixed'; ta.style.left = '-9999px';
        document.body.appendChild(ta); ta.select();
        var done = false;
        try { done = document.execCommand('copy'); } catch (e) { done = false; }
        ta.remove();
        if (done) good(); else toast(t('Copy failed — please copy manually.', '复制失败——请手动复制。'));
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(good, legacy);
      } else { legacy(); }
    };
    var up = document.createElement('button'); up.type = 'button'; up.className = 'iconbtn'; up.textContent = '👍';
    var down = document.createElement('button'); down.type = 'button'; down.className = 'iconbtn'; down.textContent = '👎';
    up.onclick = function () {
      if (up.classList.contains('on')) { up.classList.remove('on'); return; }
      up.classList.add('on'); down.classList.remove('on');
      toast(t('Thanks — logged as a good answer.', '已记录为满意回答。'));
    };
    down.onclick = function () {
      if (down.classList.contains('on')) { down.classList.remove('on'); return; }
      down.classList.add('on'); up.classList.remove('on');
      openTeach(wrap.parentElement);
    };
    wrap.appendChild(copy); wrap.appendChild(up); wrap.appendChild(down);
    return wrap;
  }

  function openTeach(col) {
    if (col.querySelector('.teach-box')) return;
    var box = document.createElement('div'); box.className = 'teach-box';
    var lbl = document.createElement('div'); lbl.className = 'lbl';
    lbl.setAttribute('data-en', "What's the correct answer? Your AI will learn from it.");
    lbl.setAttribute('data-zh', '正确答案是什么？你的 AI 会从中学习。');
    lbl.textContent = lang() === 'zh' ? '正确答案是什么？你的 AI 会从中学习。' : "What's the correct answer? Your AI will learn from it.";
    var ta = document.createElement('textarea'); ta.setAttribute('data-en-ph', 'Type the correct answer…'); ta.setAttribute('data-zh-ph', '输入正确答案…');
    ta.placeholder = lang() === 'zh' ? '输入正确答案…' : 'Type the correct answer…';
    var row = document.createElement('div'); row.className = 'row';
    var cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'mini cancel'; cancel.setAttribute('data-en', 'Cancel'); cancel.setAttribute('data-zh', '取消'); cancel.textContent = lang() === 'zh' ? '取消' : 'Cancel';
    var save = document.createElement('button'); save.type = 'button'; save.className = 'mini save'; save.setAttribute('data-en', 'Save correction'); save.setAttribute('data-zh', '保存纠正'); save.textContent = lang() === 'zh' ? '保存纠正' : 'Save correction';
    cancel.onclick = function () { box.remove(); };
    save.onclick = function () { teachCount++; box.remove(); toast(t('Saved — your AI will learn from this.', '已保存 — 你的 AI 会从中学习。') + ' (Teach My AI: ' + teachCount + '/500)'); };
    row.appendChild(cancel); row.appendChild(save);
    box.appendChild(lbl); box.appendChild(ta); box.appendChild(row);
    col.appendChild(box); ta.focus(); toBottom();
  }

  function addAI(entry, opts) {
    opts = opts || {};
    var en = entry && entry.en ? entry.en : FALLBACK.en;
    var zh = entry && entry.zh ? entry.zh : FALLBACK.zh;
    var row = document.createElement('div'); row.className = 'chat-msg a';
    var av = document.createElement('div'); av.className = 'av'; av.textContent = '◆';
    var col = document.createElement('div');
    var typing = document.createElement('div'); typing.className = 'chat-typing'; typing.innerHTML = '<span></span><span></span><span></span>';
    var bub = document.createElement('div'); bub.className = 'chat-bub'; bub.setAttribute('data-en-msg', en); bub.setAttribute('data-zh-msg', zh);
    col.appendChild(typing); col.appendChild(bub);
    var cite = (entry && entry.cite) ? buildCite(entry.cite) : null;
    if (cite) { cite.style.display = 'none'; col.appendChild(cite); }
    var actions = opts.plain ? null : buildActions(bub);
    if (actions) { actions.style.display = 'none'; col.appendChild(actions); }
    row.appendChild(av); row.appendChild(col); inner.appendChild(row); toBottom();

    // finish() re-renders the full text per the CURRENT language, so an answer
    // that streamed across a language toggle ends up in the right language.
    function finish() {
      bub.classList.remove('typing-caret');
      bub.textContent = bub.getAttribute('data-' + lang() + '-msg');
      if (cite) { cite.style.display = ''; cite.classList.add('reveal'); }
      if (actions) actions.style.display = '';
    }
    if (opts.instant) { typing.remove(); finish(); return; }
    fastComplete();
    var stream = { delay: null, iv: null, done: function () { if (typing.parentNode) typing.remove(); finish(); toBottom(); } };
    activeStream = stream;
    stream.delay = setTimeout(function () {
      typing.remove(); bub.classList.add('typing-caret');
      var text = lang() === 'zh' ? zh : en, i = 0;
      stream.iv = setInterval(function () {
        i++; bub.textContent = text.slice(0, i); toBottom();
        if (i >= text.length) {
          clearInterval(stream.iv);
          if (activeStream === stream) activeStream = null;
          finish();
        }
      }, 12);
    }, 600);
  }

  // live-streamed answer bubble for a real local model (used by local-llm.js).
  // Same row structure/actions as addAI; onCancel is invoked if the user
  // interrupts (new question / conversation switch) so the caller can abort.
  function addAILive(onCancel) {
    fastComplete();
    var row = document.createElement('div'); row.className = 'chat-msg a';
    var av = document.createElement('div'); av.className = 'av'; av.textContent = '◆';
    var col = document.createElement('div');
    var typing = document.createElement('div'); typing.className = 'chat-typing'; typing.innerHTML = '<span></span><span></span><span></span>';
    var bub = document.createElement('div'); bub.className = 'chat-bub';
    var actions = buildActions(bub); actions.style.display = 'none';
    col.appendChild(typing); col.appendChild(bub); col.appendChild(actions);
    row.appendChild(av); row.appendChild(col); inner.appendChild(row); toBottom();
    var text = '', ended = false, enMsg = null, zhMsg = null, isFail = false;
    function finalize() {
      if (ended) return; ended = true;
      if (typing.parentNode) typing.remove();
      bub.classList.remove('typing-caret');
      // live answers are single-language (attrs equal); failure notices keep
      // separate en/zh so the language toggle re-translates them
      bub.setAttribute('data-en-msg', enMsg !== null ? enMsg : text);
      bub.setAttribute('data-zh-msg', zhMsg !== null ? zhMsg : text);
      bub.textContent = bub.getAttribute('data-' + lang() + '-msg');
      if (isFail) actions.remove(); else actions.style.display = '';
      if (activeStream === s) activeStream = null;
      toBottom();
    }
    var s = { delay: null, iv: null, done: function () { if (onCancel) onCancel(); finalize(); } };
    activeStream = s;
    return {
      append: function (chunk) {
        if (ended) return;
        text += chunk;
        if (typing.parentNode) { typing.remove(); bub.classList.add('typing-caret'); }
        bub.textContent = text; toBottom();
      },
      done: finalize,
      fail: function (en, zh) { if (!text) { isFail = true; enMsg = en; zhMsg = zh; text = t(en, zh); } finalize(); }
    };
  }

  function ask(en, zh) {
    fastComplete(); addUser(en, zh || en);
    // a connected local model takes priority over the canned demo answers;
    // send the variant matching the displayed language so replies match the UI
    if (window.LocalLLM && window.LocalLLM.ready()) {
      window.LocalLLM.ask(String(lang() === 'zh' && zh ? zh : en));
      return;
    }
    var entry = match(en) || (zh ? match(zh) : null); addAI(entry);
  }

  // ---- conversations ----
  function renderGreeting() { if (!inner) return; fastComplete(); inner.innerHTML = ''; document.dispatchEvent(new CustomEvent('chat-reset')); addAI({ en: GREET.en, zh: GREET.zh }, { instant: true, plain: true }); }
  function loadConversation(id) {
    if (!inner) return;
    var seed = CONVERSATIONS[id]; if (!seed) { renderGreeting(); return; }
    fastComplete(); inner.innerHTML = '';
    // hand the seeded thread to the local-model connector so follow-up
    // questions carry the visible conversation as context
    var msgs = seed.map(function (m) {
      var e = m.r === 'u' ? m : (m.key ? KBBYID[m.key] : m);
      return { role: m.r === 'u' ? 'user' : 'assistant', content: lang() === 'zh' ? e.zh : e.en };
    });
    document.dispatchEvent(new CustomEvent('chat-reset', { detail: { seed: msgs } }));
    seed.forEach(function (m) {
      if (m.r === 'u') addUser(m.en, m.zh);
      else addAI(m.key ? KBBYID[m.key] : { en: m.en, zh: m.zh, cite: m.cite }, { instant: true });
    });
  }

  // ---- knowledge panel ----
  function setCount() { var el = document.getElementById('fileCount'); if (el) el.textContent = fileCount; }
  function renderFiles() {
    var list = document.getElementById('kList'); if (!list) return; list.innerHTML = '';
    FILES.forEach(function (f) {
      var row = document.createElement('div'); row.className = 'kfile';
      var fi = document.createElement('span'); fi.className = 'fi ' + (f.st === 'indexing' ? 'new' : f.t); fi.textContent = f.t.toUpperCase();
      var m = document.createElement('div'); m.className = 'm';
      var h = document.createElement('h4'); h.setAttribute('data-en', f.en); h.setAttribute('data-zh', f.zh); h.textContent = lang() === 'zh' ? f.zh : f.en;
      var p = document.createElement('p'); p.setAttribute('data-en', f.me); p.setAttribute('data-zh', f.mz); p.textContent = lang() === 'zh' ? f.mz : f.me;
      m.appendChild(h); m.appendChild(p);
      var idx = f.st === 'indexing';
      var b = document.createElement('span'); b.className = 'badge ' + (idx ? 'blue' : 'teal');
      b.setAttribute('data-en', idx ? 'Indexing…' : '✓ Indexed'); b.setAttribute('data-zh', idx ? '索引中…' : '✓ 已索引');
      b.textContent = lang() === 'zh' ? (idx ? '索引中…' : '✓ 已索引') : (idx ? 'Indexing…' : '✓ Indexed');
      row.appendChild(fi); row.appendChild(m); row.appendChild(b); list.appendChild(row);
    });
  }
  function addFile() {
    var n = NEWNAMES[newIdx % NEWNAMES.length]; newIdx++;
    var ext = n.en.split('.').pop(); var type = ext === 'xlsx' ? 'xls' : ext === 'docx' ? 'doc' : 'pdf';
    var f = { t: type, en: n.en, zh: n.zh, me: 'just added', mz: '刚添加', st: 'indexing' };
    FILES.unshift(f); renderFiles();
    toast(t('Reading & indexing ' + n.en + '…', '正在读取并索引 ' + n.zh + '…'));
    setTimeout(function () {
      f.st = 'ok'; f.me = 'indexed just now'; f.mz = '刚刚索引完成'; fileCount++; renderFiles(); setCount();
      toast(t('Indexed — your AI can now use ' + n.en + '.', '已索引 — 你的 AI 现在能用 ' + n.zh + ' 了。'));
    }, 1300);
  }
  function openK() {
    var p = document.getElementById('kpanel'), m = document.getElementById('kmask');
    if (!p) return;
    p.classList.add('open'); p.setAttribute('aria-hidden', 'false');
    if (m) m.classList.add('open');
    var c = document.getElementById('kClose'); if (c) c.focus();
  }
  function closeK() {
    var p = document.getElementById('kpanel'), m = document.getElementById('kmask');
    if (!p || !p.classList.contains('open')) return;
    p.classList.remove('open'); p.setAttribute('aria-hidden', 'true');
    if (m) m.classList.remove('open');
    var b = document.getElementById('kbBtn'); if (b) b.focus();
  }

  // ---- wire up ----
  // Null-safe wiring helpers: pages/harnesses that lack an element simply skip it.
  function on(id, ev, fn) { var el = document.getElementById(id); if (el) el.addEventListener(ev, fn); return el; }
  // click + keyboard (Enter/Space) activation for role="button" elements
  function pressable(el, fn) {
    if (!el) return;
    el.addEventListener('click', fn);
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); fn(e); }
    });
  }
  document.addEventListener('DOMContentLoaded', function () {
    scroll = document.getElementById('chatScroll');
    inner = document.getElementById('chatInner');

    on('chatForm', 'submit', function (e) {
      e.preventDefault();
      var input = document.getElementById('chatInput');
      if (!input) return;
      var v = input.value.trim(); if (!v) return; input.value = '';
      ask(v, v);
    });
    document.querySelectorAll('.chip').forEach(function (chip) {
      chip.addEventListener('click', function () { ask(chip.getAttribute('data-en'), chip.getAttribute('data-zh')); });
    });
    document.querySelectorAll('.chat-side .c').forEach(function (c) {
      pressable(c, function () {
        document.querySelectorAll('.chat-side .c').forEach(function (x) { x.classList.remove('on'); });
        c.classList.add('on'); loadConversation(c.getAttribute('data-conv'));
      });
    });
    pressable(document.getElementById('newChat'), function () {
      document.querySelectorAll('.chat-side .c').forEach(function (x) { x.classList.remove('on'); });
      renderGreeting();
    });
    on('kbBtn', 'click', openK);
    pressable(document.getElementById('kbLink'), openK);
    on('kClose', 'click', closeK);
    on('kmask', 'click', closeK);
    var drop = document.getElementById('kDrop');
    pressable(drop, addFile);
    if (drop) {
      ['dragover', 'dragenter'].forEach(function (ev) {
        drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('drag'); });
      });
      drop.addEventListener('dragleave', function () { drop.classList.remove('drag'); });
      drop.addEventListener('drop', function (e) { e.preventDefault(); drop.classList.remove('drag'); addFile(); });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var p = document.getElementById('kpanel');
      if (p && p.classList.contains('open')) closeK();
    });

    document.querySelectorAll('.chat-side .c').forEach(function (x) { x.classList.remove('on'); });
    setCount(); renderFiles(); renderGreeting();
  });

  // minimal surface for the optional local-model connector (local-llm.js)
  window.__chatLive = { addAILive: addAILive, toast: toast };

  // language switch: re-render dynamic message text (i18n handles [data-en] nodes)
  document.addEventListener('langchange', function () {
    document.querySelectorAll('.chat-bub[data-en-msg]').forEach(function (b) {
      if (b.classList.contains('typing-caret')) return;
      b.textContent = b.getAttribute('data-' + lang() + '-msg');
    });
  });
})();
