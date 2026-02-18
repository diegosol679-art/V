// ============================================================
//  app.js — Illias UI
//  Gemini-powered chat with settings, stats, themes, streaming
// ============================================================

// ── State ──────────────────────────────────────────────────
const state = {
  apiKey: '',
  model: CONFIG.defaults.model,
  temperature: CONFIG.defaults.temperature,
  maxTokens: CONFIG.defaults.maxTokens,
  systemPrompt: CONFIG.defaults.systemPrompt,
  theme: 'blue-black',
  messages: [],          // { role: 'user'|'model', parts: [{text}] }
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
  populateModelSelect();
  applyDefaults();
  updateBanner();
  updateStats();
  setupEventListeners();
}

function populateModelSelect() {
  els.modelSelect.innerHTML = '';
  CONFIG.models.forEach((m) => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.label;
    if (m.id === state.model) opt.selected = true;
    els.modelSelect.appendChild(opt);
  });
  updateModelDesc();
}

function applyDefaults() {
  els.tempSlider.value       = state.temperature;
  els.tempValue.textContent  = state.temperature;
  els.maxTokensSlider.value  = state.maxTokens;
  els.maxTokensValue.textContent = state.maxTokens;
  els.systemPrompt.value     = state.systemPrompt;
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
  const m = getModelConfig(state.model);
  els.modelDesc.textContent = m.description;
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

  // Remove all message rows (keep welcome state)
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

  // Hide welcome, show message
  els.welcomeState.style.display = 'none';

  // Append user bubble
  appendUserMessage(text);
  state.messages.push({ role: 'user', parts: [{ text }] });

  // Clear + reset input
  els.messageInput.value = '';
  els.messageInput.style.height = 'auto';

  state.stats.messageCount++;
  updateStats();

  // Show typing indicator
  const typingEl = appendTypingIndicator();

  setStreaming(true);

  try {
    const { responseText, usageMetadata } = await callGeminiAPI(state.messages);

    typingEl.remove();
    appendAIMessage(responseText);
    state.messages.push({ role: 'model', parts: [{ text: responseText }] });

    // Update token/cost stats
    if (usageMetadata) {
      const inTok  = usageMetadata.promptTokenCount     || 0;
      const outTok = usageMetadata.candidatesTokenCount || 0;
      state.stats.inputTokens  += inTok;
      state.stats.outputTokens += outTok;

      const cost = estimateCost(inTok, outTok, state.model);
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

// ── Gemini API call ────────────────────────────────────────
async function callGeminiAPI(messages) {
  const url = `${CONFIG.apiEndpoint}/${state.model}:generateContent?key=${state.apiKey}`;

  const body = {
    contents: messages,
    generationConfig: {
      temperature: state.temperature,
      maxOutputTokens: state.maxTokens,
    },
  };

  // Add system instruction if set
  if (state.systemPrompt.trim()) {
    body.systemInstruction = {
      parts: [{ text: state.systemPrompt.trim() }],
    };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let errMsg = `API error ${res.status}`;
    try {
      const errData = await res.json();
      errMsg = errData?.error?.message || errMsg;
    } catch (_) {}
    throw new Error(errMsg);
  }

  const data = await res.json();

  const responseText =
    data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  const usageMetadata = data?.usageMetadata || null;

  return { responseText, usageMetadata };
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
  els.totalTokens.textContent = total.toLocaleString();
  els.totalCost.textContent   = state.stats.totalCost.toFixed(CONFIG.cost.decimalPlaces);
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

// Basic markdown → HTML (bold, italic, code blocks, inline code, line breaks)
function formatMarkdown(text) {
  // Escape HTML first
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks (```...```)
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre style="background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:12px 14px;overflow-x:auto;font-size:13px;margin:6px 0;font-family:monospace;color:#e2e8f0;"><code>${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code style="background:rgba(0,102,255,0.15);border:1px solid rgba(0,102,255,0.3);border-radius:5px;padding:1px 6px;font-family:monospace;font-size:13px;">$1</code>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');

  // Line breaks
  html = html.replace(/\n/g, '<br>');

  return html;
}

// ── Boot ───────────────────────────────────────────────────
init();
