// Build My AI — optional local-model connector (chat.html).
// Talks ONLY to the local llama.cpp server (llm-lab) at 127.0.0.1 — never any
// remote host. If the server is up, real streamed answers replace the canned
// demo; if not, chat.js silently keeps its static demo behavior.
// All model output is rendered via textContent (see addAILive) — no HTML injection path.
(function () {
  var BASE = 'http://127.0.0.1:8080'; // llm-lab chat model (Qwen2.5-7B), OpenAI-compatible
  var SYSTEM =
    'You are "Build My AI", a private AI assistant running fully on this computer. ' +
    'Be concise and helpful. Always reply in the same language as the user\'s last message ' +
    '(Chinese for Chinese, English for English). Plain text only — no markdown headings.';
  var TITLE_DEMO = { en: 'My Company Knowledge AI · running locally', zh: '我的公司知识 AI · 本地运行' };
  var TITLE_LIVE = { en: 'My Local AI · general chat (no knowledge base yet)', zh: '我的本地 AI · 通用问答(暂未接知识库)' };

  var isReady = false, modelName = '', history = [];
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
  function setChip() {
    setText('.modelchip', modelName + ' · local', modelName + ' · 本地');
    setText('#chatTitle', TITLE_LIVE.en, TITLE_LIVE.zh);
    setText('.chat-hint',
      'Connected · answers come from ' + modelName + ' running on this computer — nothing leaves your machine.',
      '已连接 · 回答来自本机运行的 ' + modelName + '——数据不离开你的电脑。');
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
    if (isReady) return;
    var pc = new AbortController();
    var timer = setTimeout(function () { pc.abort(); }, 1500);
    fetch(BASE + '/v1/models', { signal: pc.signal })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        clearTimeout(timer);
        var m = j && (j.models || j.data);
        modelName = m && m[0] ? prettyModel(m[0].name || m[0].id || m[0].model) : 'Local model';
        isReady = true;
        setChip();
        toast(t('Local model connected: ' + modelName + ' — answers now come from your own AI.',
                '已连接本地模型:' + modelName + ' —— 回答来自你自己的 AI。'));
      })
      .catch(function () { clearTimeout(timer); isReady = false; scheduleReprobe(); });
  }

  function goOffline() {
    isReady = false; setChipOffline(); scheduleReprobe();
  }

  // Synchronously settle the in-flight request at interrupt time, BEFORE the
  // interrupting action reads/replaces history: commit the partial answer, or
  // drop the now-danging user turn if nothing streamed yet.
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

  async function stream(q, live) {
    var myGen = ++gen;
    var userMsg = { role: 'user', content: q };
    history.push(userMsg);
    if (history.length > 12) history = history.slice(-12);
    var me = { ctrl: new AbortController(), out: '', committed: false, userMsg: userMsg };
    cur = me;
    function stale() { return gen !== myGen || me.committed; }

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
      stream(q, live);
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
