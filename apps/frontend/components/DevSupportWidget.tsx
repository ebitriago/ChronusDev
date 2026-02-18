'use client';

import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import EmojiPicker from 'emoji-picker-react';

/**
 * DevSupportWidget - Chat en vivo de ChronusCRM 
 * para comunicación entre equipo de desarrollo y ATC/Customer Success
 * 
 * Características:
 * - Mensajes de texto
 * - Adjuntar archivos e imágenes
 * - Grabar notas de voz
 * - Previsualización de media
 */
export default function DevSupportWidget() {
    useEffect(() => {
        // Get logged-in user name
        let userName = 'Usuario Desarrollo';
        try {
            const userStr = localStorage.getItem('user');
            if (userStr) {
                const user = JSON.parse(userStr);
                userName = user.name || user.username || 'Usuario Desarrollo';
            }
        } catch (e) {
            console.log('No user found');
        }

        // CRM URL
        const CRM_URL = process.env.NEXT_PUBLIC_CRM_URL ||
            (process.env.NODE_ENV === 'development' ? 'http://localhost:3002' : 'https://chronuscrm.assistai.work');
        const ORG_ID = process.env.NEXT_PUBLIC_CRM_ORG_ID || 'admin-chronus-980';

        // Session ID per user AND org (ensures new session when org changes)
        const storageKey = `chronus_dev_chat_${ORG_ID}_${userName.replace(/\s+/g, '_')}`;
        let sessionId = localStorage.getItem(storageKey);
        if (!sessionId) {
            sessionId = `dev-${ORG_ID}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem(storageKey, sessionId);
        }

        // State
        let isRecording = false;
        let mediaRecorder: MediaRecorder | null = null;
        let audioChunks: Blob[] = [];
        let pendingFile: File | null = null;
        let recordingTimer: any = null;
        let recordingStartTime = 0;
        let isCancelled = false;

        // Clean up existing widget
        // ... (lines 48-50)

        // Create widget
        const widgetContainer = document.createElement('div');
        widgetContainer.id = 'dev-support-widget';
        widgetContainer.innerHTML = `
            <style>
                /* ... existing styles ... */
                #dev-support-widget {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    z-index: 99999;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }
                /* ... (keep existing styles until #dev-support-recording) */
                #dev-support-btn {
                    width: 56px;
                    height: 56px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #6366f1, #4f46e5);
                    border: none;
                    cursor: pointer;
                    box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: transform 0.2s, box-shadow 0.2s;
                    color: white;
                    font-size: 24px;
                }
                #dev-support-btn:hover {
                    transform: scale(1.1);
                    box-shadow: 0 6px 25px rgba(99, 102, 241, 0.5);
                }
                #dev-support-box {
                    position: absolute;
                    bottom: 66px;
                    right: 0;
                    width: 380px;
                    height: 520px;
                    background: white;
                    border-radius: 16px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.15);
                    display: none;
                    flex-direction: column;
                    overflow: hidden;
                }
                #dev-support-box.open {
                    display: flex;
                    animation: devSlideUp 0.3s ease;
                }
                @keyframes devSlideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                #dev-support-header {
                    background: linear-gradient(135deg, #6366f1, #4f46e5);
                    color: white;
                    padding: 14px 16px;
                    font-weight: 600;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 14px;
                }
                #dev-support-header .subtitle {
                    font-size: 11px;
                    opacity: 0.8;
                    font-weight: normal;
                }
                #dev-support-header button {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 20px;
                    cursor: pointer;
                    opacity: 0.8;
                }
                #dev-support-header button:hover { opacity: 1; }
                #dev-support-messages {
                    flex: 1;
                    padding: 16px;
                    overflow-y: auto;
                    background: #f8fafc;
                }
                .dev-msg {
                    margin-bottom: 10px;
                    max-width: 85%;
                    padding: 10px 14px;
                    border-radius: 12px;
                    font-size: 13px;
                    line-height: 1.4;
                    word-wrap: break-word;
                }
                .dev-msg.user {
                    background: #6366f1;
                    color: white;
                    margin-left: auto;
                    border-bottom-right-radius: 4px;
                }
                .dev-msg.agent {
                    background: white;
                    color: #334155;
                    border: 1px solid #e2e8f0;
                    border-bottom-left-radius: 4px;
                }
                .dev-msg img {
                    max-width: 100%;
                    border-radius: 8px;
                    margin-top: 6px;
                    cursor: pointer;
                }
                .dev-msg audio {
                    margin-top: 6px;
                    max-width: 100%;
                }
                .dev-msg .file-link {
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
                #dev-support-preview {
                    display: none;
                    padding: 8px 12px;
                    background: #f1f5f9;
                    border-top: 1px solid #e2e8f0;
                    align-items: center;
                    gap: 8px;
                }
                #dev-support-preview.active {
                    display: flex;
                }
                #dev-support-preview img {
                    width: 40px;
                    height: 40px;
                    object-fit: cover;
                    border-radius: 6px;
                }
                #dev-support-preview .name {
                    flex: 1;
                    font-size: 12px;
                    color: #64748b;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                #dev-support-preview .cancel {
                    background: #ef4444;
                    color: white;
                    border: none;
                    width: 22px;
                    height: 22px;
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 12px;
                }
                #dev-support-recording {
                    display: none;
                    padding: 10px 12px;
                    background: #fef2f2;
                    align-items: center;
                    gap: 12px;
                }
                #dev-support-recording.active {
                    display: flex;
                }
                
                /* Waveform Animation */
                .dev-wave {
                    display: flex;
                    align-items: center;
                    gap: 3px;
                    height: 20px;
                }
                .dev-wave-bar {
                    width: 3px;
                    background: #ef4444;
                    animation: devWave 1s ease-in-out infinite;
                    border-radius: 2px;
                }
                .dev-wave-bar:nth-child(1) { height: 60%; animation-delay: 0.1s; }
                .dev-wave-bar:nth-child(2) { height: 80%; animation-delay: 0.2s; }
                .dev-wave-bar:nth-child(3) { height: 100%; animation-delay: 0.3s; }
                .dev-wave-bar:nth-child(4) { height: 70%; animation-delay: 0.4s; }
                .dev-wave-bar:nth-child(5) { height: 50%; animation-delay: 0.5s; }
                
                @keyframes devWave {
                    0%, 100% { transform: scaleY(0.5); }
                    50% { transform: scaleY(1); }
                }
                
                .dev-timer {
                    flex: 1;
                    font-family: monospace;
                    font-size: 14px;
                    color: #dc2626;
                    font-weight: 600;
                }

                #dev-support-recording button {
                    background: #10b981;
                    color: white;
                    border: none;
                    padding: 4px 12px;
                    border-radius: 4px;
                    font-size: 11px;
                    cursor: pointer;
                }
                /* ... (keep input area styles) ... */
                #dev-support-input-area {
                    padding: 12px;
                    background: white;
                    border-top: 1px solid #e2e8f0;
                }
                #dev-input-row {
                    display: flex;
                    gap: 6px;
                    align-items: center;
                }
                .dev-icon-btn {
                    width: 34px;
                    height: 34px;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background 0.2s;
                    font-size: 16px;
                    background: #f1f5f9;
                    color: #64748b;
                }
                .dev-icon-btn:hover {
                    background: #e2e8f0;
                }
                .dev-icon-btn.recording {
                    background: #ef4444;
                    color: white;
                    animation: devPulse 1s infinite;
                }
                @keyframes devPulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                }
                #dev-support-input {
                    flex: 1;
                    padding: 10px 12px;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    font-size: 13px;
                    outline: none;
                }
                #dev-support-input:focus {
                    border-color: #6366f1;
                }
                #dev-support-send {
                    background: #6366f1;
                    color: white;
                    border: none;
                    padding: 10px 14px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 13px;
                }
                #dev-support-send:hover {
                    background: #4f46e5;
                }
                #dev-file-input {
                    display: none;
                }
                #dev-image-modal {
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
                #dev-image-modal.open {
                    display: flex;
                }
                #dev-image-modal img {
                    max-width: 90%;
                    max-height: 90%;
                    border-radius: 8px;
                }
                #dev-image-modal button {
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
            </style>
            <div id="dev-support-box">
                <div id="dev-support-header">
                    <div>
                        <div>🛠️ Soporte Desarrollo</div>
                        <div class="subtitle">${userName} - Equipo de Desarrollo</div>
                    </div>
                    <button id="dev-close-chat">×</button>
                </div>
                <div id="dev-support-messages"></div>
                <div id="dev-support-preview">
                    <img id="dev-preview-img" src="" alt="" />
                    <span class="name" id="dev-preview-name"></span>
                    <button class="cancel" id="dev-preview-cancel">×</button>
                </div>
                <!-- Updated Recording UI -->
                <div id="dev-support-recording">
                    <div class="dev-wave">
                        <div class="dev-wave-bar"></div>
                        <div class="dev-wave-bar"></div>
                        <div class="dev-wave-bar"></div>
                        <div class="dev-wave-bar"></div>
                        <div class="dev-wave-bar"></div>
                    </div>
                    <span id="dev-timer" class="dev-timer">00:00</span>
                    <button id="dev-stop-recording">✓ Enviar</button>
                    <button id="dev-cancel-recording" style="background:#ef4444;margin-left:5px;">✕</button>
                </div>
                
                <div id="dev-support-input-area">
                    <input type="file" id="dev-file-input" accept="image/*,audio/*,video/*,.pdf,.doc,.docx" />
                    <div id="dev-input-row">
                        <button class="dev-icon-btn" id="dev-attach-btn" title="Adjuntar archivo">📎</button>
                        <button class="dev-icon-btn" id="dev-emoji-btn" title="Emoji">😀</button>
                        <button class="dev-icon-btn" id="dev-mic-btn" title="Grabar audio">🎤</button>
                        <input type="text" id="dev-support-input" placeholder="Escribe tu mensaje..." />
                        <button id="dev-support-send">Enviar</button>
                    </div>
                </div>
                </div>
                <div id="dev-emoji-container" style="display: none; position: absolute; bottom: 70px; right: 10px; z-index: 100; box-shadow: 0 5px 25px rgba(0,0,0,0.2); border-radius: 12px; overflow: hidden; background: white; border: 1px solid #e2e8f0; width: 350px;">
                    <div style="padding: 8px 12px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 12px; font-weight: 700; color: #475569;">EMOJIS</span>
                        <button id="dev-emoji-close" style="border: none; background: none; cursor: pointer; font-size: 16px; color: #94a3b8; padding: 0 5px;">✕</button>
                    </div>
                    <div id="dev-emoji-root"></div>
                </div>
            </div>
            <button id="dev-support-btn" title="Chat con Soporte">🛠️</button>
            <div id="dev-image-modal">
                <button id="dev-modal-close">×</button>
                <img id="dev-modal-img" src="" alt="" />
            </div>
        `;
        document.body.appendChild(widgetContainer);

        // Elements
        const chatBox = document.getElementById('dev-support-box');
        const chatBtn = document.getElementById('dev-support-btn');
        const closeBtn = document.getElementById('dev-close-chat');
        const messagesDiv = document.getElementById('dev-support-messages');
        const inputEl = document.getElementById('dev-support-input') as HTMLInputElement;
        const sendBtn = document.getElementById('dev-support-send');
        const attachBtn = document.getElementById('dev-attach-btn');
        const fileInput = document.getElementById('dev-file-input') as HTMLInputElement;
        const micBtn = document.getElementById('dev-mic-btn');
        const previewDiv = document.getElementById('dev-support-preview');
        const previewImg = document.getElementById('dev-preview-img') as HTMLImageElement;
        const previewName = document.getElementById('dev-preview-name');
        const previewCancel = document.getElementById('dev-preview-cancel');
        const recordingDiv = document.getElementById('dev-support-recording');
        const stopRecordingBtn = document.getElementById('dev-stop-recording');
        const cancelRecordingBtn = document.getElementById('dev-cancel-recording');
        const inputRow = document.getElementById('dev-input-row');
        const imageModal = document.getElementById('dev-image-modal');
        const modalImg = document.getElementById('dev-modal-img') as HTMLImageElement;
        const modalClose = document.getElementById('dev-modal-close');

        // Emoji Logic
        const emojiBtn = document.getElementById('dev-emoji-btn');
        const emojiContainer = document.getElementById('dev-emoji-container');
        const emojiClose = document.getElementById('dev-emoji-close');
        const emojiRootEl = document.getElementById('dev-emoji-root');
        let emojiRoot: any = null;

        emojiClose?.addEventListener('click', () => {
            if (emojiContainer) emojiContainer.style.display = 'none';
        });

        emojiBtn?.addEventListener('click', () => {
            if (emojiContainer) {
                if (emojiContainer.style.display === 'none') {
                    emojiContainer.style.display = 'block';
                    if (!emojiRoot && emojiRootEl) {
                        emojiRoot = createRoot(emojiRootEl);
                        emojiRoot.render(
                            <EmojiPicker
                                onEmojiClick={(emojiData) => {
                                    if (inputEl) {
                                        inputEl.value += emojiData.emoji;
                                        inputEl.focus();
                                    }
                                    if (emojiContainer) emojiContainer.style.display = 'none';
                                }}
                                width="100%"
                                height={300}
                            />
                        );
                    }
                } else {
                    emojiContainer.style.display = 'none';
                }
            }
        });

        // Close emoji on click outside (simple version: close when sending)

        // Toggle chat
        chatBtn?.addEventListener('click', () => chatBox?.classList.add('open'));
        closeBtn?.addEventListener('click', () => chatBox?.classList.remove('open'));

        // Image modal
        function openModal(src: string) {
            if (modalImg) modalImg.src = src;
            imageModal?.classList.add('open');
        }
        modalClose?.addEventListener('click', () => imageModal?.classList.remove('open'));
        imageModal?.addEventListener('click', (e) => {
            if (e.target === imageModal) imageModal.classList.remove('open');
        });

        // Add message with media support
        function addMessage(msg: { content?: string; sender: string; mediaUrl?: string; mediaType?: string; fileName?: string }) {
            const div = document.createElement('div');
            div.className = `dev-msg ${msg.sender}`;

            if (msg.content) {
                const text = document.createElement('span');
                text.textContent = msg.content;
                div.appendChild(text);
            }

            if (msg.mediaUrl) {
                // Determine media type if not provided
                let type = msg.mediaType;
                if (!type) {
                    const ext = msg.mediaUrl.split('.').pop()?.toLowerCase();
                    if (['jpg', 'png', 'jpeg', 'gif'].includes(ext!)) type = 'image';
                    else if (['mp3', 'wav', 'ogg', 'webm'].includes(ext!) || msg.mediaUrl.includes('voice-')) type = 'audio';
                    else type = 'document';
                }

                if (type === 'image') {
                    const img = document.createElement('img');
                    img.src = msg.mediaUrl;
                    img.onclick = () => openModal(msg.mediaUrl!);
                    div.appendChild(img);
                } else if (type === 'audio') {
                    const audio = document.createElement('audio');
                    audio.controls = true;
                    audio.src = msg.mediaUrl;
                    div.appendChild(audio);
                } else {
                    const link = document.createElement('a');
                    link.href = msg.mediaUrl;
                    link.target = '_blank';
                    link.className = 'file-link';
                    link.textContent = `📄 ${msg.fileName || 'Archivo'}`;
                    div.appendChild(link);
                }
            }

            messagesDiv?.appendChild(div);
            if (messagesDiv) messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }

        // Load history
        async function loadHistory() {
            try {
                const res = await fetch(`${CRM_URL}/widget/history/${sessionId}`);
                if (res.ok) {
                    const data = await res.json();
                    data.messages.forEach((m: any) => addMessage(m));
                }
            } catch (e) {
                console.log('No previous chat history');
            }
        }
        loadHistory();

        // Send text message
        async function sendMessage() {
            if (emojiContainer) emojiContainer.style.display = 'none';
            const content = inputEl?.value.trim();
            if (!content && !pendingFile) return;

            if (pendingFile) {
                await sendFile(pendingFile, content || '');
                clearPreview();
                if (inputEl) inputEl.value = '';
                return;
            }

            addMessage({ content, sender: 'user' });
            if (inputEl) inputEl.value = '';

            try {
                await fetch(`${CRM_URL}/widget/message`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        from: sessionId,
                        content,
                        platform: 'web',
                        sessionId,
                        customerName: `${userName} - Equipo de Desarrollo`,
                        orgCode: ORG_ID
                    })
                });
            } catch (e) {
                console.error('Failed to send message', e);
            }
        }

        // Send file
        async function sendFile(file: File, text: string = '') {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('sessionId', sessionId!);
            formData.append('orgCode', ORG_ID);
            formData.append('platform', 'web');
            formData.append('customerName', `${userName} - Equipo de Desarrollo`);
            if (text) formData.append('content', text);

            const previewUrl = URL.createObjectURL(file);
            // Robust media type detection for optimistic UI
            let mediaType = 'document';
            if (file.type.startsWith('image/')) mediaType = 'image';
            else if (file.type.startsWith('audio/')) mediaType = 'audio';
            else if (file.type.startsWith('video/')) mediaType = 'video';

            addMessage({
                content: text,
                sender: 'user',
                mediaUrl: previewUrl,
                mediaType,
                fileName: file.name
            });

            try {
                await fetch(`${CRM_URL}/widget/upload`, {
                    method: 'POST',
                    body: formData
                });
            } catch (e) {
                console.error('Upload failed', e);
            }
        }

        function clearPreview() {
            pendingFile = null;
            previewDiv?.classList.remove('active');
            previewImg.src = '';
            if (previewName) previewName.textContent = '';
        }
        previewCancel?.addEventListener('click', clearPreview);

        // Timer Logic
        function startTimer() {
            recordingStartTime = Date.now();
            const timerEl = document.getElementById('dev-timer');
            if (timerEl) timerEl.textContent = "00:00";

            recordingTimer = setInterval(() => {
                const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
                const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
                const s = (elapsed % 60).toString().padStart(2, '0');
                if (timerEl) timerEl.textContent = `${m}:${s}`;
            }, 1000);
        }

        function stopTimer() {
            if (recordingTimer) {
                clearInterval(recordingTimer);
                recordingTimer = null;
            }
        }

        // Voice recording
        micBtn?.addEventListener('click', () => {
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
                isCancelled = false; // Reset cancel flag

                mediaRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) audioChunks.push(e.data);
                };

                mediaRecorder.onstop = async () => {
                    // Stop all tracks
                    stream.getTracks().forEach(t => t.stop());

                    if (isCancelled) {
                        return;
                    }

                    const blob = new Blob(audioChunks, { type: 'audio/webm' });
                    // If blob is empty, don't send
                    if (blob.size === 0) return;

                    const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
                    await sendFile(file);
                };

                mediaRecorder.start();
                isRecording = true;
                micBtn?.classList.add('recording');
                recordingDiv?.classList.add('active');
                if (inputRow) inputRow.style.display = 'none';

                startTimer();
            } catch (e) {
                console.error('Mic access denied', e);
                alert('Por favor, permite el acceso al micrófono.');
            }
        }

        function stopRecording() {
            if (mediaRecorder && isRecording) {
                mediaRecorder.stop();
                isRecording = false;
                stopTimer();
                micBtn?.classList.remove('recording');
                recordingDiv?.classList.remove('active');
                if (inputRow) inputRow.style.display = 'flex';
            }
        }

        function cancelRecording() {
            if (mediaRecorder && isRecording) {
                isCancelled = true;
                mediaRecorder.stop(); // Will trigger onstop but we check isCancelled
                isRecording = false;
                stopTimer();
                micBtn?.classList.remove('recording');
                recordingDiv?.classList.remove('active');
                if (inputRow) inputRow.style.display = 'flex';
                audioChunks = [];
            }
        }

        stopRecordingBtn?.addEventListener('click', stopRecording);
        cancelRecordingBtn?.addEventListener('click', cancelRecording);

        sendBtn?.addEventListener('click', sendMessage);
        inputEl?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });

        // Socket.io for real-time
        function connectSocket() {
            if ((window as any).io) {
                initSocket();
            } else {
                const script = document.createElement('script');
                script.src = `${CRM_URL}/socket.io/socket.io.js`;
                script.onload = initSocket;
                document.head.appendChild(script);
            }
        }

        // Notification sound function
        function playSound() {
            try {
                const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.setValueAtTime(880, ctx.currentTime);
                osc.frequency.setValueAtTime(1047, ctx.currentTime + 0.1);
                gain.gain.setValueAtTime(0.3, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.3);
            } catch (e) { console.log('Sound error', e); }
        }

        function initSocket() {
            const socket = (window as any).io(CRM_URL);
            socket.on('connect', () => {
                console.log('[DevSupport] Connected');
                socket.emit('join_conversation', sessionId);
            });
            socket.on('new_message', (msg: any) => {
                if (msg.sender === 'agent') {
                    addMessage(msg);
                    playSound(); // Play notification sound
                    // Show browser notification if chat is closed
                    if (!chatBox?.classList.contains('open') && 'Notification' in window && Notification.permission === 'granted') {
                        new Notification('🛠️ Respuesta de Soporte', { body: msg.content || 'Tienes una nueva respuesta' });
                    }
                }
            });
        }

        connectSocket();

        return () => {
            const container = document.getElementById('dev-support-widget');
            if (container) container.remove();
            if (emojiRoot) {
                setTimeout(() => emojiRoot.unmount(), 0);
            }
        };
    }, []);

    return null;
}
