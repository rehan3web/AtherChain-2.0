import { Request, Response } from 'express';
import pool from '../db/postgres';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Configure Multer for image upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/profiles';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

export const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images are allowed'));
        }
    }
});

export const AccountController = {

    // Update Profile Info (Name, Country)
    updateProfile: async (req: Request, res: Response) => {
        const { firstName, lastName, country } = req.body;
        // @ts-ignore
        const userId = req.user.id;

        if (!firstName) {
            return res.status(400).json({ message: 'First name is required' });
        }

        try {
            await pool.query(
                'UPDATE users SET first_name = $1, last_name = $2, country = $3 WHERE id = $4',
                [firstName, lastName, country, userId]
            );
            res.json({ message: 'Profile updated successfully' });
        } catch (error) {
            console.error('Update profile error:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    // Upload Profile Picture
    uploadProfileImage: async (req: Request, res: Response) => {
        // @ts-ignore
        const userId = req.user.id;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const imageUrl = `/uploads/profiles/${file.filename}`;

        try {
            // Get old image to delete
            const userRes = await pool.query('SELECT profile_image FROM users WHERE id = $1', [userId]);
            const oldImage = userRes.rows[0]?.profile_image;

            // Update DB
            await pool.query('UPDATE users SET profile_image = $1 WHERE id = $2', [imageUrl, userId]);

            // Delete old image if it exists and is local
            if (oldImage && oldImage.startsWith('/uploads/')) {
                const oldPath = path.join(__dirname, '../../', oldImage);
                if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath);
                }
            }

            res.json({ message: 'Profile image updated', imageUrl });
        } catch (error) {
            console.error('Upload image error:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    // Remove Profile Picture
    removeProfileImage: async (req: Request, res: Response) => {
        // @ts-ignore
        const userId = req.user.id;

        try {
            const userRes = await pool.query('SELECT profile_image FROM users WHERE id = $1', [userId]);
            const oldImage = userRes.rows[0]?.profile_image;

            await pool.query('UPDATE users SET profile_image = NULL WHERE id = $1', [userId]);

            if (oldImage && oldImage.startsWith('/uploads/')) {
                const oldPath = path.join(__dirname, '../../', oldImage);
                if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath);
                }
            }

            res.json({ message: 'Profile image removed' });
        } catch (error) {
            console.error('Remove image error:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    // Change Password
    changePassword: async (req: Request, res: Response) => {
        const { oldPassword, currentPassword, newPassword } = req.body;
        // @ts-ignore
        const userId = req.user.id;

        const providedOldPassword = oldPassword || currentPassword;

        if (!providedOldPassword || !newPassword) {
            return res.status(400).json({ message: 'Both old and new passwords are required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'New password must be at least 6 characters' });
        }

        try {
            const userRes = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
            const user = userRes.rows[0];

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            const isValid = await bcrypt.compare(providedOldPassword, user.password_hash);
            if (!isValid) {
                return res.status(400).json({ message: 'Incorrect old password' });
            }

            const newHash = await bcrypt.hash(newPassword, 10);
            await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, userId]);

            res.json({ message: 'Password changed successfully' });
        } catch (error) {
            console.error('Change password error:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }
};
