// --- Elements ---
const chatContainer = document.getElementById('chatContainer');
const chatContent = document.getElementById('chatContent');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const scrollToBottomBtn = document.getElementById('scrollToBottom');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const refreshBtn = document.getElementById('refreshBtn');
const newChatBtn = document.getElementById('newChatBtn');
const historyBtn = document.getElementById('historyBtn');

const modalOverlay = document.getElementById('modalOverlay');
const modalList = document.getElementById('modalList');
const modalTitle = document.getElementById('modalTitle');
const historyLayer = document.getElementById('historyLayer');
const historyList = document.getElementById('historyList');
const quickInputOverlay = document.getElementById('quickInputOverlay');
const quickInputPanel = document.getElementById('quickInputPanel');
const quickInputTitle = document.getElementById('quickInputTitle');
const quickInputList = document.getElementById('quickInputList');

// SSL banner elements
const enableHttpsBtn = document.getElementById('enableHttpsBtn');
const dismissSslBtn = document.querySelector('.ssl-banner .dismiss-btn');
const sslBanner = document.getElementById('sslBanner');
const closeModalBtn = document.getElementById('closeModalBtn');

// Support & settings modal elements
const supportOverlay = document.getElementById('supportOverlay');
const closeSupportBtn = document.getElementById('closeSupportBtn');
const backHistoryBtn = document.querySelector('.history-header .icon-btn');
const quickActionChips = document.querySelectorAll('.action-chip');

// Unified Settings elements
const settingsBtn = document.getElementById('settingsBtn');
const settingsLayer = document.getElementById('settingsLayer');
const backSettingsBtn = document.getElementById('backSettingsBtn');
const modeToggle = document.getElementById('modeToggle');
const settingsModelSelect = document.getElementById('settingsModelSelect');
const settingsSkillsList = document.getElementById('settingsSkillsList');
const settingsMcpList = document.getElementById('settingsMcpList');
const gitStatusText = document.getElementById('gitStatusText');
const revertBtn = document.getElementById('revertBtn');
const settingsSupportBtn = document.getElementById('settingsSupportBtn');

// Git Revert elements
const revertOverlay = document.getElementById('revertOverlay');
const revertFilesList = document.getElementById('revertFilesList');
const confirmRevertBtn = document.getElementById('confirmRevertBtn');
const cancelRevertBtn = document.getElementById('cancelRevertBtn');

// Goal Progress elements
const goalProgressOverlay = document.getElementById('goalProgressOverlay');
const closeGoalBtn = document.getElementById('closeGoalBtn');
const goalTitleText = document.getElementById('goalTitleText');
const goalProgressBar = document.getElementById('goalProgressBar');
const goalStepsText = document.getElementById('goalStepsText');

// Autocomplete elements
const autocompletePopup = document.getElementById('autocompletePopup');

// --- State ---
let autoRefreshEnabled = true;
let userIsScrolling = false;
let userScrollLockUntil = 0; // Timestamp until which we respect user scroll
let lastScrollPosition = 0;
let ws = null;
let idleTimer = null;
let lastHash = '';
let currentMode = 'Fast';
let chatIsOpen = true; // Track if a chat is currently open
let isGenerating = false; // Track if generation is active

// Autocomplete State
let workspaceFiles = [];
let lastFilesFetchTime = 0;
let activeAutocompleteIndex = -1;
let autocompleteMatches = [];
let activeTrigger = ''; // '@' or '#'
let triggerIndex = -1;
let settingsConfig = null;

const STATIC_SKILLS = [
    { id: 'ui-ux-pro-max', name: 'UI/UX Pro Max', description: 'UI/UX design intelligence' },
    { id: 'systematic-debugging', name: 'Systematic Debugging', description: 'Debugging guidance' },
    { id: 'brainstorming', name: 'Brainstorming', description: 'Creative feature exploration' },
    { id: 'developing-with-bigquery', name: 'Developing with BigQuery', description: 'BigQuery optimizations' },
    { id: 'vercel-react-best-practices', name: 'Vercel React Best Practices', description: 'React performance guidelines' },
    { id: 'web-design-guidelines', name: 'Web Design Guidelines', description: 'Accessibility and UX audit' }
];

const STATIC_MCP_SERVERS = [
    { id: 'StitchMCP', name: 'StitchMCP', description: 'Google Stitch design tools', tools: ['create_project', 'edit_screens'] }
];

const USER_SCROLL_LOCK_DURATION = 3000; // 3 seconds of scroll protection

// --- Auth Utilities ---
async function fetchWithAuth(url, options = {}) {
    // Add ngrok skip warning header to all requests
    if (!options.headers) options.headers = {};
    options.headers['ngrok-skip-browser-warning'] = 'true';

    try {
        const res = await fetch(url, options);
        if (res.status === 401) {
            console.log('[AUTH] Unauthorized, redirecting to login...');
            window.location.href = '/login.html';
            return new Promise(() => { }); // Halt execution
        }
        return res;
    } catch (e) {
        throw e;
    }
}

// --- Sync State (Desktop is Always Priority) ---
async function fetchAppState() {
    try {
        const res = await fetchWithAuth('/app-state');
        const data = await res.json();

        // Mode Sync (Fast/Planning) - Desktop is source of truth
        if (data.mode && data.mode !== 'Unknown') {
            currentMode = data.mode;
            modeToggle.checked = (currentMode === 'Planning');
        }

        // Model Sync - Desktop is source of truth
        if (data.model && data.model !== 'Unknown') {
            // Find matches in select and select it
            for (const opt of settingsModelSelect.options) {
                if (opt.value === data.model || data.model.includes(opt.value) || opt.value.includes(data.model)) {
                    settingsModelSelect.value = opt.value;
                    break;
                }
            }
        }

        // Quick Input Dialog (workspace selection, quick pick)
        if (data.quickInput) {
            quickInputTitle.textContent = data.quickInput.title || 'Select Option';
            quickInputList.innerHTML = '';
            
            data.quickInput.options.forEach(opt => {
                const optEl = document.createElement('div');
                optEl.className = 'quick-input-option';
                optEl.textContent = opt.text;
                optEl.setAttribute('data-index', opt.index);
                
                optEl.addEventListener('click', async () => {
                    // Click visual feedback
                    optEl.style.opacity = '0.5';
                    
                    try {
                        await fetchWithAuth('/remote-click', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                selector: '.quick-input-widget .monaco-list-row, .quick-input-widget .quick-input-list-row',
                                index: opt.index
                            })
                        });
                        
                        // Hide dialog immediately on click to prevent double-tap
                        quickInputOverlay.classList.remove('show');
                        
                        // Force fast updates
                        setTimeout(loadSnapshot, 300);
                        setTimeout(loadSnapshot, 1000);
                        setTimeout(fetchAppState, 400);
                        setTimeout(fetchAppState, 1200);
                    } catch (err) {
                        console.error('[SYNC] Quick input select failed:', err);
                        optEl.style.opacity = '1';
                    }
                });
                quickInputList.appendChild(optEl);
            });
            
            quickInputOverlay.classList.add('show');
        } else if (quickInputOverlay) {
            quickInputOverlay.classList.remove('show');
        }

        console.log('[SYNC] State refreshed from Desktop:', data);
    } catch (e) { console.error('[SYNC] Failed to sync state', e); }
}

