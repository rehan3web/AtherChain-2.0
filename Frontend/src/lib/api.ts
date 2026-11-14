import axios from 'axios';

const getBaseURL = () => {
    return process.env.NEXT_PUBLIC_API_URL || 'https://api.atherchain.com';
};

const api = axios.create({
    baseURL: getBaseURL(),
    withCredentials: true,
});

api.interceptors.request.use((config) => {
    // If header is manually matched, don't overwrite
    if (config.headers.Authorization) {
        return config;
    }

    if (config.url?.includes('/admin')) {
        const adminToken = localStorage.getItem('admin_token');
        if (adminToken) {
            config.headers.Authorization = `Bearer ${adminToken}`;
        }
    } else {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    }
    return config;
});
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 503 && error.response?.data?.status === 'maintenance') {
            const until = error.response.data.until;
            if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/maintenance') && !window.location.pathname.startsWith('/admin')) {
                window.location.href = `/maintenance?until=${encodeURIComponent(until || '')}`;
            }
        }
        if (error.response?.status === 401 || (error.response?.status === 403 && error.config.url?.includes('/admin'))) {
            // Check if it's an admin request based on URL or current page
            const isAdminRequest = error.config.url?.includes('/admin');
            const isCurrentlyOnAdminPage = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');

            if (isAdminRequest) {
                localStorage.removeItem('admin_token');
                if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/admin/login')) {
                    window.location.href = '/admin/login';
                }
            } else if (error.response?.status === 401 && !isCurrentlyOnAdminPage) {
                localStorage.removeItem('token');
                if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/delete-request')) {
                    window.location.href = '/login';
                }
            }
        } else if (error.response?.status === 403 && error.response?.data?.code === 'USER_BLOCKED') {
            if (typeof window !== 'undefined' && !window.location.pathname.includes('/blocked') && !window.location.pathname.includes('/help') && !window.location.pathname.startsWith('/admin')) {
                window.location.href = '/blocked';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
