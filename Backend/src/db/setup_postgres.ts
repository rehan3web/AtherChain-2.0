import pool from './postgres';

const setupDb = async () => {
    const client = await pool.connect();
    try {
        console.log('🚀 Starting Database Setup & Migration...');
        await client.query('BEGIN');

        // ==========================================
        // 1. Users Table & Extensions
        // ==========================================
        console.log('👤 Setting up Users table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100) NOT NULL,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                phone VARCHAR(50),
                password_hash TEXT NOT NULL,
                role VARCHAR(50) DEFAULT 'user',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);

        // Add all columns from various migrations safely
        const userColumns = [
            "referral_code VARCHAR(50) UNIQUE",
            "referrer_id UUID REFERENCES users(id)",
            "kyc_status VARCHAR(50) DEFAULT 'unverified'",
            "is_blocked BOOLEAN DEFAULT FALSE",
            "block_reason TEXT",
            "at_balance NUMERIC(20, 8) DEFAULT 0",
            "is_swap_enabled BOOLEAN DEFAULT TRUE",
            "is_mining_enabled BOOLEAN DEFAULT TRUE",
            "is_transfer_enabled BOOLEAN DEFAULT TRUE",
            "mining_paused BOOLEAN DEFAULT FALSE",
            "swap_paused BOOLEAN DEFAULT FALSE",
            "transfer_paused BOOLEAN DEFAULT FALSE",
            "is_email_verified BOOLEAN DEFAULT FALSE",
            "otp_code VARCHAR(100)",
            "otp_expires_at TIMESTAMP WITH TIME ZONE",
            "reset_token VARCHAR(100)",
            "reset_expires_at TIMESTAMP WITH TIME ZONE",
            "kyc_verified BOOLEAN DEFAULT FALSE",
            "referred_by VARCHAR(255)",
            "kyc_rejection_reason TEXT",
            "full_name VARCHAR(255)",
            "country VARCHAR(100)",
            "profile_image TEXT",
            "twofa_secret TEXT",
            "twofa_enabled BOOLEAN DEFAULT FALSE",
            "passkey_enabled BOOLEAN DEFAULT FALSE",
            "passkey_credentials JSONB",
            "next_swap_at TIMESTAMP WITH TIME ZONE",
            "mining_boost_claimed BOOLEAN DEFAULT FALSE",
            "mining_bonus_rate NUMERIC DEFAULT 0",
            "last_mined_at TIMESTAMP WITH TIME ZONE",
            "mining_days_count INT DEFAULT 0",
            "mining_sessions_count INT DEFAULT 0",
            "current_cycle_boosts INT DEFAULT 0",
            "kyc_activation_paid BOOLEAN DEFAULT FALSE",
            "kyc_activation_tx_hash VARCHAR(100)",
            "mining_reminders_enabled BOOLEAN DEFAULT FALSE",
            "last_reminder_sent_at TIMESTAMP WITH TIME ZONE",
            "twitter_username VARCHAR(100)",
            "is_twitter_followed BOOLEAN DEFAULT FALSE",
            "expo_push_token VARCHAR(500)"
        ];

        for (const col of userColumns) {
            const colName = col.split(' ')[0];
            await client.query(`
                DO $$ 
                BEGIN 
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='${colName}') THEN 
                        ALTER TABLE users ADD COLUMN ${col}; 
                    END IF;
                END $$;
            `);
        }

        // CORRECTION: Ensure default is 'unverified' (Update existing column default)
        await client.query(`ALTER TABLE users ALTER COLUMN kyc_status SET DEFAULT 'unverified'`);

        // Ensure columns are resized if they already exist
        console.log('📏 Resizing User columns...');
        await client.query(`ALTER TABLE users ALTER COLUMN phone TYPE VARCHAR(50)`);
        await client.query(`ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(50)`);
        await client.query(`ALTER TABLE users ALTER COLUMN referral_code TYPE VARCHAR(50)`);
        await client.query(`ALTER TABLE users ALTER COLUMN kyc_status TYPE VARCHAR(50)`);


        // ==========================================
        // 2. Wallets Table
        // ==========================================
        console.log('💰 Setting up Wallets table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS wallets (
                user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                address VARCHAR(255) UNIQUE NOT NULL,
                encrypted_private_key TEXT NOT NULL,
                encrypted_mnemonic TEXT NOT NULL,
                balance_at NUMERIC(20, 8) DEFAULT 0,
                balance_ath NUMERIC(20, 8) DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);

        // Ensure columns exist (from fix_wallet.ts and init.ts migrations)
        const walletColumns = [
            "balance_at NUMERIC(20, 8) DEFAULT 0", // Redundant with CREATE but safe
            "balance_ath NUMERIC(20, 8) DEFAULT 0",
            "encrypted_private_key TEXT", // Make nullable
            "encrypted_mnemonic TEXT"      // Make nullable
        ];

        await client.query(`ALTER TABLE wallets ALTER COLUMN encrypted_private_key DROP NOT NULL`);
        await client.query(`ALTER TABLE wallets ALTER COLUMN encrypted_mnemonic DROP NOT NULL`);

        for (const col of walletColumns) {
            const colName = col.split(' ')[0];
            await client.query(`
                DO $$ 
                BEGIN 
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wallets' AND column_name='${colName}') THEN 
                        ALTER TABLE wallets ADD COLUMN ${col}; 
                    END IF;
                END $$;
            `);
        }

        // Force address column resize
        await client.query(`ALTER TABLE wallets ALTER COLUMN address TYPE VARCHAR(255)`);

        // ==========================================
        // 2b. Web3 Wallet Vaults (non-custodial EVM)
        // ==========================================
        // These store the user's self-custodied EVM wallet, encrypted CLIENT-SIDE.
        // The server holds only opaque ciphertext and never has the PIN, so it
        // cannot decrypt these rows. Distinct from the `wallets` table above,
        // which is the custodial AetherChain ledger.
        console.log('🔐 Setting up Web3 wallet vaults...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS wallet_vaults (
                user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                envelope JSONB NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);

        // Peppers live in their own table on purpose. The whole point of the
        // pepper is that leaking the envelope table alone must not be enough to
        // brute-force a 6-digit PIN offline — that mitigation disappears if the
        // two are stored side by side. Keep them separate, and if you ever add
        // per-table access controls or separate backups, split them there too.
        await client.query(`
            CREATE TABLE IF NOT EXISTS wallet_vault_peppers (
                user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                pepper CHAR(64) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);

        // ==========================================
        // 3. KYC System (Requests, Docs, Logs, History)
        // ==========================================
        console.log('🆔 Setting up KYC System...');



        await client.query(`
            CREATE TABLE IF NOT EXISTS kyc_requests (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                full_name VARCHAR(255),
                father_name VARCHAR(255),
                dob DATE,
                address TEXT,
                city VARCHAR(100),
                country VARCHAR(100),
                id_type VARCHAR(50),
                
                -- New fields from migrate_kyc.ts overhaul
                id_number VARCHAR(100),
                id_expiry DATE,
                language VARCHAR(50),
                status VARCHAR(20) DEFAULT 'pending',
                rejection_reason TEXT,

                -- Legacy fields that might be used or mapped
                id_front_url TEXT,
                id_back_url TEXT,
                selfie_url TEXT,
                admin_comment TEXT,
                
                submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);

        const kycColumns = [
            "verification_score NUMERIC(5, 2)",
            "verification_logs JSONB",
            "face_scan_frame TEXT",
            "country_code VARCHAR(20)",
            "dob DATE",
            "id_expiry DATE",
            "language VARCHAR(50)"
        ];

        for (const col of kycColumns) {
            const colName = col.split(' ')[0];
            await client.query(`
                DO $$ 
                BEGIN 
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kyc_requests' AND column_name='${colName}') THEN 
                        ALTER TABLE kyc_requests ADD COLUMN ${col}; 
                    END IF;
                END $$;
            `);
        }

        // kyc_documents
        await client.query(`
            CREATE TABLE IF NOT EXISTS kyc_documents (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                request_id UUID NOT NULL REFERENCES kyc_requests(id) ON DELETE CASCADE,
                document_type VARCHAR(50) NOT NULL, -- 'id_front', 'id_back', 'selfie'
                file_path TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);

        // kyc_audit_logs
        await client.query(`
            CREATE TABLE IF NOT EXISTS kyc_audit_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                request_id UUID NOT NULL,
                admin_id TEXT NOT NULL, 
                action VARCHAR(50) NOT NULL,
                prev_status VARCHAR(20),
                new_status VARCHAR(20),
                reason TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);

        // kyc_status_history
        await client.query(`
             CREATE TABLE IF NOT EXISTS kyc_status_history (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                request_id UUID REFERENCES kyc_requests(id) ON DELETE SET NULL,
                status VARCHAR(20) NOT NULL,
                reason TEXT,
                changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);

        // CORRECTION: Fix existing users who are 'pending' but have no KYC request
        // This fixes the issue for accounts created while default was 'pending'
        // Moved here to avoid dependency error before kyc_requests table exists
        await client.query(`
            UPDATE users 
            SET kyc_status = 'unverified' 
            WHERE kyc_status = 'pending' 
            AND NOT EXISTS (SELECT 1 FROM kyc_requests WHERE kyc_requests.user_id = users.id)
        `);

        // ==========================================
        // 4. Admin & Support Systems
        // ==========================================
        console.log('🛡️ Setting up Admin & Support tables...');

        // admin_audit_logs
        await client.query(`
            CREATE TABLE IF NOT EXISTS admin_audit_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                admin_id TEXT, -- Changed from UUID to TEXT to allow flexible identifiers like admin-001
                target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                action VARCHAR(50) NOT NULL,
                details JSONB,
                ip_address VARCHAR(45),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);
        // Indexes for admin_audit_logs
        await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_admin_id ON admin_audit_logs(admin_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_target_user_id ON admin_audit_logs(target_user_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_action ON admin_audit_logs(action)`);

        // support_tickets
        await client.query(`
            CREATE TABLE IF NOT EXISTS support_tickets (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(255),
                name VARCHAR(255),
                username VARCHAR(100),
                email VARCHAR(255),
                message TEXT,
                image_url TEXT,
                status VARCHAR(20) DEFAULT 'PENDING',
                admin_reply TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);

        // Migration logic for existing support_tickets (ensuring legacy columns are nullable)
        const supportTicketCols = ['name', 'username', 'email', 'message'];
        for (const col of supportTicketCols) {
            await client.query(`ALTER TABLE support_tickets ALTER COLUMN ${col} DROP NOT NULL`);
        }

        // ticket_messages
        await client.query(`
            CREATE TABLE IF NOT EXISTS ticket_messages (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
                sender_id UUID REFERENCES users(id) ON DELETE SET NULL, 
                is_admin BOOLEAN DEFAULT FALSE,
                message TEXT NOT NULL,
                image_url TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);

        // Index for performance
        await client.query(`CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON ticket_messages(ticket_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_ticket_messages_created_at ON ticket_messages(created_at)`);

        // ==========================================
        // 5. System, Referral & Notifications
        // ==========================================
        console.log('⚙️ Setting up System & Config tables...');

        // system_settings
        await client.query(`
             CREATE TABLE IF NOT EXISTS system_settings (
                 key VARCHAR(50) PRIMARY KEY,
                 value JSONB NOT NULL
             );
        `);
        // Initial System Settings
        await client.query(`
            INSERT INTO system_settings (key, value)
            VALUES 
                ('mining', '{"active": true, "daily_reward": 1.0}'),
                ('swap', '{"active": true, "rate": 1, "fee_percent": 1}'),
                ('referral', '{"active": true, "reward_unverified": 10, "reward_verified": 50}'),
                ('boost_referral_limit', '"10"'),
                ('boost_reward_amount', '"0.1"'),
                ('daily_boost_max', '"3"'),
                ('boost_enabled', '"true"'),
                ('mining_cycle_hours', '"24"'),
                ('kyc_activation_fee_ath', '"25"'),
                ('admin_activation_wallet', '"0x0000000000000000000000000000000000000000"')
            ON CONFLICT (key) DO NOTHING;
        `);

        // referral_settings
        await client.query(`
            CREATE TABLE IF NOT EXISTS referral_settings (
                id SERIAL PRIMARY KEY,
                registration_reward_at NUMERIC(20, 8) DEFAULT 10,
                kyc_verified_reward_at NUMERIC(20, 8) DEFAULT 50,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);
        // Seed referral settings
        await client.query(`
            INSERT INTO referral_settings (id, registration_reward_at, kyc_verified_reward_at)
            VALUES (1, 10, 50)
            ON CONFLICT (id) DO NOTHING;
        `);

        // referral_rewards_log
        await client.query(`
            CREATE TABLE IF NOT EXISTS referral_rewards_log (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                referrer_id UUID REFERENCES users(id),
                referred_id UUID REFERENCES users(id),
                type VARCHAR(20), -- 'registration', 'kyc'
                amount NUMERIC(20, 8),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(referred_id, type)
            );
        `);

        // notifications
        await client.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                type VARCHAR(50) DEFAULT 'broadcast',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);

        // notification_reads
        await client.query(`
            CREATE TABLE IF NOT EXISTS notification_reads (
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE,
                read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                PRIMARY KEY (user_id, notification_id)
            );
        `);

        // Push Subscriptions for Web Push notifications
        await client.query(`
            CREATE TABLE IF NOT EXISTS push_subscriptions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                subscription JSONB NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(user_id)
            );
        `);

        // ==========================================
        // 6. Optimizations (Indexes)
        // ==========================================
        console.log('⚡ Applying Performance Indexes...');

        // Users
        await client.query(`CREATE INDEX IF NOT EXISTS idx_users_referrer_id ON users(referrer_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_users_next_swap_at ON users(next_swap_at)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_users_mining_days on users(mining_days_count)`);

        // Wallets
        await client.query(`CREATE INDEX IF NOT EXISTS idx_wallets_address ON wallets(address)`);

        // KYC Requests
        await client.query(`CREATE INDEX IF NOT EXISTS idx_kyc_user_id ON kyc_requests(user_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_kyc_status ON kyc_requests(status)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_kyc_submitted_at ON kyc_requests(submitted_at)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_kyc_country ON kyc_requests(country)`);

        // Rewards Logs
        await client.query(`CREATE INDEX IF NOT EXISTS idx_rewards_referrer_id ON referral_rewards_log(referrer_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_rewards_referred_id ON referral_rewards_log(referred_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_rewards_created_at ON referral_rewards_log(created_at)`);

        // Support Tickets
        await client.query(`CREATE INDEX IF NOT EXISTS idx_support_user_id ON support_tickets(user_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_support_status ON support_tickets(status)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_support_created_at ON support_tickets(created_at)`);

        // Admin Audit Logs
        await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_created_at ON admin_audit_logs(created_at)`);

        // Notifications
        await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_notif_reads_user_id ON notification_reads(user_id)`);

        // ==========================================
        // 7. Security & Fingerprinting
        // ==========================================
        console.log('🔒 Setting up Security & Fingerprinting tables...');

        await client.query(`
            CREATE TABLE IF NOT EXISTS device_fingerprints (
                visitor_id VARCHAR(512) NOT NULL,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                ip_address VARCHAR(45),
                user_agent TEXT,
                device_type VARCHAR(50),
                browser VARCHAR(255),
                os VARCHAR(255),
                screen_resolution VARCHAR(50),
                gpu VARCHAR(255),
                fonts TEXT,
                canvas_hash TEXT,
                components_json JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                is_blocked BOOLEAN DEFAULT FALSE,
                PRIMARY KEY (visitor_id, user_id)
            );
        `);

        // Migration loop for device_fingerprints columns
        const fingerprintColumns = [
            "browser VARCHAR(255)",
            "os VARCHAR(255)",
            "screen_resolution VARCHAR(50)",
            "gpu VARCHAR(255)",
            "fonts TEXT",
            "canvas_hash TEXT",
            "components_json JSONB"
        ];

        for (const col of fingerprintColumns) {
            const colName = col.split(' ')[0];
            const colDef = col.split(' ').slice(1).join(' ');

            // Add column if missing
            await client.query(`
                DO $$ 
                BEGIN 
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='device_fingerprints' AND column_name='${colName}') THEN 
                        ALTER TABLE device_fingerprints ADD COLUMN ${colName} ${colDef}; 
                    END IF;
                END $$;
            `);

            // Always ensure the type is correct (Fix for value too long error)
            await client.query(`ALTER TABLE device_fingerprints ALTER COLUMN ${colName} TYPE ${colDef} USING ${colName}::${colDef}`);
        }

        // Fix visitor_id length if existing
        await client.query(`ALTER TABLE device_fingerprints ALTER COLUMN visitor_id TYPE VARCHAR(512)`);

        await client.query(`DROP INDEX IF EXISTS idx_device_fingerprints_visitor_id`);
        await client.query(`DROP INDEX IF EXISTS idx_device_fingerprints_canvas_hash`);

        await client.query(`CREATE INDEX IF NOT EXISTS idx_device_fingerprints_visitor_id ON device_fingerprints USING HASH (visitor_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_device_fingerprints_user_id ON device_fingerprints(user_id)`);
        // ==========================================
        // 8. App Versions & Updates Management
        // ==========================================
        console.log('📱 Setting up App Versions table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS app_versions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                version VARCHAR(50) UNIQUE NOT NULL,
                is_allowed BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);
        // Seed initial version if not exists
        await client.query(`
            INSERT INTO app_versions (version, is_allowed)
            VALUES ('1.1.1', TRUE)
            ON CONFLICT (version) DO NOTHING;
        `);

        // ==========================================
        // 9. Account Deletion Requests
        // ==========================================
        console.log('🗑️ Setting up Account Deletion table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS account_deletion_requests (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                email VARCHAR(255) NOT NULL,
                otp_hash VARCHAR(255) NOT NULL,
                otp_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                attempts INT DEFAULT 0,
                max_attempts INT DEFAULT 5,
                resend_count INT DEFAULT 0,
                last_resend_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                auth_token_hash VARCHAR(255),
                auth_token_expires_at TIMESTAMP WITH TIME ZONE,
                status VARCHAR(50) DEFAULT 'pending_otp',
                ip_address VARCHAR(45),
                user_agent TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_account_deletion_user_id ON account_deletion_requests(user_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_account_deletion_status ON account_deletion_requests(status)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_account_deletion_auth_token_hash ON account_deletion_requests(auth_token_hash)`);

        await client.query('COMMIT');
        console.log('✅✅ All Database Tables & Migrations setup successfully!');

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Database Setup Failed:', e);
        process.exit(1);
    } finally {
        client.release();
        process.exit(0);
    }
};

if (require.main === module) {
    setupDb();
}

export default setupDb;