// --- SSL Banner ---
async function checkSslStatus() {
    if (window.location.protocol === 'https:') return;
    if (localStorage.getItem('sslBannerDismissed')) return;
    if (sslBanner) sslBanner.style.display = 'flex';
}

async function enableHttps() {
    const btn = document.getElementById('enableHttpsBtn');
    btn.textContent = 'Generating...';
    btn.disabled = true;

    try {
        const res = await fetchWithAuth('/generate-ssl', { method: 'POST' });
        const data = await res.json();

        if (data.success) {
            sslBanner.innerHTML = `
                <span>✅ ${data.message}</span>
                <button id="sslReloadBtn">Reload After Restart</button>
            `;
            sslBanner.style.background = 'linear-gradient(90deg, #10b981, #059669)';
            
            const reloadBtn = document.getElementById('sslReloadBtn');
            if (reloadBtn) reloadBtn.addEventListener('click', () => location.reload());
        } else {
            btn.textContent = 'Failed - Retry';
            btn.disabled = false;
        }
    } catch (e) {
        btn.textContent = 'Error - Retry';
        btn.disabled = false;
    }
}

function dismissSslBanner() {
    if (sslBanner) sslBanner.style.display = 'none';
    localStorage.setItem('sslBannerDismissed', 'true');
}

