// ============================================================
//  app.js — Illias UI
//  Multi-provider: Groq, Mistral, OpenRouter + more
// ============================================================

// ── State ──────────────────────────────────────────────────
const state = {
  apiKey: '',
  provider: CONFIG.defaults.provider,
  model: CONFIG.defaults.model,
  temperature: CONFIG.defaults.temperature,
  maxTokens: CONFIG.defaults.maxTokens,
  systemPrompt: CONFIG.defaults.systemPrompt,
  theme: 'blue-black',
  messages: [],
  isStreaming: false,
  stats: {
    messageCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalCost: 0,
  },
};

// ── DOM refs ───────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const els = {
  messagesContainer: $('messagesContainer'),
  welcomeState:      $('welcomeState'),
  messageInput:      $('messageInput'),
  sendBtn:           $('sendBtn'),
  apiBanner:         $('apiBanner'),
  apiKeyInput:       $('apiKeyInput'),
  modelSelect:       $('modelSelect'),
  modelDesc:         $('modelDesc'),
  tempSlider:        $('tempSlider'),
  tempValue:         $('tempValue'),
  maxTokensSlider:   $('maxTokensSlider'),
  maxTokensValue:    $('maxTokensValue'),
  systemPrompt:      $('systemPrompt'),
  totalTokens:       $('totalTokens'),
  totalCost:         $('totalCost'),
  statMessages:      $('statMessages'),
  statInputTokens:   $('statInputTokens'),
  statOutputTokens:  $('statOutputTokens'),
  statCost:          $('statCost'),
  sidebar:           $('sidebar'),
  clearBtn:          $('clearBtn'),
  sidebarToggle:     $('sidebarToggle'),
  closeSidebar:      $('closeSidebar'),
  toggleKeyVis:      $('toggleKeyVis'),
};

// ── Init ───────────────────────────────────────────────────
function init() {
  injectProviderSelector();
  populateModelSelect();
  applyDefaults();
  updateBanner();
  updateStats();
  setupEventListeners();
}

// ── Inject provider dropdown into sidebar ─────────────────
function injectProviderSelector() {
  // Insert provider select before the model select group
  const modelGroup = els.modelSelect.closest('.setting-group');

  const group = document.createElement('div');
  group.className = 'setting-group';
  group.innerHTML = `
    <label class="setting-label">🔌 Provider</label>
    <select id="providerSelect" class="setting-input" onchange="onProviderChange()">
      ${CONFIG.providers.map(p => `<option value="${p.id}" ${p.id === state.provider ? 'selected' : ''}>${p.label}</option>`).join('')}
    </select>
    <span class="setting-hint" id="providerHint"></span>
  `;

  modelGroup.parentNode.insertBefore(group, modelGroup);
  updateProviderHint();
}

function updateProviderHint() {
  const hint = document.getElementById('providerHint');
  if (hint) {
    const provider = getProviderConfig(state.provider);
    hint.textContent = provider.keyHint;
  }
  // Also update key placeholder
  const provider = getProviderConfig(state.provider);
  els.apiKeyInput.placeholder = provider.keyPlaceholder;
}

function onProviderChange() {
  state.provider = document.getElementById('providerSelect').value;
  state.apiKey = '';
  els.apiKeyInput.value = '';
  updateProviderHint();
  populateModelSelect();
  updateBanner();
}

function populateModelSelect() {
  const provider = getProviderConfig(state.provider);
  els.modelSelect.innerHTML = '';
  provider.models.forEach((m) => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.label;
    els.modelSelect.appendChild(opt);
  });
  state.model = provider.models[0].id;
  updateModelDesc();
}

function applyDefaults() {
  els.tempSlider.value           = state.temperature;
  els.tempValue.textContent      = state.temperature;
  els.maxTokensSlider.value      = state.maxTokens;
  els.maxTokensValue.textContent = state.maxTokens;
  els.systemPrompt.value         = state.systemPrompt;
}

function setupEventListeners() {
  els.sidebarToggle.addEventListener('click', () => toggleSidebar());
  els.closeSidebar.addEventListener('click',  () => toggleSidebar(false));
  els.clearBtn.addEventListener('click', clearChat);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') toggleSidebar(false);
  });
}

