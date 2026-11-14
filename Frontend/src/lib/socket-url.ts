const getSocketURL = () => {
    // 1. Check explicit WS URL
    if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
    if (process.env.NEXT_PUBLIC_SOCKET_URL) return process.env.NEXT_PUBLIC_SOCKET_URL;

    // 2. Fallback to API URL (most reliable)
    if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;

    // 3. Localhost fallbacks
    if (typeof window !== 'undefined') {
        const host = window.location.hostname;
        if (host !== 'localhost' && host !== '127.0.0.1') {
            // If on a domain but no API_URL set, try the same domain
            return `https://${host}`;
        }
    }

    return 'http://localhost:5000';
};

export const SOCKET_URL = getSocketURL();