// --- WebSocket ---
function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}`);

    ws.onopen = () => {
        console.log('WS Connected');
        updateStatus(true);
        loadSnapshot();
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'error' && data.message === 'Unauthorized') {
            window.location.href = '/login.html';
            return;
        }
        if (data.type === 'snapshot_update' && autoRefreshEnabled && !userIsScrolling) {
            loadSnapshot();
        }
    };

    ws.onclose = () => {
        console.log('WS Disconnected');
        updateStatus(false);
        setTimeout(connectWebSocket, 2000);
    };
}

function updateStatus(connected) {
    if (connected) {
        statusDot.classList.remove('disconnected');
        statusDot.classList.add('connected');
        statusText.textContent = 'Live';
    } else {
        statusDot.classList.remove('connected');
        statusDot.classList.add('disconnected');
        statusText.textContent = 'Reconnecting';
    }
}

// --- Rendering ---
async function loadSnapshot() {
    try {
        // Add spin animation to refresh button
        const icon = refreshBtn.querySelector('svg');
        icon.classList.remove('spin-anim');
        void icon.offsetWidth; // trigger reflow
        icon.classList.add('spin-anim');

        const response = await fetchWithAuth('/snapshot');
        if (!response.ok) {
            if (response.status === 503) {
                chatIsOpen = false;
                showEmptyState();
                return;
            }
            throw new Error('Failed to load');
        }

        chatIsOpen = true;
        const data = await response.json();

        // Capture scroll state BEFORE updating content
        const scrollPos = chatContainer.scrollTop;
        const scrollHeight = chatContainer.scrollHeight;
        const clientHeight = chatContainer.clientHeight;
        const isNearBottom = scrollHeight - scrollPos - clientHeight < 120;
        const isUserScrollLocked = Date.now() < userScrollLockUntil;

        // --- CSS INJECTION (Cached) ---
        let styleTag = document.getElementById('cdp-styles');
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = 'cdp-styles';
            document.head.appendChild(styleTag);
        }

        const darkModeOverrides = '/* --- BASE SNAPSHOT CSS --- */\n' +
            data.css +
            '\n\n/* --- FORCE DARK MODE OVERRIDES --- */\n' +
            ':root {\n' +
            '    --bg-app: #000000;\n' +
            '    --text-main: #ffffff;\n' +
            '    --text-muted: #71717a;\n' +
            '    --border-color: #27272a;\n' +
            '}\n' +
            '\n' +
            '#conversation, #chat, #cascade {\n' +
            '    background-color: transparent !important;\n' +
            '    color: var(--text-main) !important;\n' +
            '    font-family: \'Inter\', system-ui, sans-serif !important;\n' +
            '    position: relative !important;\n' +
            '    height: auto !important;\n' +
            '    width: 100% !important;\n' +
            '}\n' +
            '\n' +
            '#conversation > div, #chat > div, #cascade > div {\n' +
            '    position: static !important;\n' +
            '}\n' +
            '[style*="position: absolute"], [style*="position: fixed"],\n' +
            '[data-headlessui-state], [id*="headlessui"] {\n' +
            '    position: absolute !important;\n' +
            '}\n' +
            '\n' +
            '#conversation p, #chat p, #cascade p, #conversation h1, #chat h1, #cascade h1, #conversation h2, #chat h2, #cascade h2, #conversation h3, #chat h3, #cascade h3, #conversation span, #chat span, #cascade span, #conversation div, #chat div, #cascade div, #conversation li, #chat li, #cascade li {\n' +
            '    color: inherit !important;\n' +
            '}\n' +
            '\n' +
            '[style*="color: rgb(0, 0, 0)"], [style*="color: black"],\n' +
            '[style*="color:#000"], [style*="color: #000"] {\n' +
            '    color: #e2e8f0 !important;\n' +
            '}\n' +
            '\n' +
            '#conversation a, #chat a, #cascade a {\n' +
            '    color: #4285f4 !important;\n' +
            '    text-decoration: underline;\n' +
            '}\n' +
            '\n' +
            'img[src^="/c:"], img[src^="/C:"], img[src*="AppData"] {\n' +
            '    display: none !important;\n' +
            '}\n' +
            '\n' +
            'img, svg {\n' +
            '    display: inline !important;\n' +
            '    vertical-align: middle !important;\n' +
            '}\n' +
            '\n' +
            '/* Single-line Code Block */\n' +
            ':not(pre) > code {\n' +
            '    padding: 2px 4px !important;\n' +
            '    border-radius: 4px !important;\n' +
            '    background-color: rgba(255, 255, 255, 0.06) !important;\n' +
            '    font-size: 0.85em !important;\n' +
            '    line-height: 1.2 !important;\n' +
            '    white-space: normal !important;\n' +
            '}\n' +
            '\n' +
            'pre, code, .monaco-editor-background, [class*="terminal"] {\n' +
            '    background-color: #0c0c0e !important;\n' +
            '    color: #cbd5e1 !important;\n' +
            '    font-family: \'JetBrains Mono\', monospace !important;\n' +
            '    border-radius: 6px !important;\n' +
            '    border: 1px solid var(--border-color) !important;\n' +
            '}\n' +
            '                \n' +
            'pre {\n' +
            '    position: relative !important;\n' +
            '    white-space: pre-wrap !important; \n' +
            '    word-break: break-word !important;\n' +
            '    padding: 8px 10px !important;\n' +
            '    margin: 6px 0 !important;\n' +
            '    display: block !important;\n' +
            '    width: 100% !important;\n' +
            '}\n' +
            '\n' +
            'blockquote {\n' +
            '    border-left: 3.5px solid #4285f4 !important;\n' +
            '    background: rgba(66, 133, 244, 0.04) !important;\n' +
            '    color: #cbd5e1 !important;\n' +
            '    padding: 8px 12px !important;\n' +
            '    margin: 8px 0 !important;\n' +
            '    border-radius: 0 6px 6px 0 !important;\n' +
            '}\n' +
            '\n' +
            'table {\n' +
            '    border-collapse: collapse !important;\n' +
            '    width: 100% !important;\n' +
            '    border: 1px solid var(--border-color) !important;\n' +
            '}\n' +
            'th, td {\n' +
            '    border: 1px solid var(--border-color) !important;\n' +
            '    padding: 8px !important;\n' +
            '    color: #cbd5e1 !important;\n' +
            '}\n' +
            '\n' +
            '::-webkit-scrollbar {\n' +
            '    width: 0 !important;\n' +
            '}\n' +
            '                \n' +
            '[style*="background-color: rgb(255, 255, 255)"],\n' +
            '[style*="background-color: white"],\n' +
            '[style*="background: white"] {\n' +
            '    background-color: transparent !important;\n' +
            '}';
        styleTag.textContent = darkModeOverrides;
        chatContent.innerHTML = data.html;

        // Process dynamic classes for Allow/Deny, Apply/Discard buttons
        processDynamicButtons();

        // Add chevrons / indicators to details / collapsible cards
        postProcessThinkingCards();

        // Parse goal progress from snapshot if goal is active
        parseGoalProgress(data.html);

        // Morph send button based on generation status
        updateSendBtnState(!!data.isGenerating);

        // Add mobile copy buttons to all code blocks
        addMobileCopyButtons();

        // Smart scroll behavior
        if (isUserScrollLocked) {
            const scrollPercent = scrollHeight > 0 ? scrollPos / scrollHeight : 0;
            const newScrollPos = chatContainer.scrollHeight * scrollPercent;
            chatContainer.scrollTop = newScrollPos;
        } else if (isNearBottom || scrollPos === 0) {
            scrollToBottom();
        } else {
            chatContainer.scrollTop = scrollPos;
        }

    } catch (err) {
        console.error(err);
    }
}

// --- Dynamic Button Style Mapper ---
function processDynamicButtons() {
    const buttons = chatContent.querySelectorAll('button, [role="button"]');
    const acceptWords = ['allow', 'always allow', 'allow once', 'accept', 'apply', 'save', 'confirm', 'yes', 'run'];
    const rejectWords = ['deny', 'reject', 'discard', 'no'];
    const neutralWords = ['cancel', 'review', 'review changes'];

    buttons.forEach(btn => {
        const text = (btn.innerText || '').trim().toLowerCase();
        if (acceptWords.some(w => text.includes(w))) {
            btn.classList.add('btn-accept');
        } else if (rejectWords.some(w => text.includes(w))) {
            btn.classList.add('btn-reject');
        } else if (neutralWords.some(w => text.includes(w))) {
            btn.classList.add('btn-neutral');
        }
    });
}

// --- Thinking Cards Chevrons ---
function postProcessThinkingCards() {
    const thinkingElements = chatContent.querySelectorAll('[class*="thinking"], [class*="thought"], [class*="worked-status"], [class*="edited-files"], details');
    thinkingElements.forEach(el => {
        if (el.tagName === 'DETAILS') {
            const summary = el.querySelector('summary');
            if (summary && !summary.querySelector('.chevron-indicator')) {
                const indicator = document.createElement('span');
                indicator.className = 'chevron-indicator';
                indicator.style.float = 'right';
                indicator.style.marginLeft = '8px';
                indicator.style.fontSize = '10px';
                indicator.style.color = 'var(--text-muted)';
                indicator.textContent = el.hasAttribute('open') ? '▲' : '▼';
                summary.appendChild(indicator);
            }
        }
    });
}

// --- Morph Send / Stop Button ---
function updateSendBtnState(generating) {
    isGenerating = generating;
    if (generating) {
        sendBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px; height:14px;">
                <rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>
            </svg>
        `;
        sendBtn.classList.add('stop-btn');
        sendBtn.setAttribute('aria-label', 'Stop Generation');
        sendBtn.disabled = false;
        sendBtn.style.opacity = '1';
    } else {
        sendBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="19" x2="12" y2="5"></line>
                <polyline points="5 12 12 5 19 12"></polyline>
            </svg>
        `;
        sendBtn.classList.remove('stop-btn');
        sendBtn.setAttribute('aria-label', 'Send');
        sendBtn.disabled = !messageInput.value.trim();
        sendBtn.style.opacity = sendBtn.disabled ? '0.4' : '1';
    }
}

async function stopGeneration() {
    sendBtn.disabled = true;
    sendBtn.style.opacity = '0.5';
    try {
        await fetchWithAuth('/stop', { method: 'POST' });
        setTimeout(loadSnapshot, 300);
        setTimeout(loadSnapshot, 1000);
    } catch (e) {
        console.error('[STOP] Failed to stop:', e);
    } finally {
        sendBtn.disabled = false;
        sendBtn.style.opacity = '1';
    }
}

// --- Autocomplete Logic ---
async function ensureWorkspaceFiles() {
    const now = Date.now();
    if (workspaceFiles.length > 0 && now - lastFilesFetchTime < 30000) {
        return;
    }
    try {
        const res = await fetchWithAuth('/api/workspace-files');
        const data = await res.json();
        if (data.success && data.files) {
            workspaceFiles = data.files;
            lastFilesFetchTime = now;
        }
    } catch (err) {
        console.error('[TAGGING] Failed to fetch workspace files:', err);
    }
}

async function handleAutocompleteInput() {
    const cursor = messageInput.selectionStart;
    const val = messageInput.value;
    const textBeforeCursor = val.substring(0, cursor);
    
    // Match word starting with @ or #
    const match = textBeforeCursor.match(/(?:^|\s)([@#])([a-zA-Z0-9_\-\/.]*)$/);
    
    if (!match) {
        hideAutocomplete();
        return;
    }
    
    activeTrigger = match[1];
    const query = match[2].toLowerCase();
    triggerIndex = cursor - match[0].length + match[0].indexOf(activeTrigger);
    
    if (activeTrigger === '@') {
        await ensureWorkspaceFiles();
        
        autocompleteMatches = workspaceFiles.filter(f => 
            f.path.toLowerCase().includes(query) || f.name.toLowerCase().includes(query)
        ).map(f => ({
            type: 'file',
            id: f.path,
            text: f.path,
            icon: f.type === 'directory' ? '📁' : '📄',
            badge: f.type === 'directory' ? 'DIR' : 'FILE'
        }));
    } else {
        // trigger is '#'
        const skills = (settingsConfig && settingsConfig.skills) || STATIC_SKILLS;
        const mcps = (settingsConfig && settingsConfig.mcpServers) || STATIC_MCP_SERVERS;
        
        const skillMatches = skills.filter(s => 
            s.id.toLowerCase().includes(query) || s.name.toLowerCase().includes(query)
        ).map(s => ({
            type: 'skill',
            id: s.id,
            text: s.name,
            icon: '⚡',
            badge: 'SKILL'
        }));
        
        const mcpMatches = mcps.filter(m => 
            m.id.toLowerCase().includes(query) || m.name.toLowerCase().includes(query)
        ).map(m => ({
            type: 'mcp',
            id: m.id,
            text: m.name,
            icon: '🔌',
            badge: 'MCP'
        }));
        
        autocompleteMatches = [...skillMatches, ...mcpMatches];
    }
    
    if (autocompleteMatches.length === 0) {
        hideAutocomplete();
        return;
    }
    
    autocompleteMatches = autocompleteMatches.slice(0, 10);
    activeAutocompleteIndex = 0;
    renderAutocompletePopup();
}

function renderAutocompletePopup() {
    autocompletePopup.innerHTML = '';
    
    autocompleteMatches.forEach((match, idx) => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item' + (idx === activeAutocompleteIndex ? ' active' : '');
        
        item.innerHTML = `
            <span class="autocomplete-item-icon">${match.icon}</span>
            <span class="autocomplete-item-text">${escapeHtml(match.text)}</span>
            <span class="autocomplete-item-type">${match.badge}</span>
        `;
        
        item.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            selectAutocompleteItem(match);
        });
        
        autocompletePopup.appendChild(item);
    });
    
    autocompletePopup.classList.add('show');
}

function selectAutocompleteItem(match) {
    const cursor = messageInput.selectionStart;
    let insertText = '';
    if (match.type === 'file') {
        insertText = `@[${match.id}]`;
    } else {
        insertText = `#${match.id}`;
    }
    
    const val = messageInput.value;
    const before = val.substring(0, triggerIndex);
    const after = val.substring(cursor);
    
    messageInput.value = before + insertText + ' ' + after;
    const newCursor = triggerIndex + insertText.length + 1;
    messageInput.selectionStart = messageInput.selectionEnd = newCursor;
    
    messageInput.dispatchEvent(new Event('input'));
    hideAutocomplete();
    messageInput.focus();
}

