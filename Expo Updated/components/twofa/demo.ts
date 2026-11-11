// Public, fixed, demo-only key. It protects nothing; never use it for a real account.
export const DEMO_SECRET = 'ATHERCHAINDEMOKEYPUBLICNOTSECRET';
export const DEMO_REJECT_CODE = '123456';
export const CODE_LENGTH = 6;

const label = encodeURIComponent('AtherChain DEMO:demo-only-not-secure');
const issuer = encodeURIComponent('AtherChain DEMO');
export const DEMO_URI = `otpauth://totp/${label}?secret=${DEMO_SECRET}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;

/** Spaced groups of four for readability. */
export const groupedSecret = DEMO_SECRET.replace(/(.{4})(?=.)/g, '$1 ');

// Session-only memory of the demo outcome. Never persisted, no codes or keys stored.
let completed = false;
export const isDemoCompleted = () => completed;
export const markDemoCompleted = () => { completed = true; disabledShown = false; };
export const markDemoDisabled = () => { completed = false; disabledShown = true; };
// Session-only: true once the walkthrough was turned off this session.
let disabledShown = false;
export const isDemoDisabled = () => disabledShown;
export const clearDemoDisabled = () => { disabledShown = false; };
