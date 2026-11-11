import { Request, Response, NextFunction } from 'express';
import { query } from '../db/postgres';

export const maintenanceCheck = async (req: Request, res: Response, next: NextFunction) => {
    // 1. Skip paths that should always be accessible
    const skipPaths = ['/admin', '/auth/login', '/auth/status', '/user/kyc/status', '/health', '/uploads'];

    if (skipPaths.some(path => req.path.startsWith(path))) {
        return next();
    }

    try {
        // Fetch maintenance settings
        const result = await query(
            "SELECT key, value FROM system_settings WHERE key IN ('maintenance_mode', 'maintenance_until')"
        );

        const settings: Record<string, any> = {};
        result.rows.forEach(row => {
            settings[row.key] = row.value;
        });

        const isMaintenance = settings['maintenance_mode'] === 'true' || settings['maintenance_mode'] === true;

        if (isMaintenance) {
            const until = settings['maintenance_until'] ? new Date(settings['maintenance_until']) : null;

            // If maintenance is enabled and (no until date OR until date is in the future)
            if (!until || new Date() < until) {
                // Return 503 Service Unavailable
                // The frontend Axios interceptor will catch this and redirect to /maintenance
                return res.status(503).json({
                    status: 'maintenance',
                    message: 'SYSTEM UNDER MAINTENANCE',
                    until: until ? until.toISOString() : null
                });
            }
        }
    } catch (error) {
        console.error('Maintenance Check Error:', error);
        // On error, let the request proceed to avoid total blackout
    }

    next();
};
