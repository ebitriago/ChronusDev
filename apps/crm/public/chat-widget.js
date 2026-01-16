/**
 * ChronusCRM Live Chat Widget
 * Embeddable script for customer support via AssistAI
 * 
 * Usage:
 * <script src="http://YOUR_CRM_URL:3002/chat-widget.js" data-org-id="ORG123"></script>
 */
(function () {
    const API_URL = document.currentScript?.src.replace('/chat-widget.js', '') || 'http://127.0.0.1:3002';
    const ORG_ID = document.currentScript?.getAttribute('data-org-id') || 'default';

    // Generate or retrieve session ID
    let sessionId = localStorage.getItem('chronus_chat_session');
    if (!sessionId) {
        sessionId = `assistai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('chronus_chat_session', sessionId);
    }

    // Inject styles
    const styles = document.createElement('style');
    styles.textContent = `
        #chronus-chat-widget {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 99999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        #chronus-chat-button {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: linear-gradient(135deg, #10b981, #059669);
            border: none;
            cursor: pointer;
            box-shadow: 0 4px 20px rgba(16, 185, 129, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        #chronus-chat-button:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 25px rgba(16, 185, 129, 0.5);
        }
        #chronus-chat-button svg {
            width: 28px;
            height: 28px;
            fill: white;
        }
        #chronus-chat-box {
            position: absolute;
            bottom: 70px;
            right: 0;
            width: 360px;
            height: 500px;
            background: white;
            border-radius: 16px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.15);
            display: none;
            flex-direction: column;
            overflow: hidden;
        }
        #chronus-chat-box.open {
            display: flex;
            animation: slideUp 0.3s ease;
        }
        @keyframes slideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        #chronus-chat-header {
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            padding: 16px;
            font-weight: 600;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        #chronus-chat-header button {
            background: none;
            border: none;
            color: white;
            font-size: 20px;
            cursor: pointer;
            opacity: 0.8;
        }
        #chronus-chat-header button:hover { opacity: 1; }
        #chronus-chat-messages {
            flex: 1;
            padding: 16px;
            overflow-y: auto;
            background: #f8fafc;
        }
        .chronus-msg {
            margin-bottom: 12px;
            max-width: 80%;
            padding: 10px 14px;
            border-radius: 12px;
            font-size: 14px;
            line-height: 1.4;
        }
        .chronus-msg.user {
            background: #10b981;
            color: white;
            margin-left: auto;
            border-bottom-right-radius: 4px;
        }
        .chronus-msg.agent {
            background: white;
            color: #334155;
            border: 1px solid #e2e8f0;
            border-bottom-left-radius: 4px;
        }
        #chronus-chat-input-area {
            padding: 12px;
            background: white;
            border-top: 1px solid #e2e8f0;
            display: flex;
            gap: 8px;
        }
        #chronus-chat-input {
            flex: 1;
            padding: 10px 14px;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            font-size: 14px;
            outline: none;
        }
        #chronus-chat-input:focus {
            border-color: #10b981;
        }
        #chronus-chat-send {
            background: #10b981;
            color: white;
            border: none;
            padding: 10px 16px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
        }
        #chronus-chat-send:hover {
            background: #059669;
        }
    `;
    document.head.appendChild(styles);

    // Create widget HTML
    const widget = document.createElement('div');
    widget.id = 'chronus-chat-widget';
    widget.innerHTML = `
        <div id="chronus-chat-box">
            <div id="chronus-chat-header">
                <span>💬 Soporte en Vivo</span>
                <button id="chronus-close-chat">×</button>
            </div>
            <div id="chronus-chat-messages"></div>
            <div id="chronus-chat-input-area">
                <input type="text" id="chronus-chat-input" placeholder="Escribe un mensaje..." />
                <button id="chronus-chat-send">Enviar</button>
            </div>
        </div>
        <button id="chronus-chat-button">
            <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
        </button>
    `;
    document.body.appendChild(widget);

    const chatBox = document.getElementById('chronus-chat-box');
    const chatBtn = document.getElementById('chronus-chat-button');
    const closeBtn = document.getElementById('chronus-close-chat');
    const messagesDiv = document.getElementById('chronus-chat-messages');
    const inputEl = document.getElementById('chronus-chat-input');
    const sendBtn = document.getElementById('chronus-chat-send');

    // Toggle chat
    chatBtn.addEventListener('click', () => chatBox.classList.add('open'));
    closeBtn.addEventListener('click', () => chatBox.classList.remove('open'));

    // Render message
    function addMessage(msg) {
        const div = document.createElement('div');
        div.className = `chronus-msg ${msg.sender}`;
        div.textContent = msg.content;
        messagesDiv.appendChild(div);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    // Load history
    async function loadHistory() {
        try {
            const res = await fetch(`${API_URL}/conversations/${sessionId}`);
            if (res.ok) {
                const data = await res.json();
                data.messages.forEach(addMessage);
            }
        } catch (e) {
            console.log('No previous history');
        }
    }
    loadHistory();

    // Send message
    async function sendMessage() {
        const content = inputEl.value.trim();
        if (!content) return;

        // Optimistic UI
        addMessage({ content, sender: 'user' });
        inputEl.value = '';

        try {
            await fetch(`${API_URL}/webhooks/messages/incoming`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from: sessionId,
                    content,
                    platform: 'assistai',
                    sessionId,
                    customerName: 'Visitor'
                })
            });
        } catch (e) {
            console.error('Failed to send message', e);
        }
    }

    sendBtn.addEventListener('click', sendMessage);
    inputEl.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // Real-time via Socket.io (if available)
    function connectSocket() {
        if (typeof io === 'undefined') {
            // Load Socket.io client
            const script = document.createElement('script');
            script.src = `${API_URL}/socket.io/socket.io.js`;
            script.onload = initSocket;
            document.head.appendChild(script);
        } else {
            initSocket();
        }
    }

    function initSocket() {
        const socket = io(API_URL);
        socket.on('connect', () => {
            console.log('[ChronusWidget] Connected to server');
            socket.emit('join_conversation', sessionId);
        });
        socket.on('new_message', (msg) => {
            if (msg.sender === 'agent') {
                addMessage(msg);
            }
        });
    }

    connectSocket();
})();
