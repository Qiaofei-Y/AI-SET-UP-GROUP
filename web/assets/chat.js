// Build My AI — interactive chat demo. Simulates a local RAG assistant:
// user asks → typing → streamed answer with a source citation. Bilingual.
(function () {
  // Tiny canned knowledge base. Each entry: match keywords + bilingual answer + citation.
  var KB = [
    {
      k: ['payment', 'cycle', 'supplier a', '付款', '周期', 'a 供应商'],
      en: 'Per the contract, the payment cycle with Supplier A is 45 days after acceptance, with a 2% early-payment discount if paid within 10 days.',
      zh: '根据合同,与 A 供应商的付款周期为验收后 45 天,10 天内付款可享 2% 提前付款折扣。',
      cite: { file_en: '2024_Procurement_SupplierA.pdf', file_zh: '2024采购合同_A供应商.pdf', loc_en: '· p.3 · Payment terms', loc_zh: '· 第 3 页 · 付款条款' }
    },
    {
      k: ['inventory', 'q2', 'stock', '库存', '报表'],
      en: 'Q2 closing inventory was 42,600 units, down 8% from Q1. The largest drop was in the packaging category (−19%).',
      zh: 'Q2 期末库存为 42,600 件,较 Q1 下降 8%。降幅最大的是包装类(−19%)。',
      cite: { file_en: 'Q2_Inventory.xlsx', file_zh: 'Q2库存报表.xlsx', loc_en: '· Summary sheet · row 12', loc_zh: '· 汇总表 · 第 12 行' }
    },
    {
      k: ['penalty', 'late', 'delivery', '违约', '延迟', '交付'],
      en: 'The late-delivery penalty is 0.5% of the order value per day, capped at 10% of the total contract value.',
      zh: '延迟交付违约金为每日订单金额的 0.5%,上限为合同总额的 10%。',
      cite: { file_en: '2024_Procurement_SupplierA.pdf', file_zh: '2024采购合同_A供应商.pdf', loc_en: '· p.5 · Clause 7', loc_zh: '· 第 5 页 · 第 7 条' }
    },
    {
      k: ['approve', 'approval', 'policy', 'purchase', '审批', '采购', '制度'],
      en: 'Purchases above $10,000 require two-level approval: the department head, then finance. Below that, the department head alone can approve.',
      zh: '金额超过 $10,000 的采购需两级审批:先部门负责人,再财务。低于该金额,部门负责人单独审批即可。',
      cite: { file_en: 'Supplier_Policy.docx', file_zh: '供应商管理制度.docx', loc_en: '· Section 3.2', loc_zh: '· 第 3.2 节' }
    }
  ];
  var FALLBACK = {
    en: "I couldn't find that in your 12 files. Try asking about the Supplier A contract, the Q2 inventory report, or the purchase approval policy — or drag more documents into your knowledge base.",
    zh: '我在你的 12 份文件里没找到相关内容。可以问 A 供应商合同、Q2 库存报表、或采购审批制度——也可以拖更多文档进知识库。'
  };

  function lang() { return window.__lang === 'zh' ? 'zh' : 'en'; }
  function match(q) {
    var s = q.toLowerCase();
    for (var i = 0; i < KB.length; i++) {
      var hit = KB[i].k.some(function (kw) { return s.indexOf(kw) !== -1; });
      if (hit) return KB[i];
    }
    return null;
  }

  var scroll, inner, activeIv = null;
  function toBottom() { scroll.scrollTop = scroll.scrollHeight; }

  function addUser(en, zh) {
    var row = document.createElement('div');
    row.className = 'chat-msg u';
    row.innerHTML = '<div class="av" data-en="You" data-zh="你">' + t('You', '你') + '</div>' +
      '<div class="chat-bub" data-en-msg="' + esc(en) + '" data-zh-msg="' + esc(zh) + '"></div>';
    inner.appendChild(row);
    row.querySelector('.chat-bub').textContent = lang() === 'zh' ? zh : en;
    toBottom();
  }

  function addAI(entry) {
    var en = entry ? entry.en : FALLBACK.en;
    var zh = entry ? entry.zh : FALLBACK.zh;
    var row = document.createElement('div');
    row.className = 'chat-msg a';
    var citeHtml = '';
    if (entry) {
      var c = entry.cite;
      citeHtml = '<div class="chat-cite" style="display:none">' +
        '<span class="fi">' + (c.file_en.split('.').pop().toUpperCase().slice(0, 3)) + '</span>' +
        '<span><b data-en="' + esc(c.file_en) + '" data-zh="' + esc(c.file_zh) + '">' + (lang() === 'zh' ? c.file_zh : c.file_en) + '</b> ' +
        '<span data-en="' + esc(c.loc_en) + '" data-zh="' + esc(c.loc_zh) + '">' + (lang() === 'zh' ? c.loc_zh : c.loc_en) + '</span></span></div>';
    }
    row.innerHTML = '<div class="av">◆</div><div>' +
      '<div class="chat-typing"><span></span><span></span><span></span></div>' +
      '<div class="chat-bub" data-en-msg="' + esc(en) + '" data-zh-msg="' + esc(zh) + '" style="display:none"></div>' +
      citeHtml + '</div>';
    inner.appendChild(row);
    toBottom();

    var typing = row.querySelector('.chat-typing');
    var bub = row.querySelector('.chat-bub');
    var cite = row.querySelector('.chat-cite');
    setTimeout(function () {
      typing.remove();
      bub.style.display = '';
      bub.classList.add('typing-caret');
      var text = lang() === 'zh' ? zh : en, i = 0;
      if (activeIv) clearInterval(activeIv);
      activeIv = setInterval(function () {
        i++; bub.textContent = text.slice(0, i); toBottom();
        if (i >= text.length) {
          clearInterval(activeIv); activeIv = null;
          bub.classList.remove('typing-caret');
          if (cite) { cite.style.display = ''; cite.classList.add('reveal'); }
        }
      }, 14);
    }, 650);
  }

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

  function ask(en, zh) {
    addUser(en, zh || en);
    var entry = match(en) || (zh ? match(zh) : null);
    addAI(entry);
  }

  document.addEventListener('DOMContentLoaded', function () {
    scroll = document.getElementById('chatScroll');
    inner = document.getElementById('chatInner');
    var form = document.getElementById('chatForm');
    var input = document.getElementById('chatInput');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = input.value.trim();
      if (!v) return;
      input.value = '';
      // Send the typed text as-is for both languages (user's own words).
      ask(v, v);
    });
    // suggestion chips
    document.querySelectorAll('.chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        ask(chip.getAttribute('data-en'), chip.getAttribute('data-zh'));
      });
    });
  });

  // On language switch: re-render existing bubbles/citations (i18n handles [data-en]; we handle [data-*-msg]).
  document.addEventListener('langchange', function () {
    document.querySelectorAll('.chat-bub[data-en-msg]').forEach(function (b) {
      if (b.classList.contains('typing-caret')) return; // let an in-progress stream finish
      b.textContent = b.getAttribute('data-' + lang() + '-msg');
    });
  });
})();
