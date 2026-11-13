import { createHash, randomInt } from 'node:crypto';
import redis from '../db/redis';

type Purpose = 'password' | 'twofa';
const LIFETIME = 10 * 60;
export class RecoveryError extends Error {
    constructor(message: string, public status = 400) { super(message); }
}
const keyFor = (purpose: Purpose, id: string) => `recovery:${purpose}:${id}`;
const digest = (code: string) => createHash('sha256').update(code).digest('hex');

/** Purpose-bound, short-lived OTPs never share registration or suspicious-login codes. */
export async function sendRecoveryOTP(purpose: Purpose, user: { id: string; email: string },
    send: (email: string, code: string) => Promise<unknown>) {
    const key = keyFor(purpose, user.id);
    const count = await redis.incr(`${key}:sends`);
    if (count === 1) await redis.expire(`${key}:sends`, 3600);
    if (count > 5) throw new RecoveryError('Too many recovery emails. Please try again in an hour.', 429);
    const cooldown = await redis.set(`${key}:cooldown`, '1', 'EX', 60, 'NX');
    if (!cooldown) throw new RecoveryError('Please wait 60 seconds before requesting another code.', 429);
    const code = randomInt(100000, 1000000).toString();
    try {
        await redis.set(key, JSON.stringify({ digest: digest(code), attempts: 0 }), 'EX', LIFETIME);
        await send(user.email, code);
    } catch (error) {
        await redis.del(key, `${key}:cooldown`);
        throw error;
    }
}

// Checking attempts and consuming the code are atomic, including concurrent reset requests.
const CHECK = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local state = cjson.decode(raw)
if state.attempts >= 5 then return -1 end
if state.digest ~= ARGV[1] then
  state.attempts = state.attempts + 1
  local ttl = redis.call('PTTL', KEYS[1])
  if ttl > 0 then redis.call('SET', KEYS[1], cjson.encode(state), 'PX', ttl) end
  if state.attempts >= 5 then return -1 end
  return 0
end
if ARGV[2] == 'consume' then redis.call('DEL', KEYS[1]) end
return 1`;

export async function checkRecoveryOTP(purpose: Purpose, userId: string, code: string, consume = false) {
    if (typeof code !== 'string' || !/^\d{6}$/.test(code))
        throw new RecoveryError('Enter the six-digit verification code.');
    const result = Number(await redis.eval(CHECK, 1, keyFor(purpose, userId), digest(code), consume ? 'consume' : 'check'));
    if (result === -1) throw new RecoveryError('Too many incorrect codes. Request a new code.', 429);
    if (result !== 1) throw new RecoveryError('Invalid or expired verification code. Please request a new code.');
}

export async function revokeRecoverySessions(userId: string) {
    const sessions = await redis.smembers(`user_sessions:${userId}`);
    await redis.del(...sessions.map(id => `session:${id}`), `user_sessions:${userId}`, `session:${userId}`);
}