// ── Sidebar ────────────────────────────────────────────────
function toggleSidebar(force) {
  const isOpen = !els.sidebar.classList.contains('closed');
  const shouldClose = force === false ? true : (force === true ? false : isOpen);
  els.sidebar.classList.toggle('closed', shouldClose);
}

// ── API Key ────────────────────────────────────────────────
function onApiKeyChange() {
  state.apiKey = els.apiKeyInput.value.trim();
  updateBanner();
}

function toggleKeyVisibility() {
  const input = els.apiKeyInput;
  const isPass = input.type === 'password';
  input.type = isPass ? 'text' : 'password';
  els.toggleKeyVis.textContent = isPass ? '🙈' : '👁️';
}

function updateBanner() {
  els.apiBanner.classList.toggle('hidden', !!state.apiKey);
}

// ── Model ──────────────────────────────────────────────────
function onModelChange() {
  state.model = els.modelSelect.value;
  updateModelDesc();
}

function updateModelDesc() {
  const m = getModelConfig(state.model, state.provider);
  els.modelDesc.textContent = m ? m.description : '';
}

// ── Temperature ────────────────────────────────────────────
function onTempChange(val) {
  state.temperature = parseFloat(val);
  els.tempValue.textContent = state.temperature.toFixed(2);
}

// ── Max Tokens ─────────────────────────────────────────────
function onMaxTokensChange(val) {
  state.maxTokens = parseInt(val, 10);
  els.maxTokensValue.textContent = state.maxTokens;
}

// ── System Prompt ──────────────────────────────────────────
function onSystemPromptChange() {
  state.systemPrompt = els.systemPrompt.value;
}

// ── Theme ──────────────────────────────────────────────────
function setTheme(theme) {
  state.theme = theme;
  document.documentElement.removeAttribute('data-theme');
  if (theme !== 'blue-black') {
    document.documentElement.setAttribute('data-theme', theme);
  }
  document.querySelectorAll('.swatch').forEach((s) => {
    s.classList.toggle('active', s.dataset.gradient === theme);
  });
}

// ── Welcome chips ──────────────────────────────────────────
function usePrompt(text) {
  els.messageInput.value = text;
  autoResize(els.messageInput);
  els.messageInput.focus();
}

// ── Input helpers ──────────────────────────────────────────
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 160) + 'px';
}

function handleKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

// ── Clear chat ─────────────────────────────────────────────
function clearChat() {
  state.messages = [];
  state.stats = { messageCount: 0, inputTokens: 0, outputTokens: 0, totalCost: 0 };
  const rows = els.messagesContainer.querySelectorAll('.message-row, .error-bubble');
  rows.forEach((r) => r.remove());
  els.welcomeState.style.display = '';
  updateStats();
}

// ── Send message ───────────────────────────────────────────
async function sendMessage() {
  const text = els.messageInput.value.trim();
  if (!text || state.isStreaming) return;

  if (!state.apiKey) {
    toggleSidebar(true);
    els.apiKeyInput.focus();
    return;
  }

  els.welcomeState.style.display = 'none';
  appendUserMessage(text);
  state.messages.push({ role: 'user', content: text });

  els.messageInput.value = '';
  els.messageInput.style.height = 'auto';

  state.stats.messageCount++;
  updateStats();

  const typingEl = appendTypingIndicator();
  setStreaming(true);

  try {
    const { responseText, usage } = await callAPI(state.messages);

    typingEl.remove();
    appendAIMessage(responseText);
    state.messages.push({ role: 'assistant', content: responseText });

    if (usage) {
      const inTok  = usage.prompt_tokens     || 0;
      const outTok = usage.completion_tokens || 0;
      state.stats.inputTokens  += inTok;
      state.stats.outputTokens += outTok;
      const cost = estimateCost(inTok, outTok, state.model, state.provider);
      state.stats.totalCost += cost.totalCost;
    }

    updateStats();

  } catch (err) {
    typingEl.remove();
    appendError(err.message || 'Something went wrong. Check your API key and try again.');
  } finally {
    setStreaming(false);
  }
}

