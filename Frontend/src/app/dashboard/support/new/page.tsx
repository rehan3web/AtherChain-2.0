
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Send, Upload } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import api from '@/lib/api';

export default function NewTicketPage() {
    const router = useRouter();
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !message) {
            setError('Please fill in all required fields');
            return;
        }

        try {
            setLoading(true);
            setError('');

            const formData = new FormData();
            formData.append('title', title);
            formData.append('message', message);
            if (file) {
                formData.append('image', file);
            }

            // Need to ensure we're using the authenticated create endpoint
            // Our updated route is POST /support/
            await api.post('/support', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            router.push('/dashboard/support');
        } catch (err: any) {
            console.error('Failed to create ticket', err);
            setError(err.response?.data?.message || 'Failed to create ticket. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 p-6 max-w-2xl mx-auto">
            <div className="flex items-center gap-4">
                <Link href="/dashboard/support">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Create New Ticket</h1>
                    <p className="text-muted-foreground">Describe your issue and we'll help you ASAP.</p>
                </div>
            </div>

            <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
                <CardContent className="pt-6">
                    {error && (
                        <Alert variant="destructive" className="mb-6">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="title">Subject <span className="text-red-500">*</span></Label>
                            <Input
                                id="title"
                                placeholder="Brief summary of the issue"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="message">Description <span className="text-red-500">*</span></Label>
                            <Textarea
                                id="message"
                                placeholder="Detailed description of what you're experiencing..."
                                className="min-h-[150px]"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="file">Attachment (Optional)</Label>
                            <div className="flex items-center gap-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => document.getElementById('file-upload')?.click()}
                                    className="w-full justify-start text-muted-foreground"
                                >
                                    <Upload className="mr-2 h-4 w-4" />
                                    {file ? file.name : 'Click to upload image (JPG, PNG)'}
                                </Button>
                                <input
                                    id="file-upload"
                                    type="file"
                                    className="hidden"
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                                />
                                {file && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive hover:text-destructive/90"
                                        onClick={() => setFile(null)}
                                    >
                                        &times;
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <Button type="submit" className="w-full md:w-auto" disabled={loading}>
                                <Send className="mr-2 h-4 w-4" />
                                {loading ? 'Submitting...' : 'Submit Ticket'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
