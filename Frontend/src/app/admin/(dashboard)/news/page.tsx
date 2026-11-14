
'use client';

import { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Plus, Edit2, Trash2, Image as ImageIcon, Search, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { useAlert } from '@/providers/AlertProvider';
import { Badge } from '@/components/ui/badge';

interface NewsPost {
    id: string;
    title: string;
    description: string;
    image_url: string | null;
    created_at: string;
    updated_at: string;
}

export default function AdminNewsPage() {
    const [posts, setPosts] = useState<NewsPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [pageState, setPageState] = useState<string | null>(null);

    // Create/Edit State
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingPost, setEditingPost] = useState<NewsPost | null>(null);
    const [formData, setFormData] = useState({ title: '', description: '' });
    const [file, setFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const { showAlert } = useAlert();

    // Delete State
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [postToDelete, setPostToDelete] = useState<NewsPost | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchNews = async () => {
        try {
            setLoading(true);
            const res = await api.get('/news'); // Using public list for list view
            setPosts(res.data.posts);
            setPageState(res.data.pageState);
        } catch (error) {
            showAlert('danger', 'Failed to fetch news');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNews();
    }, []);

    const handleSubmit = async () => {
        if (!formData.title || !formData.description) {
            showAlert('warning', 'Title and description are required');
            return;
        }

        setSubmitting(true);
        const data = new FormData();
        data.append('title', formData.title);
        data.append('description', formData.description);
        if (file) {
            data.append('image', file);
        }

        try {
            const token = localStorage.getItem('admin_token');
            const config = { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } };

            if (editingPost) {
                // Update
                data.append('created_at', editingPost.created_at); // Required for PK
                await api.put(`/news/admin/${editingPost.id}`, data, config);
                showAlert('success', 'Post updated successfully');
            } else {
                // Create
                await api.post('/news/admin', data, config);
                showAlert('success', 'Post created successfully');
            }

            setIsDialogOpen(false);
            setEditingPost(null);
            setFormData({ title: '', description: '' });
            setFile(null);
            fetchNews();
        } catch (error) {
            console.error(error);
            showAlert('danger', 'Operation failed');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!postToDelete) return;

        setSubmitting(true);
        try {
            const token = localStorage.getItem('admin_token');
            // Assuming delete endpoint expects created_at as query param
            await api.delete(`/news/admin/${postToDelete.id}`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { created_at: postToDelete.created_at }
            });
            showAlert('success', 'Post deleted successfully');
            setIsDeleteOpen(false);
            setPostToDelete(null);
            fetchNews();
        } catch (error) {
            console.error(error);
            showAlert('danger', 'Failed to delete post');
        } finally {
            setSubmitting(false);
        }
    };

    const openCreate = () => {
        setEditingPost(null);
        setFormData({ title: '', description: '' });
        setFile(null);
        setIsDialogOpen(true);
    };

    const openEdit = (post: NewsPost) => {
        setEditingPost(post);
        setFormData({ title: post.title, description: post.description });
        setFile(null);
        setIsDialogOpen(true);
    };

    const openDelete = (post: NewsPost) => {
        setPostToDelete(post);
        setIsDeleteOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Manage News & Updates</h1>
                    <p className="text-muted-foreground">Publish and manage announcements.</p>
                </div>
                <Button onClick={openCreate} className="w-full md:w-auto h-12 md:h-10 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20">
                    <Plus className="w-4 h-4 mr-2" /> Create Post
                </Button>
            </div>

            {/* Content Section */}
            <div className="space-y-4">
                {/* Desktop View */}
                <Card className="hidden @[48rem]/main:block border-border bg-card shadow-sm rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-b border-border bg-muted/50 hover:bg-muted/50">
                                    <TableHead className="w-[100px] text-[10px] font-black uppercase tracking-widest">Visual</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Headline</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Date</TableHead>
                                    <TableHead className="text-right text-[10px] font-black uppercase tracking-widest">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody className="divide-y divide-border/10">
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-40 text-center">
                                            <Loader2 className="animate-spin w-6 h-6 mx-auto text-primary" />
                                        </TableCell>
                                    </TableRow>
                                ) : posts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-40 text-center text-muted-foreground font-mono uppercase tracking-widest opacity-40">
                                            No posts available
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    posts.map((post) => (
                                        <TableRow key={post.id} className="group hover:bg-muted/20 transition-colors">
                                            <TableCell>
                                                {post.image_url ? (
                                                    <div className="w-12 h-12 rounded-lg overflow-hidden border border-border shadow-sm group-hover:border-primary/30 transition-colors">
                                                        <img
                                                            src={`${api.defaults.baseURL}/uploads/news/${post.image_url}`}
                                                            alt=""
                                                            className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center border border-border">
                                                        <ImageIcon className="w-5 h-5 text-muted-foreground opacity-30" />
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="font-bold tracking-tight max-w-[400px]">
                                                <div className="truncate" title={post.title}>{post.title}</div>
                                                <div className="text-[10px] text-muted-foreground font-mono truncate opacity-60">ID: {post.id.slice(-8).toUpperCase()}</div>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground font-mono text-xs uppercase opacity-70">
                                                {format(new Date(post.created_at), 'MMM dd, yyyy')}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-x-1 group-hover:translate-x-0">
                                                    <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg" onClick={() => openEdit(post)}>
                                                        <Edit2 className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive/10 rounded-lg" onClick={() => openDelete(post)}>
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </Card>

                {/* Mobile View */}
                <div className="block @[48rem]/main:hidden space-y-4">
                    {loading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <Card key={i} className="h-32 animate-pulse bg-muted/10 border-border rounded-xl" />
                        ))
                    ) : posts.length === 0 ? (
                        <div className="py-20 text-center text-muted-foreground font-mono uppercase tracking-widest text-xs opacity-40">
                            No posts available
                        </div>
                    ) : (
                        posts.map((post) => (
                            <Card key={post.id} className="p-4 bg-card border-border shadow-sm rounded-xl flex gap-4 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-2 z-10">
                                    <div className="flex gap-1">
                                        <Button variant="secondary" size="icon" className="h-8 w-8 bg-background/80 backdrop-blur-sm border border-border" onClick={() => openEdit(post)}>
                                            <Edit2 className="w-3 h-3" />
                                        </Button>
                                        <Button variant="secondary" size="icon" className="h-8 w-8 bg-destructive/10 backdrop-blur-sm border border-destructive/20 text-destructive" onClick={() => openDelete(post)}>
                                            <Trash2 className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="w-20 h-20 rounded-lg overflow-hidden border border-border shrink-0">
                                    {post.image_url ? (
                                        <img
                                            src={`${api.defaults.baseURL}/uploads/news/${post.image_url}`}
                                            alt=""
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-muted flex items-center justify-center">
                                            <ImageIcon className="w-6 h-6 text-muted-foreground opacity-20" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0 space-y-1 py-1">
                                    <div className="text-xs font-mono text-primary uppercase tracking-widest">
                                        {format(new Date(post.created_at), 'MM.dd.yy')}
                                    </div>
                                    <h3 className="text-sm font-bold text-foreground leading-tight line-clamp-2 tracking-tight">
                                        {post.title}
                                    </h3>
                                    <div className="text-[9px] text-muted-foreground font-mono uppercase opacity-50 truncate">
                                        ID {post.id.slice(-6)}
                                    </div>
                                </div>
                            </Card>
                        )
                        ))}
                </div>
            </div>

            {/* Create/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>{editingPost ? 'Edit Post' : 'Create New Post'}</DialogTitle>
                        <DialogDescription>
                            {editingPost ? 'Update existing announcement.' : 'Publish a new announcement to all users.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Title</label>
                            <Input
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                placeholder="Enter post title"
                            />
                        </div>
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Description</label>
                            <Textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Enter detailed description"
                                className="min-h-[150px]"
                            />
                        </div>
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Image (Optional)</label>
                            <Input
                                type="file"
                                accept="image/*"
                                onChange={(e) => setFile(e.target.files?.[0] || null)}
                            />
                            {editingPost?.image_url && !file && (
                                <p className="text-xs text-muted-foreground">Current image will be kept if left blank.</p>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSubmit} disabled={submitting}>
                            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {editingPost ? 'Update Post' : 'Publish Post'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Post</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete <span className="font-bold">{postToDelete?.title}</span>? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={submitting}>
                            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Delete Permanently
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
