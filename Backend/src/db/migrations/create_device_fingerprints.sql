-- Create device_fingerprints table
CREATE TABLE IF NOT EXISTS device_fingerprints (
    visitor_id VARCHAR(255) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    device_type VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_blocked BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (visitor_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_device_fingerprints_visitor_id ON device_fingerprints(visitor_id);
CREATE INDEX IF NOT EXISTS idx_device_fingerprints_user_id ON device_fingerprints(user_id);
