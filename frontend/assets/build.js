// Build My AI — guided wizard + installer / cloud-manual generator (client-side demo).
(function () {
  var STATE = { need: 'company', needText: '', os: 'win11', gpu: 'nvidia', vram: '12', ram: '32', mode: 'local' };
  var STEP = 0;
  var TOTAL = 4;
  var userPickedMode = false;   // true once the user clicks a Local/Cloud card herself
  var activeTemplate = null;    // template prefill currently shown in #needText
  var needEdited = false;       // true once the user types in #needText

  // ---- Advisor rule table (scenario is used for RAG default; model tier from VRAM) ----
  function pickModel(vram) {
    var v = parseInt(vram, 10);
    if (v >= 24) return { name: 'Qwen2.5 32B Instruct', size: '~20 GB', file: 'qwen2.5-32b-instruct-q4_k_m.gguf', repo: 'Qwen/Qwen2.5-32B-Instruct-GGUF', quant: 'Q4_K_M', quality: 92, speed: 62 };
    if (v >= 12) return { name: 'Qwen2.5 14B Instruct', size: '~9 GB', file: 'qwen2.5-14b-instruct-q4_k_m.gguf', repo: 'Qwen/Qwen2.5-14B-Instruct-GGUF', quant: 'Q4_K_M', quality: 85, speed: 78 };
    return { name: 'Llama 3.1 8B Instruct', size: '~4.9 GB', file: 'Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf', repo: 'bartowski/Meta-Llama-3.1-8B-Instruct-GGUF', quant: 'Q4_K_M', quality: 78, speed: 88 };
  }
  function ragDefault(need) { return need !== 'writing'; } // all doc-grounded needs get RAG; writing works from style samples
  function needLabel(k) {
    return { company: t('Company Knowledge AI', '公司知识 AI'), legal: t('Contract & Legal Review', '合同 / 法务审阅'),
             writing: t('Writing Assistant', '写作助手'), research: t('Research Assistant', '研究助手'),
             support: t('Customer Support AI', '客服 AI'), data: t('Data Analyst AI', '数据分析 AI') }[k];
  }

  function buildPlan(modeOverride) {
    var mode = modeOverride || STATE.mode;
    // no dedicated GPU: the VRAM dropdown must not drive the pick — local falls back
    // to the smallest sensible config (cloud is the recommended path in that case)
    var vram = STATE.gpu === 'none' ? '8' : STATE.vram;
    // cloud gets a bigger tier; hybrid's on-device half is sized like local
    var m = pickModel(mode === 'cloud' ? '24' : vram);
    var rag = ragDefault(STATE.need);
    var gb = parseFloat((m.size.match(/[\d.]+/) || ['0'])[0]); // keep decimals: '~4.9 GB' → 4.9
    return {
      title: t('Private Knowledge Assistant · Balanced', '私有知识助手 · 均衡版'),
      model: m, rag: rag,
      space: m.size,
      quality: m.quality, speed: m.speed,
      spacePct: mode === 'cloud' ? 30 : Math.min(70, Math.round((gb / 24) * 100))
    };
  }

  // ---- rendering ----
  function $(id) { return document.getElementById(id); }
  function renderProgress() {
    var dots = document.querySelectorAll('#progress .dot');
    dots.forEach(function (d, i) {
      d.className = 'dot' + (i < STEP ? ' done' : i === STEP ? ' on' : '');
    });
    var labels = [t('Need', '需求'), t('Computer', '电脑'), t('Plan', '方案'), t('Get files', '拿到文件')];
    var num = (STEP + 1) + '/' + TOTAL;
    $('steplabel').textContent = t('Step ' + num + ' · ' + labels[STEP], '第 ' + num + ' 步 · ' + labels[STEP]);
  }
  function showStep(n) {
    STEP = n;
    for (var i = 0; i < TOTAL; i++) $('step' + i).classList.toggle('hidden', i !== n);
    if (n === 2) {
      // default the run mode from the GPU answer until the user picks one explicitly
      if (!userPickedMode) STATE.mode = (STATE.gpu === 'none') ? 'cloud' : 'local';
      renderPlan();
    }
    if (n === 3) renderOutput();
    renderProgress();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Backend API plan, fetched via the planProvider hook that local-llm.js (the
  // only network-capable file) registers. apiPlan holds the /v1/advise answer
  // for the current render; planGen invalidates stale responses when the user
  // switches mode or navigates back and forth.
  var apiPlan = null, planGen = 0;
  function planFromApi(j) {
    var m = j.model;
    return {
      title: t('Private Knowledge Assistant · Balanced', '私有知识助手 · 均衡版'),
      model: { name: m.name, quant: m.quant, repo: m.repo, file: m.file, size: '~' + m.size_gb + ' GB' },
      rag: j.rag, space: '~' + m.size_gb + ' GB',
      quality: m.quality, speed: m.speed,
      spacePct: STATE.mode === 'cloud' ? 30 : Math.min(70, Math.round((m.size_gb / 24) * 100)),
      fromApi: true
    };
  }
  function renderPlan() {
    var myGen = ++planGen;
    apiPlan = null;
    drawPlan(buildPlan());
    var provider = window.__buildAdvisor && window.__buildAdvisor.planProvider;
    if (provider) {
      provider({
        template: STATE.need, mode: STATE.mode,
        hardware: { gpu: STATE.gpu, vram_gb: Number(STATE.vram), ram_gb: Number(STATE.ram) }
      }, function (api) {
        if (myGen !== planGen || !api) return; // stale, or API down — the rule plan stands
        apiPlan = api;
        drawPlan(planFromApi(api));
      });
    }
  }
  function drawPlan(p) {
    var isHybrid = STATE.mode === 'hybrid';
    var localNoGpu = STATE.gpu === 'none' && STATE.mode !== 'cloud'; // local and hybrid both have an on-device half
    var runsWhere = STATE.mode === 'cloud' ? t('runs in the cloud', '云端运行')
                  : isHybrid ? t('runs on your computer + cloud for heavy tasks', '本机运行 + 繁重任务走云端')
                  : t('runs on your computer', '本机运行');
    $('planBox').innerHTML =
      '<span class="pick">✦ ' + t('BEST MATCH', '最佳匹配') + '</span>' +
      '<h3>' + p.title + '</h3>' +
      '<div class="desc">' + t('For: ', '用于:') + needLabel(STATE.need) + ' · ' + runsWhere +
        (p.fromApi ? ' · <span style="font-family:var(--mono);font-size:11px;color:var(--accent)">' +
          t('✦ live · model registry @ :8940', '✦ 实时推荐 · 模型库 @ :8940') + '</span>' : '') + '</div>' +
      meter(t('Answer quality', '回答质量'), t('Very good', '很好'), p.quality, 'var(--accent)') +
      meter(t('Response speed', '响应速度'), t('Fast', '快'), p.speed, 'var(--info)') +
      meter(t('Space used', '占用空间'), p.space, p.spacePct, 'var(--clay)') +
      (localNoGpu ?
        '<div style="margin-top:12px;font-size:13px;color:var(--clay)">⚠ ' +
        t('The on-device part needs an NVIDIA graphics card and this computer doesn\'t have one. We recommend the cloud option below.',
          '本机运行的部分需要 NVIDIA 显卡,而这台电脑没有。我们推荐下方的云端方案。') + '</div>' : '') +
      '<details class="adv"><summary>' + t('Advanced (for the technical)', '高级模式(给懂技术的人看)') + '</summary><table>' +
        row(t('Recommended model', '推荐模型'), p.model.name + ' (' + p.model.quant + ')') +
        (isHybrid ? row(t('Cloud escalation model', '云端升级模型'), pickModel('24').name) : '') +
        row(t('Runtime', '推理运行时'), 'llama.cpp server (CUDA)') +
        row(t('Knowledge / RAG', '知识库 / RAG'), p.rag ? t('On · bge-base-en + local vector store', '开启 · bge-base-en + 本地向量库') : t('Off', '关闭')) +
        row(t('Source', '下载来源'), 'huggingface.co / ' + p.model.repo) +
      '</table></details>';
    syncModeCards();
  }
  // mode cards reflect STATE: selection, ✦ RECOMMENDED badge and the no-GPU warning
  function syncModeCards() {
    var noGpu = STATE.gpu === 'none';
    document.querySelectorAll('#step2 .opt').forEach(function (o) {
      var isSel = o.getAttribute('data-mode') === STATE.mode;
      o.classList.toggle('sel', isSel);
      o.setAttribute('aria-checked', isSel ? 'true' : 'false');
      o.classList.toggle('rec', noGpu ? o.getAttribute('data-mode') === 'cloud'
                                      : o.getAttribute('data-mode') === 'local');
    });
    var recLocal = $('recLocal'), recCloud = $('recCloud'), warn = $('localGpuWarn'), warnH = $('hybridGpuWarn');
    if (recLocal) recLocal.classList.toggle('hidden', noGpu);
    if (recCloud) recCloud.classList.toggle('hidden', !noGpu);
    if (warn) warn.classList.toggle('hidden', !noGpu);
    if (warnH) warnH.classList.toggle('hidden', !noGpu);
  }
  function meter(label, val, pct, color) {
    return '<div class="meter"><div class="top"><span>' + label + '</span><b>' + val + '</b></div>' +
      '<div class="track"><div class="fill" style="width:' + pct + '%;background:' + color + '"></div></div></div>';
  }
  function row(k, v) { return '<tr><td>' + k + '</td><td>' + v + '</td></tr>'; }

  // ---- generators ----
  function localInstaller(p) {
    var rag = p.rag;
    return '# Build My AI — one-click local installer (generated)\n' +
      '# Target: Windows + NVIDIA · Model: ' + p.model.name + '\n' +
      '# This PowerShell payload runs automatically when you double-click build-my-ai-setup.bat.\n' +
      '# Windows may show a UAC or SmartScreen prompt — choose "Run" / "Yes" to continue.\n\n' +
      '$ErrorActionPreference = "Stop"\n' +
      '$Root  = "$env:LOCALAPPDATA\\BuildMyAI"\n' +
      '$Model = "' + p.model.file + '"\n' +
      '$Repo  = "' + p.model.repo + '"\n\n' +
      'Write-Host "[1/5] Checking NVIDIA GPU..."\n' +
      'if (-not (Get-Command nvidia-smi -ErrorAction SilentlyContinue)) {\n' +
      '  Write-Host "No NVIDIA driver found. Get it at https://www.nvidia.com/en-us/drivers/ then re-run."; exit 1 }\n' +
      'nvidia-smi --query-gpu=name,memory.total --format=csv,noheader\n\n' +
      'Write-Host "[2/5] Preparing runtime (llama.cpp server, CUDA build)..."\n' +
      'New-Item -ItemType Directory -Force -Path "$Root\\runtime","$Root\\models","$Root\\knowledge" | Out-Null\n' +
      '# (installer bundles a prebuilt llama-server.exe; download step omitted in this demo script)\n\n' +
      'Write-Host "[3/5] Downloading AI model (' + p.model.size + ') from Hugging Face (US CDN)..."\n' +
      '$Url = "https://huggingface.co/$Repo/resolve/main/$Model"\n' +
      'Invoke-WebRequest -Uri $Url -OutFile "$Root\\models\\$Model" -Resume\n\n' +
      (rag ?
      'Write-Host "[4/5] Configuring knowledge engine (RAG: bge-base-en + local vector store)..."\n' +
      '# embeds files you drop into $Root\\knowledge and builds a local index\n\n' :
      'Write-Host "[4/5] Skipping RAG (not needed for this setup)..."\n\n') +
      'Write-Host "[5/5] Starting your AI (OpenAI-compatible API on http://localhost:11434)..."\n' +
      'Start-Process "$Root\\runtime\\llama-server.exe" -ArgumentList "-m `"$Root\\models\\$Model`" --port 11434 --host 127.0.0.1"\n' +
      'Start-Sleep -Seconds 3\n' +
      'Start-Process "http://localhost:11434"\n' +
      'Write-Host "Done. Your AI is running locally. Open the Control Center from the tray icon."\n';
  }

  // PowerShell -EncodedCommand expects base64 of UTF-16LE text
  function toUtf16leBase64(s) {
    var bytes = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      bytes += String.fromCharCode(c & 0xff, (c >> 8) & 0xff);
    }
    return btoa(bytes);
  }
  // double-clickable wrapper: a .bat that runs the PowerShell payload itself
  function batInstaller(script) {
    return '@echo off\r\n' +
      'title Build My AI - Installer\r\n' +
      'echo Installing your AI. Progress will appear below - keep this window open.\r\n' +
      'powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ' + toUtf16leBase64(script) + '\r\n' +
      'pause\r\n';
  }

  function installManifest(p) {
    return JSON.stringify({
      product: 'Build My AI', generated: 'client-demo',
      need: STATE.need, mode: STATE.mode,
      target: { os: STATE.os, gpu: STATE.gpu, vram_gb: STATE.gpu === 'none' ? 0 : Number(STATE.vram), ram_gb: Number(STATE.ram) },
      plan: {
        model: p.model.name, quant: p.model.quant, model_file: p.model.file,
        source: 'huggingface.co/' + p.model.repo, approx_size: p.model.size,
        runtime: 'llama.cpp server (CUDA)', api: 'openai-compatible @ localhost:11434',
        rag: p.rag ? { enabled: true, embedding: 'bge-base-en-v1.5', vector_store: 'chroma-local' } : { enabled: false }
      }
    }, null, 2);
  }

  function cloudManual(p) {
    var m = p.model;
    return '# Cloud Deployment Guide — ' + m.name + '\n' +
      'Generated by Build My AI for: **' + needLabel(STATE.need) + '**\n\n' +
      '> Use this when your own computer can\'t run the model, or you want it accessible from anywhere.\n' +
      '> All providers below are US-based. Your documents will leave your computer when you use cloud inference.\n\n' +
      '## 1. Rent a GPU server (US region)\n' +
      'Pick one and launch an instance with a GPU that has at least ' + (m.name.indexOf('32B') >= 0 ? '24 GB' : m.name.indexOf('14B') >= 0 ? '16 GB' : '12 GB') + ' of graphics card memory:\n' +
      '- RunPod — https://www.runpod.io (per-hour, US data centers)\n' +
      '- Lambda — https://lambda.ai\n' +
      '- AWS EC2 (g6 family, us-east-1) — https://aws.amazon.com/ec2/instance-types/g6/\n\n' +
      'Choose an image with CUDA drivers preinstalled (e.g. "PyTorch" or "CUDA 12" template).\n\n' +
      '## 2. Install the runtime\n' +
      '```bash\n' +
      'sudo apt-get update && sudo apt-get install -y build-essential git cmake\n' +
      'git clone https://github.com/ggml-org/llama.cpp && cd llama.cpp\n' +
      'cmake -B build -DGGML_CUDA=ON && cmake --build build --config Release -j\n' +
      '```\n\n' +
      '## 3. Download the model (' + m.size + ')\n' +
      '```bash\n' +
      'pip install -U "huggingface_hub[cli]"\n' +
      'hf download ' + m.repo + ' ' + m.file + ' --local-dir ./models\n' +
      '```\n\n' +
      '## 4. Start an OpenAI-compatible API\n' +
      '```bash\n' +
      './build/bin/llama-server -m ./models/' + m.file + ' \\\n' +
      '  --host 0.0.0.0 --port 11434 --api-key "YOUR_SECRET_KEY"\n' +
      '```\n' +
      'Open port 11434 in the provider\'s firewall/security group (restrict to your IP).\n\n' +
      (p.rag ?
      '## 5. Add your knowledge (RAG)\n' +
      '```bash\n' +
      'pip install chromadb sentence-transformers\n' +
      '# embed with bge-base-en-v1.5, index into a local Chroma store,\n' +
      '# retrieve top-k and prepend to the prompt at query time.\n' +
      '```\n\n' +
      '## 6. Point the web app here\n' :
      '## 5. Point the web app here\n') +
      'In Build My AI → Control Center → API, set the base URL to:\n' +
      '```\nhttp://<your-server-ip>:11434/v1\n```\n' +
      'and paste the API key from step 4.\n\n' +
      '## Cost note\n' +
      'A GPU left running 24/7 costs roughly $145–540 / month. If usage is light and bursty,\n' +
      'stop the instance when idle, or use a per-request API instead — cheaper unless traffic is high and steady.\n';
  }

  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  }

  function renderOutput() {
    // generated files must match what the plan step showed: prefer the API plan
    var p = apiPlan ? planFromApi(apiPlan) : buildPlan();
    var isLocal = STATE.mode === 'local', isHybrid = STATE.mode === 'hybrid';
    $('outTitle').textContent = isLocal ? t('Your local installer is ready', '你的本地安装包已生成')
                              : isHybrid ? t('Your hybrid setup files are ready', '你的混合部署文件已生成')
                                         : t('Your cloud deployment guide is ready', '你的云端部署手册已生成');
    $('outLead').textContent = isLocal
      ? t('Download it and double-click it on your Windows machine. It installs everything — no command line needed.', '下载后在你的 Windows 电脑上双击运行,自动装好一切,无需命令行。')
      : isHybrid
      ? t('The installer sets up the private half on your Windows machine; the guide sets up a cloud model for heavy tasks. Hybrid is a Pro feature — free during beta.', '安装包在你的 Windows 电脑上装好私密的本地部分;手册用于搭建处理繁重任务的云端模型。混合模式为 Pro 功能——Beta 期免费。')
      : t('A step-by-step guide customized to your model, for a US GPU server.', '为你的模型定制的分步手册,面向美国 GPU 服务器。');
    if ((isLocal || isHybrid) && STATE.gpu === 'none') {
      $('outLead').textContent += ' ' + t('Note: the on-device part needs an NVIDIA graphics card and you told us this computer doesn\'t have one — the installer will stop at the graphics card check. We recommend the cloud option instead.',
                                          '注意:本机运行的部分需要 NVIDIA 显卡,而你填写的电脑没有——安装程序会在显卡检查处停止。我们推荐改用云端方案。');
    }
    // summary
    $('outSummary').innerHTML =
      kv(t('Purpose', '用途'), needLabel(STATE.need)) +
      kv(t('Model', '模型'), p.model.name + ' (' + p.model.quant + ')' +
        (isHybrid ? ' + ' + pickModel('24').name + t(' (cloud)', '(云端)') : '')) +
      kv(t('Runs', '运行方式'), isLocal ? t('On your computer', '本机')
                              : isHybrid ? t('Your computer + cloud for heavy tasks', '本机 + 繁重任务走云端')
                                         : t('Cloud GPU server', '云 GPU 服务器')) +
      kv(t('Knowledge / RAG', '知识库 / RAG'), p.rag ? t('On', '开启') : t('Off', '关闭'));
    // downloads + preview
    var dl = $('outDownloads'), pv = $('outPreview'), fm = $('outFileMeta');
    dl.innerHTML = '';
    if (isLocal || isHybrid) {
      var script = localInstaller(p), manifest = installManifest(p);
      var bat = batInstaller(script);
      addBtn(dl, t('⬇ Download installer (.bat) — double-click to install', '⬇ 下载安装包 (.bat)——双击即可安装'), 'primary', function () { download('build-my-ai-setup.bat', bat, 'text/plain'); });
      addBtn(dl, t('⬇ Download plan (.json)', '⬇ 下载方案清单 (.json)'), 'ghost', function () { download('install-plan.json', manifest, 'application/json'); });
      if (isHybrid) {
        var hybridManual = cloudManual(buildPlan('cloud'));
        addBtn(dl, t('⬇ Download cloud guide (.md)', '⬇ 下载云端手册 (.md)'), 'ghost', function () { download('cloud-deployment-guide.md', hybridManual, 'text/markdown'); });
        fm.textContent = 'build-my-ai-setup.bat + cloud-deployment-guide.md · ' + t('preview shows the installer', '预览为安装包内容');
      } else {
        fm.textContent = 'build-my-ai-setup.bat · ' + t('preview of the install steps it runs', '内含安装步骤预览');
      }
      pv.textContent = script;
    } else {
      var manual = cloudManual(p);
      addBtn(dl, t('⬇ Download guide (.md)', '⬇ 下载手册 (.md)'), 'primary', function () { download('cloud-deployment-guide.md', manual, 'text/markdown'); });
      fm.textContent = 'cloud-deployment-guide.md · ' + t('preview', '预览');
      pv.textContent = manual;
    }
  }
  function kv(k, v) { return '<div class="kv"><span>' + k + '</span><b>' + v + '</b></div>'; }
  function addBtn(parent, label, cls, fn) {
    var b = document.createElement('button'); b.className = 'btn ' + cls; b.textContent = label; b.onclick = fn;
    parent.appendChild(b);
  }

  // template slug (from homepage ?template=) — one wizard card per homepage template,
  // so the card the user clicked is the card that lights up here
  var TEMPLATES = {
    company: { need: 'company', en: 'A private AI that reads my company PDFs, Excel and internal docs', zh: '一个能读公司 PDF、Excel 和内部资料的私有 AI' },
    legal: { need: 'legal', en: 'An AI that reviews contracts and finds clauses, terms and risks', zh: '一个审阅合同、查找条款与风险的 AI' },
    writing: { need: 'writing', en: 'A writing assistant that drafts and polishes in my voice', zh: '一个按我的风格起草、润色的写作助手' },
    research: { need: 'research', en: 'A research assistant that reads papers and summarizes with sources', zh: '一个读论文并带来源归纳的研究助手' },
    support: { need: 'support', en: 'A customer support AI that answers from my product docs and FAQs', zh: '一个基于产品文档和 FAQ 回答的客服 AI' },
    data: { need: 'data', en: 'A data analyst AI I can ask about my spreadsheets in plain words', zh: '一个能用人话问我表格的数据分析 AI' }
  };
  function applyTemplate() {
    var slug = (location.search.match(/[?&]template=([a-z]+)/) || [])[1];
    if (!slug || !Object.prototype.hasOwnProperty.call(TEMPLATES, slug)) return; // own keys only — never the prototype chain
    var tpl = TEMPLATES[slug];
    STATE.need = tpl.need;
    activeTemplate = tpl;
    document.querySelectorAll('#step0 .tmpl').forEach(function (el) {
      var isSel = el.getAttribute('data-need') === tpl.need;
      el.classList.toggle('sel', isSel);
      el.setAttribute('aria-checked', isSel ? 'true' : 'false');
    });
    writeTemplatePrefill();
  }
  // (write-only: we never read the box's value back)
  function writeTemplatePrefill() {
    var box = $('needText');
    if (box && activeTemplate && !needEdited) box.value = (window.__lang === 'zh' ? activeTemplate.zh : activeTemplate.en);
  }
  // Local-AI advisor hook. local-llm.js (the ONLY file allowed to talk to the
  // network, 127.0.0.1-pinned) reads the need box, classifies the sentence with
  // the local model, and calls select() with a template slug. build.js itself
  // never reads the box and never touches the network.
  var lastAdvice = null;
  window.__buildAdvisor = {
    needs: ['company', 'legal', 'writing', 'research', 'support', 'data'],
    select: function (slug, via) {
      if (window.__buildAdvisor.needs.indexOf(slug) === -1) return;
      document.querySelectorAll('#step0 .tmpl').forEach(function (x) {
        var isSel = x.getAttribute('data-need') === slug;
        x.classList.toggle('sel', isSel);
        x.setAttribute('aria-checked', isSel ? 'true' : 'false');
      });
      STATE.need = slug;
      lastAdvice = { slug: slug, via: via };
      renderAdviceHint();
    }
  };
  function renderAdviceHint() {
    var h = $('advisorHint');
    if (!h || !lastAdvice) return;
    h.classList.remove('hidden');
    h.textContent = '🤖 ' + t('Your local AI picked: ', '你的本地 AI 已选中:') +
      needLabel(lastAdvice.slug) + (lastAdvice.via ? ' · ' + lastAdvice.via : '');
  }

  // bilingual accessible names that can't live in static attributes
  function applyA11yLabels() {
    var box = $('needText');
    if (box) box.setAttribute('aria-label', t('Describe what you want your AI to do', '描述你想让 AI 帮你做什么'));
    var tg = $('tmplGroup');
    if (tg) tg.setAttribute('aria-label', t('Choose an AI type', '选择 AI 类型'));
    var mg = $('modeGroup');
    if (mg) mg.setAttribute('aria-label', t('Choose where your AI runs', '选择 AI 的运行位置'));
  }
  // Enter/Space on a focused card behaves like a click
  function keyActivates(el) {
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); el.click(); }
    });
  }

  // ---- wire up ----
  document.addEventListener('DOMContentLoaded', function () {
    // template selection (click or Enter/Space)
    document.querySelectorAll('#step0 .tmpl').forEach(function (el) {
      el.addEventListener('click', function () {
        document.querySelectorAll('#step0 .tmpl').forEach(function (x) {
          x.classList.remove('sel'); x.setAttribute('aria-checked', 'false');
        });
        el.classList.add('sel'); el.setAttribute('aria-checked', 'true');
        STATE.need = el.getAttribute('data-need');
        // a manual pick overrides (and hides) the local-AI suggestion
        if (lastAdvice && lastAdvice.slug !== STATE.need) {
          lastAdvice = null;
          var hint = $('advisorHint');
          if (hint) hint.classList.add('hidden');
        }
        // a manual pick of a different need retires the URL-template prefill
        // (and clears the untouched prefill text, so a stale sentence in the
        //  old language doesn't linger; write-only — we never read the box)
        if (activeTemplate && activeTemplate.need !== STATE.need) {
          activeTemplate = null;
          var box = $('needText');
          if (box && !needEdited) box.value = '';
        }
      });
      keyActivates(el);
    });
    applyTemplate();
    applyA11yLabels();
    var needBox = $('needText');
    if (needBox) needBox.addEventListener('input', function () { needEdited = true; });
    // device form
    ['os', 'gpu', 'vram', 'ram'].forEach(function (k) {
      var sel = $('f_' + k);
      if (sel) sel.addEventListener('change', function () {
        STATE[k] = sel.value;
        if (k === 'gpu') {
          var vramSel = $('f_vram');
          if (vramSel) vramSel.disabled = (STATE.gpu === 'none'); // no GPU → no graphics memory to pick
          userPickedMode = false; // re-derive the recommended mode on the next step
        }
      });
    });
    // mode selection (click or Enter/Space)
    document.querySelectorAll('#step2 .opt').forEach(function (o) {
      o.addEventListener('click', function () {
        STATE.mode = o.getAttribute('data-mode');
        userPickedMode = true;
        renderPlan();
      });
      keyActivates(o);
    });
    // nav buttons
    $('n0').onclick = function () { showStep(1); };
    $('b1').onclick = function () { showStep(0); };
    $('n1').onclick = function () { showStep(2); };
    $('b2').onclick = function () { showStep(1); };
    $('gen').onclick = function () {
      // anonymous plan stats for the deployment-data flywheel: slugs, tiers and
      // booleans only. Sent via the reportPlan hook (local-llm.js, API up) and
      // only when the plan itself came from the API — so ids match the registry.
      var report = window.__buildAdvisor && window.__buildAdvisor.reportPlan;
      if (report && apiPlan && apiPlan.model && apiPlan.model.id) {
        report({
          stage: 'plan_generated', template: STATE.need, model: apiPlan.model.id,
          os: STATE.os, gpu: STATE.gpu,
          vram_gb: STATE.gpu === 'none' ? 0 : Number(STATE.vram), ram_gb: Number(STATE.ram),
          mode: STATE.mode, success: true
        });
      }
      showStep(3);
    };
    $('b3').onclick = function () { showStep(2); };
    $('restart').onclick = function () { showStep(0); };
    showStep(0);
  });
  // re-render dynamic panels on language change
  document.addEventListener('langchange', function () {
    if (STEP === 2) renderPlan();
    if (STEP === 3) renderOutput();
    renderProgress();
    applyA11yLabels();
    writeTemplatePrefill(); // untouched template prefill follows the language
    renderAdviceHint();     // AI-pick hint follows the language too
  });
})();
