// Build My AI — optional local-model connector (chat.html + build.html).
// Talks ONLY to local llm-lab services at 127.0.0.1 — never any remote host:
//   BASE    :8080  llama.cpp chat model (OpenAI-compatible, streamed)
//   PORTAL  :8090  Michael AI Portal — /api/rag Q&A over the indexed project docs
//   ADVISOR :8092  RESERVED — run your own OpenAI-compatible server here and the
//                  build wizard's need-classifier switches to it automatically
//                  (until then it falls back to the chat model on :8080)
//   API     Build My AI backend — /v1/advise powers the wizard's plan step
//           when up; chat 👍/👎 ratings post to /v1/feedback (rating +
//           template + model id only, never any content); /v1/auth/* for
//           accounts. On a local page it's :8940 on this machine; on a real
//           domain it's SAME-ORIGIN relative (reverse proxy forwards /v1/*,
//           docs/22 P0-13) — no other host is ever constructible.
//   OLLAMA  :11434 the engine our guided installer sets up (OpenAI-compatible
//                  /v1) — the chat fallback rung when llm-lab isn't running,
//                  so a user who completed the real install can chat right here
// chat.html ladder: RAG (portal up) > general chat (8080) > Ollama (11434) > demo.
// build.html: the need box is classified into a template slug by ADVISOR/BASE.
// All model output is rendered via textContent — no HTML injection path.
(function () {
  var BASE = 'http://127.0.0.1:8080';
  var PORTAL = 'http://127.0.0.1:8090';
  var ADVISOR = 'http://127.0.0.1:8092';
  var OLLAMA = 'http://127.0.0.1:11434';
  var LOCAL_PAGE = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var API = LOCAL_PAGE ? 'http://127.0.0.1:8940' : '';
  var SYSTEM =
    'You are "Build My AI", a private AI assistant running fully on this computer. ' +
    'Be concise and helpful. Always reply in the same language as the user\'s last message ' +
    '(Chinese for Chinese, English for English). Plain text only — no markdown headings.';
  var TITLE_DEMO = { en: 'My Company Knowledge AI · demo preview', zh: '我的公司知识 AI · 演示预览' };
  var TITLE_CHAT = { en: 'My Local AI · general chat (no knowledge base yet)', zh: '我的本地 AI · 通用问答(暂未接知识库)' };
  var TITLE_RAG = { en: 'Project Knowledge AI · local RAG', zh: '项目知识 AI · 本地 RAG' };
  // suggested questions that the indexed project corpus can actually answer
  var RAG_CHIPS = [
    { en: 'What does the MVP include?', zh: 'MVP 都包含什么?' },
    { en: 'What is the pricing model?', zh: '定价策略是怎样的?' },
    { en: 'Who are the target users?', zh: '目标用户是谁?' },
    { en: 'What is the product roadmap?', zh: '产品路线图是什么?' }
  ];

  var isReady = false, ragUp = false, ollamaUp = false, ollamaTag = '', modelName = '', history = [];
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
    } else if (ollamaUp) {
      setText('.modelchip', modelName + ' · Ollama', modelName + ' · Ollama');
      setText('#chatTitle', TITLE_CHAT.en, TITLE_CHAT.zh);
      setText('.chat-hint',
        'Connected via Ollama · answers come from ' + modelName + ' running on this computer — nothing leaves your machine.',
        '已通过 Ollama 连接 · 回答来自本机运行的 ' + modelName + '——数据不离开你的电脑。');
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
        ollamaUp = false; // llm-lab has priority — it carries the RAG portal
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
      .catch(function () {
        clearTimeout(timer);
        isReady = ollamaUp; // stay ready while the Ollama rung holds — no demo-answer flicker mid-reprobe
        probeOllama();
      });
  }

  // Fallback rung: the Ollama engine our guided installer sets up (:11434,
  // OpenAI-compatible /v1). Only reached when llm-lab (8080) is down; the 15s
  // reprobe keeps watching for the richer llm-lab stack (it carries RAG).
  function probeOllama() {
    var pc = new AbortController();
    var timer = setTimeout(function () { pc.abort(); }, 1500);
    var wasUp = ollamaUp;
    fetch(OLLAMA + '/v1/models', { signal: pc.signal })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        clearTimeout(timer);
        var ids = ((j && j.data) || []).map(function (x) { return String(x.id || x.name || ''); }).filter(Boolean);
        if (!ids.length) throw new Error('no models installed');
        // prefer an instruct model (what the guided installer pulls), else the first
        ollamaTag = ids.filter(function (id) { return /instruct/i.test(id); })[0] || ids[0];
        modelName = prettyModel(ollamaTag);
        ollamaUp = true; isReady = true; ragUp = false;
        setChip();
        if (!wasUp) {
          toast(t('Local AI connected via Ollama: ' + modelName + ' — answers now come from your own AI.',
                  '已通过 Ollama 连接本地 AI:' + modelName + '——回答来自你自己的 AI。'));
        }
        scheduleReprobe();
      })
      .catch(function () {
        clearTimeout(timer);
        if (wasUp) { goOffline(); }              // Ollama died: full offline handling + chip
        else { ollamaUp = false; isReady = false; scheduleReprobe(); }
      });
  }

  function goOffline() {
    isReady = false; ragUp = false; ollamaUp = false; setChipOffline(); scheduleReprobe();
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
    var viaOllama = ollamaUp; // freeze the rung for this request's whole lifecycle
    try {
      var payload = {
        stream: true, temperature: 0.6, max_tokens: 512,
        messages: [{ role: 'system', content: SYSTEM }].concat(history)
      };
      if (viaOllama) payload.model = ollamaTag; // Ollama requires the tag; llama.cpp serves its loaded model
      var opts = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: me.ctrl.signal,
        body: JSON.stringify(payload)
      };
      // two literal fetches on purpose: the security suite proves every fetch
      // starts with a pinned constant (docs/18 §3 precedent)
      res = await (viaOllama ? fetch(OLLAMA + '/v1/chat/completions', opts)
                             : fetch(BASE + '/v1/chat/completions', opts));
      if (!res.ok || !res.body) throw new Error('bad response ' + (res && res.status));
    } catch (e) {
      if (cur === me) cur = null;
      if (e && e.name === 'AbortError') { live.done(); return; } // interrupt already settled by commitCurrent()
      if (!stale()) { commitCurrent(); goOffline(); }            // drops the dangling user turn
      if (viaOllama) {
        live.fail('(Ollama unreachable — back to demo answers. It starts automatically after a restart.)',
                  '(Ollama 连不上——已切回演示回答。重启电脑后 Ollama 会自动启动。)');
      } else {
        live.fail('(Local model unreachable — back to demo answers. Is `ai` still running?)',
                  '(本地模型连不上——已切回演示回答。`ai` 服务还在跑吗?)');
      }
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

  // ---- build.html: classify the need-box sentence into a template slug ----
  // The free text is sent ONLY to 127.0.0.1 (ADVISOR if up, else the chat
  // model) and never enters any generated file — build.js never reads the box.
  var advisorUp = false, advGen = 0, advTimer = null;
  function probeAdvisor() {
    var pc = new AbortController();
    var timer = setTimeout(function () { pc.abort(); }, 1500);
    fetch(ADVISOR + '/v1/models', { signal: pc.signal })
      .then(function (r) { clearTimeout(timer); advisorUp = r.ok; })
      .catch(function () { clearTimeout(timer); advisorUp = false; });
  }
  function classifyNeed(text) {
    var myGen = ++advGen;
    if ((!advisorUp && !isReady) || !text || text.length < 4) return;
    var pc = new AbortController();
    var timer = setTimeout(function () { pc.abort(); }, 8000);
    var opts = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: pc.signal,
      body: JSON.stringify({
        stream: false, temperature: 0, max_tokens: 6,
        messages: [
          { role: 'system', content:
            'Classify the user\'s AI need into exactly one of these template ids: ' +
            'company (internal company knowledge base), legal (contracts / legal review), ' +
            'writing (writing assistant), research (read papers / reports), ' +
            'support (customer support / product FAQ), data (spreadsheets / data analysis). ' +
            'Reply with the single id only, nothing else.' },
          { role: 'user', content: text }
        ]
      })
    };
    // two literal fetch sites (not one via a variable) so the security test can
    // prove every fetch target starts with a 127.0.0.1-pinned constant
    (advisorUp ? fetch(ADVISOR + '/v1/chat/completions', opts)
               : fetch(BASE + '/v1/chat/completions', opts))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        clearTimeout(timer);
        if (myGen !== advGen) return; // stale — the user kept typing
        var out = (j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
        var m = String(out).toLowerCase().match(/\b(company|legal|writing|research|support|data)\b/);
        if (m && window.__buildAdvisor) {
          window.__buildAdvisor.select(m[1], advisorUp ? t('your advisor AI @ :8092', '你的顾问 AI @ :8092') : modelName);
        }
      })
      .catch(function () { clearTimeout(timer); });
  }
  // reflect + capture the opt-in checkbox wherever it appears (build wizard).
  // The dashboard toggle uses window.__bmaConsent directly in its own script.
  function wireConsent() {
    var cb = document.getElementById('usageOptIn');
    if (!cb) return;
    cb.checked = consented();
    cb.addEventListener('change', function () { setConsent(cb.checked); });
  }
  function wireBuildPage() {
    var box = document.getElementById('needText');
    if (!box || !window.__buildAdvisor) return; // not the build wizard
    probeAdvisor();
    window.__buildAdvisor.planProvider = advisePlan; // backend API drives the plan step when up
    window.__buildAdvisor.reportPlan = reportPlan;   // anonymous plan stats on "Generate"
    box.addEventListener('input', function () {
      clearTimeout(advTimer);
      advTimer = setTimeout(function () { classifyNeed(box.value.trim()); }, 900);
    });
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { clearTimeout(advTimer); classifyNeed(box.value.trim()); }
    });
  }

  // ---- backend API (:8940 local / same-origin deployed): advise + feedback ----
  var apiUp = false;
  function probeApi() {
    var pc = new AbortController();
    var timer = setTimeout(function () { pc.abort(); }, 1500);
    fetch(API + '/v1/health', { signal: pc.signal })
      .then(function (r) { clearTimeout(timer); apiUp = r.ok; })
      .catch(function () { clearTimeout(timer); apiUp = false; });
  }
  // called by build.js's renderPlan; req is {template, mode, hardware} — slugs
  // and numbers only, no free text (build.js never reads the need box)
  function advisePlan(req, cb) {
    if (!apiUp) { cb(null); probeApi(); return; } // retry availability for next time
    var pc = new AbortController();
    var timer = setTimeout(function () { pc.abort(); }, 4000);
    fetch(API + '/v1/advise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: pc.signal,
      body: JSON.stringify(req)
    })
      .then(function (r) { if (!r.ok) throw new Error('bad response'); return r.json(); })
      .then(function (j) { clearTimeout(timer); cb(j && j.model ? j : null); })
      .catch(function () { clearTimeout(timer); apiUp = false; cb(null); });
  }
  // ---- usage-analytics consent (privacy.html promises OPT-IN) ----
  // The anonymous install/plan/feedback stats are sent ONLY after the user opts
  // in. Consent is device-local (the data carries no identity, so no account is
  // needed) in localStorage; the default (unset) is OFF. Both senders below gate
  // on consented(), and the build wizard / dashboard toggles flip it.
  var CONSENT_KEY = 'bma-usage-consent';
  function consented() {
    try { return localStorage.getItem(CONSENT_KEY) === 'on'; } catch (e) { return false; }
  }
  function setConsent(on) {
    try { localStorage.setItem(CONSENT_KEY, on ? 'on' : 'off'); } catch (e) {}
  }
  window.__bmaConsent = { get: consented, set: setConsent };

  // wizard "Generate" → /v1/telemetry/deploy. Fire-and-forget; payload is
  // built by build.js from slugs/tiers/booleans only (schema-whitelisted server-side).
  // Gated on opt-in consent — no consent, nothing sent (the privacy promise).
  function reportPlan(payload) {
    if (!apiUp || !payload || !consented()) return;
    fetch(API + '/v1/telemetry/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(function () { apiUp = false; });
  }
  // chat 👍/👎 → /v1/feedback. Structurally content-free: rating + template +
  // model id only. Sent only when a real local model answered (isReady) AND the
  // user has opted in to anonymous usage analytics.
  document.addEventListener('chat-feedback', function (e) {
    if (!isReady || !apiUp || !e.detail || !consented()) return;
    var modelId = String(modelName).replace(/[^A-Za-z0-9.\-]/g, '-');
    if (!/^[A-Za-z0-9.\-]{4,64}$/.test(modelId)) return;
    fetch(API + '/v1/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: e.detail.rating === 'up' ? 'up' : 'down',
                             template: 'company', model: modelId })
    }).catch(function () { apiUp = false; });
  });

  // ---- auth (API): real signup/login for signup.html ----
  // Identity fields go ONLY to the self-hosted API (users.db) — local :8940
  // in dev, same-origin behind the reverse proxy when deployed;
  // signup.js shows an explicit error when the API is unreachable (P0-14).
  function authCall(path, body, token, cb) {
    var pc = new AbortController();
    var timer = setTimeout(function () { pc.abort(); }, 4000);
    var opts = { method: body === null ? 'GET' : 'POST', headers: {}, signal: pc.signal };
    if (body !== null) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    fetch(API + path, opts)
      .then(function (r) {
        return r.json().then(function (j) { return { status: r.status, json: j }; });
      })
      .then(function (res) { clearTimeout(timer); cb(null, res); })
      .catch(function () { clearTimeout(timer); cb(new Error('offline'), null); });
  }
  window.__bmaAuth = {
    signup: function (body, cb) { authCall('/v1/auth/signup', body, null, cb); },
    login: function (body, cb) { authCall('/v1/auth/login', body, null, cb); },
    me: function (token, cb) { authCall('/v1/auth/me', null, token, cb); },
    logout: function (token, cb) { authCall('/v1/auth/logout', {}, token, cb); },
    // password recovery + email verification (P0-15) — all unauthenticated:
    // the emailed one-time token is the credential, carried in the body
    forgot: function (body, cb) { authCall('/v1/auth/forgot', body, null, cb); },
    reset: function (body, cb) { authCall('/v1/auth/reset', body, null, cb); },
    verify: function (body, cb) { authCall('/v1/auth/verify', body, null, cb); },
    // account self-service (dashboard + account.html) — the privacy policy's promises, live
    changePassword: function (token, body, cb) { authCall('/v1/account/password', body, token, cb); },
    changeEmail: function (token, body, cb) { authCall('/v1/account/email', body, token, cb); },
    logoutAll: function (token, cb) { authCall('/v1/account/logout-all', {}, token, cb); },
    exportData: function (token, cb) { authCall('/v1/account/export', null, token, cb); },
    deleteAccount: function (token, body, cb) { authCall('/v1/account/delete', body, token, cb); }
  };
  // ---- billing (API): start a Stripe-HOSTED checkout / portal (P0-1/2) ----
  // We never handle card data: these return a Stripe URL and the page does a
  // full-page redirect to it. authCall already pins to the API prefix, so no new
  // network target is introduced (the security test's egress lock stays intact).
  // checkout carries accept_terms: the caller MUST obtain the auto-renewal
  // clickwrap consent first (dashboard shows the disclosure + checkbox); the
  // server records the acceptance (version + time) before starting a subscription.
  window.__bmaBilling = {
    checkout: function (token, plan, cb) {
      authCall('/v1/billing/checkout', { plan: plan, accept_terms: true }, token, cb);
    },
    portal: function (token, cb) { authCall('/v1/billing/portal', {}, token, cb); }
  };

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
  document.addEventListener('DOMContentLoaded', function () { probe(); probeApi(); wireBuildPage(); wireConsent(); });
})();
