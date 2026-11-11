import { Request, Response } from 'express';
import pool from '../db/postgres';

/**
 * Public endpoint to check if an app version is allowed.
 * POST /auth/check-version
 * Body: { version: string }
 */
export const checkVersion = async (req: Request, res: Response) => {
    try {
        const { version } = req.body;
        if (!version) {
            return res.status(400).json({ message: 'version parameter is required' });
        }

        // Query if this version is allowed
        const result = await pool.query(
            'SELECT is_allowed FROM app_versions WHERE version = $1',
            [version]
        );

        if (result.rows.length === 0) {
            // Version is not in the list, so it's not allowed
            return res.json({ allowed: false });
        }

        const isAllowed = result.rows[0].is_allowed;
        return res.json({ allowed: isAllowed });
    } catch (error) {
        console.error('Check version error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Admin: List all registered app versions.
 * GET /admin/app-versions
 */
export const listVersions = async (req: Request, res: Response) => {
    try {
        const result = await pool.query(
            'SELECT id, version, is_allowed, created_at FROM app_versions ORDER BY created_at DESC'
        );
        return res.json(result.rows);
    } catch (error) {
        console.error('List versions error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Admin: Add a new app version to the allowed list.
 * POST /admin/app-versions
 * Body: { version: string, is_allowed?: boolean }
 */
export const addVersion = async (req: Request, res: Response) => {
    try {
        const { version, is_allowed } = req.body;
        if (!version) {
            return res.status(400).json({ message: 'version is required' });
        }

        const allowed = is_allowed !== false; // default to true

        const result = await pool.query(
            'INSERT INTO app_versions (version, is_allowed) VALUES ($1, $2) ON CONFLICT (version) DO UPDATE SET is_allowed = EXCLUDED.is_allowed RETURNING *',
            [version, allowed]
        );

        return res.status(201).json({
            message: 'App version added successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Add version error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Admin: Update/Toggle version allowed status.
 * PUT /admin/app-versions/:id
 * Body: { is_allowed: boolean }
 */
export const updateVersion = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { is_allowed } = req.body;

        if (is_allowed === undefined) {
            return res.status(400).json({ message: 'is_allowed parameter is required' });
        }

        const result = await pool.query(
            'UPDATE app_versions SET is_allowed = $1 WHERE id = $2 RETURNING *',
            [is_allowed, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'App version not found' });
        }

        return res.json({
            message: 'App version updated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Update version error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Admin: Delete an app version.
 * DELETE /admin/app-versions/:id
 */
export const deleteVersion = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            'DELETE FROM app_versions WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'App version not found' });
        }

        return res.json({
            message: 'App version deleted successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Delete version error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};
