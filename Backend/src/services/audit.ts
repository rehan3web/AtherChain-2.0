import pool from '../db/postgres';

export class AuditService {
    static async log(adminId: string, targetUserId: string | null, action: string, details: any = {}, ipAddress: string | null = null) {
        try {
            await pool.query(
                `INSERT INTO admin_audit_logs (admin_id, target_user_id, action, details, ip_address)
                 VALUES ($1, $2, $3, $4, $5)`,
                [adminId, targetUserId, action, JSON.stringify(details), ipAddress]
            );
        } catch (error) {
            console.error('Failed to write audit log:', error);
            // Non-blocking: don't crash the request if audit logging fails, but definitely log the error
        }
    }
}