function hideAutocomplete() {
    autocompletePopup.classList.remove('show');
    autocompleteMatches = [];
    activeAutocompleteIndex = -1;
    activeTrigger = '';
    triggerIndex = -1;
}

function handleAutocompleteKeydown(e) {
    if (!autocompletePopup.classList.contains('show')) {
        return;
    }
    
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeAutocompleteIndex = (activeAutocompleteIndex + 1) % autocompleteMatches.length;
        renderAutocompletePopup();
        const activeEl = autocompletePopup.children[activeAutocompleteIndex];
        if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeAutocompleteIndex = (activeAutocompleteIndex - 1 + autocompleteMatches.length) % autocompleteMatches.length;
        renderAutocompletePopup();
        const activeEl = autocompletePopup.children[activeAutocompleteIndex];
        if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeAutocompleteIndex >= 0 && activeAutocompleteIndex < autocompleteMatches.length) {
            selectAutocompleteItem(autocompleteMatches[activeAutocompleteIndex]);
        }
    } else if (e.key === 'Escape') {
        e.preventDefault();
        hideAutocomplete();
    }
}

// --- Goal Mode Progress overlay ---
function parseGoalProgress(htmlContent) {
    const activeGoal = localStorage.getItem('activeGoal');
    if (!activeGoal) {
        goalProgressOverlay.classList.remove('show');
        return;
    }

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    const text = tempDiv.textContent || tempDiv.innerText || '';

    // Search for pattern: Step 3 of 10 or 3/10
    const stepMatch = text.match(/(?:step|task|phase)\s*(\d+)\s*(?:of|\/)\s*(\d+)/i) || 
                      text.match(/\[\s*(\d+)\s*\/\s*(\d+)\s*\]/);

    if (stepMatch) {
        const current = parseInt(stepMatch[1], 10);
        const total = parseInt(stepMatch[2], 10);
        if (total > 0 && current <= total) {
            const percent = Math.round((current / total) * 100);
            goalProgressBar.style.width = `${percent}%`;
            goalStepsText.textContent = `Progress: Step ${current} of ${total} (${percent}%)`;
            
            const lines = text.split('\n');
            const matchedLine = lines.find(l => l.includes(stepMatch[0]));
            if (matchedLine && matchedLine.length < 120) {
                goalStepsText.textContent = matchedLine.trim();
            }
        }
    } else {
        const thoughts = tempDiv.querySelectorAll('[class*="thinking"], [class*="thought"]');
        if (thoughts.length > 0) {
            const lastThought = thoughts[thoughts.length - 1].textContent.split('\n')[0].trim();
            goalStepsText.textContent = lastThought.substring(0, 80) + (lastThought.length > 80 ? '...' : '');
            
            const currentWidth = parseFloat(goalProgressBar.style.width) || 5;
            if (currentWidth < 90) {
                goalProgressBar.style.width = `${currentWidth + 0.5}%`;
            }
        }
    }
}

