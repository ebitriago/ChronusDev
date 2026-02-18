import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

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

export const triggerNotificationHaptic = async (type: 'success' | 'warning' | 'error') => {
    if (!isNativePlatform()) return;

    try {
        let notificationType = NotificationType.Success;
        if (type === 'warning') notificationType = NotificationType.Warning;
        if (type === 'error') notificationType = NotificationType.Error;

        await Haptics.notification({ type: notificationType });
    } catch (e) {
        // Ignorar
    }
};
