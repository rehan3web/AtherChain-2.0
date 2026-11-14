'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, RefreshCw, CheckCircle2, SwitchCamera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DocumentUploadProps {
    label: string;
    onFileChange: (file: File | null) => void;
    file: File | null;
    className?: string;
}

export function DocumentUpload({ label, onFileChange, file, className }: DocumentUploadProps) {
    const [mode, setMode] = useState<'selection' | 'upload' | 'camera'>('selection');
    const [isCapturing, setIsCapturing] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

    const stopCamera = () => {
        stream?.getTracks().forEach(t => t.stop());
        setStream(null);
        setIsCapturing(false);
    };

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    const startCamera = async (modeOverride?: 'user' | 'environment') => {
        try {
            const mode = modeOverride || facingMode;
            // Stop current stream before starting a new one
            if (stream) {
                stream.getTracks().forEach(t => t.stop());
            }

            const constraints = {
                video: {
                    facingMode: { ideal: mode },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };
            const s = await navigator.mediaDevices.getUserMedia(constraints);
            setStream(s);
            if (modeOverride) setFacingMode(modeOverride);
            setIsCapturing(true);
            setMode('camera');
        } catch (err) {
            console.error('Camera access error:', err);
            try {
                const s = await navigator.mediaDevices.getUserMedia({ video: true });
                setStream(s);
                setIsCapturing(true);
                setMode('camera');
            } catch (fallbackErr) {
                console.error('Fallback camera error:', fallbackErr);
                alert('Camera access denied or not available.');
                setMode('selection');
            }
        }
    };

    const switchCamera = async () => {
        const newMode = facingMode === 'user' ? 'environment' : 'user';
        await startCamera(newMode);
    };

    const capture = () => {
        if (!videoRef.current) return;
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0);
            canvas.toBlob(blob => {
                if (blob) {
                    const capturedFile = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
                    onFileChange(capturedFile);
                    setMode('selection');
                    stopCamera();
                }
            }, 'image/jpeg', 0.95);
        }
    };

    const handleLocalUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            onFileChange(selectedFile);
            setMode('selection');
        }
    };

    useEffect(() => {
        return () => stopCamera();
    }, []);

    // Helper to render the common label
    const LabelHeader = () => <Label className="text-muted-foreground block mb-3">{label}</Label>;

    if (file) {
        return (
            <div className={cn("space-y-3", className)}>
                <LabelHeader />
                <div className="relative h-48 w-full group overflow-hidden border border-border bg-card">
                    <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" alt={label} />
                    <div className="absolute inset-0 bg-background/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <Button
                            type="button"
                            variant="ghost"
                            className="text-foreground hover:bg-foreground/10 gap-2"
                            onClick={() => onFileChange(null)}
                        >
                            <RefreshCw size={20} />
                            <span className="font-medium">Change Photo</span>
                        </Button>
                    </div>
                    {/* Verified Badge (always visible until hover implies change) */}
                    <div className="absolute top-2 right-2 group-hover:opacity-0 transition-opacity">
                        <CheckCircle2 className="text-foreground fill-green-500" size={24} />
                    </div>
                </div>
            </div>
        );
    }

    if (mode === 'camera') {
        return (
            <div className={cn("space-y-3", className)}>
                <LabelHeader />
                <div className="relative h-64 w-full border border-border bg-background overflow-hidden">
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={cn(
                            "w-full h-full object-cover transform",
                            facingMode === 'user' && "scale-x-[-1]"
                        )}
                    />

                    <div className="absolute top-4 right-4 z-20">
                        <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            className="rounded-full bg-background/20 backdrop-blur-md border border-white/20 hover:bg-background/40"
                            onClick={switchCamera}
                        >
                            <SwitchCamera className="h-5 w-5 text-white" />
                        </Button>
                    </div>

                    <div className="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-6 z-20">
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="bg-secondary text-foreground border border-border hover:bg-secondary/80"
                            onClick={() => { stopCamera(); setMode('selection'); }}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            size="icon"
                            className="h-14 w-14 rounded-full border-4 border-muted-foreground/30 bg-foreground hover:opacity-90 transition-opacity"
                            onClick={capture}
                        >
                            <div className="h-10 w-10 bg-transparent rounded-full" />
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={cn("space-y-3", className)}>
            <LabelHeader />
            <div className="h-48 w-full border border-dashed border-border bg-card flex flex-col items-center justify-center transition-all duration-300 hover:border-foreground/30 hover:bg-secondary/50 group">
                <div className="flex flex-col items-center gap-4 w-full px-6">
                    <div className="flex gap-4 w-full">
                        <div className="flex-1 relative">
                            <Input
                                type="file"
                                accept="image/*"
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                                onChange={handleLocalUpload}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full h-12 border-border bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary gap-2 rounded-none"
                            >
                                <Upload size={16} />
                                Upload File
                            </Button>
                        </div>
                        <div className="flex-1">
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full h-12 border-border bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary gap-2 rounded-none"
                                onClick={() => startCamera()}
                            >
                                <Camera size={16} />
                                Take Photo
                            </Button>
                        </div>
                    </div>
                    <p className="text-muted-foreground/60 text-xs uppercase tracking-widest text-center">
                        Supports JPG, PNG • Max 5MB
                    </p>
                </div>
            </div>
        </div>
    );
}