// Check saved goal initially
const savedGoal = localStorage.getItem('activeGoal');
if (savedGoal) {
    goalTitleText.textContent = savedGoal;
    goalProgressOverlay.classList.add('show');
}

closeGoalBtn.addEventListener('click', () => {
    goalProgressOverlay.classList.remove('show');
    localStorage.removeItem('activeGoal');
});

// --- Unified Settings Panel ---
async function loadSettingsPanel() {
    try {
        const res = await fetchWithAuth('/api/settings');
        settingsConfig = await res.json();
        
        modeToggle.checked = (currentMode === 'Planning');
        
        // Populate skills dynamic toggles
        settingsSkillsList.innerHTML = '';
        settingsConfig.skills.forEach(skill => {
            const row = document.createElement('div');
            row.className = 'skill-item';
            row.innerHTML = `
                <div class="skill-row">
                    <span>${skill.name}</span>
                    <label class="switch-container">
                        <input type="checkbox" class="skill-toggle" data-id="${skill.id}" ${skill.enabled ? 'checked' : ''}>
                        <span class="switch-slider"></span>
                    </label>
                </div>
                <div class="skill-desc">${skill.description}</div>
            `;
            
            row.querySelector('.skill-toggle').addEventListener('change', async function() {
                skill.enabled = this.checked;
                await saveSettingsConfig();
            });
            settingsSkillsList.appendChild(row);
        });
        
        // Populate MCP servers toggles
        settingsMcpList.innerHTML = '';
        settingsConfig.mcpServers.forEach(mcp => {
            const row = document.createElement('div');
            row.className = 'mcp-item';
            row.innerHTML = `
                <div class="mcp-row">
                    <span>${mcp.name}</span>
                    <label class="switch-container">
                        <input type="checkbox" class="mcp-toggle" data-id="${mcp.id}" ${mcp.enabled ? 'checked' : ''}>
                        <span class="switch-slider"></span>
                    </label>
                </div>
                <div class="skill-desc">Active tools: ${mcp.tools.join(', ')}</div>
            `;
            
            row.querySelector('.mcp-toggle').addEventListener('change', async function() {
                mcp.enabled = this.checked;
                await saveSettingsConfig();
            });
            settingsMcpList.appendChild(row);
        });
        
        await checkGitStatus();
        
    } catch (err) {
        console.error('[SETTINGS] Load error:', err);
    }
}

async function saveSettingsConfig() {
    if (!settingsConfig) return;
    try {
        await fetchWithAuth('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settingsConfig)
        });
    } catch (err) {
        console.error('[SETTINGS] Save error:', err);
    }
}

settingsBtn.addEventListener('click', () => {
    settingsLayer.classList.add('show');
    loadSettingsPanel();
});

backSettingsBtn.addEventListener('click', () => {
    settingsLayer.classList.remove('show');
});

// Mode switch inside settings
modeToggle.addEventListener('change', async function() {
    const mode = this.checked ? 'Planning' : 'Fast';
    try {
        const res = await fetchWithAuth('/set-mode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode })
        });
        const data = await res.json();
        if (data.success) {
            currentMode = mode;
            if (settingsConfig) {
                settingsConfig.general = settingsConfig.general || {};
                settingsConfig.general.mode = mode;
                await saveSettingsConfig();
            }
        } else {
            modeToggle.checked = (currentMode === 'Planning');
        }
    } catch (e) {
        modeToggle.checked = (currentMode === 'Planning');
    }
});

// Model select inside settings
settingsModelSelect.addEventListener('change', async function() {
    const model = this.value;
    try {
        const res = await fetchWithAuth('/set-model', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model })
        });
        const data = await res.json();
        if (data.success) {
            if (settingsConfig) {
                settingsConfig.general = settingsConfig.general || {};
                settingsConfig.general.model = model;
                await saveSettingsConfig();
            }
        }
    } catch (e) {
        console.error('[SETTINGS] Model set error:', e);
    }
});

// --- Git Workspace Control ---
async function checkGitStatus() {
    try {
        const res = await fetchWithAuth('/api/git-status');
        const data = await res.json();
        if (data.success) {
            const count = data.files.length;
            if (count > 0) {
                gitStatusText.textContent = `${count} file${count > 1 ? 's' : ''} modified`;
                revertBtn.disabled = false;
                revertBtn.style.opacity = '1';
            } else {
                gitStatusText.textContent = 'Clean workspace';
                revertBtn.disabled = true;
                revertBtn.style.opacity = '0.5';
            }
        } else {
            gitStatusText.textContent = 'Git status unavailable';
            revertBtn.disabled = true;
            revertBtn.style.opacity = '0.5';
        }
    } catch (err) {
        gitStatusText.textContent = 'Git status error';
        revertBtn.disabled = true;
        revertBtn.style.opacity = '0.5';
    }
}

