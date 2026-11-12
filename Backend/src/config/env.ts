import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
    PORT: z.string().default('5000'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

    // Database URLs
    POSTGRES_URL: z.string().url(),
    POSTGRES_SSL: z.string().default('false').transform((val) => val === 'true'),

    MONGO_URI: z.string().url(),
    // SCYLLA_URL: z.string().optional(), 
    // SCYLLA_DATACENTER: z.string().optional(),
    // SCYLLA_USERNAME: z.string().optional(),
    // SCYLLA_PASSWORD: z.string().optional(),
    REDIS_URL: z.string().url(),

    // Secrets
    JWT_SECRET: z.string().min(8),
    ENCRYPTION_SECRET: z.string().min(8),

    // Admin Credentials
    ADMIN_EMAIL: z.string().email(),
    ADMIN_PASSWORD_HASH: z.string(), // Pre-hashed or to be checked against

    // Email Config
    EMAIL_HOST: z.string().default('smtp.gmail.com'),
    EMAIL_PORT: z.string().default('587'),
    EMAIL_USER: z.string().email(),
    EMAIL_PASSWORD: z.string(),
    FRONTEND_URL: z.string().default('http://localhost:3000').transform((val) => val.split(',').map(s => s.trim())),

    ALLOWED_ORIGINS: z.string().default('http://localhost:3000').transform((val) => val.split(',').map(s => s.trim())),
    EXPECTED_PASSKEY_ORIGINS: z.string().optional().transform((val) => val ? val.split(',').map(s => s.trim()) : []),
    RP_ID: z.string().default('localhost'),

    // Push Notifications
    VAPID_PUBLIC_KEY: z.string(),
    VAPID_PRIVATE_KEY: z.string(),

    // Security Settings
    ALLOW_MULTIPLE_ACCOUNTS: z.string().default('false').transform((val) => val === 'true'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
    console.error('❌ Invalid environment variables:', _env.error.format());
    process.exit(1);
}

export const env = _env.data;

