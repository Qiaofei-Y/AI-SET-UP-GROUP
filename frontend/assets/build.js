// Build My AI — guided wizard + installer / cloud-manual generator (client-side demo).
(function () {
  var STATE = { need: 'company', needText: '', os: 'win11', gpu: 'nvidia', vram: '12', ram: '32', mode: 'local' };
  var STEP = 0;
  var TOTAL = 4;
  var userPickedMode = false;   // true once the user clicks a Local/Cloud card herself
  var activeTemplate = null;    // template prefill currently shown in #needText
  var needEdited = false;       // true once the user types in #needText

  // ---- Advisor rule table ----
  // Offline mirror of backend/api/registry.json, ordered largest-first
  // (sync enforced by tests/security.test.js §8). best_for lists the needs a
  // model is strongest at; pickModel adds NEED_BONUS quality points on a match,
  // so the in-tier specialist wins while a much bigger generalist still takes over.
  // ollama = FULL pinned quant tag (short tags get re-pointed upstream; docs/22 P0-6 honesty
  // demands the generated installer pull exactly the model the plan card promised)
  var MODELS = [
    { id: 'qwen2.5-32b-instruct', name: 'Qwen2.5 32B Instruct', size: '~20 GB', file: 'qwen2.5-32b-instruct-q4_k_m.gguf', repo: 'Qwen/Qwen2.5-32B-Instruct-GGUF', quant: 'Q4_K_M', ollama: 'qwen2.5:32b-instruct-q4_K_M', vram: 24, quality: 92, speed: 62, best_for: ['company', 'legal', 'research', 'data'] },
    { id: 'qwen2.5-14b-instruct', name: 'Qwen2.5 14B Instruct', size: '~9 GB', file: 'qwen2.5-14b-instruct-q4_k_m.gguf', repo: 'Qwen/Qwen2.5-14B-Instruct-GGUF', quant: 'Q4_K_M', ollama: 'qwen2.5:14b-instruct-q4_K_M', vram: 12, quality: 85, speed: 78, best_for: ['company', 'legal', 'research', 'data'] },
    { id: 'llama-3.1-8b-instruct', name: 'Llama 3.1 8B Instruct', size: '~4.9 GB', file: 'Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf', repo: 'bartowski/Meta-Llama-3.1-8B-Instruct-GGUF', quant: 'Q4_K_M', ollama: 'llama3.1:8b-instruct-q4_K_M', vram: 8, quality: 78, speed: 88, best_for: ['company', 'writing', 'research'] },
    { id: 'qwen2.5-7b-instruct', name: 'Qwen2.5 7B Instruct', size: '~4.7 GB', file: 'qwen2.5-7b-instruct-q4_k_m.gguf', repo: 'Qwen/Qwen2.5-7B-Instruct-GGUF', quant: 'Q4_K_M', ollama: 'qwen2.5:7b-instruct-q4_K_M', vram: 8, quality: 76, speed: 88, best_for: ['data', 'support'] },
    { id: 'mistral-7b-instruct-v0.3', name: 'Mistral 7B Instruct v0.3', size: '~4.4 GB', file: 'Mistral-7B-Instruct-v0.3-Q4_K_M.gguf', repo: 'bartowski/Mistral-7B-Instruct-v0.3-GGUF', quant: 'Q4_K_M', ollama: 'mistral:7b-instruct-v0.3-q4_K_M', vram: 6, quality: 72, speed: 90, best_for: ['writing', 'support'] }
  ];
  var NEED_BONUS = 10;
  function pickModel(vram, need) {
    var v = parseInt(vram, 10);
    var score = function (m) { return m.quality + (m.best_for.indexOf(need) >= 0 ? NEED_BONUS : 0); };
    var pool = MODELS.filter(function (m) { return m.vram <= v; });
    if (!pool.length) pool = [MODELS[MODELS.length - 1]]; // smallest as the floor
    return pool.reduce(function (best, m) { return score(m) > score(best) ? m : best; });
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
    var m = pickModel(mode === 'cloud' ? '24' : vram, STATE.need);
    var rag = ragDefault(STATE.need);
    var gb = parseFloat((m.size.match(/[\d.]+/) || ['0'])[0]); // keep decimals: '~4.9 GB' → 4.9
    return {
      title: t('Private Knowledge Assistant · Balanced', '私有知识助手 · 均衡版'),
      model: m, rag: rag,
      matched: m.best_for.indexOf(STATE.need) >= 0,
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
  function offlineTag(id) { // resilience: an older API build may not carry the ollama tag yet
    var hit = MODELS.filter(function (x) { return x.id === id; })[0];
    return hit ? hit.ollama : '';
  }
  function planFromApi(j) {
    var m = j.model;
    return {
      title: t('Private Knowledge Assistant · Balanced', '私有知识助手 · 均衡版'),
      model: { name: m.name, quant: m.quant, repo: m.repo, file: m.file,
               size: '~' + m.size_gb + ' GB', ollama: m.ollama || offlineTag(m.id) },
      rag: j.rag, space: '~' + m.size_gb + ' GB',
      matched: (m.best_for || []).indexOf(STATE.need) >= 0,
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
        (p.matched ? ' · <span style="font-family:var(--mono);font-size:11px;color:var(--accent)">' +
          t('✦ model matched to this need', '✦ 模型按需求匹配') + '</span>' : '') +
        (p.fromApi ? ' · <span style="font-family:var(--mono);font-size:11px;color:var(--accent)">' +
          t('✦ live · model registry', '✦ 实时推荐 · 模型库') + '</span>' : '') + '</div>' +
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
  // The old PowerShell demo installer is retired (docs/22 P0-6): it could never
  // complete on a real machine. The Ollama path below is REAL — every command
  // works today. Builders are pure (model object in, text out) so the security
  // suite can execute them and assert on the actual artifacts.
  function isLlama(m) { return m.ollama.indexOf('llama') === 0; }
  function llamaNoticeMd(m) {
    return isLlama(m)
      ? '\n## License note — Built with Llama\n' +
        'This setup uses Llama 3.1, made available by Meta under the Llama 3.1 Community License:\n' +
        'https://www.llama.com/llama3_1/license/ · Acceptable Use Policy: https://www.llama.com/llama3_1/use-policy/\n'
      : '';
  }
  // Real guided installer: plain cmd batch — no PowerShell (that is what broke the
  // old demo), no admin rights, idempotent (safe to re-run, finished steps skip).
  function ollamaInstaller(m) {
    var lic = isLlama(m)
      ? 'echo  Built with Llama - Llama 3.1 Community License: https://www.llama.com/llama3_1/license/\r\n'
      : '';
    return '@echo off\r\n' +
      'setlocal EnableExtensions\r\n' +
      'title Build My AI - Guided Setup\r\n' +
      'echo ============================================================\r\n' +
      'echo  Build My AI - guided local setup (this install is real)\r\n' +
      'echo  Model:  ' + m.name + '  (' + m.size + ' download)\r\n' +
      'echo  Engine: Ollama - free and open-source, official installer\r\n' +
      'echo  Safe to re-run: finished steps are skipped automatically.\r\n' +
      'echo ============================================================\r\n' +
      'echo.\r\n' +
      'echo [1/4] Checking your NVIDIA graphics card...\r\n' +
      'where nvidia-smi >nul 2>nul\r\n' +
      'if errorlevel 1 (\r\n' +
      '  echo   No NVIDIA driver found. Your AI will run on the processor instead - it works, but noticeably slower.\r\n' +
      '  echo   Drivers: https://www.nvidia.com/en-us/drivers/\r\n' +
      '  echo   Press any key to continue anyway, or close this window to stop.\r\n' +
      '  pause >nul\r\n' +
      ') else (\r\n' +
      '  nvidia-smi --query-gpu=name,memory.total --format=csv,noheader\r\n' +
      ')\r\n' +
      'echo.\r\n' +
      'echo [2/4] Checking the Ollama engine...\r\n' +
      'where ollama >nul 2>nul\r\n' +
      'if errorlevel 1 (\r\n' +
      '  echo   Ollama is not installed yet. Opening the official download page...\r\n' +
      '  start https://ollama.com/download/windows\r\n' +
      '  echo   Run OllamaSetup.exe from your Downloads folder and click through it.\r\n' +
      '  echo   No admin rights needed. When it finishes, come back here and press any key.\r\n' +
      '  pause >nul\r\n' +
      ')\r\n' +
      'where ollama >nul 2>nul\r\n' +
      'if errorlevel 1 (\r\n' +
      '  echo   Still no Ollama found. Finish the Ollama install, then double-click this file again.\r\n' +
      '  echo   Nothing is lost - this setup continues where it left off.\r\n' +
      '  pause\r\n' +
      '  exit /b 1\r\n' +
      ')\r\n' +
      'echo   Ollama is ready.\r\n' +
      'echo.\r\n' +
      'echo [3/4] Downloading your AI model (' + m.size + '). This is the long step.\r\n' +
      'echo   If the download is interrupted, just run this file again - it resumes.\r\n' +
      'ollama pull ' + m.ollama + '\r\n' +
      'if errorlevel 1 (\r\n' +
      '  echo   The download did not finish. Check your internet connection and free disk space,\r\n' +
      '  echo   then double-click this file again.\r\n' +
      '  pause\r\n' +
      '  exit /b 1\r\n' +
      ')\r\n' +
      'echo.\r\n' +
      'echo [4/4] Asking your AI to say hello...\r\n' +
      'ollama run ' + m.ollama + ' "Say hello in one short sentence."\r\n' +
      'if errorlevel 1 (\r\n' +
      '  echo   The model did not answer. Restart your computer - Ollama starts automatically -\r\n' +
      '  echo   then double-click this file again.\r\n' +
      '  pause\r\n' +
      '  exit /b 1\r\n' +
      ')\r\n' +
      'echo.\r\n' +
      'echo ============================================================\r\n' +
      'echo  Done. Your AI is running on this computer.\r\n' +
      'echo  Any OpenAI-compatible app can talk to it at:  http://localhost:11434/v1\r\n' +
      'echo  Chat in this window anytime with:  ollama run ' + m.ollama + '\r\n' +
      'echo  Knowledge base (drop your documents) ships with our desktop app.\r\n' +
      lic +
      'echo ============================================================\r\n' +
      'pause\r\n';
  }

  // Step-by-step companion: same install done by hand — the SmartScreen /
  // locked-down-machine escape hatch, and the transparency artifact.
  function ollamaGuide(m) {
    return '# Set up your AI by hand — ' + m.name + '\n' +
      'Generated by Build My AI. Same result as the .bat installer, done step by step.\n' +
      'Time: mostly the model download (' + m.size + ').\n\n' +
      '## 1. Install the Ollama engine (free, open-source)\n' +
      'Download and run the official installer — no admin rights needed:\n' +
      'https://ollama.com/download/windows\n' +
      'Requires Windows 10 22H2 or newer. For NVIDIA acceleration, driver 551.61+ (https://www.nvidia.com/en-us/drivers/).\n\n' +
      '## 2. Download your model (' + m.size + ')\n' +
      'Open the Start menu, type `cmd`, press Enter, then paste:\n' +
      '```\nollama pull ' + m.ollama + '\n```\n' +
      'If the download is interrupted, run the same command again — it resumes.\n\n' +
      '## 3. Check it answers\n' +
      '```\nollama run ' + m.ollama + ' "Say hello in one short sentence."\n```\n' +
      'You can keep chatting right there, or type /bye to exit.\n\n' +
      '## 4. Connect apps (optional)\n' +
      'Your AI now serves an OpenAI-compatible API on this computer only:\n' +
      '```\nhttp://localhost:11434/v1\n```\n' +
      'Any app that accepts a custom OpenAI endpoint can use it (any API key value works).\n\n' +
      '## Troubleshooting\n' +
      '- "ollama is not recognized": close and reopen the cmd window (PATH updates after install).\n' +
      '- Download fails: check free disk space (need ' + m.size + ' plus headroom) and re-run the pull.\n' +
      '- Slow answers without an NVIDIA card: the model is running on your processor — expected.\n' +
      '- Model answers but apps can\'t connect: Ollama listens on 127.0.0.1:11434 by default (local only, by design).\n' +
      llamaNoticeMd(m) +
      '\n## What\'s next\n' +
      'The knowledge base (drop your documents, get sourced answers) ships with our desktop app.\n' +
      'Preview the Control Center on the website meanwhile.\n';
  }

  function installManifest(p) {
    var cloud = STATE.mode === 'cloud';
    return JSON.stringify({
      product: 'Build My AI', generated: 'client',
      need: STATE.need, mode: STATE.mode,
      install_method: cloud ? 'cloud_manual' : 'ollama_guided',
      target: { os: STATE.os, gpu: STATE.gpu, vram_gb: STATE.gpu === 'none' ? 0 : Number(STATE.vram), ram_gb: Number(STATE.ram) },
      plan: {
        model: p.model.name, quant: p.model.quant, model_file: p.model.file,
        source: 'huggingface.co/' + p.model.repo, approx_size: p.model.size,
        runtime: cloud ? 'llama.cpp server (CUDA)' : 'ollama',
        ollama_tag: cloud ? null : p.model.ollama,
        api: 'openai-compatible @ localhost:11434',
        rag: { enabled: false, planned: p.rag, note: 'knowledge base ships with the desktop app' }
      }
    }, null, 2);
  }

  function cloudManual(p) {
    var m = p.model;
    return '# Cloud Deployment Guide — ' + m.name + '\n' +
      'Generated by Build My AI for: **' + needLabel(STATE.need) + '**\n\n' +
      '> Use this when your own computer can\'t run the model, or you want it accessible from anywhere.\n' +
      '> This guide assumes basic comfort with a terminal — or a helper who has it (30–60 min).\n' +
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
      '## 5. Add your knowledge (RAG) — outline\n' +
      'The indexing pipeline (embed with bge-base-en-v1.5 → local Chroma store → retrieve top-k\n' +
      'into the prompt) ships with our desktop app. Until then this is an outline, not runnable code.\n\n' +
      '## 6. Connect your apps\n' :
      '## 5. Connect your apps\n') +
      'Point any OpenAI-compatible app at:\n' +
      '```\nhttp://<your-server-ip>:11434/v1\n```\n' +
      'with the API key from step 4. (Our Control Center integration is in preview on the website.)\n\n' +
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

  function timeEstimate(sizeLabel) { // minutes, dominated by the model download
    var gb = parseFloat((String(sizeLabel).match(/[\d.]+/) || ['5'])[0]);
    return gb <= 5 ? '10–25' : gb <= 10 ? '15–35' : '25–60';
  }
  // plain-language "what the installer does" — shown instead of raw script by default
  function installerSteps(m) {
    return t('What the installer does when you double-click it:',
             '双击安装包后,它会做这些事:') + '\n\n' +
      '1. ' + t('Checks your NVIDIA graphics card (continues on the processor if there is none — slower).',
                '检查你的 NVIDIA 显卡(没有也能继续,用处理器运行——会慢一些)。') + '\n' +
      '2. ' + t('Installs Ollama, a free open-source AI engine — the official installer opens and you click through it.',
                '安装 Ollama——免费开源的 AI 引擎,官方安装程序会弹出,按提示点击即可。') + '\n' +
      '3. ' + t('Downloads your model (', '下载你的模型(') + m.name + ', ' + m.size +
                t('). Interrupted? Run the file again — it resumes.', ')。中断了?再次运行即可续传。') + '\n' +
      '4. ' + t('Asks your AI to say hello, to prove it works.', '让你的 AI 说声 hello,验证一切正常。') + '\n\n' +
      t('Everything runs and stays on this computer.', '一切都在这台电脑上运行和保存。');
  }
  var rawView = false; // preview toggle state (reset on re-render)
  function renderOutput() {
    // generated files must match what the plan step showed: prefer the API plan
    var p = apiPlan ? planFromApi(apiPlan) : buildPlan();
    var isLocal = STATE.mode === 'local', isHybrid = STATE.mode === 'hybrid', isCloud = STATE.mode === 'cloud';
    STATE.installMethod = isCloud ? 'cloud_manual' : 'ollama_guided'; // one real method per mode (docs/22 P0-6/13)
    $('outTitle').textContent = isLocal ? t('Your installer is ready — this install is real', '你的安装包已生成——这是真实可用的安装')
                              : isHybrid ? t('Your hybrid files are ready — the local install is real', '你的混合部署文件已生成——本地安装真实可用')
                                         : t('Your cloud deployment guide is ready', '你的云端部署手册已生成');
    $('outLead').textContent = isCloud
      ? t('A step-by-step guide customized to your model, for a US GPU server. It assumes basic terminal comfort — or a helper who has it (30–60 min).',
          '为你的模型定制的分步手册,面向美国 GPU 服务器。需要基础命令行经验——或请人帮忙(30–60 分钟)。')
      : t('Double-click the .bat on your Windows machine. It installs Ollama — a free, open-source AI engine (the official installer opens; click through it) — downloads your model (' + p.model.size + '), and checks your AI is answering. About ' + timeEstimate(p.model.size) + ' minutes, mostly the download.',
          '在 Windows 电脑上双击这个 .bat。它会安装 Ollama——免费开源的 AI 引擎(官方安装程序会弹出,按提示点击)——下载你的模型(' + p.model.size + '),并检查 AI 已正常应答。大约 ' + timeEstimate(p.model.size) + ' 分钟,主要是下载时间。') +
        (isHybrid ? ' ' + t('The cloud guide sets up the heavy-task half. Hybrid is a Pro feature — free during beta; automatic routing arrives with Pro.',
                            '云端手册用于搭建处理繁重任务的那一半。混合为 Pro 功能——Beta 期免费;自动分流将随 Pro 推出。') : '');
    if (!isCloud && STATE.gpu === 'none') {
      $('outLead').textContent += ' ' + t('This computer has no NVIDIA graphics card: we recommend the cloud option. If you continue locally, your AI runs on the processor — it works, but noticeably slow.',
                                          '这台电脑没有 NVIDIA 显卡:我们推荐云端方案。如果坚持本地安装,AI 会用处理器运行——能用,但明显偏慢。');
    }
    // summary
    $('outSummary').innerHTML =
      kv(t('Purpose', '用途'), needLabel(STATE.need)) +
      kv(t('Model', '模型'), p.model.name + ' (' + p.model.quant + ')' +
        (isHybrid ? ' + ' + pickModel('24', STATE.need).name + t(' (cloud)', '(云端)') : '')) +
      kv(t('Install method', '安装方式'), isCloud
        ? t('Manual guide (cloud GPU) · works today', '手动手册(云 GPU)· 现已可用')
        : t('Guided (Ollama — free, open-source) · works today', '引导式(Ollama——免费开源)· 现已可用')) +
      kv(t('Runs', '运行方式'), isLocal ? t('On your computer', '本机')
                              : isHybrid ? t('Your computer + cloud for heavy tasks', '本机 + 繁重任务走云端')
                                         : t('Cloud GPU server', '云 GPU 服务器')) +
      kv(t('Knowledge / RAG', '知识库 / RAG'), p.rag
        ? t('Planned — ships with the desktop app', '规划中——随桌面应用推出')
        : t('Off', '关闭'));
    // downloads + preview
    var dl = $('outDownloads'), pv = $('outPreview'), fm = $('outFileMeta');
    dl.innerHTML = '';
    rawView = false;
    var manifest = installManifest(p);
    var toggle = $('pvToggle'), smart = $('smartNote');
    if (!isCloud) {
      var bat = ollamaInstaller(p.model), guide = ollamaGuide(p.model);
      addBtn(dl, t('⬇ Download installer (.bat) — double-click to run', '⬇ 下载安装包 (.bat)——双击即可运行'), 'primary', function () { download('install-my-ai.bat', bat, 'text/plain'); });
      addBtn(dl, t('Prefer step-by-step? Get the guide (.md)', '想一步一步来?下载图文指南 (.md)'), 'ghost', function () { download('ollama-setup-guide.md', guide, 'text/markdown'); });
      if (isHybrid) {
        var hybridManual = cloudManual(buildPlan('cloud'));
        addBtn(dl, t('⬇ Download cloud guide (.md)', '⬇ 下载云端手册 (.md)'), 'ghost', function () { download('cloud-deployment-guide.md', hybridManual, 'text/markdown'); });
      }
      addBtn(dl, t('Download the plan file (.json)', '下载方案清单 (.json)'), 'linkbtn', function () { download('install-plan.json', manifest, 'application/json'); });
      smart.classList.remove('hidden');
      fm.textContent = 'install-my-ai.bat + ollama-setup-guide.md' + (isHybrid ? ' + cloud-deployment-guide.md' : '');
      pv.textContent = installerSteps(p.model);
      toggle.classList.remove('hidden');
      toggle.onclick = function () {
        rawView = !rawView;
        pv.textContent = rawView ? bat : installerSteps(p.model);
        toggle.textContent = rawView ? t('Back to the plain-language view', '返回人话版说明')
                                     : t('View raw script', '查看原始脚本');
      };
      toggle.textContent = t('View raw script', '查看原始脚本');
    } else {
      var manual = cloudManual(p);
      addBtn(dl, t('⬇ Download guide (.md)', '⬇ 下载手册 (.md)'), 'primary', function () { download('cloud-deployment-guide.md', manual, 'text/markdown'); });
      addBtn(dl, t('Download the plan file (.json)', '下载方案清单 (.json)'), 'linkbtn', function () { download('install-plan.json', manifest, 'application/json'); });
      smart.classList.add('hidden');
      toggle.classList.add('hidden');
      fm.textContent = 'cloud-deployment-guide.md · ' + t('preview', '预览');
      pv.textContent = manual;
    }
    // coming-soon chips: visibility follows the mode (never selectable — honesty by design)
    $('chipDesktop').classList.toggle('hidden', isCloud);
    $('chipLambda').classList.toggle('hidden', isLocal);
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
          mode: STATE.mode, success: true,
          // closed enum, whitelisted server-side — segments install success by method
          install_method: STATE.mode === 'cloud' ? 'cloud_manual' : 'ollama_guided'
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
