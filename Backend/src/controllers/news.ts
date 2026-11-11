
import { Request, Response } from 'express';
import News from '../models/News';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// --- Multer Configuration for News ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads/news';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req: any, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `news-${uniqueSuffix}${ext}`);
    }
});

const fileFilter = (req: any, file: any, cb: any) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPG, PNG, and WEBP allowed.'), false);
    }
};

export const newsUpload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// --- Controller Methods ---

/**
 * Create a News Post (Admin Only)
 */
export const createNews = async (req: Request, res: Response) => {
    try {
        const { title, description } = req.body;
        const file = req.file;
        const user = (req as any).user;

        if (!title || !description) {
            return res.status(400).json({ message: 'Title and description are required' });
        }

        const createdBy = user.id;
        const imageUrl = file ? file.filename : undefined;

        const news = await News.create({
            title,
            description,
            imageUrl,
            createdBy
        });

        res.status(201).json({
            message: 'News post created',
            post: {
                id: news._id,
                title: news.title,
                description: news.description,
                image_url: news.imageUrl,
                created_at: news.createdAt
            }
        });

    } catch (error) {
        console.error('Create News Error:', error);
        res.status(500).json({ message: 'Failed to create news post' });
    }
};

/**
 * List News (Public/User)
 * Supports pagination via pageState (using skip/limit for now, or just limit as per old code)
 */
export const listNews = async (req: Request, res: Response) => {
    try {
        const pageState = req.query.pageState as string | undefined;
        const pageSize = 5;
        const skip = pageState ? parseInt(pageState) : 0;

        const posts = await News.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pageSize);

        // Check if there are more
        const count = await News.countDocuments();
        const nextState = (skip + pageSize < count) ? String(skip + pageSize) : null;

        const mappedPosts = posts.map(row => ({
            id: row._id,
            title: row.title,
            description: row.description,
            image_url: row.imageUrl,
            created_at: row.createdAt,
            updated_at: row.updatedAt
        }));

        res.json({
            posts: mappedPosts,
            pageState: nextState // Return offset for next page
        });

    } catch (error) {
        console.error('List News Error:', error);
        res.status(500).json({ message: 'Failed to fetch news' });
    }
};

/**
 * Update News (Admin Only)
 */
export const updateNews = async (req: Request, res: Response) => {
    try {
        const { id } = req.params as { id: string };
        const { title, description } = req.body;
        const file = req.file;

        const updateData: any = {};
        if (title) updateData.title = title;
        if (description) updateData.description = description;
        if (file) updateData.imageUrl = file.filename;

        const news = await News.findByIdAndUpdate(id, updateData, { new: true });

        if (!news) {
            return res.status(404).json({ message: 'News post not found' });
        }

        res.json({ message: 'News post updated', post: news });

    } catch (error) {
        console.error('Update News Error:', error);
        res.status(500).json({ message: 'Failed to update news post' });
    }
};

/**
 * Delete News (Admin Only)
 */
export const deleteNews = async (req: Request, res: Response) => {
    try {
        const { id } = req.params as { id: string };

        const news = await News.findById(id);
        if (!news) {
            return res.status(404).json({ message: 'News post not found' });
        }

        // Delete image file if exists
        if (news.imageUrl) {
            const filePath = path.join('uploads/news', news.imageUrl);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        await News.findByIdAndDelete(id);

        res.json({ message: 'News post deleted' });

    } catch (error) {
        console.error('Delete News Error:', error);
        res.status(500).json({ message: 'Failed to delete news post' });
    }
};
