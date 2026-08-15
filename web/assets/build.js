// Build My AI — guided wizard + installer / cloud-manual generator (client-side demo).
(function () {
  var STATE = { need: 'company', needText: '', os: 'win11', gpu: 'nvidia', vram: '12', ram: '32', mode: 'local' };
  var STEP = 0;
  var TOTAL = 4;

  // ---- Advisor rule table (scenario is used for RAG default; model tier from VRAM) ----
  function pickModel(vram) {
    var v = parseInt(vram, 10);
    if (v >= 24) return { name: 'Qwen2.5 32B Instruct', size: '~20 GB', file: 'qwen2.5-32b-instruct-q4_k_m.gguf', repo: 'Qwen/Qwen2.5-32B-Instruct-GGUF', quant: 'Q4_K_M', quality: 92, speed: 62 };
    if (v >= 12) return { name: 'Qwen2.5 14B Instruct', size: '~9 GB', file: 'qwen2.5-14b-instruct-q4_k_m.gguf', repo: 'Qwen/Qwen2.5-14B-Instruct-GGUF', quant: 'Q4_K_M', quality: 85, speed: 78 };
    return { name: 'Llama 3.1 8B Instruct', size: '~4.9 GB', file: 'Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf', repo: 'bartowski/Meta-Llama-3.1-8B-Instruct-GGUF', quant: 'Q4_K_M', quality: 78, speed: 88 };
  }
  function ragDefault(need) { return need === 'company' || need === 'research'; }
  function needLabel(k) {
    return { company: t('Company Knowledge AI', '公司知识 AI'), writing: t('Writing Assistant', '写作助手'),
             research: t('Research Assistant', '研究助手'), general: t('General Assistant', '通用助手') }[k];
  }

  function buildPlan() {
    var m = pickModel(STATE.mode === 'cloud' ? '24' : STATE.vram); // cloud gets a bigger tier
    var rag = ragDefault(STATE.need);
    return {
      title: t('Private Knowledge Assistant · Balanced', '私有知识助手 · 均衡版'),
      model: m, rag: rag,
      space: m.size,
      quality: m.quality, speed: m.speed,
      spacePct: STATE.mode === 'cloud' ? 30 : Math.min(70, Math.round((parseInt(m.size.replace(/[^0-9]/g, ''), 10) / 24) * 100))
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
    $('steplabel').textContent = t('Step', '第') + ' ' + (STEP + 1) + '/' + TOTAL + ' · ' + labels[STEP];
  }
  function showStep(n) {
    STEP = n;
    for (var i = 0; i < TOTAL; i++) $('step' + i).classList.toggle('hidden', i !== n);
    if (n === 2) renderPlan();
    if (n === 3) renderOutput();
    renderProgress();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderPlan() {
    var p = buildPlan();
    $('planBox').innerHTML =
      '<span class="pick">✦ ' + t('BEST MATCH', '最佳匹配') + '</span>' +
      '<h3>' + p.title + '</h3>' +
      '<div class="desc">' + t('For: ', '用于:') + needLabel(STATE.need) +
        (STATE.mode === 'cloud' ? ' · ' + t('runs in the cloud', '云端运行') : ' · ' + t('runs on your computer', '本机运行')) + '</div>' +
      meter(t('Answer quality', '回答质量'), t('Very good', '很好'), p.quality, 'var(--accent)') +
      meter(t('Response speed', '响应速度'), t('Fast', '快'), p.speed, 'var(--info)') +
      meter(t('Space used', '占用空间'), p.space, p.spacePct, 'var(--clay)') +
      '<details class="adv"><summary>' + t('Advanced (for the technical)', '高级模式(给懂技术的人看)') + '</summary><table>' +
        row(t('Recommended model', '推荐模型'), p.model.name + ' (' + p.model.quant + ')') +
        row(t('Runtime', '推理运行时'), 'llama.cpp server (CUDA)') +
        row(t('Knowledge / RAG', '知识库 / RAG'), p.rag ? t('On · bge-base-en + local vector store', '开启 · bge-base-en + 本地向量库') : t('Off', '关闭')) +
        row(t('Source', '下载来源'), 'huggingface.co / ' + p.model.repo) +
      '</table></details>';
    // mode cards reflect selection
    document.querySelectorAll('#step2 .opt').forEach(function (o) {
      o.classList.toggle('sel', o.getAttribute('data-mode') === STATE.mode);
    });
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
      '# Run in PowerShell (Admin):  powershell -ExecutionPolicy Bypass -File build-my-ai-setup.ps1\n\n' +
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

  function installManifest(p) {
    return JSON.stringify({
      product: 'Build My AI', generated: 'client-demo',
      need: STATE.need, target: { os: STATE.os, gpu: STATE.gpu, vram_gb: Number(STATE.vram), ram_gb: Number(STATE.ram) },
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
      'Pick one and launch an instance with a GPU that has at least ' + (m.name.indexOf('32B') >= 0 ? '24 GB' : m.name.indexOf('14B') >= 0 ? '16 GB' : '12 GB') + ' of VRAM:\n' +
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
    var p = buildPlan();
    var isLocal = STATE.mode === 'local';
    $('outTitle').textContent = isLocal ? t('Your local installer is ready', '你的本地安装包已生成')
                                        : t('Your cloud deployment guide is ready', '你的云端部署手册已生成');
    $('outLead').textContent = isLocal
      ? t('Download it and run it on your Windows machine. It installs everything — no command line needed.', '下载后在你的 Windows 电脑上运行,自动装好一切,无需命令行。')
      : t('A step-by-step guide customized to your model, for a US GPU server.', '为你的模型定制的分步手册,面向美国 GPU 服务器。');
    // summary
    $('outSummary').innerHTML =
      kv(t('Purpose', '用途'), needLabel(STATE.need)) +
      kv(t('Model', '模型'), p.model.name + ' (' + p.model.quant + ')') +
      kv(t('Runs', '运行方式'), isLocal ? t('On your computer', '本机') : t('Cloud GPU server', '云 GPU 服务器')) +
      kv(t('Knowledge / RAG', '知识库 / RAG'), p.rag ? t('On', '开启') : t('Off', '关闭'));
    // downloads + preview
    var dl = $('outDownloads'), pv = $('outPreview'), fm = $('outFileMeta');
    if (isLocal) {
      var script = localInstaller(p), manifest = installManifest(p);
      dl.innerHTML = '';
      addBtn(dl, t('⬇ Download installer (.ps1)', '⬇ 下载安装脚本 (.ps1)'), 'primary', function () { download('build-my-ai-setup.ps1', script, 'text/plain'); });
      addBtn(dl, t('⬇ Download plan (.json)', '⬇ 下载方案清单 (.json)'), 'ghost', function () { download('install-plan.json', manifest, 'application/json'); });
      fm.textContent = 'build-my-ai-setup.ps1 · ' + t('preview', '预览');
      pv.textContent = script;
    } else {
      var manual = cloudManual(p);
      dl.innerHTML = '';
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

  // ---- wire up ----
  document.addEventListener('DOMContentLoaded', function () {
    // template selection
    document.querySelectorAll('#step0 .tmpl').forEach(function (el) {
      el.addEventListener('click', function () {
        document.querySelectorAll('#step0 .tmpl').forEach(function (t) { t.classList.remove('sel'); });
        el.classList.add('sel'); STATE.need = el.getAttribute('data-need');
      });
    });
    // device form
    ['os', 'gpu', 'vram', 'ram'].forEach(function (k) {
      var sel = $('f_' + k);
      if (sel) sel.addEventListener('change', function () { STATE[k] = sel.value; });
    });
    // mode selection
    document.querySelectorAll('#step2 .opt').forEach(function (o) {
      o.addEventListener('click', function () {
        STATE.mode = o.getAttribute('data-mode');
        document.querySelectorAll('#step2 .opt').forEach(function (x) { x.classList.remove('sel'); });
        o.classList.add('sel');
        renderPlan();
      });
    });
    // nav buttons
    $('n0').onclick = function () { showStep(1); };
    $('b1').onclick = function () { showStep(0); };
    $('n1').onclick = function () { showStep(2); };
    $('b2').onclick = function () { showStep(1); };
    $('gen').onclick = function () { showStep(3); };
    $('b3').onclick = function () { showStep(2); };
    $('restart').onclick = function () { showStep(0); };
    showStep(0);
  });
  // re-render dynamic panels on language change
  document.addEventListener('langchange', function () {
    if (STEP === 2) renderPlan();
    if (STEP === 3) renderOutput();
    renderProgress();
  });
})();
