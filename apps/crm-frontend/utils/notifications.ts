/**
 * Notification sound utility
 * Uses Web Audio API to generate a pleasant notification sound
 */
import { isNativePlatform, triggerNotificationHaptic } from '../services/capacitor';

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
    if (!audioContext) {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContext;
}

/**
 * Play a notification sound
 * @param type - 'message' for chat messages, 'alert' for urgent notifications
 */
export function playNotificationSound(type: 'message' | 'alert' = 'message'): void {
    try {
        // Native Haptics regardless of platform sound policy
        if (isNativePlatform()) {
            triggerNotificationHaptic(type === 'message' ? 'success' : 'warning');
            // We can still play web audio if supported in WebView, or rely on system sound for push
        }

        const ctx = getAudioContext();

        // Resume context if suspended (browser autoplay policy)
        if (ctx.state === 'suspended') {
            ctx.resume();
        }

        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        if (type === 'message') {
            // Pleasant chime for messages
            oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5
            oscillator.frequency.setValueAtTime(1047, ctx.currentTime + 0.1); // C6
            gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.3);
        } else {
            // More urgent sound for alerts
            oscillator.frequency.setValueAtTime(659, ctx.currentTime); // E5
            oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
            oscillator.frequency.setValueAtTime(1047, ctx.currentTime + 0.2); // C6
            gainNode.gain.setValueAtTime(0.4, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.4);
        }
    } catch (e) {
        console.log('Could not play notification sound:', e);
    }
}

/**
 * Request notification permission from browser
 */
export async function requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
        return false;
    }

    if (Notification.permission === 'granted') {
        return true;
    }

    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }

    return false;
}

/**
 * Show a browser notification
 */
export function showBrowserNotification(title: string, body: string, icon?: string): void {
    if (Notification.permission === 'granted') {
        new Notification(title, {
            body,
            icon: icon || '/favicon.png',
            badge: '/favicon.png',
            tag: 'inbox-notification'
        });
    }
}
