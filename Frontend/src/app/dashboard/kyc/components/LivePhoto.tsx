'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { captureLivePhoto } from '@/lib/kycPhoto';

interface Props {
    isSubmitting: boolean;
    onCaptured: (frame: string) => Promise<void>;
}

export function LivePhoto({ isSubmitting, onCaptured }: Props) {
    const video = useRef<HTMLVideoElement>(null);
    const stream = useRef<MediaStream | null>(null);
    const mounted = useRef(false);
    const attempt = useRef(0);
    const locked = useRef(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [starting, setStarting] = useState(false);
    const [ready, setReady] = useState(false);
    const [working, setWorking] = useState(false);
    const [photo, setPhoto] = useState('');
    const [error, setError] = useState('');

    const stopCamera = useCallback(() => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        stream.current?.getTracks().forEach(track => track.stop());
        stream.current = null;
        if (video.current) video.current.srcObject = null;
    }, []);

    useEffect(() => {
        mounted.current = true;
        const pause = () => {
            if (!document.hidden) return;
            attempt.current++;
            stopCamera();
            setStarting(false);
            setReady(false);
            setError('Camera paused. Enable the camera again when you return.');
        };
        document.addEventListener('visibilitychange', pause);
        return () => {
            mounted.current = false;
            attempt.current++;
            stopCamera();
            document.removeEventListener('visibilitychange', pause);
        };
    }, [stopCamera]);

    const startCamera = async () => {
        if (starting || locked.current || isSubmitting) return;
        stopCamera();
        const ticket = ++attempt.current;
        setPhoto('');
        setError('');
        setReady(false);
        setStarting(true);
        // Permission prompts can remain open. Do not allow a late result to
        // restart the camera after timeout, navigation or a new attempt.
        timer.current = setTimeout(() => {
            if (!mounted.current || ticket !== attempt.current) return;
            attempt.current++;
            stopCamera();
            setStarting(false);
            setError('The camera did not become ready. Check camera access and try again.');
        }, 15000);
        try {
            if (!navigator.mediaDevices?.getUserMedia) {
                throw new Error('Camera access requires HTTPS and a supported browser.');
            }
            const next = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } }
            });
            if (!mounted.current || ticket !== attempt.current || document.hidden) {
                next.getTracks().forEach(track => track.stop());
                return;
            }
            stream.current = next;
            if (!video.current) throw new Error('Camera preview is unavailable. Try again.');
            video.current.srcObject = next;
            await video.current.play();
        } catch (cause) {
            if (!mounted.current || ticket !== attempt.current) return;
            stopCamera();
            setStarting(false);
            const denied = cause instanceof DOMException && ['NotAllowedError', 'SecurityError'].includes(cause.name);
            setError(denied ? 'Camera access was not allowed. Enable camera access in your browser settings and try again.'
                : cause instanceof Error ? cause.message : 'Could not open the camera. Try again.');
        }
    };

    const submitPhoto = async (frame: string) => {
        if (locked.current || isSubmitting) return;
        locked.current = true;
        setWorking(true);
        setError('');
        try {
            await onCaptured(frame);
        } catch (cause) {
            if (mounted.current) setError(cause instanceof Error ? cause.message : 'Submission failed. Retry or take a new photo.');
        } finally {
            locked.current = false;
            if (mounted.current) setWorking(false);
        }
    };

    const takePhoto = () => {
        if (!ready || !video.current || locked.current || isSubmitting) return;
        try {
            const frame = captureLivePhoto(video.current);
            setPhoto(frame);
            setReady(false);
            stopCamera();
            void submitPhoto(frame);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not take the photo.');
        }
    };

    const busy = starting || working || isSubmitting;
    return (
        <section className="space-y-6 border border-border bg-card p-5 md:p-8" aria-label="One live photo">
            <div className="space-y-2 text-center">
                <h2 className="text-2xl font-semibold">One live photo</h2>
                <p className="text-sm text-muted-foreground">Look straight at the front camera, keep your face clearly visible, then take one photo.</p>
            </div>
            <div className="relative aspect-[3/4] max-w-sm mx-auto overflow-hidden bg-secondary border border-border">
                {photo ? <img src={photo} alt="Your captured KYC photo" className="w-full h-full object-contain" />
                    : <video ref={video} autoPlay playsInline muted
                        className="w-full h-full object-cover -scale-x-100"
                        onLoadedData={() => {
                            if (!stream.current || document.hidden || !mounted.current) return;
                            if (timer.current) clearTimeout(timer.current);
                            timer.current = null;
                            setStarting(false);
                            setReady(true);
                        }}
                        onError={() => {
                            stopCamera();
                            setStarting(false);
                            setReady(false);
                            setError('Camera preview failed. Enable the camera to try again.');
                        }} />}
                {!photo && !ready && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
                    {starting ? <Loader2 className="w-10 h-10 animate-spin" /> : <Camera className="w-12 h-12 text-muted-foreground" />}
                    <p className="text-sm">{starting ? 'Opening camera…' : 'Camera is off'}</p>
                </div>}
            </div>
            {error && <p role="alert" className="text-sm text-destructive text-center">{error}</p>}
            <div className="flex flex-wrap justify-center gap-3">
                {photo ? <>
                    <Button type="button" variant="outline" disabled={busy} onClick={() => void startCamera()}>
                        <RefreshCw className="w-4 h-4 mr-2" /> Retake photo
                    </Button>
                    {error && <Button type="button" disabled={busy} onClick={() => void submitPhoto(photo)}>Retry submission</Button>}
                </> : <Button type="button" disabled={busy}
                    onClick={ready ? takePhoto : () => void startCamera()}>
                    {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
                    {starting ? 'Opening camera…' : ready ? 'Take photo & submit KYC' : 'Enable front camera'}
                </Button>}
            </div>
            <p className="text-sm text-muted-foreground text-center">
                {working || isSubmitting ? 'Submitting your application for manual review…'
                    : 'Taking the photo automatically submits your details and both ID images for manual review. This is not verified biometric liveness.'}
            </p>
        </section>
    );
}
