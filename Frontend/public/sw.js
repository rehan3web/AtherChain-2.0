const CACHE_NAME = 'ather-image-cache-v1';
const IMAGE_EXTENSIONS = /\.(png|jpg|jpeg|svg|gif|webp|ico)(\?.*)?$/i;

self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // SECURITY: Never cache API requests or anything with Authorization headers
    // Port 5000 is our backend, and common API patterns
    const isAPI = url.port === '5000' ||
        url.pathname.startsWith('/api') ||
        url.pathname.includes('/user/me') ||
        url.pathname.includes('/wallet/stats');

    const hasAuth = event.request.headers.has('Authorization');

    if (isAPI || hasAuth || event.request.method !== 'GET') {
        return; // Let it fall through to network, do NOT cache
    }

    // Only handle image extensions for speed optimization
    if (IMAGE_EXTENSIONS.test(url.pathname)) {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((cachedResponse) => {
                    // Stale-While-Revalidate strategy
                    const fetchPromise = fetch(event.request).then((networkResponse) => {
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch(() => null);

                    return cachedResponse || fetchPromise;
                });
            })
        );
    }
});

// Push Notification Handling
self.addEventListener('push', (event) => {
    if (!event.data) return;

    try {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: data.icon || '/link.png',
            badge: '/link.png',
            data: data.data || {},
            vibrate: [200, 100, 200, 100, 200], // More pronounced vibration
            silent: false, // Ensure it's not silent
            sound: '/beep.wav', // Added sound
            tag: 'mining-claim',
            renotify: true,
            actions: [
                { action: 'open', title: 'Claim Now' },
                { action: 'close', title: 'Close' }
            ]
        };

        event.waitUntil(
            self.registration.showNotification(data.title, options).then(() => {
                // Also broadcast to open tabs to play sound (for active sessions)
                return self.clients.matchAll({ type: 'window' }).then((clients) => {
                    clients.forEach(client => {
                        client.postMessage({ type: 'PLAY_NOTIFICATION_SOUND' });
                    });
                });
            })
        );
    } catch (err) {
        console.error('Push handling error:', err);
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/dashboard/mining';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // Check if there is already a window open with this URL
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url.includes(urlToOpen) && 'focus' in client) {
                    return client.focus();
                }
            }
            // If no window is open, open a new one
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
