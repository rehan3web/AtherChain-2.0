import crypto from 'crypto';
import { env } from '../config/env';

const ALGORITHM = 'aes-256-gcm';
const SECRET_KEY = crypto.scryptSync(env.ENCRYPTION_SECRET, 'salt', 32);
// In production, salt should be consistent or stored. For simplicity here, we stick to a derived key from secret.
// Actually, `scryptSync` with fixed salt is deterministic. Better to use the secret directly if it's 32 bytes or hash it.
// We'll use a hashed version of the secret to ensure 32 bytes.
const KEY = crypto.createHash('sha256').update(env.ENCRYPTION_SECRET).digest();

export const encrypt = (text: string) => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');

    // Return IV:AuthTag:Encrypted
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
};

export const decrypt = (encryptedText: string) => {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted format');

    const [ivHex, authTagHex, encryptedHex] = parts;

    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
};
