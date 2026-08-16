// Build My AI — optional local-model connector (chat.html).
// Talks ONLY to local llm-lab services at 127.0.0.1 — never any remote host:
//   BASE   :8080  llama.cpp chat model (OpenAI-compatible, streamed)
//   PORTAL :8090  Michael AI Portal — /api/rag Q&A over the indexed project docs
// Mode ladder: RAG (portal up) > general chat (8080 up) > canned demo (nothing up).
// All model output is rendered via textContent (see addAILive) — no HTML injection path.
(function () {
  var BASE = 'http://127.0.0.1:8080';
  var PORTAL = 'http://127.0.0.1:8090';
  var SYSTEM =
    'You are "Build My AI", a private AI assistant running fully on this computer. ' +
    'Be concise and helpful. Always reply in the same language as the user\'s last message ' +
    '(Chinese for Chinese, English for English). Plain text only — no markdown headings.';
  var TITLE_DEMO = { en: 'My Company Knowledge AI · running locally', zh: '我的公司知识 AI · 本地运行' };
  var TITLE_CHAT = { en: 'My Local AI · general chat (no knowledge base yet)', zh: '我的本地 AI · 通用问答(暂未接知识库)' };
  var TITLE_RAG = { en: 'Project Knowledge AI · local RAG', zh: '项目知识 AI · 本地 RAG' };
  // suggested questions that the indexed project corpus can actually answer
  var RAG_CHIPS = [
    { en: 'What does the MVP include?', zh: 'MVP 都包含什么?' },
    { en: 'What is the pricing model?', zh: '定价策略是怎样的?' },
    { en: 'Who are the target users?', zh: '目标用户是谁?' },
    { en: 'What is the product roadmap?', zh: '产品路线图是什么?' }
  ];

  var isReady = false, ragUp = false, modelName = '', history = [];
  // in-flight request bookkeeping: `gen` invalidates stale async completions,
  // `cur` holds the one active request ({ctrl, out, committed, userMsg}).
  var gen = 0, cur = null, probeTimer = null;

  function t(en, zh) { return window.__lang === 'zh' ? zh : en; }
  function toast(msg) { if (window.__chatLive) window.__chatLive.toast(msg); }

  function prettyModel(id) {
    var base = String(id).split('/').pop().replace(/\.gguf$/i, '');
    return base.replace(/-(Q\d[\w.]*|IQ\d[\w.]*|f16|bf16)$/i, '');
  }

  function setText(sel, en, zh) {
    var el = document.querySelector(sel);
    if (!el) return;
    el.setAttribute('data-en', en); el.setAttribute('data-zh', zh);
    el.textContent = t(en, zh);
  }
  function setChips() {
    var chips = document.querySelectorAll('.chip');
    for (var i = 0; i < chips.length && i < RAG_CHIPS.length; i++) {
      chips[i].setAttribute('data-en', RAG_CHIPS[i].en);
      chips[i].setAttribute('data-zh', RAG_CHIPS[i].zh);
      chips[i].textContent = t(RAG_CHIPS[i].en, RAG_CHIPS[i].zh);
    }
  }
  function setChip() {
    if (ragUp) {
      setText('.modelchip', modelName + ' · RAG', modelName + ' · RAG');
      setText('#chatTitle', TITLE_RAG.en, TITLE_RAG.zh);
      setText('.chat-hint',
        'Connected · retrieval (bge-m3) + generation (' + modelName + ') run on this computer — answers cite the project docs.',
        '已连接 · 检索(bge-m3)+ 生成(' + modelName + ')全在本机——回答会引用项目文档。');
      setChips();
    } else {
      setText('.modelchip', modelName + ' · local', modelName + ' · 本地');
      setText('#chatTitle', TITLE_CHAT.en, TITLE_CHAT.zh);
      setText('.chat-hint',
        'Connected · answers come from ' + modelName + ' running on this computer — nothing leaves your machine.',
        '已连接 · 回答来自本机运行的 ' + modelName + '——数据不离开你的电脑。');
    }
  }
  function setChipOffline() {
    if (!modelName) return;
    setText('.modelchip', modelName + ' · offline', modelName + ' · 已断开');
    setText('#chatTitle', TITLE_DEMO.en, TITLE_DEMO.zh);
    setText('.chat-hint',
      'Local model unreachable — demo answers from the sample knowledge base.',
      '本地模型连不上——已切回小样本知识库的演示回答。');
  }

  function scheduleReprobe() {
    clearTimeout(probeTimer);
    probeTimer = setTimeout(probe, 15000);
  }
  function probe() {
    if (isReady && ragUp) return;
    var pc = new AbortController();
    var timer = setTimeout(function () { pc.abort(); }, 1500);
    var wasReady = isReady;
    fetch(BASE + '/v1/models', { signal: pc.signal })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        clearTimeout(timer);
        var m = j && (j.models || j.data);
        modelName = m && m[0] ? prettyModel(m[0].name || m[0].id || m[0].model) : 'Local model';
        isReady = true;
        // chat model is up — now see if the RAG portal is too
        var pc2 = new AbortController();
        var timer2 = setTimeout(function () { pc2.abort(); }, 1500);
        return fetch(PORTAL + '/api/health', { signal: pc2.signal })
          .then(function (r2) { clearTimeout(timer2); ragUp = r2.ok; })
          .catch(function () { clearTimeout(timer2); ragUp = false; });
      })
      .then(function () {
        if (!isReady) return;
        setChip();
        if (!wasReady) {
          toast(ragUp
            ? t('Connected: ' + modelName + ' + project knowledge base (local RAG).',
                '已连接:' + modelName + ' + 项目知识库(本地 RAG)。')
            : t('Local model connected: ' + modelName + ' — answers now come from your own AI.',
                '已连接本地模型:' + modelName + ' —— 回答来自你自己的 AI。'));
        }
        if (!ragUp) scheduleReprobe(); // keep trying to pick the portal up
      })
      .catch(function () { clearTimeout(timer); isReady = false; scheduleReprobe(); });
  }

  function goOffline() {
    isReady = false; ragUp = false; setChipOffline(); scheduleReprobe();
  }

  // Synchronously settle the in-flight request at interrupt time, BEFORE the
  // interrupting action reads/replaces history: commit the partial answer, or
  // drop the now-dangling user turn if nothing streamed yet.
  function commitCurrent() {
    if (!cur || cur.committed) return;
    cur.committed = true;
    if (cur.out) {
      history.push({ role: 'assistant', content: cur.out });
    } else {
      var i = history.lastIndexOf(cur.userMsg);
      if (i !== -1) history.splice(i, 1);
    }
  }

  function beginRequest(q) {
    var userMsg = { role: 'user', content: q };
    history.push(userMsg);
    if (history.length > 12) history = history.slice(-12);
    var me = { ctrl: new AbortController(), out: '', committed: false, userMsg: userMsg, gen: ++gen };
    cur = me;
    return me;
  }
  function dropUserMsg(me) {
    var i = history.lastIndexOf(me.userMsg);
    if (i !== -1) history.splice(i, 1);
  }

  // ---- RAG mode: one-shot Q&A against the indexed project docs (portal) ----
  async function ragAsk(q, live) {
    var me = beginRequest(q);
    function stale() { return gen !== me.gen || me.committed; }
    var j = null;
    try {
      var res = await fetch(PORTAL + '/api/rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: me.ctrl.signal,
        body: JSON.stringify({ question: q, lang: window.__lang === 'zh' ? 'zh' : 'en' })
      });
      if (!res.ok) throw new Error('bad response ' + res.status);
      j = await res.json();
      if (j && j.error) throw new Error(j.error);
    } catch (e) {
      if (cur === me) cur = null;
      if (e && e.name === 'AbortError') { live.done(); return; } // interrupt already settled
      // portal broke: drop to general chat for this and future questions
      ragUp = false; scheduleReprobe();
      if (!stale()) { dropUserMsg(me); if (isReady) { setChip(); stream(q, live); return; } }
      goOffline();
      live.fail('(Local model unreachable — back to demo answers. Is `ai` still running?)',
                '(本地模型连不上——已切回演示回答。`ai` 服务还在跑吗?)');
      return;
    }
    if (stale()) { if (cur === me) cur = null; live.done(); return; }
    if (j.empty) {
      // nothing relevant in the project docs — answer with the general model
      dropUserMsg(me);
      if (cur === me) cur = null;
      stream(q, live);
      return;
    }
    var ans = String(j.answer || '');
    me.out = ans;
    live.append(ans);
    if (j.sources && j.sources.length) {
      var seen = {};
      for (var i = 0; i < j.sources.length && Object.keys(seen).length < 3; i++) {
        var s = j.sources[i], f = String(s.file || '');
        if (!f || seen[f]) continue; seen[f] = 1;
        live.addCite(f, String(s.section || ''));
      }
    }
    if (!stale()) { me.committed = true; history.push({ role: 'assistant', content: ans }); }
    if (cur === me) cur = null;
    live.done();
  }

  // ---- general-chat mode: streamed completion straight from the model ----
  async function stream(q, live) {
    var me = beginRequest(q);
    function stale() { return gen !== me.gen || me.committed; }

    var res;
    try {
      res = await fetch(BASE + '/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: me.ctrl.signal,
        body: JSON.stringify({
          stream: true, temperature: 0.6, max_tokens: 512,
          messages: [{ role: 'system', content: SYSTEM }].concat(history)
        })
      });
      if (!res.ok || !res.body) throw new Error('bad response ' + (res && res.status));
    } catch (e) {
      if (cur === me) cur = null;
      if (e && e.name === 'AbortError') { live.done(); return; } // interrupt already settled by commitCurrent()
      if (!stale()) { commitCurrent(); goOffline(); }            // drops the dangling user turn
      live.fail('(Local model unreachable — back to demo answers. Is `ai` still running?)',
                '(本地模型连不上——已切回演示回答。`ai` 服务还在跑吗?)');
      return;
    }

    var reader = res.body.getReader(), dec = new TextDecoder(), buf = '', dataLines = [], sawDone = false;
    // standard SSE: consecutive `data:` lines form one event, dispatched on a blank line
    function dispatch() {
      if (!dataLines.length) return;
      var payload = dataLines.join('\n'); dataLines = [];
      if (payload === '[DONE]') { sawDone = true; return; }
      try {
        var d = JSON.parse(payload);
        var c = d.choices && d.choices[0] && d.choices[0].delta && d.choices[0].delta.content;
        if (c) { me.out += c; live.append(c); }
      } catch (pe) { /* non-JSON event — ignore */ }
    }
    function feed(line) {
      line = line.replace(/\r$/, '');
      if (line === '') { dispatch(); return; }
      if (line.indexOf('data:') === 0) dataLines.push(line.slice(5).replace(/^ /, ''));
    }

    try {
      for (;;) {
        var r = await reader.read();
        if (r.done) break;
        buf += dec.decode(r.value, { stream: true });
        var lines = buf.split('\n'); buf = lines.pop();
        for (var i = 0; i < lines.length && !sawDone; i++) feed(lines[i]);
        if (sawDone) break;
      }
      if (!sawDone) { // connection closed without [DONE]: flush decoder + trailing partial line
        buf += dec.decode();
        if (buf) buf.split('\n').forEach(feed);
        dispatch();
      }
      try { reader.cancel(); } catch (ce) {}
      if (!stale()) {
        me.committed = true;
        if (me.out) history.push({ role: 'assistant', content: me.out });
      }
      if (cur === me) cur = null;
      live.done();
    } catch (e) {
      if (cur === me) cur = null;
      if (e && e.name === 'AbortError') { live.done(); return; } // interrupt already settled
      if (me.out) { // mid-answer disconnect: keep the partial, but say so
        live.append('\n⚠ ' + t('Connection lost — answer is incomplete.', '连接中断——回答不完整。'));
        if (!stale()) { me.committed = true; history.push({ role: 'assistant', content: me.out }); goOffline(); }
        live.done();
      } else {
        if (!stale()) { commitCurrent(); goOffline(); }
        live.fail('(Local model unreachable — back to demo answers. Is `ai` still running?)',
                  '(本地模型连不上——已切回演示回答。`ai` 服务还在跑吗?)');
      }
    }
  }

  window.LocalLLM = {
    ready: function () { return isReady && !!window.__chatLive; },
    ask: function (q) {
      var live = window.__chatLive.addAILive(function () {
        // user interrupted (new question): settle history now, then abort
        commitCurrent();
        if (cur && cur.ctrl) { try { cur.ctrl.abort(); } catch (e) {} }
      });
      if (ragUp) ragAsk(q, live); else stream(q, live);
    }
  };

  // conversation switch / new chat: invalidate the in-flight request and
  // replace history with the seeded thread (if any) so follow-ups have context
  document.addEventListener('chat-reset', function (e) {
    if (cur) cur.committed = true; // stale completions must not touch the new history
    gen++;
    if (cur && cur.ctrl) { try { cur.ctrl.abort(); } catch (er) {} }
    cur = null;
    history = (e && e.detail && e.detail.seed) ? e.detail.seed.slice() : [];
  });
  document.addEventListener('langchange', function () {
    if (!modelName) return;
    if (isReady) setChip(); else setChipOffline();
  });
  document.addEventListener('DOMContentLoaded', probe);
})();
