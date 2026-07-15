    let ws = null;
    const messagesEl = document.getElementById('messages');
    const inputEl = document.getElementById('input');
    const sendBtn = document.getElementById('send-btn');
    const statusDot = document.getElementById('status-dot');
    const agentSelect = document.getElementById('agent-select');
    const uploadBtn = document.getElementById('upload-btn');
    const fileInput = document.getElementById('file-input');
    const attachmentBar = document.getElementById('attachment-bar');
    const inputArea = document.getElementById('input-area');
    let statusLabel = null;
    let scrollBottomBtn = null;
    let composerResizeObserver = null;
    enhanceLocalShell();

    const uploadLimits = {
      maxCount: 50,
      maxFileBytes: 50 * 1024 * 1024,
      maxTotalBytes: 250 * 1024 * 1024,
      blockedExtensions: ['.exe', '.msi', '.dll', '.com', '.scr', '.bat', '.cmd', '.ps1', '.vbs', '.hta', '.lnk', '.url', '.reg', '.cpl'],
    };

    let connected = false;
    let isRunning = false;
    let currentSessionId = '';
    let currentSessionIdSource = '';
    let currentSessionKey = '';
    let currentAgentType = loadAgentTypeFromUrlOrStorage();
    let reconnectTimer = null;
    let localToken = '';
    let currentAssistantMsg = null;
    let currentAssistantTurn = null;
    let thinkingMsg = null;
    let thinkingText = '';
    let currentTurnActions = [];
    let currentTurnActionSeq = 0;
    let pendingAttachments = [];
    let assistantBuffer = '';
    let currentAssistantMarkdown = '';
    let assistantFrame = null;
    let autoFollowMessages = true;
    const inlineSlashStreamIds = new Set();
    const outgoingObjectUrls = new Set();

    function enhanceLocalShell() {
      const header = document.getElementById('header');
      const headerTitle = document.getElementById('header-title');

      if (header && headerTitle && !header.querySelector('.brand')) {
        headerTitle.textContent = 'Linco Local Agent';

        const brand = document.createElement('div');
        brand.className = 'brand';
        const brandMark = document.createElement('span');
        brandMark.className = 'brand-mark';
        brandMark.setAttribute('aria-hidden', 'true');
        brandMark.textContent = 'LC';
        const brandCopy = document.createElement('div');
        brandCopy.className = 'brand-copy';
        const subtitle = document.createElement('span');
        subtitle.className = 'header-subtitle';
        subtitle.textContent = 'Local IM simulator for bridge debugging';

        brandCopy.appendChild(headerTitle);
        brandCopy.appendChild(subtitle);
        brand.appendChild(brandMark);
        brand.appendChild(brandCopy);

        const controls = document.createElement('div');
        controls.className = 'header-controls';
        const statusPill = document.createElement('span');
        statusPill.className = 'status-pill';
        statusPill.title = 'Connection status';
        statusLabel = document.createElement('span');
        statusLabel.id = 'status-label';
        statusLabel.textContent = 'Offline';
        statusPill.appendChild(statusDot);
        statusPill.appendChild(statusLabel);
        agentSelect.title = 'Select local test Agent';
        controls.appendChild(statusPill);
        controls.appendChild(agentSelect);

        header.textContent = '';
        header.appendChild(brand);
        header.appendChild(controls);
      } else {
        statusLabel = document.getElementById('status-label');
      }

      if (attachmentBar && inputArea && !document.getElementById('composer-shell')) {
        const composer = document.createElement('div');
        composer.id = 'composer-shell';
        inputArea.parentNode.insertBefore(composer, attachmentBar);
        composer.appendChild(attachmentBar);
        composer.appendChild(inputArea);
      }

      const chatContainer = document.getElementById('chat-container');
      if (chatContainer && !document.getElementById('scroll-bottom-btn')) {
        scrollBottomBtn = document.createElement('button');
        scrollBottomBtn.id = 'scroll-bottom-btn';
        scrollBottomBtn.type = 'button';
        scrollBottomBtn.textContent = 'Bottom';
        scrollBottomBtn.addEventListener('click', () => scrollToBottom({ force: true }));
        chatContainer.appendChild(scrollBottomBtn);
      } else {
        scrollBottomBtn = document.getElementById('scroll-bottom-btn');
      }

      uploadBtn.textContent = '+';
      uploadBtn.title = 'Attach files';
      uploadBtn.setAttribute('aria-label', 'Attach files');
      statusDot.className = 'disconnected';
      inputEl.rows = 1;
      inputEl.placeholder = 'Ask a question or type /help';
      sendBtn.textContent = 'Send';
      observeComposerHeight();
    }

    window.addEventListener('beforeunload', () => {
      for (const url of outgoingObjectUrls) URL.revokeObjectURL(url);
      outgoingObjectUrls.clear();
    });

    function usePageScroll() {
      return window.matchMedia('(max-width: 640px)').matches;
    }

    function scrollRoot() {
      return document.scrollingElement || document.documentElement;
    }

    function updateComposerHeight() {
      const composer = document.getElementById('composer-shell');
      if (!composer) return;
      const height = Math.ceil(composer.getBoundingClientRect().height || 88);
      document.documentElement.style.setProperty('--composer-height', `${height}px`);
    }

    function observeComposerHeight() {
      const composer = document.getElementById('composer-shell');
      updateComposerHeight();
      if (!composer || composerResizeObserver || typeof ResizeObserver === 'undefined') return;
      composerResizeObserver = new ResizeObserver(() => {
        updateComposerHeight();
        updateScrollBottomButton();
      });
      composerResizeObserver.observe(composer);
    }

    function isNearBottom() {
      if (usePageScroll()) {
        const root = scrollRoot();
        return root.scrollHeight - root.scrollTop - root.clientHeight < 120;
      }
      return messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 80;
    }

    function updateScrollBottomButton() {
      if (!scrollBottomBtn) return;
      const hasConversation = messagesEl.children.length > 2;
      scrollBottomBtn.classList.toggle('visible', hasConversation && !isNearBottom());
    }

    function scrollToBottom(options = {}) {
      if (!options.force && !autoFollowMessages) return;
      if (usePageScroll()) {
        const root = scrollRoot();
        root.scrollTop = root.scrollHeight;
      } else {
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
      autoFollowMessages = true;
      requestAnimationFrame(updateScrollBottomButton);
    }

    messagesEl.addEventListener('scroll', () => {
      autoFollowMessages = isNearBottom();
      updateScrollBottomButton();
    }, { passive: true });

    window.addEventListener('scroll', () => {
      if (usePageScroll()) {
        autoFollowMessages = isNearBottom();
        updateScrollBottomButton();
      }
    }, { passive: true });

    window.addEventListener('resize', () => {
      updateComposerHeight();
      updateScrollBottomButton();
    }, { passive: true });

    function addMessage(type, text, extra = {}) {
      const shouldFollow = autoFollowMessages || isNearBottom();
      const div = document.createElement('div');
      div.className = `message ${type}`;

      if (type === 'assistant') {
        div.classList.add('markdown');
        renderAssistantMarkdown(div, text);
      } else if (type === 'system') {
        renderSystemMessage(div, text);
      } else {
        const textNode = document.createElement('span');
        textNode.textContent = text;
        div.appendChild(textNode);
      }

      if (extra.attachments?.length) {
        const list = document.createElement('div');
        list.className = 'file-list';
        for (const file of extra.attachments) {
          if (file.mimeType?.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = `data:${file.mimeType};base64,${file.base64}`;
            img.alt = file.name;
            list.appendChild(img);
          } else {
            const item = document.createElement('div');
            item.textContent = `File: ${file.name} (${formatSize(file.size)})`;
            list.appendChild(item);
          }
        }
        div.appendChild(list);
      }

      const actions = normalizeMessageActions(extra.actions || extra.quickActions || extra.quickReplies);
      if (actions.length) {
        div.appendChild(createMessageActions(actions));
      }

      messagesEl.appendChild(div);
      if (type === 'user' || shouldFollow) scrollToBottom({ force: true });
      updateScrollBottomButton();
      return div;
    }

    function addPresenceMessage(data) {
      const device = data.device || {};
      const client = data.client || {};
      const div = document.createElement('div');
      div.className = 'message system is-status';

      const grid = document.createElement('div');
      grid.className = 'presence-grid';
      appendPresenceTitle(grid, `${agentLabel(data.from || currentAgentType)} ${data.status === 'offline' ? 'offline' : 'online'}`);
      appendPresenceRow(grid, 'Device', device.name || '-');
      appendPresenceRow(grid, 'Device ID', device.id || '-');
      appendPresenceRow(grid, 'Platform', [device.platform, device.arch].filter(Boolean).join(' / ') || '-');
      appendPresenceRow(grid, 'Client', [client.name, client.version].filter(Boolean).join(' ') || '-');
      if (data.reason) appendPresenceRow(grid, 'Reason', data.reason);

      div.appendChild(grid);
      messagesEl.appendChild(div);
      scrollToBottom({ force: true });
      updateScrollBottomButton();
    }

    function appendPresenceTitle(parent, text) {
      const item = document.createElement('div');
      item.className = 'presence-title';
      item.textContent = text;
      parent.appendChild(item);
    }

    function appendPresenceRow(parent, label, value) {
      const row = document.createElement('div');
      row.className = 'presence-row';
      const labelEl = document.createElement('span');
      labelEl.className = 'presence-label';
      labelEl.textContent = label;
      const valueEl = document.createElement('span');
      valueEl.className = 'presence-value';
      valueEl.textContent = String(value || '-');
      row.appendChild(labelEl);
      row.appendChild(valueEl);
      parent.appendChild(row);
    }

    function renderSystemMessage(container, text) {
      const raw = String(text || '');
      const lines = raw.split(/\r?\n/);
      if (isStatusSystemMessage(raw)) container.classList.add('is-status');

      const wrapper = document.createElement('div');
      wrapper.className = 'system-lines';

      for (const line of lines) {
        const item = document.createElement('span');
        item.className = 'system-line';
        if (!line.trim()) {
          item.classList.add('is-muted');
          item.textContent = '';
        } else {
          if (isPathLikeLine(line)) item.classList.add('is-path');
          if (isCommandLikeLine(line)) item.classList.add('is-command');
          item.textContent = line;
        }
        wrapper.appendChild(item);
      }

      container.appendChild(wrapper);
    }

    function isStatusSystemMessage(text) {
      return /Connected|disconnected|reconnect|workspace|\/help|Local simulator/i.test(text || '');
    }

    function isPathLikeLine(line) {
      const value = String(line || '').trim();
      return /^[A-Za-z]:\\/.test(value) || value.includes('\\workspace') || value.includes('/workspace') || value.includes('/sessions/');
    }

    function isCommandLikeLine(line) {
      return /(^|\s)\/[a-z][\w-]*(\s|$)/i.test(String(line || ''));
    }

    function normalizeMessageActions(actions) {
      if (!Array.isArray(actions)) return [];
      return actions
        .map(action => {
          if (typeof action === 'string') return { label: action, command: action };
          if (!action || typeof action !== 'object') return null;
          const command = String(action.command || action.text || action.value || '').trim();
          const label = String(action.label || action.title || command || '').trim();
          return command && label ? { ...action, command, label } : null;
        })
        .filter(Boolean)
        .slice(0, 40);
    }

    function createMessageActions(actions) {
      const container = document.createElement('div');
      container.className = 'message-actions';

      for (const action of actions) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'message-action-btn';
        button.textContent = action.label;
        button.title = action.command;
        button.addEventListener('click', () => {
          sendTextMessage(action.command);
        });
        container.appendChild(button);
      }

      return container;
    }

    function addSlashCommandResult(result) {
      const shouldFollow = autoFollowMessages || isNearBottom();
      const command = String(result?.command || '').trim();
      const data = result?.data && typeof result.data === 'object' ? result.data : {};
      if (command === 'history' && data.replaceConversation) {
        replaceConversationWithHistory(data);
        return null;
      }
      const card = document.createElement('div');
      card.className = 'slash-result';

      const header = document.createElement('div');
      header.className = 'slash-result-header';
      const title = document.createElement('div');
      title.textContent = slashCommandTitle(command);
      const meta = document.createElement('div');
      meta.className = 'slash-result-meta';
      meta.textContent = slashCommandMeta(command, data);
      header.appendChild(title);
      if (meta.textContent) header.appendChild(meta);
      card.appendChild(header);

      if (command === 'history') {
        renderHistoryResult(card, data);
      } else if (command === 'help') {
        renderListResult(card, data.items || [], {
          emptyText: 'No commands available',
          title: item => item.label || item.command || '(command)',
          subtitle: item => item.description || '',
          command: () => '',
          commandLabel: () => 'Send',
        });
        renderHelpNotes(card, data.notes);
      } else if (command === 'sessions') {
        renderListResult(card, data.items || [], {
          emptyText: 'No local sessions found',
          title: item => item.title || item.id || '(untitled)',
          subtitle: item => [
            item.id ? `ID: ${item.id}` : '',
            item.updatedAtText ? `Updated: ${item.updatedAtText}` : '',
          ].filter(Boolean).join('\n'),
          command: item => item.bindCommand,
          commandLabel: () => 'Bind session',
        });
      } else if (command === 'project') {
        renderListResult(card, data.items || [], {
          emptyText: 'No known projects found',
          title: item => item.label || item.path || '(project)',
          subtitle: item => item.path || '',
          command: item => item.command,
          commandLabel: () => 'Select project',
        });
      } else if (command === 'chats') {
        renderListResult(card, data.items || [], {
          emptyText: 'No Codex chats found',
          title: item => item.title || item.firstMessage || item.id || '(chat)',
          subtitle: item => [
            item.id ? `ID: ${item.id}` : '',
            item.updatedAtText ? `Updated: ${item.updatedAtText}` : '',
            item.workspace || '',
          ].filter(Boolean).join('\n'),
          command: item => item.bindCommand,
          commandLabel: () => 'Bind chat',
        });
      } else if (command === 'agent') {
        renderListResult(card, data.items || [], {
          emptyText: 'No Agents available',
          title: item => `${item.id || '(agent)'}${item.isCurrent ? ' (current)' : ''}${item.isDefault ? ' (default)' : ''}`,
          subtitle: item => [item.model ? `model: ${item.model}` : '', item.workspace || item.agentDir || ''].filter(Boolean).join('\n'),
          command: item => item.command,
          commandLabel: () => 'Bind agent',
        });
      } else if (command === 'profile') {
        renderListResult(card, data.items || [], {
          emptyText: 'No Profiles available',
          title: item => `${item.name || '(profile)'}${item.isCurrent ? ' (current)' : ''}${item.isDefault ? ' (default)' : ''}`,
          subtitle: () => '',
          command: item => item.command,
          commandLabel: () => 'Bind profile',
        });
      } else {
        const pre = document.createElement('pre');
        pre.className = 'history-text';
        pre.textContent = JSON.stringify(data, null, 2);
        card.appendChild(pre);
      }

      messagesEl.appendChild(card);
      if (shouldFollow) scrollToBottom({ force: true });
      return card;
    }

    function replaceConversationWithHistory(data) {
      clearRenderedConversation();
      currentSessionKey = data.agentSessionId || currentSessionKey;
      const rounds = Array.isArray(data.rounds) ? data.rounds : [];
      if (!rounds.length) {
        addMessage('system', 'The current session has no displayable chat history.');
        return;
      }
      for (const round of rounds) {
        addMessage('user', round.user?.text || '');
        addHistoryAssistantMessage(round);
      }
      scrollToBottom({ force: true });
    }

    function addHistoryAssistantMessage(round) {
      const thinking = historyThinkingText(round);
      if (!thinking) {
        if (!round.assistant?.missing) addMessage('assistant', round.assistant?.text || '');
        return;
      }

      const container = document.createElement('div');
      container.className = 'message assistant markdown assistant-turn';

      const actionPanel = createActionPanel();
      actionPanel.panel.classList.add('active');
      actionPanel.panel.classList.remove('is-running');
      actionPanel.details.open = false;
      actionPanel.summaryText.textContent = 'Thinking summary';
      actionPanel.list.appendChild(createActionItem({
        id: `history-thinking-${round.roundId || round.index || ''}`,
        type: 'thinking',
        status: 'success',
        label: 'Thinking summary',
        detail: thinking,
      }));
      container.appendChild(actionPanel.panel);

      if (!round.assistant?.missing) {
        const content = document.createElement('div');
        content.className = 'assistant-content';
        content.dataset.role = 'final-answer';
        renderAssistantMarkdown(content, round.assistant?.text || '');
        container.appendChild(content);
      }

      messagesEl.appendChild(container);
    }

    function historyThinkingText(round) {
      return String(round?.thinking?.text || '').trim();
    }

    function clearRenderedConversation() {
      messagesEl.textContent = '';
      currentAssistantMsg = null;
      currentAssistantTurn = null;
      thinkingMsg = null;
      thinkingText = '';
      currentTurnActions = [];
      assistantBuffer = '';
      currentAssistantMarkdown = '';
      if (assistantFrame) cancelAnimationFrame(assistantFrame);
      assistantFrame = null;
      inlineSlashStreamIds.clear();
      autoFollowMessages = true;
    }

    function slashCommandTitle(command) {
      if (command === 'history') return 'Chat History';
      if (command === 'help') return 'Available Commands';
      if (command === 'sessions') return 'Local Sessions';
      if (command === 'project') return 'Known Projects';
      if (command === 'chats') return 'Codex Chats';
      if (command === 'agent') return 'OpenClaw Agent';
      if (command === 'profile') return 'Hermes Profile';
      return `Slash command: ${command || 'unknown'}`;
    }

    function slashCommandMeta(command, data) {
      if (command === 'history') return `${data.agentType || ''} ${data.returnedRounds || 0}/${data.requestedLimit || 0}`.trim();
      if (command === 'help') return `${data.agentType || ''} ${data.returnedCount || (data.items || []).length || 0} items`.trim();
      if (command === 'sessions') return `${data.agentType || ''} ${data.returnedCount || 0}/${data.requestedLimit || 0}`.trim();
      if (command === 'project') return `${(data.items || []).length} items`;
      if (command === 'chats') return `${data.returnedCount || 0}/${data.requestedLimit || 0}`;
      if (command === 'agent') return data.current ? `current: ${data.current}` : '';
      if (command === 'profile') return data.current ? `current: ${data.current}` : '';
      return '';
    }

    function renderHistoryResult(card, data) {
      const rounds = Array.isArray(data.rounds) ? data.rounds : [];
      if (!rounds.length) {
        appendSlashEmpty(card, 'No displayable chat history');
        return;
      }
      const list = document.createElement('div');
      list.className = 'history-rounds';
      for (const round of rounds) {
        const item = document.createElement('div');
        item.className = 'history-round';
        appendHistoryBlock(item, 'User', round.user?.text || '');
        const thinking = historyThinkingText(round);
        if (thinking) appendHistoryBlock(item, 'Thinking', thinking);
        appendHistoryBlock(item, 'Assistant', round.assistant?.missing ? '(no final output)' : (round.assistant?.text || ''));
        list.appendChild(item);
      }
      card.appendChild(list);
    }

    function appendHistoryBlock(container, role, text) {
      const block = document.createElement('div');
      block.className = 'history-block';
      const label = document.createElement('div');
      label.className = 'history-role';
      label.textContent = role;
      const body = document.createElement('div');
      body.className = 'history-text';
      body.textContent = text || '(empty)';
      block.appendChild(label);
      block.appendChild(body);
      container.appendChild(block);
    }

    function renderListResult(card, items, options) {
      if (!Array.isArray(items) || !items.length) {
        appendSlashEmpty(card, options.emptyText || 'No data');
        return;
      }
      const list = document.createElement('div');
      list.className = 'slash-result-list';
      for (const item of items) {
        const row = document.createElement('div');
        row.className = 'slash-result-item';
        const title = document.createElement('div');
        title.className = 'slash-result-title';
        title.textContent = options.title(item);
        row.appendChild(title);
        const subtitleText = options.subtitle(item);
        if (subtitleText) {
          const subtitle = document.createElement('div');
          subtitle.className = 'slash-result-subtitle';
          subtitle.textContent = subtitleText;
          row.appendChild(subtitle);
        }
        const command = String(options.command(item) || '').trim();
        if (command) {
          row.appendChild(createMessageActions([{ label: options.commandLabel(item), command }]));
        }
        list.appendChild(row);
      }
      card.appendChild(list);
    }

    function renderHelpNotes(card, notes) {
      if (!Array.isArray(notes) || !notes.length) return;
      const list = document.createElement('div');
      list.className = 'slash-result-list';
      for (const noteText of notes) {
        const row = document.createElement('div');
        row.className = 'slash-result-item';
        const note = document.createElement('div');
        note.className = 'slash-result-subtitle';
        note.textContent = String(noteText || '');
        row.appendChild(note);
        list.appendChild(row);
      }
      card.appendChild(list);
    }

    function appendSlashEmpty(card, text) {
      const empty = document.createElement('div');
      empty.className = 'slash-result-subtitle';
      empty.textContent = text;
      card.appendChild(empty);
    }

    function renderAssistantMarkdown(el, rawText) {
      if (!el) return;

      if (!window.marked || !window.DOMPurify) {
        el.textContent = rawText || '';
        return;
      }

      try {
        const html = marked.parse(rawText || '', {
          breaks: true,
          gfm: true,
        });
        el.innerHTML = DOMPurify.sanitize(html, {
          ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
        });
        for (const link of el.querySelectorAll('a[href]')) {
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
        }
      } catch {
        el.textContent = rawText || '';
      }
    }

    function removeMessage(el) {
      if (el) {
        el.remove();
        scrollToBottom();
      }
    }

    function ensureAssistantTurn() {
      if (currentAssistantTurn?.container?.isConnected) return currentAssistantTurn;

      currentAssistantMarkdown = '';
      currentTurnActions = [];
      currentTurnActionSeq = 0;
      thinkingText = '';

      const container = document.createElement('div');
      container.className = 'message assistant markdown assistant-turn';

      const actionPanel = createActionPanel();
      const content = document.createElement('div');
      content.className = 'assistant-content';
      content.dataset.role = 'final-answer';

      container.appendChild(actionPanel.panel);
      container.appendChild(content);
      messagesEl.appendChild(container);

      currentAssistantMsg = content;
      currentAssistantTurn = {
        container,
        actionPanel: actionPanel.panel,
        actionDetails: actionPanel.details,
        actionSummaryText: actionPanel.summaryText,
        actionCount: actionPanel.count,
        actionList: actionPanel.list,
      };
      scrollToBottom();
      return currentAssistantTurn;
    }

    function createActionPanel() {
      const panel = document.createElement('div');
      panel.className = 'agent-action-panel is-running';

      const details = document.createElement('details');
      details.className = 'agent-action-details';
      details.open = true;

      const summary = document.createElement('summary');
      summary.className = 'agent-action-summary';

      const dot = document.createElement('span');
      dot.className = 'agent-task-dot';

      const summaryText = document.createElement('span');
      summaryText.className = 'agent-action-summary-text';
      summaryText.textContent = 'Thinking...';

      const count = document.createElement('span');
      count.className = 'agent-action-count';

      const list = document.createElement('div');
      list.className = 'agent-action-list';

      summary.appendChild(dot);
      summary.appendChild(summaryText);
      summary.appendChild(count);
      details.appendChild(summary);
      details.appendChild(list);
      panel.appendChild(details);
      return { panel, details, summaryText, count, list };
    }

    function completeAssistantTurn() {
      flushAssistantBuffer();
      if (currentAssistantTurn) {
        if (!currentAssistantMarkdown.trim() && currentAssistantTurn.container.dataset.deliveredFiles) {
          currentAssistantMarkdown = currentAssistantTurn.container.dataset.deliveredFiles === '1'
            ? 'Files are ready. See the attachment below.'
            : `${currentAssistantTurn.container.dataset.deliveredFiles} files are ready. See the attachments below.`;
          renderAssistantMarkdown(currentAssistantMsg, currentAssistantMarkdown);
        }
        currentAssistantTurn.actionPanel.classList.remove('is-running');
        if (currentTurnActions.length) {
          currentAssistantTurn.actionDetails.open = false;
          updateActionPanelSummary();
        }
      }
      currentAssistantMsg = null;
      currentAssistantTurn = null;
      thinkingMsg = null;
      thinkingText = '';
    }

    function ensureActionPanel() {
      const turn = ensureAssistantTurn();
      turn.actionPanel.classList.add('active');
      updateActionPanelSummary();
      return turn;
    }

    function updateActionPanelSummary() {
      if (!currentAssistantTurn) return;
      const realActions = currentTurnActions.filter(action => action.type !== 'thinking');
      const running = currentTurnActions.some(action => action.status === 'running');
      const failed = currentTurnActions.some(action => action.status === 'failed');
      const completed = realActions.filter(action => action.status === 'success' || action.status === 'failed').length;

      let text = 'Thinking...';
      if (realActions.length) {
        if (running) text = `Running (${completed}/${realActions.length} steps)`;
        else if (failed) text = `Partially completed (${completed}/${realActions.length} steps)`;
        else text = `Completed (${completed}/${realActions.length} steps)`;
      } else if (currentTurnActions.some(action => action.type === 'thinking')) {
        text = running ? 'Thinking...' : 'Thinking summary';
      }

      currentAssistantTurn.actionSummaryText.textContent = text;
      currentAssistantTurn.actionCount.textContent = realActions.length ? `${realActions.length}` : '';
      currentAssistantTurn.actionPanel.classList.toggle('is-running', running);
    }

    function actionTypeForTool(name) {
      const tool = String(name || '').trim().toLowerCase();
      if (tool === 'exec' || tool.includes('shell') || tool.includes('command')) return 'shell';
      if (tool.includes('search') || tool === 'grep' || tool === 'glob') return 'search';
      if (tool.includes('read')) return 'read';
      if (tool.includes('write')) return 'write';
      if (tool.includes('edit') || tool.includes('patch')) return 'edit';
      return 'tool';
    }

    function fallbackThinkingForTool(tool) {
      const actionType = actionTypeForTool(tool.name || tool.toolName);
      const label = summarizeToolInput(tool.input || tool.name || 'tool call');
      if (actionType === 'shell') return 'Preparing to run a command for verification.';
      if (actionType === 'search') return `Preparing to search${label ? `: ${label}` : ''}.`;
      if (actionType === 'read') return `Preparing to inspect files${label ? `: ${label}` : ''}.`;
      if (actionType === 'write' || actionType === 'edit') return `Preparing to edit content${label ? `: ${label}` : ''}.`;
      return `Preparing to call ${tool.name || 'a tool'}.`;
    }

    function summarizeToolInput(value) {
      const text = typeof value === 'string' ? value : safeStringify(value);
      return text.replace(/\s+/g, ' ').trim().slice(0, 90);
    }

    function safeStringify(value) {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value || '');
      }
    }

    function upsertAction(action) {
      ensureActionPanel();
      const id = action.id || `action-${++currentTurnActionSeq}`;
      const duplicate = findDuplicateCompletedAction(id, action);
      if (duplicate) {
        duplicate.repeat = (duplicate.repeat || 1) + 1;
        duplicate.label = action.label || duplicate.label;
        duplicate.detail = action.detail || duplicate.detail;
        renderActionPanel();
        return duplicate;
      }
      let item = currentTurnActions.find(entry => entry.id === id);
      if (!item) {
        item = {
          id,
          type: action.type || 'tool',
          status: action.status || 'running',
          label: action.label || '',
          detail: action.detail || '',
          detailTitle: action.detailTitle || 'Details',
          repeat: action.repeat || 1,
        };
        currentTurnActions.push(item);
      } else {
        Object.assign(item, action, { id });
      }
      renderActionPanel();
      return item;
    }

    function findDuplicateCompletedAction(id, action) {
      if (currentTurnActions.some(entry => entry.id === id)) return null;
      const type = action.type || 'tool';
      const label = action.label || '';
      const detail = action.detail || '';
      return currentTurnActions.find(entry =>
        entry.type === type &&
        entry.label === label &&
        entry.detail === detail &&
        entry.status === action.status
      ) || null;
    }

    function renderActionPanel() {
      if (!currentAssistantTurn) return;
      currentAssistantTurn.actionList.textContent = '';
      for (const action of currentTurnActions) {
        currentAssistantTurn.actionList.appendChild(createActionItem(action));
      }
      updateActionPanelSummary();
    }

    function createActionItem(action) {
      const item = document.createElement('div');
      item.className = `agent-action-item is-${action.status || 'running'}`;
      item.dataset.actionId = action.id;

      if (action.type === 'thinking') {
        const row = document.createElement('div');
        row.className = 'agent-action-thinking';
        const kind = document.createElement('span');
        kind.className = 'agent-action-thinking-kind';
        kind.textContent = 'THINK';
        const text = document.createElement('span');
        text.className = 'agent-action-thinking-text';
        text.textContent = action.detail || action.label;
        row.appendChild(kind);
        row.appendChild(text);
        item.appendChild(row);
        return item;
      }

      const main = document.createElement('div');
      main.className = 'agent-action-main';
      const kind = document.createElement('span');
      kind.className = 'agent-action-kind';
      kind.textContent = action.type || 'tool';
      const label = document.createElement('span');
      label.className = 'agent-action-label';
      label.textContent = action.label || action.toolName || 'Tool call';
      if (action.repeat > 1) label.textContent += ` x${action.repeat}`;
      label.title = label.textContent;
      const state = document.createElement('span');
      state.className = 'agent-action-state';
      state.textContent = action.status === 'success' ? 'Done' : action.status === 'failed' ? 'Failed' : 'Running';
      main.appendChild(kind);
      main.appendChild(label);
      main.appendChild(state);
      item.appendChild(main);

      if (action.detail) {
        const details = document.createElement('details');
        details.className = 'agent-action-io';
        const summary = document.createElement('summary');
        summary.textContent = action.detailTitle || 'Details';
        const pre = document.createElement('pre');
        pre.textContent = action.detail;
        details.appendChild(summary);
        details.appendChild(pre);
        item.appendChild(details);
      }
      return item;
    }

    function insertReasoningCard(card) {
      if (currentAssistantMsg?.parentNode === messagesEl) {
        messagesEl.insertBefore(card, currentAssistantMsg);
        return;
      }
      messagesEl.appendChild(card);
    }

    function handleThinking(data) {
      const text = normalizeThinkingText(data.fullText || data.text || data.delta || '');
      if (!isUsefulThinkingText(text)) return;

      thinkingText = appendReasoningText(thinkingText, text, data);
      thinkingText = normalizeThinkingText(thinkingText);
      if (!isUsefulThinkingText(thinkingText)) return;
      upsertAction({
        id: currentThinkingActionId(),
        type: 'thinking',
        status: 'running',
        label: 'Thinking summary',
        detail: thinkingText,
      });
      scrollToBottom();
    }

    function clearThinking(options = {}) {
      const action = currentTurnActions.find(item => item.id === currentThinkingActionId());
      if (action) {
        const removeCompleted = options.remove && action.status === 'running';
        if (removeCompleted || !isUsefulThinkingText(thinkingText)) {
          currentTurnActions = currentTurnActions.filter(item => item.id !== currentThinkingActionId());
        } else {
          action.status = 'success';
          action.detail = thinkingText;
        }
        renderActionPanel();
      }
      thinkingMsg = null;
      if (options.remove) thinkingText = '';
    }

    function createReasoningCard() {
      const card = document.createElement('div');
      card.className = 'reasoning-card active collapsed';

      const header = document.createElement('button');
      header.type = 'button';
      header.className = 'reasoning-card-header';
      header.addEventListener('click', () => {
        card.classList.toggle('collapsed');
      });

      const toggle = document.createElement('span');
      toggle.className = 'reasoning-card-toggle';
      toggle.textContent = '>';

      const title = document.createElement('span');
      title.className = 'reasoning-card-title';
      title.textContent = 'Thinking';

      const preview = document.createElement('span');
      preview.className = 'reasoning-card-preview';
      preview.textContent = '';

      const badge = document.createElement('span');
      badge.className = 'reasoning-card-badge';
      badge.textContent = 'Summary';

      const body = document.createElement('div');
      body.className = 'reasoning-card-body';
      body.textContent = '';

      header.appendChild(toggle);
      header.appendChild(title);
      header.appendChild(preview);
      header.appendChild(badge);
      card.appendChild(header);
      card.appendChild(body);
      return card;
    }

    function updateReasoningCard(card, text, active) {
      const cleanText = normalizeThinkingText(text);
      if (!cleanText) return;
      const badge = card.querySelector('.reasoning-card-badge');
      if (badge) badge.textContent = active ? 'Running' : 'Collapsed';
      const title = card.querySelector('.reasoning-card-title');
      if (title) title.textContent = active ? 'Thinking' : 'Thinking Summary';
      const preview = card.querySelector('.reasoning-card-preview');
      if (preview) preview.textContent = compactPreview(cleanText);
      const body = card.querySelector('.reasoning-card-body');
      if (body) body.textContent = cleanText;
      card.classList.toggle('active', !!active);
    }

    function appendReasoningText(current, next, data = {}) {
      const normalizedNext = normalizeThinkingText(next);
      if (typeof data.fullText === 'string') return normalizeThinkingText(data.fullText);
      if (data.replace === true) return normalizedNext;
      if (!current) return normalizedNext;
      if (normalizedNext.startsWith(current)) return normalizedNext;
      if (current.endsWith(normalizedNext)) return current;
      return `${current}${normalizedNext}`;
    }

    function normalizeThinkingText(value) {
      return String(value || '')
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map(line => line.trimEnd())
        .filter(line => !isDividerLine(line))
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    function isUsefulThinkingText(text) {
      if (!text || text.length < 8) return false;
      const compact = text.replace(/\s/g, '');
      if (compact.length < 8) return false;
      const signalChars = compact.replace(/[-_=*#`~|.]/g, '');
      return signalChars.length >= 8;
    }

    function isDividerLine(line) {
      const compact = String(line || '').trim();
      if (!compact) return true;
      return /^[-_=*#`~|.\s]{6,}$/.test(compact);
    }

    function compactPreview(text) {
      return text.replace(/\s+/g, ' ').slice(0, 84);
    }

    function addToolCard(tool) {
      const toolId = tool.id || '';
      const hadCurrentThinking = closeCurrentThinking();
      if (!hadCurrentThinking && !currentTurnActions.some(action => action.type === 'thinking' && action.status === 'running')) {
        upsertAction({
          id: `thinking-for-${toolId || currentTurnActionSeq + 1}`,
          type: 'thinking',
          status: 'success',
          label: 'Thinking summary',
          detail: fallbackThinkingForTool(tool),
        });
      }
      upsertAction({
        id: toolId || `tool-${++currentTurnActionSeq}`,
        type: actionTypeForTool(tool.name),
        status: 'running',
        toolName: tool.name || 'tool',
        label: tool.name || 'tool',
        detail: summarizeToolInput(tool.input || ''),
        detailTitle: 'Input',
      });
      scrollToBottom();
    }

    function closeCurrentThinking() {
      const action = currentTurnActions.find(item => item.id === currentThinkingActionId() && item.status === 'running');
      if (!action) return false;
      action.status = 'success';
      action.detail = thinkingText || action.detail;
      action.id = `thinking-${++currentTurnActionSeq}`;
      thinkingText = '';
      renderActionPanel();
      return true;
    }

    function currentThinkingActionId() {
      return 'thinking-current';
    }

    function createToolCard(toolId, title, badgeText) {
      const card = document.createElement('div');
      card.className = 'tool-card';
      card.dataset.toolId = toolId || '';

      const header = document.createElement('button');
      header.type = 'button';
      header.className = 'tool-card-header';
      header.addEventListener('click', () => {
        card.classList.toggle('collapsed');
      });

      const toggle = document.createElement('span');
      toggle.className = 'tool-card-toggle';
      toggle.textContent = 'v';

      const main = document.createElement('span');
      main.className = 'tool-card-summary-main';
      main.textContent = title;

      const badge = document.createElement('span');
      badge.className = 'tool-card-summary-badge';
      badge.textContent = badgeText;

      header.appendChild(toggle);
      header.appendChild(main);
      header.appendChild(badge);
      card.appendChild(header);

      const body = document.createElement('div');
      body.className = 'tool-card-body';
      card.appendChild(body);

      return card;
    }

    function updateToolCardHeader(card, title, badgeText) {
      const main = card.querySelector('.tool-card-summary-main');
      if (main && title) main.textContent = title;
      const badge = card.querySelector('.tool-card-summary-badge');
      if (badge && badgeText) badge.textContent = badgeText;
    }

    function upsertToolSection(card, sectionKey, title, output) {
      const body = card.querySelector('.tool-card-body') || card;
      let section = body.querySelector(`.tool-section[data-section-key="${cssEscape(sectionKey)}"]`);
      if (!section) {
        section = createToolSection(title, output);
        section.dataset.sectionKey = sectionKey;
        body.appendChild(section);
        return section;
      }

      const titleEl = section.querySelector('.tool-section-title');
      if (titleEl) titleEl.textContent = title;
      const pre = section.querySelector('pre');
      if (pre) pre.textContent = output;
      return section;
    }

    function createToolSection(title, output) {
      const section = document.createElement('div');
      section.className = 'tool-section';
      const titleEl = document.createElement('div');
      titleEl.className = 'tool-section-title';
      titleEl.textContent = title;
      const pre = document.createElement('pre');
      pre.textContent = output;
      section.appendChild(titleEl);
      section.appendChild(pre);
      return section;
    }

    function insertToolCard(card) {
      if (currentAssistantMsg?.parentNode === messagesEl) {
        messagesEl.insertBefore(card, currentAssistantMsg);
        return;
      }
      messagesEl.appendChild(card);
    }

    function addToolResult(result) {
      const id = result.toolUseId || result.id || `tool-${++currentTurnActionSeq}`;
      const existing = currentTurnActions.find(action => action.id === id);
      upsertAction({
        id,
        type: existing?.type || 'tool',
        status: result.isError ? 'failed' : 'success',
        label: existing?.label || result.name || result.toolName || 'Tool result',
        detail: summarizeToolInput(result.output || ''),
        detailTitle: result.isError ? 'Error output' : 'Output',
      });
      scrollToBottom();
    }

    function createOrphanToolResultCard(result) {
      const card = createToolCard(result.toolUseId || '', 'Tool Result', result.isError ? 'Error' : 'Output');
      insertToolCard(card);
      return card;
    }

    function addOutgoingAttachment(file) {
      flushAssistantBuffer();
      const activeTurn = currentAssistantTurn;
      if (activeTurn?.container?.isConnected && !file.error) {
        const count = Number(activeTurn.container.dataset.deliveredFiles || '0') + 1;
        activeTurn.container.dataset.deliveredFiles = String(count);
      }

      const card = document.createElement('div');
      card.className = 'outgoing-card';

      if (file.error) {
        card.classList.add('error');
        const icon = document.createElement('div');
        icon.className = 'outgoing-icon';
        icon.textContent = 'File';
        const info = document.createElement('div');
        info.className = 'outgoing-info';
        const name = document.createElement('div');
        name.className = 'outgoing-name';
        name.textContent = file.name || 'File delivery failed';
        const meta = document.createElement('div');
        meta.textContent = file.error;
        info.appendChild(name);
        info.appendChild(meta);
        card.appendChild(icon);
        card.appendChild(info);
        messagesEl.appendChild(card);
        scrollToBottom();
        return;
      }

      const fileUrl = withLocalToken(file.url || '/');

      if (file.kind === 'image') {
        const link = document.createElement('a');
        link.href = fileUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        const img = document.createElement('img');
        img.className = 'outgoing-preview';
        img.src = fileUrl;
        img.alt = file.name || 'image';
        link.appendChild(img);
        card.appendChild(link);
      } else {
        const icon = document.createElement('div');
        icon.className = 'outgoing-icon';
        icon.textContent = 'File';
        card.appendChild(icon);
      }

      const info = document.createElement('div');
      info.className = 'outgoing-info';
      const name = document.createElement('div');
      name.className = 'outgoing-name';
      name.textContent = file.name || 'Untitled file';
      const meta = document.createElement('div');
      meta.textContent = `${file.mimeType || 'application/octet-stream'} - ${formatSize(file.size || 0)}`;
      const actions = document.createElement('div');
      actions.className = 'outgoing-actions';

      const openLink = document.createElement('a');
      openLink.className = 'outgoing-link';
      openLink.href = fileUrl;
      openLink.target = '_blank';
      openLink.rel = 'noopener noreferrer';
      openLink.textContent = file.kind === 'image' ? 'Open preview' : 'Open';

      const downloadLink = document.createElement('a');
      downloadLink.className = 'outgoing-link';
      downloadLink.href = fileUrl;
      downloadLink.download = file.name || '';
      downloadLink.textContent = 'Download';

      actions.appendChild(openLink);
      actions.appendChild(downloadLink);
      info.appendChild(name);
      info.appendChild(meta);
      info.appendChild(actions);
      card.appendChild(info);
      messagesEl.appendChild(card);
      scrollToBottom();
    }

    function cssEscape(value) {
      if (window.CSS?.escape) return CSS.escape(value);
      return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
    }

    function addDangerConfirm(text) {
      const container = document.createElement('div');
      container.className = 'danger-confirm';

      const textEl = document.createElement('div');
      textEl.className = 'danger-text';
      textEl.textContent = text;
      container.appendChild(textEl);

      const buttons = document.createElement('div');
      buttons.className = 'danger-buttons';

      const denyBtn = document.createElement('button');
      denyBtn.className = 'btn-deny';
      denyBtn.textContent = 'Deny';
      denyBtn.addEventListener('click', () => {
        container.remove();
        scrollToBottom();
        safeSend({ type: 'danger_confirm', to: currentAgentType, sessionKey: currentSessionKey, approved: false });
      });

      const approveBtn = document.createElement('button');
      approveBtn.className = 'btn-approve';
      approveBtn.textContent = 'Allow';
      approveBtn.addEventListener('click', () => {
        container.remove();
        scrollToBottom();
        safeSend({ type: 'danger_confirm', to: currentAgentType, sessionKey: currentSessionKey, approved: true });
      });

      buttons.appendChild(denyBtn);
      buttons.appendChild(approveBtn);
      container.appendChild(buttons);
      messagesEl.appendChild(container);
      scrollToBottom();
    }

    function addPermissionConfirm(data) {
      const requestId = data.requestId || '';
      const selector = requestId ? `.permission-confirm[data-request-id="${cssEscape(requestId)}"]` : '';
      const existing = selector ? messagesEl.querySelector(selector) : null;
      if (existing) {
        scrollToBottom();
        return;
      }

      const container = document.createElement('div');
      container.className = 'danger-confirm permission-confirm';
      container.dataset.requestId = requestId;

      const title = document.createElement('div');
      title.className = 'danger-text';
      title.textContent = `${agentLabel(currentAgentType)} requests tool access: ${data.toolName || 'tool'}`;
      container.appendChild(title);

      if (data.input) {
        const inputEl = document.createElement('pre');
        inputEl.className = 'tool-input';
        inputEl.textContent = data.input;
        container.appendChild(inputEl);
      }

      const buttons = document.createElement('div');
      buttons.className = 'danger-buttons';

      const denyBtn = document.createElement('button');
      denyBtn.className = 'btn-deny';
      denyBtn.textContent = 'Deny';
      denyBtn.addEventListener('click', () => {
        container.remove();
        scrollToBottom();
        safeSend({ type: 'permission_response', to: currentAgentType, sessionKey: currentSessionKey, requestId: data.requestId, approved: false });
      });

      const approveBtn = document.createElement('button');
      approveBtn.className = 'btn-approve';
      approveBtn.textContent = 'Allow';
      approveBtn.addEventListener('click', () => {
        container.remove();
        scrollToBottom();
        safeSend({ type: 'permission_response', to: currentAgentType, sessionKey: currentSessionKey, requestId: data.requestId, approved: true });
      });

      buttons.appendChild(denyBtn);
      buttons.appendChild(approveBtn);
      container.appendChild(buttons);
      messagesEl.appendChild(container);
      scrollToBottom();
    }

    function setConnected(value) {
      connected = value;
      statusDot.className = connected ? '' : 'disconnected';
      if (statusLabel) statusLabel.textContent = connected ? 'Online' : 'Offline';
      updateSendState();
    }

    function updateSendState() {
      const inlineSlash = canSendInlineSlashCommand();
      sendBtn.disabled = !connected;
      sendBtn.classList.toggle('is-stop', connected && isRunning && !inlineSlash);
      sendBtn.textContent = isRunning && !inlineSlash ? 'Stop' : 'Send';
    }

    function setRunning(value) {
      isRunning = !!value;
      updateSendState();
    }

    function updateSessionInfo(data) {
      currentSessionId = data.sessionId || currentSessionId;
      currentSessionIdSource = data.sessionIdSource || currentSessionIdSource;
      currentSessionKey = data.sessionKey || data.sessionId || currentSessionKey;
      if (data.agentType) setAgentSelection(data.agentType, { persist: true });

      if (!data.upload) return;
      uploadLimits.maxCount = data.upload.maxCount || uploadLimits.maxCount;
      uploadLimits.maxFileBytes = data.upload.maxFileBytes || uploadLimits.maxFileBytes;
      uploadLimits.maxTotalBytes = data.upload.maxTotalBytes || uploadLimits.maxTotalBytes;
      uploadLimits.blockedExtensions = Array.isArray(data.upload.blockedExtensions)
        ? data.upload.blockedExtensions.map(ext => ext.toLowerCase())
        : uploadLimits.blockedExtensions;
    }

    function fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result;
          const [, base64] = dataUrl.split(',');
          resolve({
            name: file.name,
            mimeType: file.type || mimeFromName(file.name),
            size: file.size,
            base64,
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    async function addFiles(files) {
      const incoming = Array.from(files || []);
      if (pendingAttachments.length + incoming.length > uploadLimits.maxCount) {
        addMessage('error', `You can attach up to ${uploadLimits.maxCount} files at a time.`);
        return;
      }

      for (const file of incoming) {
        const error = validateFile(file);
        if (error) {
          addMessage('error', error);
          continue;
        }

        try {
          const attachment = await fileToBase64(file);
          pendingAttachments.push(attachment);
          addMessage('system', `Attachment ready: ${file.name}`);
        } catch (err) {
          addMessage('error', `Failed to read attachment: ${err.message}`);
        }
      }

      renderAttachments();
    }

    function validateFile(file) {
      const ext = extensionOf(file.name);
      if (ext && uploadLimits.blockedExtensions.includes(ext)) {
        return `For security reasons, ${ext} files are blocked by default: ${file.name}`;
      }
      if (file.size > uploadLimits.maxFileBytes) {
        return `File exceeds ${formatSize(uploadLimits.maxFileBytes)}: ${file.name}`;
      }
      const totalSize = pendingAttachments.reduce((sum, item) => sum + (item.size || 0), 0) + file.size;
      if (totalSize > uploadLimits.maxTotalBytes) {
        return `Total attachment size exceeds ${formatSize(uploadLimits.maxTotalBytes)}`;
      }
      return null;
    }

    function renderAttachments() {
      attachmentBar.textContent = '';
      attachmentBar.classList.toggle('active', pendingAttachments.length > 0);

      for (const [index, file] of pendingAttachments.entries()) {
        const chip = document.createElement('div');
        chip.className = 'attachment-chip';

        if (file.mimeType?.startsWith('image/')) {
          const img = document.createElement('img');
          img.src = `data:${file.mimeType};base64,${file.base64}`;
          img.alt = file.name;
          chip.appendChild(img);
        }

        const name = document.createElement('span');
        name.className = 'attachment-name';
        name.textContent = `${file.name} (${formatSize(file.size)})`;
        chip.appendChild(name);

        const remove = document.createElement('button');
        remove.className = 'remove-btn';
        remove.textContent = 'x';
        remove.addEventListener('click', () => {
          pendingAttachments.splice(index, 1);
          renderAttachments();
        });
        chip.appendChild(remove);

        attachmentBar.appendChild(chip);
      }
      updateComposerHeight();
      updateScrollBottomButton();
    }

    async function sendMessage() {
      const text = inputEl.value.trim();
      if (isRunning && canSendInlineSlashCommand(text)) {
        sendInlineSlashCommand(text);
        return;
      }
      if (isRunning) {
        stopCurrentTask();
        return;
      }
      if (!text && pendingAttachments.length === 0) return;
      if (!connected) {
        addMessage('error', 'Local simulator is not connected. Start it with linco-connect start --local-im, then open the local test page.');
        return;
      }

      const files = pendingAttachments.map(a => ({
        name: a.name,
        type: a.mimeType,
        base64: a.base64,
      }));

      const lincoMsg = {
        type: 'inbound_message',
        to: currentAgentType,
        accountId: 'local-mock',
        agentId: 'main',
        chatType: 'direct',
        userId: 'local-test-user',
        messageId: `local-msg-${Date.now()}`,
        sessionKey: currentSessionKey || currentSessionId,
        text,
        files: files.length > 0 ? files : undefined,
      };

      addMessage('user', text || '(attachment)', { attachments: pendingAttachments });
      setRunning(true);
      safeSend(lincoMsg);

      pendingAttachments = [];
      renderAttachments();
      inputEl.value = '';
      inputEl.style.height = 'auto';
    }

    function canSendInlineSlashCommand(text = inputEl.value.trim()) {
      return isRunning && String(text || '').trim().startsWith('/') && pendingAttachments.length === 0;
    }

    function sendInlineSlashCommand(text) {
      const normalizedText = String(text || '').trim();
      if (!normalizedText || !connected) return;
      const messageId = `local-msg-${Date.now()}`;
      const streamId = `linco-stream-${messageId}`;
      inlineSlashStreamIds.add(streamId);
      safeSend({
        type: 'inbound_message',
        to: currentAgentType,
        accountId: 'local-mock',
        agentId: 'main',
        chatType: 'direct',
        userId: 'local-test-user',
        messageId,
        streamId,
        sessionKey: currentSessionKey || currentSessionId,
        text: normalizedText,
      });
      addMessage('user', normalizedText);
      inputEl.value = '';
      inputEl.style.height = 'auto';
      updateSendState();
    }

    function sendTextMessage(text) {
      const normalizedText = String(text || '').trim();
      if (!normalizedText) return;
      if (!connected) {
        addMessage('error', 'Local simulator is not connected.');
        return;
      }

      const lincoMsg = {
        type: 'inbound_message',
        to: currentAgentType,
        accountId: 'local-mock',
        agentId: 'main',
        chatType: 'direct',
        userId: 'local-test-user',
        messageId: `local-msg-${Date.now()}`,
        sessionKey: currentSessionKey || currentSessionId,
        text: normalizedText,
      };

      addMessage('user', normalizedText);
      setRunning(true);
      safeSend(lincoMsg);
    }

    function stopCurrentTask() {
      if (!connected) return;
      safeSend({
        type: 'stop_turn',
        to: currentAgentType,
        sessionKey: currentSessionKey || currentSessionId,
      });
      sendBtn.disabled = true;
      sendBtn.textContent = 'Stopping...';
    }

    function safeSend(payload) {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        addMessage('error', 'Local simulator is not connected. Start it with linco-connect start --local-im, then open the local test page.');
        return;
      }
      ws.send(JSON.stringify(payload));
    }

    function appendAssistantChunk(text) {
      ensureAssistantTurn();
      assistantBuffer += text || '';
      if (assistantFrame) return;
      assistantFrame = requestAnimationFrame(() => {
        currentAssistantMarkdown += assistantBuffer;
        assistantBuffer = '';
        renderAssistantMarkdown(currentAssistantMsg, currentAssistantMarkdown);
        assistantFrame = null;
        scrollToBottom();
        updateScrollBottomButton();
      });
    }

    function flushAssistantBuffer() {
      if (assistantFrame) {
        cancelAnimationFrame(assistantFrame);
        assistantFrame = null;
      }
      if (currentAssistantMsg && assistantBuffer) {
        currentAssistantMarkdown += assistantBuffer;
        assistantBuffer = '';
        renderAssistantMarkdown(currentAssistantMsg, currentAssistantMarkdown);
        scrollToBottom();
        updateScrollBottomButton();
      }
    }

    function loadAgentTypeFromUrlOrStorage() {
      const params = new URLSearchParams(location.search);
      return normalizeAgentType(params.get('agentType') || localStorage.getItem('linco.agentType') || 'claude');
    }

    function normalizeAgentType(value) {
      const type = String(value || 'claude').trim().toLowerCase();
      return ['claude', 'codex', 'hermes', 'openclaw'].includes(type) ? type : 'claude';
    }

    function agentLabel(type) {
      return type === 'codex' ? 'Codex' : type === 'hermes' ? 'Hermes' : type === 'openclaw' ? 'OpenClaw' : 'Claude Code';
    }

    function setAgentSelection(agentType, options = {}) {
      currentAgentType = normalizeAgentType(agentType);
      if (agentSelect.value !== currentAgentType) agentSelect.value = currentAgentType;
      if (options.persist !== false) localStorage.setItem('linco.agentType', currentAgentType);
    }

    function initializeAgentSelector(config = {}) {
      if (Array.isArray(config.agents) && config.agents.length > 0) {
        agentSelect.innerHTML = '';
        for (const agent of config.agents) {
          const option = document.createElement('option');
          option.value = normalizeAgentType(agent.type);
          option.textContent = agent.label || agentLabel(option.value);
          agentSelect.appendChild(option);
        }
      }

      const params = new URLSearchParams(location.search);
      const selected = params.get('agentType') || localStorage.getItem('linco.agentType') || config.defaultLocalAgent || currentAgentType;
      setAgentSelection(selected);
    }

    function handleAgentChange() {
      const nextAgent = normalizeAgentType(agentSelect.value);
      if (nextAgent === currentAgentType && ws?.readyState === WebSocket.OPEN) return;
      setAgentSelection(nextAgent);
      currentSessionId = '';
      currentSessionIdSource = '';
      addMessage('system', `Switched to ${agentLabel(nextAgent)}. Reconnecting the local test session...`);
      reconnectWebSocketNow();
    }

    function reconnectWebSocketNow() {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
      const currentWs = ws;
      ws = null;
      if (currentWs && currentWs.readyState !== WebSocket.CLOSED) {
        currentWs.onclose = null;
        currentWs.close();
      }
      setConnected(false);
      connectWebSocket();
    }

    function loadLocalToken() {
      const params = new URLSearchParams(location.search);
      const tokenFromUrl = params.get('localToken') || params.get('token') || '';
      const token = tokenFromUrl || localStorage.getItem('linco.localToken') || '';
      if (token) localStorage.setItem('linco.localToken', token);
      if (tokenFromUrl) hideLocalTokenFromAddressBar(params);
      return token;
    }

    function rememberLocalToken(token) {
      if (!token) return;
      localToken = token;
      localStorage.setItem('linco.localToken', token);
    }

    function rememberLocalTokenFromUrl(urlString) {
      try {
        const url = new URL(urlString, location.href);
        if (url.host !== location.host) return;
        rememberLocalToken(url.searchParams.get('localToken') || url.searchParams.get('token') || '');
      } catch {}
    }

    function hideLocalTokenFromAddressBar(params) {
      params.delete('localToken');
      params.delete('token');
      const nextUrl = `${location.pathname}${params.toString() ? `?${params}` : ''}${location.hash}`;
      history.replaceState(null, '', nextUrl);
    }

    function ensureLocalTokenForUi() {
      if (localToken) return true;
      addMessage('error', 'Missing local access token. Open the full local test page URL printed by linco-connect start.');
      return false;
    }

    function withLocalToken(urlString) {
      const url = new URL(urlString, location.href);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return url.toString();
      if (url.host !== location.host) return url.toString();
      if (localToken) url.searchParams.set('localToken', localToken);
      return url.toString();
    }

    function objectUrlFromBase64(base64, mimeType) {
      const cleanBase64 = String(base64 || '').replace(/\s/g, '');
      const binary = atob(cleanBase64);
      const chunks = [];
      const chunkSize = 8192;

      for (let offset = 0; offset < binary.length; offset += chunkSize) {
        const slice = binary.slice(offset, offset + chunkSize);
        const bytes = new Uint8Array(slice.length);
        for (let i = 0; i < slice.length; i += 1) {
          bytes[i] = slice.charCodeAt(i);
        }
        chunks.push(bytes);
      }

      const blob = new Blob(chunks, { type: mimeType || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      outgoingObjectUrls.add(url);
      return url;
    }

    async function loadClientConfig() {
      try {
        const headers = {};
        if (localToken) headers.Authorization = `Bearer ${localToken}`;
        const res = await fetch('/api/client-config', {
          cache: 'no-store',
          headers,
        });
        if (res.status === 401) {
          ensureLocalTokenForUi();
          return {};
        }
        if (!res.ok) return {};
        const config = await res.json();
        rememberLocalTokenFromUrl(config.wsUrl);
        return config;
      } catch {
        return {};
      }
    }

    function defaultWebSocketUrl() {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${location.host}`;
    }

    function pageSessionId() {
      const params = new URLSearchParams(location.search);
      return params.get('session_id') || params.get('sessionId') || currentSessionId || '';
    }

    function websocketUrlWithSessionId(wsUrl) {
      const url = new URL(wsUrl, location.href);
      const sessionId = pageSessionId();
      if (sessionId) url.searchParams.set('session_id', sessionId);
      url.searchParams.set('agentType', currentAgentType);
      url.searchParams.set('linco', '1');
      if (localToken && url.host === location.host) url.searchParams.set('localToken', localToken);
      return url.toString();
    }

    async function initLocalTestPage() {
      const config = await loadClientConfig();
      initializeAgentSelector(config);
      if (!config.localImEnabled) {
        setConnected(false);
        addMessage('system', 'Local simulator is disabled by default. To debug the local frontend IM, start with linco-connect start --local-im.');
        return;
      }
      connectWebSocket(config);
    }

    async function connectWebSocket(config) {
      const clientConfig = config || await loadClientConfig();
      initializeAgentSelector(clientConfig);
      if (!clientConfig.localImEnabled) {
        setConnected(false);
        return;
      }
      ws = new WebSocket(websocketUrlWithSessionId(clientConfig.wsUrl || defaultWebSocketUrl()));
      ws.onmessage = handleSocketMessage;
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        setRunning(false);
        addMessage('system', 'Connection closed. Reconnecting...');
        reconnectTimer = setTimeout(connectWebSocket, 3000);
      };
      ws.onerror = () => {
        setConnected(false);
        setRunning(false);
      };
    }

    function handleSocketMessage(event) {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        addMessage('error', 'Received an invalid server message.');
        return;
      }

      switch (data.type) {
        case 'session_info':
          updateSessionInfo(data);
          break;
        case 'turn_start':
          setRunning(true);
          break;
        case 'turn_end':
          if (!consumeInlineSlashTurnEnd(data)) {
            clearThinking();
            completeAssistantTurn();
            setRunning(false);
          }
          break;
        case 'outbound_message':
          if (data.mediaName) {
            let fileUrl = data.mediaUrl || '#';
            if (data.mediaBase64) {
              try {
                fileUrl = objectUrlFromBase64(data.mediaBase64, data.mediaType);
              } catch {
                addOutgoingAttachment({
                  name: data.mediaName,
                  error: 'File data could not be parsed for preview or download.',
                });
                break;
              }
            }
            addOutgoingAttachment({
              name: data.mediaName,
              mimeType: data.mediaType,
              url: fileUrl,
              size: data.size || 0,
              kind: data.mediaType?.startsWith('image/') ? 'image' : 'file',
            });
          } else {
            const msgType = data.messageId?.includes('error') ? 'error' : 'system';
            addMessage(msgType, data.text || '', {
              actions: data.actions,
              quickActions: data.quickActions,
              quickReplies: data.quickReplies,
            });
          }
          break;
        case 'slash_command_result':
          addSlashCommandResult(data);
          break;
        case 'stream_chunk':
          handleStreamChunk(data);
          break;
        case 'thinking':
          handleThinking(data);
          break;
        case 'thinking_clear':
          clearThinking({ remove: true });
          break;
        case 'tool_call':
          addToolCard(data);
          break;
        case 'tool_result':
          addToolResult(data);
          break;
        case 'permission_request':
          addPermissionConfirm(data);
          break;
        case 'danger_warning':
          setRunning(false);
          addDangerConfirm(data.text || 'Operation confirmation required');
          break;
        case 'presence_event':
          addPresenceMessage(data);
          break;
        case 'pong':
          break;
        default:
          console.log('[WS] Unhandled message type:', data.type, data);
      }
    }

    function consumeInlineSlashTurnEnd(data) {
      const streamId = data.streamId || data.stream_id || '';
      if (!streamId || !inlineSlashStreamIds.has(streamId)) return false;
      inlineSlashStreamIds.delete(streamId);
      updateSendState();
      return isRunning;
    }

    function handleStreamChunk(data) {
      if (data.done) {
        completeAssistantTurn();
        setRunning(false);
      } else {
        clearThinking();
        appendAssistantChunk(data.delta || '');
      }
    }

    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      addFiles(e.target.files);
      fileInput.value = '';
    });

    document.addEventListener('paste', (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const images = [];
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) images.push(file);
        }
      }
      if (images.length > 0) {
        e.preventDefault();
        addFiles(images);
      }
    });

    sendBtn.addEventListener('click', sendMessage);
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (isRunning && !canSendInlineSlashCommand()) return;
        sendMessage();
      }
    });

    inputEl.addEventListener('input', () => {
      inputEl.style.height = 'auto';
      inputEl.style.height = Math.min(inputEl.scrollHeight, window.innerWidth <= 640 ? 132 : 160) + 'px';
      updateComposerHeight();
      updateScrollBottomButton();
      updateSendState();
    });

    agentSelect.addEventListener('change', handleAgentChange);
    setAgentSelection(currentAgentType, { persist: false });
    localToken = loadLocalToken();
    initLocalTestPage();

    function extensionOf(name) {
      const idx = name.lastIndexOf('.');
      return idx >= 0 ? name.slice(idx).toLowerCase() : '';
    }

    function mimeFromName(name) {
      switch (extensionOf(name)) {
        case '.png': return 'image/png';
        case '.jpg':
        case '.jpeg': return 'image/jpeg';
        case '.gif': return 'image/gif';
        case '.webp': return 'image/webp';
        case '.txt': return 'text/plain';
        case '.md': return 'text/markdown';
        case '.csv': return 'text/csv';
        case '.sql': return 'application/sql';
        case '.pdf': return 'application/pdf';
        case '.doc': return 'application/msword';
        case '.docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        case '.xls': return 'application/vnd.ms-excel';
        case '.xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        case '.json': return 'application/json';
        case '.xml': return 'application/xml';
        case '.zip': return 'application/zip';
        default: return 'application/octet-stream';
      }
    }

    function formatSize(size) {
      if (!Number.isFinite(size) || size <= 0) return '0 KB';
      if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
      return `${(size / 1024).toFixed(1)} KB`;
    }
