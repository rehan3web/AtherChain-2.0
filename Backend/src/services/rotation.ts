import { env } from '../config/env';

let currentIndex = 0;

export const getNextAdminKey = () => {
    const keys = env.ATH_ADMIN_PRIVATE_KEYS;
    if (!keys || keys.length === 0) {
        throw new Error('No admin private keys configured');
    }

    const key = keys[currentIndex];
    currentIndex = (currentIndex + 1) % keys.length;
    return key;
};
