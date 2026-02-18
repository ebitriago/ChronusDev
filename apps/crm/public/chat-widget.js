/**
 * ChronusCRM Live Chat Widget
 * Embeddable script for customer support via AssistAI
 * 
 * Features:
 * - Text messages
 * - File/Image attachments
 * - Voice recording
 * - Real-time via Socket.io
 * 
 * Usage:
 * <script src="http://YOUR_CRM_URL:3002/chat-widget.js" data-org-id="ORG123"></script>
 */
(function () {
    const API_URL = document.currentScript?.src.replace('/chat-widget.js', '') || 'http://127.0.0.1:3002';
    const ORG_ID = document.currentScript?.getAttribute('data-org-id') || 'default';

    // Generate or retrieve session ID per org
    let sessionId = localStorage.getItem(`chronus_chat_${ORG_ID}`);
    if (!sessionId) {
        sessionId = `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem(`chronus_chat_${ORG_ID}`, sessionId);
    }

    // State
    let isRecording = false;
    let mediaRecorder = null;
    let audioChunks = [];
    let recordingTimer = null;
    let recordingStartTime = 0;

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
            width: 380px;
            height: 550px;
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
            max-width: 85%;
            padding: 10px 14px;
            border-radius: 12px;
            font-size: 14px;
            line-height: 1.4;
            word-wrap: break-word;
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
        .chronus-msg img {
            max-width: 100%;
            border-radius: 8px;
            margin-top: 6px;
            cursor: pointer;
        }
        .chronus-msg audio {
            margin-top: 6px;
            max-width: 100%;
        }
        .chronus-msg video {
            max-width: 100%;
            border-radius: 8px;
            margin-top: 6px;
        }
        .chronus-msg .file-link {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-top: 6px;
            padding: 8px 12px;
            background: rgba(255,255,255,0.2);
            border-radius: 6px;
            font-size: 12px;
            text-decoration: none;
            color: inherit;
        }
        .chronus-msg.user .file-link {
            background: rgba(255,255,255,0.2);
        }
        .chronus-msg.agent .file-link {
            background: #f1f5f9;
            color: #0284c7;
        }
        #chronus-chat-input-area {
            padding: 12px;
            background: white;
            border-top: 1px solid #e2e8f0;
        }
        #chronus-chat-input-row {
            display: flex;
            gap: 8px;
            align-items: center;
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
        .chronus-icon-btn {
            width: 36px;
            height: 36px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
            font-size: 18px;
        }
        #chronus-attach-btn {
            background: #f1f5f9;
            color: #64748b;
        }
        #chronus-attach-btn:hover {
            background: #e2e8f0;
        }
        #chronus-mic-btn {
            background: #f1f5f9;
            color: #64748b;
        }
        #chronus-mic-btn:hover {
            background: #e2e8f0;
        }
        #chronus-mic-btn.recording {
            background: #ef4444;
            color: white;
            animation: pulse 1s infinite;
        }
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
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
        #chronus-file-input {
            display: none;
        }
        #chronus-preview-bar {
            display: none;
            padding: 8px;
            background: #f8fafc;
            border-top: 1px solid #e2e8f0;
            align-items: center;
            gap: 8px;
        }
        #chronus-preview-bar.active {
            display: flex;
        }
        #chronus-preview-bar img {
            width: 50px;
            height: 50px;
            object-fit: cover;
            border-radius: 6px;
        }
        #chronus-preview-bar .file-name {
            flex: 1;
            font-size: 12px;
            color: #64748b;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        #chronus-preview-bar button {
            background: #ef4444;
            color: white;
            border: none;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 14px;
        }
        .chronus-recording-indicator {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: #fef2f2;
            border-radius: 8px;
            margin-bottom: 8px;
        }
        .chronus-recording-indicator .dot {
            width: 10px;
            height: 10px;
            background: #ef4444;
            border-radius: 50%;
            animation: blink 1s infinite;
        }
        @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
        }
        .chronus-recording-indicator span {
            font-size: 12px;
            color: #dc2626;
        }
        .chronus-recording-indicator button {
            margin-left: auto;
            background: #10b981;
            color: white;
            border: none;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 11px;
            cursor: pointer;
        }
        /* Image preview modal */
        #chronus-image-modal {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.9);
            z-index: 999999;
            display: none;
            align-items: center;
            justify-content: center;
        }
        #chronus-image-modal.open {
            display: flex;
        }
        #chronus-image-modal img {
            max-width: 90%;
            max-height: 90%;
            border-radius: 8px;
        }
        #chronus-image-modal button {
            position: absolute;
            top: 20px;
            right: 20px;
            background: white;
            border: none;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            font-size: 24px;
            cursor: pointer;
        }

        /* Waveform Animation */
        .chronus-wave {
            display: flex;
            align-items: center;
            gap: 3px;
            height: 20px;
        }
        .chronus-wave-bar {
            width: 3px;
            background: #ef4444;
            animation: wave 1s ease-in-out infinite;
            border-radius: 2px;
        }
        .chronus-wave-bar:nth-child(1) { height: 60%; animation-delay: 0.1s; }
        .chronus-wave-bar:nth-child(2) { height: 80%; animation-delay: 0.2s; }
        .chronus-wave-bar:nth-child(3) { height: 100%; animation-delay: 0.3s; }
        .chronus-wave-bar:nth-child(4) { height: 70%; animation-delay: 0.4s; }
        .chronus-wave-bar:nth-child(5) { height: 50%; animation-delay: 0.5s; }
        
        @keyframes wave {
            0%, 100% { transform: scaleY(0.5); }
            50% { transform: scaleY(1); }
        }
        
        .chronus-timer {
            font-family: monospace;
            font-size: 14px;
            color: #dc2626;
            font-weight: 600;
            min-width: 45px;
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
            <div id="chronus-preview-bar">
                <img id="chronus-preview-img" src="" alt="Preview" />
                <span class="file-name" id="chronus-preview-name">archivo.jpg</span>
                <button id="chronus-preview-cancel">×</button>
            </div>
            <div id="chronus-chat-input-area">
                <div id="chronus-recording-indicator" class="chronus-recording-indicator" style="display:none; gap:12px;">
                    <div class="chronus-wave">
                        <div class="chronus-wave-bar"></div>
                        <div class="chronus-wave-bar"></div>
                        <div class="chronus-wave-bar"></div>
                        <div class="chronus-wave-bar"></div>
                        <div class="chronus-wave-bar"></div>
                    </div>
                    <span id="chronus-timer" class="chronus-timer">00:00</span>
                    <button id="chronus-stop-recording">✓</button>
                    <button id="chronus-cancel-recording" style="background:#ef4444;margin-left:5px;">✕</button>
                </div>
                <div id="chronus-chat-input-row">
                    <input type="file" id="chronus-file-input" accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx" />
                    <button class="chronus-icon-btn" id="chronus-attach-btn" title="Adjuntar archivo">📎</button>
                    <button class="chronus-icon-btn" id="chronus-mic-btn" title="Grabar audio">🎤</button>
                    <input type="text" id="chronus-chat-input" placeholder="Escribe un mensaje..." />
                    <button id="chronus-chat-send">Enviar</button>
                </div>
            </div>
        </div>
        <button id="chronus-chat-button">
            <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
        </button>
        <div id="chronus-image-modal">
            <button id="chronus-modal-close">×</button>
            <img id="chronus-modal-img" src="" alt="Full image" />
        </div>
    `;
    document.body.appendChild(widget);

    // Elements
    const chatBox = document.getElementById('chronus-chat-box');
    const chatBtn = document.getElementById('chronus-chat-button');
    const closeBtn = document.getElementById('chronus-close-chat');
    const messagesDiv = document.getElementById('chronus-chat-messages');
    const inputEl = document.getElementById('chronus-chat-input');
    const sendBtn = document.getElementById('chronus-chat-send');
    const attachBtn = document.getElementById('chronus-attach-btn');
    const fileInput = document.getElementById('chronus-file-input');
    const micBtn = document.getElementById('chronus-mic-btn');
    const previewBar = document.getElementById('chronus-preview-bar');
    const previewImg = document.getElementById('chronus-preview-img');
    const previewName = document.getElementById('chronus-preview-name');
    const previewCancel = document.getElementById('chronus-preview-cancel');
    const recordingIndicator = document.getElementById('chronus-recording-indicator');
    const stopRecordingBtn = document.getElementById('chronus-stop-recording');
    const imageModal = document.getElementById('chronus-image-modal');
    const modalImg = document.getElementById('chronus-modal-img');
    const modalClose = document.getElementById('chronus-modal-close');

    let pendingFile = null;

    // Toggle chat
    chatBtn.addEventListener('click', () => chatBox.classList.add('open'));
    closeBtn.addEventListener('click', () => chatBox.classList.remove('open'));

    // Image modal
    function openImageModal(src) {
        modalImg.src = src;
        imageModal.classList.add('open');
    }
    modalClose.addEventListener('click', () => imageModal.classList.remove('open'));
    imageModal.addEventListener('click', (e) => {
        if (e.target === imageModal) imageModal.classList.remove('open');
    });

    // Render message with media support
    function addMessage(msg) {
        const div = document.createElement('div');
        div.className = `chronus-msg ${msg.sender}`;

        // Text content
        if (msg.content) {
            const textSpan = document.createElement('span');
            textSpan.textContent = msg.content;
            div.appendChild(textSpan);
        }

        // Media content
        if (msg.mediaUrl) {
            const mediaType = msg.mediaType || detectMediaType(msg.mediaUrl);

            if (mediaType === 'image') {
                const img = document.createElement('img');
                img.src = msg.mediaUrl;
                img.alt = 'Imagen';
                img.onclick = () => openImageModal(msg.mediaUrl);
                div.appendChild(img);
            } else if (mediaType === 'audio') {
                const audio = document.createElement('audio');
                audio.controls = true;
                audio.src = msg.mediaUrl;
                div.appendChild(audio);
            } else if (mediaType === 'video') {
                const video = document.createElement('video');
                video.controls = true;
                video.src = msg.mediaUrl;
                div.appendChild(video);
            } else {
                // Document/file
                const link = document.createElement('a');
                link.href = msg.mediaUrl;
                link.target = '_blank';
                link.className = 'file-link';
                link.innerHTML = `📄 ${msg.fileName || 'Archivo'}`;
                div.appendChild(link);
            }
        }

        messagesDiv.appendChild(div);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    function detectMediaType(url) {
        if (!url) return 'document';
        const ext = url.split('.').pop()?.toLowerCase();

        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
        if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return 'audio';
        if (['mp4', 'mov', 'avi'].includes(ext)) return 'video';

        // webm can be audio or video — prioritize audio for voice recordings
        if (ext === 'webm') {
            if (url.includes('voice-') || url.includes('/audio/')) return 'audio';
            return 'video';
        }

        // Fallback checks
        if (url.includes('voice-') || url.includes('/audio/')) return 'audio';

        return 'document';
    }

    // Load history
    async function loadHistory() {
        try {
            const res = await fetch(`${API_URL}/widget/history/${sessionId}`);
            if (res.ok) {
                const data = await res.json();
                data.messages.forEach(addMessage);
            }
        } catch (e) {
            console.log('No previous history');
        }
    }
    loadHistory();

    // Send text message
    async function sendMessage() {
        const content = inputEl.value.trim();
        if (!content && !pendingFile) return;

        // If there's a file, send it
        if (pendingFile) {
            await sendFile(pendingFile, content);
            clearPreview();
            inputEl.value = '';
            return;
        }

        // Text only
        addMessage({ content, sender: 'user' });
        inputEl.value = '';

        try {
            await fetch(`${API_URL}/widget/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from: sessionId,
                    content,
                    platform: 'web',
                    sessionId,
                    customerName: 'Visitante Web',
                    orgCode: ORG_ID
                })
            });
        } catch (e) {
            console.error('Failed to send message', e);
        }
    }

    // Send file with optional text
    async function sendFile(file, text = '') {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('sessionId', sessionId);
        formData.append('orgCode', ORG_ID);
        formData.append('platform', 'web');
        formData.append('customerName', 'Visitante Web');
        if (text) formData.append('content', text);

        // Optimistic UI
        let previewUrl = null;
        if (file.type.startsWith('image/')) {
            previewUrl = URL.createObjectURL(file);
        }
        addMessage({
            content: text,
            sender: 'user',
            mediaUrl: previewUrl,
            mediaType: file.type.startsWith('image/') ? 'image' :
                file.type.startsWith('audio/') ? 'audio' :
                    file.type.startsWith('video/') ? 'video' : 'document',
            fileName: file.name
        });

        // Clean up preview URL to prevent memory leak
        if (previewUrl) {
            setTimeout(() => URL.revokeObjectURL(previewUrl), 5000);
        }

        try {
            await fetch(`${API_URL}/widget/upload`, {
                method: 'POST',
                body: formData
            });
        } catch (e) {
            console.error('Failed to upload file', e);
        }
    }

    // File attachment
    attachBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        pendingFile = file;
        previewName.textContent = file.name;

        if (file.type.startsWith('image/')) {
            previewImg.src = URL.createObjectURL(file);
            previewImg.style.display = 'block';
        } else {
            previewImg.style.display = 'none';
        }

        previewBar.classList.add('active');
        fileInput.value = '';
    });

    previewCancel.addEventListener('click', clearPreview);
    function clearPreview() {
        pendingFile = null;
        previewBar.classList.remove('active');
        previewImg.src = '';
        previewName.textContent = '';
    }

    // Voice recording
    micBtn.addEventListener('click', async () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    });

    async function startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    audioChunks.push(e.data);
                }
            };

            mediaRecorder.start();
            isRecording = true;
            micBtn.classList.add('recording');
            recordingIndicator.style.display = 'flex';
            document.getElementById('chronus-chat-input-row').style.display = 'none';

            // Start Timer
            startRecordingTimer();
        } catch (e) {
            console.error('Microphone access denied', e);
            alert('Por favor, permite el acceso al micrófono.');
        }
    }

    function startRecordingTimer() {
        recordingStartTime = Date.now();
        const timerEl = document.getElementById('chronus-timer');
        if (timerEl) timerEl.textContent = "00:00";

        recordingTimer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
            const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
            const s = (elapsed % 60).toString().padStart(2, '0');
            const el = document.getElementById('chronus-timer');
            if (el) el.textContent = `${m}:${s}`;
        }, 1000);
    }

    function stopRecordingTimer() {
        if (recordingTimer) {
            clearInterval(recordingTimer);
            recordingTimer = null;
        }
    }

    async function stopRecording() {
        if (mediaRecorder && isRecording) {
            isRecording = false;
            stopRecordingTimer();
            micBtn.classList.remove('recording');
            recordingIndicator.style.display = 'none';
            document.getElementById('chronus-chat-input-row').style.display = 'flex';

            // Wait for recorder to finish and gather all data
            const audioBlob = await new Promise((resolve) => {
                mediaRecorder.onstop = () => {
                    resolve(new Blob(audioChunks, { type: 'audio/webm' }));
                };
                mediaRecorder.stop();
            });

            // Stop tracks after recorder is fully stopped
            mediaRecorder.stream.getTracks().forEach(t => t.stop());

            const audioFile = new File([audioBlob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
            await sendFile(audioFile);
        }
    }

    function cancelRecording() {
        if (mediaRecorder && isRecording) {
            mediaRecorder.onstop = () => { }; // Clear handler so nothing is sent
            mediaRecorder.stop();
            isRecording = false;
            stopRecordingTimer();
            micBtn.classList.remove('recording');
            recordingIndicator.style.display = 'none';
            document.getElementById('chronus-chat-input-row').style.display = 'flex';

            // Clear chunks so nothing is sent
            audioChunks = [];
            mediaRecorder.stream.getTracks().forEach(t => t.stop());
        }
    }

    // Bind buttons
    const cancelRecordingBtn = document.getElementById('chronus-cancel-recording');
    if (cancelRecordingBtn) cancelRecordingBtn.addEventListener('click', cancelRecording);

    stopRecordingBtn.addEventListener('click', stopRecording);

    sendBtn.addEventListener('click', sendMessage);
    inputEl.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // Real-time via Socket.io
    function connectSocket() {
        if (typeof io === 'undefined') {
            const script = document.createElement('script');
            script.src = `${API_URL}/socket.io/socket.io.js`;
            script.onload = initSocket;
            document.head.appendChild(script);
        } else {
            initSocket();
        }
    }

    function initSocket() {
        const socket = io(API_URL, {
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 2000
        });
        socket.on('connect', () => {
            console.log('[ChronusWidget] Connected to server');
            socket.emit('join_conversation', sessionId);
        });
        socket.on('reconnect', () => {
            console.log('[ChronusWidget] Reconnected to server');
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
