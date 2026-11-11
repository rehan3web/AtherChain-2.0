
const fetch = require('node-fetch'); // Assuming node-fetch or native fetch in Node 18+

const BASE_URL = 'http://localhost:5000';

async function run() {
    const username = 'user_' + Math.floor(Math.random() * 100000);
    const email = `${username}@example.com`;
    const password = 'password123';

    console.log(`Step 1: Registering user ${username}...`);
    const regRes = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            firstName: 'Test',
            lastName: 'User',
            username,
            email,
            password,
            phone: '1234567890'
        })
    });

    if (regRes.status !== 201) {
        console.error('Registration failed:', await regRes.text());
        return;
    }
    const regData = await regRes.json();
    console.log('Registered. UserId:', regData.userId);

    // We need to bypass email verification for test strictly speaking, 
    // OR we need to manually update DB to verify email.
    // The login code checks `is_email_verified`.
    // I can't easily verify email without DB access or OTP.
    // However, I can try to login. If it says EMAIL_NOT_VERIFIED, I am blocked.
    // The previous code showed: `if (!user.is_email_verified) return 403`.

    // I need to use `run_command` to update the DB directly to set `is_email_verified = true`.
    // Postgres is available. I can use `psql` if available or the backend's db connection if I run this as a TS script inside backend?
    // Testing via external script is harder if email verification is enforced.

    // Alternative: Login with an EXISTING user? User might not want me to mess with their account.
    // Alternative: Update the script to "Hack" the DB verification.

    console.log('Please manually verify this user in DB if strictly needed, or I will try to use a known user?');
    // I will try to update it via SQL if I can. 
    // But first let's see if I can login. Maybe verification is disabled for some envs?
    // Assume I need to verify.
}

run();
