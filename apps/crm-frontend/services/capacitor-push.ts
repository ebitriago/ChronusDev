import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { isNativePlatform, triggerNotificationHaptic } from './capacitor';
import { toast } from 'react-hot-toast';

export const registerNativePush = async (apiUrl: string, token: string) => {
    if (!isNativePlatform()) return;

    console.log('🔔 Initializing Native Push Notifications...');

    // 1. Request Permission
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
        console.log('🚫 Push permission denied');
        return;
    }

    // 2. Register with FCM/APNS
    await PushNotifications.register();

    // 3. Listen for token registration
    PushNotifications.addListener('registration', async (pushToken) => {
        console.log('🔔 Native Push Token:', pushToken.value);

        // Send to CRM Backend
        try {
            const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
            await fetch(`${apiUrl}/push-devices`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    token: pushToken.value,
                    platform: platform,
                }),
            });
            console.log('✅ Native push token registered with backend');
        } catch (error) {
            console.error('❌ Error registering native push token:', error);
        }
    });

    PushNotifications.addListener('registrationError', (error) => {
        console.error('❌ Native Push Registration Error:', error);
    });

    // 4. Listen for received notifications (Foreground)
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('🔔 Push Received:', notification);
        triggerNotificationHaptic('success');

        toast(notification.body || 'Nueva notificación', {
            icon: '🔔',
            duration: 4000
        });
    });

    // 5. Listen for notification actions (Tapping on notification)
    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('🔔 Push Action:', notification);
        // Aquí podríamos navegar a una URL específica si viene en los datos
        // const data = notification.notification.data;
        // if (data.url) router.push(data.url);
    });
};

export const removenativePushListeners = async () => {
    if (!isNativePlatform()) return;
    await PushNotifications.removeAllListeners();
};