revertBtn.addEventListener('click', async () => {
    revertFilesList.innerHTML = '<div style="padding:10px; text-align:center; color:var(--text-muted);">Scanning changes...</div>';
    revertOverlay.classList.add('show');
    
    try {
        const res = await fetchWithAuth('/api/git-status');
        const data = await res.json();
        if (data.success && data.files.length > 0) {
            revertFilesList.innerHTML = '';
            
            const selectAllDiv = document.createElement('div');
            selectAllDiv.className = 'revert-file-item';
            selectAllDiv.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
            selectAllDiv.style.paddingBottom = '6px';
            selectAllDiv.style.marginBottom = '6px';
            selectAllDiv.innerHTML = `
                <input type="checkbox" id="selectAllRevert" checked>
                <label for="selectAllRevert" style="font-weight: 600; cursor:pointer;">SELECT ALL CHANGES</label>
            `;
            revertFilesList.appendChild(selectAllDiv);
            
            const fileCheckboxes = [];
            data.files.forEach(file => {
                const item = document.createElement('div');
                item.className = 'revert-file-item';
                const badgeColor = file.status === 'M' ? '#4285f4' : file.status === 'A' ? '#10b981' : '#f43f5e';
                item.innerHTML = `
                    <input type="checkbox" value="${file.path}" checked class="file-revert-checkbox">
                    <span style="color: ${badgeColor}; font-weight: bold; width: 18px; display: inline-block;">${file.status}</span>
                    <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${file.path}</span>
                `;
                const cb = item.querySelector('input');
                fileCheckboxes.push(cb);
                revertFilesList.appendChild(item);
            });
            
            const selectAllCb = selectAllDiv.querySelector('input');
            selectAllCb.addEventListener('change', function() {
                fileCheckboxes.forEach(cb => cb.checked = this.checked);
            });
        } else {
            revertFilesList.innerHTML = '<div style="padding:10px; text-align:center; color:var(--text-muted);">No changes found</div>';
        }
    } catch (err) {
        revertFilesList.innerHTML = '<div style="padding:10px; text-align:center; color:var(--error);">Failed to scan git</div>';
    }
});

confirmRevertBtn.addEventListener('click', async () => {
    const checkboxes = revertFilesList.querySelectorAll('.file-revert-checkbox:checked');
    const files = Array.from(checkboxes).map(cb => cb.value);
    
    if (files.length === 0) {
        revertOverlay.classList.remove('show');
        return;
    }
    
    confirmRevertBtn.disabled = true;
    confirmRevertBtn.textContent = 'Reverting...';
    
    try {
        const selectAllCb = document.getElementById('selectAllRevert');
        const revertAll = selectAllCb && selectAllCb.checked && files.length === revertFilesList.querySelectorAll('.file-revert-checkbox').length;
        
        const res = await fetchWithAuth('/api/revert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                files: files,
                all: revertAll
            })
        });
        const data = await res.json();
        if (data.success) {
            revertOverlay.classList.remove('show');
            await checkGitStatus();
            setTimeout(loadSnapshot, 500);
            setTimeout(loadSnapshot, 1000);
        } else {
            alert('Revert failed: ' + (data.error || 'Unknown'));
        }
    } catch (err) {
        alert('Failed to send revert request: ' + err.message);
    } finally {
        confirmRevertBtn.disabled = false;
        confirmRevertBtn.textContent = 'Revert Selected';
    }
});

cancelRevertBtn.addEventListener('click', () => {
    revertOverlay.classList.remove('show');
});

revertOverlay.addEventListener('click', (e) => {
    if (e.target === revertOverlay) revertOverlay.classList.remove('show');
});