// ── Universal OpenAI-compatible API call ───────────────────
async function callAPI(messages) {
  const provider = getProviderConfig(state.provider);

  const body = {
    model: state.model,
    messages: [
      ...(state.systemPrompt.trim()
        ? [{ role: 'system', content: state.systemPrompt.trim() }]
        : []),
      ...messages,
    ],
    temperature: state.temperature,
    max_tokens: state.maxTokens,
  };

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `${provider.authHeader} ${state.apiKey}`,
  };

  // OpenRouter needs these extra headers
  if (state.provider === 'openrouter') {
    headers['HTTP-Referer'] = window.location.href;
    headers['X-Title'] = 'Illias';
  }

  const res = await fetch(provider.baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let errMsg = `API error ${res.status}`;
    try {
      const errData = await res.json();
      errMsg = errData?.error?.message || JSON.stringify(errData?.error) || errMsg;
    } catch (_) {}
    throw new Error(errMsg);
  }

  const data = await res.json();
  const responseText = data?.choices?.[0]?.message?.content || '';
  const usage = data?.usage || null;

  return { responseText, usage };
}

// ── DOM builders ───────────────────────────────────────────
function appendUserMessage(text) {
  const row = createMessageRow('user', '🧑', text);
  els.messagesContainer.appendChild(row);
  scrollToBottom();
}

function appendAIMessage(text) {
  const formatted = formatMarkdown(text);
  const row = createMessageRow('ai', '✦', formatted, true);
  els.messagesContainer.appendChild(row);
  scrollToBottom();
}

function createMessageRow(type, avatarIcon, content, isHTML = false) {
  const row = document.createElement('div');
  row.className = `message-row ${type}`;

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = avatarIcon;

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  if (isHTML) {
    bubble.innerHTML = content;
  } else {
    bubble.textContent = content;
  }

  const meta = document.createElement('div');
  meta.className = 'message-meta';
  meta.textContent = formatTime(new Date());

  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.appendChild(bubble);
  wrap.appendChild(meta);

  row.appendChild(avatar);
  row.appendChild(wrap);

  return row;
}

function appendTypingIndicator() {
  const row = document.createElement('div');
  row.className = 'message-row ai';

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = '✦';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  const indicator = document.createElement('div');
  indicator.className = 'typing-indicator';
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement('div');
    dot.className = 'typing-dot';
    indicator.appendChild(dot);
  }

  bubble.appendChild(indicator);
  row.appendChild(avatar);
  row.appendChild(bubble);
  els.messagesContainer.appendChild(row);
  scrollToBottom();
  return row;
}

function appendError(msg) {
  const el = document.createElement('div');
  el.className = 'error-bubble';
  el.textContent = `⚠️ ${msg}`;
  els.messagesContainer.appendChild(el);
  scrollToBottom();
}

// ── Stats ──────────────────────────────────────────────────
function updateStats() {
  const total = state.stats.inputTokens + state.stats.outputTokens;
  els.totalTokens.textContent      = total.toLocaleString();
  els.totalCost.textContent        = state.stats.totalCost.toFixed(CONFIG.cost.decimalPlaces);
  els.statMessages.textContent     = state.stats.messageCount;
  els.statInputTokens.textContent  = state.stats.inputTokens.toLocaleString();
  els.statOutputTokens.textContent = state.stats.outputTokens.toLocaleString();
  els.statCost.textContent         = state.stats.totalCost.toFixed(CONFIG.cost.decimalPlaces);
}

// ── Streaming state ────────────────────────────────────────
function setStreaming(val) {
  state.isStreaming = val;
  els.sendBtn.disabled = val;
  els.messageInput.disabled = val;
}

// ── Helpers ────────────────────────────────────────────────
function scrollToBottom() {
  els.messagesContainer.scrollTo({
    top: els.messagesContainer.scrollHeight,
    behavior: 'smooth',
  });
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatMarkdown(text) {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre style="background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:12px 14px;overflow-x:auto;font-size:13px;margin:6px 0;font-family:monospace;color:#e2e8f0;"><code>${code.trim()}</code></pre>`;
  });

  html = html.replace(/`([^`]+)`/g, '<code style="background:rgba(0,102,255,0.15);border:1px solid rgba(0,102,255,0.3);border-radius:5px;padding:1px 6px;font-family:monospace;font-size:13px;">$1</code>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');
  html = html.replace(/\n/g, '<br>');

  return html;
}

// ── Boot ───────────────────────────────────────────────────
init();
