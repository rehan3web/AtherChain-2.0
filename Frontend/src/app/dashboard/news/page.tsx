
'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Calendar, ChevronLeft, ChevronRight, Newspaper } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface NewsPost {
    id: string;
    title: string;
    description: string;
    image_url: string | null;
    created_at: string;
    updated_at: string;
}

export default function NewsPage() {
    const [posts, setPosts] = useState<NewsPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [pageState, setPageState] = useState<string | null>(null);
    const [history, setHistory] = useState<(string | null)[]>([]); // To handle "Previous" properly, we'd need a stack of pageStates

    // Note: Scylla/Cassandra pagination is forward-only via pageState. 
    // Implementing "Previous" is tricky without storing the stack of pageStates.
    // For this implementation, we will support "Load More" or simple Next/Reset.

    const fetchNews = async (state: string | null = null) => {
        try {
            setLoading(true);
            const res = await api.get(`/news`, {
                params: { pageState: state }
            });

            // If state is null (first page), replace posts. 
            // If we are implementing "Load More", append. 
            // Requirement says "Pagination: 5 posts per page... Next/Previous".
            // Since standard Next/Prev is hard with Cassandra's stateless paging tokens if we don't cache them,
            // we will simulate pages by keeping track of the pageState stack.

            setPosts(res.data.posts);
            setPageState(res.data.pageState || null); // Next page token
        } catch (error) {
            console.error('Failed to fetch news', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNews();
    }, []);

    const handleNext = () => {
        if (pageState) {
            setHistory(prev => [...prev, pageState]); // Save current next token? No.
            // Actually, we need to save the token *before* the current one to go back.
            // But API returns token for *next* page.
            // Strategy: 
            // Page 1: Check history? No.
            // Let's stick to simple "Next" for now, or just append to history the *current* page token used?
            // Correct way for stateless clients:
            // P1: token=null. Returns next=A.
            // P2: token=A. Returns next=B.
            // To go back to P1, we load token=null.
            // So we need to store the tokens we USED.

            // Let's store the token used to fetch current page in history.
            // But wait, the FIRST page uses null.

            // Current Page 1. fetch(null). Returns next=A. History=[].
            // Click Next -> fetch(A). Returns next=B. History=[null].
            // Click Next -> fetch(B). Returns next=C. History=[null, A].
            // Click Prev -> Pop history (A). fetch(A). ... Wait, A was for P2. 
            // So if we are on P3 (using B), we want to go to P2 (using A).
            // History should be [null, A]. Last item is the token for previous page.

            // Let's implement.

            // Current "cursor" is problematic because `fetchNews` doesn't know "current".
            // Let's refactor `fetchNews` to take the token to use.

            // Actually, simpler: just push the *current used token* to history before fetching next.
            // But we don't strictly have "current used token" stored in state, only `pageState` (next).
            // We need `currentLoadToken`.
        }
    };

    // We need to track the token used to load THIS page.
    const [currentToken, setCurrentToken] = useState<string | null>(null);

    const loadPage = (token: string | null) => {
        // Before loading, if we are moving forward, we should save current?
        // Let's just explicit navigation.
        setCurrentToken(token);
        fetchNews(token);
    };

    const onNext = () => {
        if (pageState) {
            setHistory(prev => [...prev, currentToken]);
            loadPage(pageState);
        }
    };

    const onPrev = () => {
        if (history.length > 0) {
            const prevToken = history[history.length - 1]; // Get last token
            setHistory(prev => prev.slice(0, -1)); // Remove it
            loadPage(prevToken);
        }
    };

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-8">
            <div className="flex items-center gap-3 border-b pb-6 border-border/40">
                <div className="p-3 bg-primary/10 rounded-xl">
                    <Newspaper className="w-8 h-8 text-primary" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">News & Updates</h1>
                    <p className="text-muted-foreground mt-1">Latest announcements from the Ather Network team.</p>
                </div>
            </div>

            {loading && posts.length === 0 ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="animate-spin w-8 h-8 text-primary" />
                </div>
            ) : posts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    No news posts found.
                </div>
            ) : (
                <div className="space-y-6">
                    {posts.map((post) => (
                        <Card key={post.id} className="overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/20 transition-all duration-300">
                            <div className="flex flex-col">
                                {post.image_url && (
                                    <div className="w-full h-[300px] relative shrink-0">
                                        <img
                                            src={`${api.defaults.baseURL}/uploads/news/${post.image_url}`}
                                            alt={post.title}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                )}
                                <div className="flex flex-col flex-1 p-6">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Badge variant="outline" className="text-xs font-mono text-muted-foreground bg-muted/50 border-0">
                                            <Calendar className="w-3 h-3 mr-1" />
                                            {format(new Date(post.created_at), 'PPP')}
                                        </Badge>
                                    </div>
                                    <h2 className="text-2xl font-bold mb-3">{post.title}</h2>
                                    <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap flex-1">
                                        {post.description}
                                    </p>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Pagination Controls */}
            <div className="flex justify-between items-center py-4">
                <Button
                    variant="outline"
                    onClick={onPrev}
                    disabled={history.length === 0 || loading}
                    className="w-[120px]"
                >
                    <ChevronLeft className="w-4 h-4 mr-2" /> Previous
                </Button>

                <span className="text-sm text-muted-foreground font-mono">
                    Page {history.length + 1}
                </span>

                <Button
                    variant="outline"
                    onClick={onNext}
                    disabled={!pageState || loading}
                    className="w-[120px]"
                >
                    Next <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
            </div>
        </div>
    );
}
