import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { PushNotifications } from '@capacitor/push-notifications';
import { API_URL, getHeaders } from '../app/api';

export const isNativePlatform = (): boolean => {
    return Capacitor.isNativePlatform();
};

export const initCapacitor = async () => {
    if (!isNativePlatform()) return;

    try {
        // Configurar Status Bar
        await StatusBar.setStyle({ style: Style.Dark });

        // En Android, podemos hacer la status bar transparente u overlay
        if (Capacitor.getPlatform() === 'android') {
            await StatusBar.setOverlaysWebView({ overlay: false });
            await StatusBar.setBackgroundColor({ color: '#0f172a' }); // Coincide con bg-main dark
        }

        // Ocultar Splash Screen (por si acaso no se ocultó auto)
        await SplashScreen.hide();

        console.log('📱 Capacitor initialized successfully');
    } catch (error) {
        console.error('❌ Error initializing Capacitor:', error);
    }
};

export const triggerHaptic = async (style: 'light' | 'medium' | 'heavy' = 'medium') => {
    if (!isNativePlatform()) return;

    try {
        let impact = ImpactStyle.Medium;
        if (style === 'light') impact = ImpactStyle.Light;
        if (style === 'heavy') impact = ImpactStyle.Heavy;

        await Haptics.impact({ style: impact });
    } catch (e) {
        // Ignorar errores de haptics
    }
};

export const registerPushNotifications = async () => {
    if (!isNativePlatform()) return;

    try {
        // 1. Request Permission
        let permStatus = await PushNotifications.checkPermissions();

        if (permStatus.receive === 'prompt') {
            permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive !== 'granted') {
            console.log('🚫 Push permission denied');
            return;
        }

        // 2. Register
        await PushNotifications.register();

        // 3. Listeners
        // On registration success
        PushNotifications.addListener('registration', async (token) => {
            console.log('📲 Push registration success, token:', token.value);

            // Send token to backend
            try {
                await fetch(`${API_URL}/push-devices`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify({
                        token: token.value,
                        platform: Capacitor.getPlatform()
                    })
                });
                console.log('✅ Push token sent to backend');
            } catch (err) {
                console.error('❌ Error sending push token to backend:', err);
            }
        });

        // On registration error
        PushNotifications.addListener('registrationError', (error: any) => {
            console.error('❌ Push registration error: ', error.message);
        });

        // On notification received (foreground)
        PushNotifications.addListener('pushNotificationReceived', (notification: any) => {
            console.log('🔔 Push received:', notification);
            triggerHaptic('medium');
            // We could show a custom toast here if needed
        });

        // On notification tapped
        PushNotifications.addListener('pushNotificationActionPerformed', (notification: any) => {
            console.log('👆 Push tapped:', notification);
            // Handle deep links or navigation here if needed
            // const data = notification.notification.data;
            // if (data.url) window.location.href = data.url;
        });

    } catch (e) {
        console.error('❌ Error handling push notifications:', e);
    }
};