// --- Mobile Code Block Copy Functionality ---
function addMobileCopyButtons() {
    const codeBlocks = chatContent.querySelectorAll('pre');

    codeBlocks.forEach((pre, index) => {
        if (pre.querySelector('.mobile-copy-btn')) return;

        const codeElement = pre.querySelector('code') || pre;
        const textToCopy = (codeElement.textContent || codeElement.innerText).trim();
        const hasNewline = /\n/.test(textToCopy);

        if (!hasNewline) {
            pre.classList.remove('has-copy-btn');
            pre.classList.add('single-line-pre');
            return;
        }

        pre.classList.remove('single-line-pre');
        pre.classList.add('has-copy-btn');

        const copyBtn = document.createElement('button');
        copyBtn.className = 'mobile-copy-btn';
        copyBtn.setAttribute('data-code-index', index);
        copyBtn.setAttribute('aria-label', 'Copy code');
        copyBtn.innerHTML = `
            <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
        `;

        copyBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const success = await copyToClipboard(textToCopy);

            if (success) {
                copyBtn.classList.add('copied');
                copyBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                `;

                setTimeout(() => {
                    copyBtn.classList.remove('copied');
                    copyBtn.innerHTML = `
                        <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    `;
                }, 2000);
            }
        });

        pre.appendChild(copyBtn);
    });
}

// --- Cross-platform Clipboard Copy ---
async function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.warn('[COPY] Clipboard API failed:', err);
        }
    }

    try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.top = '0';
        textArea.style.left = '0';
        textArea.style.width = '2em';
        textArea.style.height = '2em';
        textArea.style.opacity = '0';

        document.body.appendChild(textArea);
        textArea.select();

        const success = document.execCommand('copy');
        document.body.removeChild(textArea);
        return success;
    } catch (err) {
        console.warn('[COPY] execCommand failed:', err);
    }
    return false;
}

function scrollToBottom() {
    chatContainer.scrollTo({
        top: chatContainer.scrollHeight,
        behavior: 'smooth'
    });
}

// --- Inputs ---
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    // If goal command, save to local storage
    if (message.startsWith('/goal ')) {
        const goalTitle = message.substring(6).trim();
        localStorage.setItem('activeGoal', goalTitle);
        goalTitleText.textContent = goalTitle;
        goalProgressBar.style.width = '5%';
        goalStepsText.textContent = 'Initializing goal mode...';
        goalProgressOverlay.classList.add('show');
    }

    messageInput.value = '';
    messageInput.style.height = 'auto';
    messageInput.blur();

    sendBtn.disabled = true;
    sendBtn.style.opacity = '0.5';

    try {
        if (!chatIsOpen) {
            const newChatRes = await fetchWithAuth('/new-chat', { method: 'POST' });
            const newChatData = await newChatRes.json();
            if (newChatData.success) {
                await new Promise(r => setTimeout(r, 800));
                chatIsOpen = true;
            }
        }

        const res = await fetchWithAuth('/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });

        setTimeout(loadSnapshot, 300);
        setTimeout(loadSnapshot, 800);
        setTimeout(checkChatStatus, 1000);
    } catch (e) {
        console.error('Send error:', e);
        setTimeout(loadSnapshot, 500);
    } finally {
        sendBtn.disabled = false;
        sendBtn.style.opacity = '1';
    }
}

// --- Event Listeners ---
sendBtn.addEventListener('click', () => {
    if (isGenerating) {
        stopGeneration();
    } else {
        sendMessage();
    }
});

refreshBtn.addEventListener('click', () => {
    loadSnapshot();
    fetchAppState();
});

messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        // If autocomplete is visible, handle Enter key inside handleAutocompleteKeydown
        if (autocompletePopup.classList.contains('show')) {
            return;
        }
        e.preventDefault();
        sendMessage();
    } else {
        handleAutocompleteKeydown(e);
    }
});

messageInput.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
    handleAutocompleteInput();
});

if (enableHttpsBtn) enableHttpsBtn.addEventListener('click', enableHttps);
if (dismissSslBtn) dismissSslBtn.addEventListener('click', dismissSslBanner);
if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
if (backHistoryBtn) backHistoryBtn.addEventListener('click', hideChatHistory);

settingsSupportBtn.addEventListener('click', () => {
    supportOverlay.classList.add('show');
});

if (closeSupportBtn) {
    closeSupportBtn.addEventListener('click', () => {
        supportOverlay.classList.remove('show');
    });
}

if (supportOverlay) {
    supportOverlay.addEventListener('click', (e) => {
        if (e.target === supportOverlay) {
            supportOverlay.classList.remove('show');
        }
    });
}

// --- Scroll Sync to Desktop ---
let scrollSyncTimeout = null;
let lastScrollSync = 0;
const SCROLL_SYNC_DEBOUNCE = 150; 
let snapshotReloadPending = false;

async function syncScrollToDesktop() {
    const scrollPercent = chatContainer.scrollTop / (chatContainer.scrollHeight - chatContainer.clientHeight);
    try {
        await fetchWithAuth('/remote-scroll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scrollPercent })
        });

        if (!snapshotReloadPending) {
            snapshotReloadPending = true;
            setTimeout(() => {
                loadSnapshot();
                snapshotReloadPending = false;
            }, 300);
        }
    } catch (e) {
        console.log('Scroll sync failed:', e.message);
    }
}

chatContainer.addEventListener('scroll', () => {
    userIsScrolling = true;
    userScrollLockUntil = Date.now() + USER_SCROLL_LOCK_DURATION;
    clearTimeout(idleTimer);

    const isNearBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight < 120;
    if (isNearBottom) {
        scrollToBottomBtn.classList.remove('show');
        userScrollLockUntil = 0;
    } else {
        scrollToBottomBtn.classList.add('show');
    }

    const now = Date.now();
    if (now - lastScrollSync > SCROLL_SYNC_DEBOUNCE) {
        lastScrollSync = now;
        clearTimeout(scrollSyncTimeout);
        scrollSyncTimeout = setTimeout(syncScrollToDesktop, 100);
    }

    idleTimer = setTimeout(() => {
        userIsScrolling = false;
        autoRefreshEnabled = true;
    }, 5000);
});

scrollToBottomBtn.addEventListener('click', () => {
    userIsScrolling = false;
    userScrollLockUntil = 0; 
    scrollToBottom();
});

// --- Quick Actions ---
function quickAction(text) {
    messageInput.value = text;
    messageInput.style.height = 'auto';
    messageInput.style.height = messageInput.scrollHeight + 'px';
    messageInput.focus();
}

quickActionChips.forEach(chip => {
    chip.addEventListener('click', () => {
        const actionText = chip.getAttribute('data-action') || chip.innerText.trim();
        if (actionText.includes('Explain')) {
            quickAction('Explain this code in a detailed and elaborate manner.');
        } else if (actionText.includes('Fix')) {
            quickAction('Please fix the bugs in this code...');
        } else if (actionText.includes('Create')) {
            quickAction('Please create or update documentation for this code.');
        } else {
            quickAction(actionText);
        }
    });
});

// --- New Chat Logic ---
async function startNewChat() {
    newChatBtn.style.opacity = '0.5';
    newChatBtn.style.pointerEvents = 'none';

    try {
        const res = await fetchWithAuth('/new-chat', { method: 'POST' });
        const data = await res.json();

        if (data.success) {
            setTimeout(loadSnapshot, 500);
            setTimeout(loadSnapshot, 1000);
            setTimeout(checkChatStatus, 1500);
        }
    } catch (e) {
        console.error('New chat error:', e);
    }

    setTimeout(() => {
        newChatBtn.style.opacity = '1';
        newChatBtn.style.pointerEvents = 'auto';
    }, 500);
}

newChatBtn.addEventListener('click', startNewChat);

// --- Chat History Logic ---
async function showChatHistory() {
    historyList.innerHTML = `
        <div class="history-state-container">
            <div class="history-spinner"></div>
            <div class="history-state-text">Loading History...</div>
        </div>
    `;
    historyLayer.classList.add('show');
    historyBtn.style.opacity = '1';

    try {
        const res = await fetchWithAuth('/chat-history');
        const data = await res.json();

        if (data.error) {
            historyList.innerHTML = `
                <div class="history-state-container">
                    <div class="history-state-icon">⚠️</div>
                    <div class="history-state-title">Error loading history</div>
                    <div class="history-state-desc">${data.error}</div>
                    <button class="history-new-btn mt-4">
                        New Conversation
                    </button>
                </div>
            `;
            return;
        }

        const chats = data.chats || [];
        if (chats.length === 0) {
            historyList.innerHTML = `
                <div class="history-state-container">
                    <div class="history-state-icon">📝</div>
                    <div class="history-state-title">No recent chats found</div>
                    <button class="history-new-btn mt-4">
                        New Conversation
                    </button>
                </div>
            `;
            return;
        }

        let html = `
            <div class="history-action-container">
                <button class="history-new-btn">
                    New Conversation
                </button>
            </div>
            <div class="history-list-group">
        `;

        chats.forEach(chat => {
            const safeTitle = chat.title.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
            html += `
                <div class="history-card" data-title="${safeTitle}">
                    <div class="history-card-icon">
                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                        </svg>
                    </div>
                    <div class="history-card-content">
                        <span class="history-card-title">${escapeHtml(chat.title)}</span>
                    </div>
                    <div class="history-card-arrow">
                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        historyList.innerHTML = html;

    } catch (e) {
        historyList.innerHTML = `
            <div class="history-state-container">
                <div class="history-state-icon">🔌</div>
                <div class="history-state-title">Connection Error</div>
            </div>
        `;
    }
}

function hideChatHistory() {
    historyLayer.classList.remove('show');
    try {
        fetchWithAuth('/close-history', { method: 'POST' });
    } catch (e) {
        console.error('Failed to close history on desktop:', e);
    }
}

historyBtn.addEventListener('click', showChatHistory);

// --- Select Chat from History ---
async function selectChat(title) {
    chatContent.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>Switching Conversation...</p></div>';

    try {
        const res = await fetchWithAuth('/select-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title })
        });
        const data = await res.json();

        if (data.success) {
            let attempts = 0;
            const poll = setInterval(async () => {
                await loadSnapshot();
                attempts++;
                if (attempts > 10) clearInterval(poll);
            }, 500);
        } else {
            console.error('Failed to select chat:', data.error);
            setTimeout(loadSnapshot, 500);
        }
    } catch (e) {
        console.error('Select chat error:', e);
        setTimeout(loadSnapshot, 500);
    }
}

// --- Check Chat Status ---
async function checkChatStatus() {
    try {
        const res = await fetchWithAuth('/chat-status');
        const data = await res.json();
        chatIsOpen = data.hasChat || data.editorFound;
        if (!chatIsOpen) {
            showEmptyState();
        }
    } catch (e) {
        console.error('Chat status check failed:', e);
    }
}

// --- Empty State ---
function showEmptyState() {
    chatContent.innerHTML = `
        <div class="empty-state">
            <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <h2>No Chat Open</h2>
            <p>Start a new conversation or select one from your history to begin chatting.</p>
            <button class="empty-state-btn" id="newChatFromEmptyBtn">
                Start New Conversation
            </button>
        </div>
    `;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function openModal(title, options, onSelect) {
    modalTitle.textContent = title;
    modalList.innerHTML = '';
    options.forEach(opt => {
        const div = document.createElement('div');
        div.className = 'modal-option';
        div.textContent = opt;
        div.addEventListener('click', () => {
            onSelect(opt);
            closeModal();
        });
        modalList.appendChild(div);
    });
    modalOverlay.classList.add('show');
}

function closeModal() {
    modalOverlay.classList.remove('show');
}

modalOverlay.onclick = (e) => {
    if (e.target === modalOverlay) closeModal();
};

// --- Viewport / Keyboard Handling ---
if (window.visualViewport) {
    function handleResize() {
        document.body.style.height = window.visualViewport.height + 'px';
        if (document.activeElement === messageInput) {
            setTimeout(scrollToBottom, 100);
        }
    }
    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', handleResize);
    handleResize(); 
} else {
    window.addEventListener('resize', () => {
        document.body.style.height = window.innerHeight + 'px';
    });
    document.body.style.height = window.innerHeight + 'px'; 
}

// --- Remote Click Logic ---
chatContainer.addEventListener('click', async (e) => {
    const target = e.target.closest('div, span, p, summary, button, details');
    if (!target) return;

    const text = target.innerText || '';
    const isUiToggle = /Thought|Thinking|Worked for|Edited|\d+\s+file/i.test(text) && text.length < 500;

    if (isUiToggle) {
        target.style.opacity = '0.5';
        setTimeout(() => target.style.opacity = '1', 300);

        const firstLine = text.split('\n')[0].trim();
        const allElements = chatContainer.querySelectorAll(target.tagName.toLowerCase());
        let tapIndex = 0;
        for (let i = 0; i < allElements.length; i++) {
            const el = allElements[i];
            const elText = el.innerText || '';
            const elFirstLine = elText.split('\n')[0].trim();

            if (/Thought|Thinking|Worked for|Edited|\d+\s+file/i.test(elText) && elText.length < 500 && elFirstLine === firstLine) {
                if (el === target || el.contains(target)) {
                    break;
                }
                tapIndex++;
            }
        }

        try {
            await fetchWithAuth('/remote-click', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    selector: target.tagName.toLowerCase(),
                    index: tapIndex,
                    textContent: firstLine  
                })
            });

            setTimeout(loadSnapshot, 400);   
            setTimeout(loadSnapshot, 800);   
            setTimeout(loadSnapshot, 1500);  
        } catch (e) {
            console.error('Remote click failed:', e);
        }
        return;
    }

    const btn = e.target.closest('button, [role="button"]');
    if (btn) {
        const btnText = (btn.innerText || '').trim();
        const actionKeywords = [
            'Allow this conversation', 'Always allow', 'Allow once',
            'Review changes', 'Review',
            'Confirm', 'Accept', 'Reject', 'Discard',
            'Allow', 'Deny', 'Apply', 'Save', 'Run',
            'Yes', 'No'
        ];

        const btnTextLower = btnText.toLowerCase();
        const matchedKeyword = actionKeywords.find(kw =>
            btnTextLower.includes(kw.toLowerCase())
        );
        if (matchedKeyword) {
            btn.style.opacity = '0.5';
            setTimeout(() => btn.style.opacity = '1', 300);

            const allButtons = Array.from(chatContainer.querySelectorAll('button, [role="button"]'));
            const matchingButtons = allButtons.filter(b =>
                (b.innerText || '').toLowerCase().includes(matchedKeyword.toLowerCase())
            );
            const btnIndex = matchingButtons.indexOf(btn);

            try {
                await fetchWithAuth('/remote-click', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        selector: btn.tagName.toLowerCase() === 'button' ? 'button' : '[role="button"]',
                        index: btnIndex >= 0 ? btnIndex : 0,
                        textContent: matchedKeyword
                    })
                });

                setTimeout(loadSnapshot, 400);
                setTimeout(loadSnapshot, 1000);
                setTimeout(loadSnapshot, 2500);
            } catch (err) {
                console.error('Remote button click failed:', err);
            }
        }
    }
});

// Dynamic event delegation for history items
if (historyList) {
    historyList.addEventListener('click', (e) => {
        const newBtn = e.target.closest('.history-new-btn');
        const card = e.target.closest('.history-card');
        
        if (newBtn) {
            hideChatHistory();
            startNewChat();
        } else if (card) {
            const title = card.getAttribute('data-title');
            hideChatHistory();
            selectChat(title);
        }
    });
}

chatContent.addEventListener('click', (e) => {
    if (e.target.closest('#newChatFromEmptyBtn')) {
        startNewChat();
    }
});

// Click outside autocomplete to dismiss
document.addEventListener('click', (e) => {
    if (!e.target.closest('.input-section') && !e.target.closest('#autocompletePopup')) {
        hideAutocomplete();
    }
});

// --- Init ---
connectWebSocket();
fetchAppState();
setInterval(fetchAppState, 5000);
checkChatStatus();
setInterval(checkChatStatus, 10000); 
checkSslStatus();
