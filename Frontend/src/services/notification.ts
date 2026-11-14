import api from '@/lib/api';

const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
};

export class NotificationService {
    static async isSupported() {
        return 'serviceWorker' in navigator && 'PushManager' in window;
    }

    static async getSubscription() {
        const registration = await navigator.serviceWorker.ready;
        return await registration.pushManager.getSubscription();
    }

    static async subscribe() {
        try {
            const registration = await navigator.serviceWorker.ready;

            // Get VAPID public key from server
            const { data } = await api.get('/push-notifications/vapid-public-key');
            const publicKey = data.publicKey;

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey)
            });

            // Save subscription to server
            await api.post('/push-notifications/subscribe', { subscription });

            return true;
        } catch (error) {
            console.error('Failed to subscribe to push notifications:', error);
            return false;
        }
    }

    static async unsubscribe() {
        try {
            const subscription = await this.getSubscription();
            if (subscription) {
                await subscription.unsubscribe();
            }
            return true;
        } catch (error) {
            console.error('Failed to unsubscribe from push notifications:', error);
            return false;
        }
    }

    static async requestPermission() {
        if (!('Notification' in window)) return 'denied';
        const permission = await Notification.requestPermission();
        return permission;
    }

    static playSound() {
        const audio = new Audio('/beep.wav');
        audio.play().catch(e => console.error('Error playing sound:', e));
    }
}
