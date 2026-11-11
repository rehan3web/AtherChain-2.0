'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import { toast } from 'sonner';

interface FaceVerificationProps {
    onComplete: (data: { frame: string; score: number; logs: any[] }) => void;
    onReset: () => void;
    isVerified: boolean;
    isSubmitting: boolean;
}

type VerificationStep = 'CENTER' | 'LEFT' | 'RIGHT' | 'DOWN' | 'MOUTH' | 'SUCCESS';

const stepsMeta: Record<VerificationStep, { label: string; key: string, progress: number }> = {
    CENTER: { label: 'Center your face', key: 'center', progress: 20 },
    LEFT: { label: 'Turn slightly LEFT', key: 'left', progress: 40 },
    RIGHT: { label: 'Turn slightly RIGHT', key: 'right', progress: 60 },
    DOWN: { label: 'Look down', key: 'down', progress: 80 },
    MOUTH: { label: 'Open mouth', key: 'mouth', progress: 90 },
    SUCCESS: { label: 'Verified', key: 'success', progress: 100 }
};

export function FaceVerification({ onComplete, onReset, isVerified, isSubmitting }: FaceVerificationProps) {
    const webcamRef = useRef<Webcam>(null);
    const [status, setStatus] = useState('Initializing Models...');
    const [progress, setProgress] = useState(0);
    const [currentStep, setCurrentStep] = useState<VerificationStep>('CENTER');
    const [logs, setLogs] = useState<any[]>([]);
    const [cameraReady, setCameraReady] = useState(false);
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const hasCompleted = useRef(false);

    // Circular Progress Constants
    const radius = 140;
    const stroke = 2;
    const normalizedRadius = radius - stroke * 2;
    const circumference = normalizedRadius * 2 * Math.PI;

    const nextStep = useCallback((step: VerificationStep) => {
        setLogs(prev => [...prev, { action: step, timestamp: Date.now() }]);
        const stepOrder: VerificationStep[] = ['CENTER', 'LEFT', 'RIGHT', 'DOWN', 'MOUTH', 'SUCCESS'];
        const nextIdx = stepOrder.indexOf(currentStep) + 1;
        if (nextIdx < stepOrder.length) {
            setCurrentStep(stepOrder[nextIdx]);
        }
    }, [currentStep]);

    // 1. Load Models from Public Directory
    useEffect(() => {
        let mounted = true;
        const loadModels = async () => {
            try {
                const MODEL_URL = '/models';
                await Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                ]);
                if (mounted) {
                    setModelsLoaded(true);
                    setStatus('Align Face');
                }
            } catch (error) {
                console.error('Failed to load models:', error);
                if (mounted) {
                    setStatus('Model Load Error');
                    toast.error('Failed to load facial recognition models');
                }
            }
        };
        loadModels();
        return () => { mounted = false; };
    }, []);

    // 2. Detection Loop
    useEffect(() => {
        let intervalId: NodeJS.Timeout;

        const detectFace = async () => {
            // Stop if verified, submitting, finished, or already completed
            if (!cameraReady || !modelsLoaded || isVerified || isSubmitting || currentStep === 'SUCCESS' || hasCompleted.current) return;

            if (webcamRef.current && webcamRef.current.video && webcamRef.current.video.readyState === 4) {
                const video = webcamRef.current.video;

                try {
                    // Fast detection with TinyFaceDetector
                    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });
                    const detection = await faceapi.detectSingleFace(video, options).withFaceLandmarks();

                    if (!detection) {
                        if (!status.includes('Turn') && !status.includes('Look') && !status.includes('Open')) {
                            setStatus('Face not detected');
                        }
                        return;
                    }

                    // Face detected, update prompt
                    if (status === 'Face not detected' || status === 'Align Face' || status === 'Initializing Models...') {
                        setStatus(stepsMeta[currentStep].label);
                    }

                    const landmarks = detection.landmarks;
                    const nose = landmarks.getNose()[3]; // Tip of nose
                    const leftEye = landmarks.getLeftEye()[0];
                    const rightEye = landmarks.getRightEye()[3];
                    const mouth = landmarks.getMouth();

                    // Calculate metrics
                    const eyeWidth = Math.abs(rightEye.x - leftEye.x);
                    const noseXRel = (nose.x - leftEye.x) / eyeWidth; // 0.5 is centered
                    const noseYRel = (nose.y - leftEye.y) / eyeWidth;

                    const mouthTop = mouth[13]; // Inner upper lip
                    const mouthBottom = mouth[19]; // Inner lower lip
                    const mouthOpen = Math.abs(mouthBottom.y - mouthTop.y) / eyeWidth;


                    if (currentStep === 'CENTER') {
                        if (noseXRel > 0.4 && noseXRel < 0.6) {
                            nextStep('CENTER');
                        }
                    }
                    else if (currentStep === 'LEFT') {
                        setStatus('Turn Left');
                        if (noseXRel > 0.65) nextStep('LEFT');
                    }
                    else if (currentStep === 'RIGHT') {
                        setStatus('Turn Right');
                        if (noseXRel < 0.35) nextStep('RIGHT');
                    }
                    else if (currentStep === 'DOWN') {
                        setStatus('Look Down');
                        if (noseYRel > 0.5) nextStep('DOWN');
                    }
                    else if (currentStep === 'MOUTH') {
                        setStatus('Open Mouth');
                        if (mouthOpen > 0.2) nextStep('MOUTH');
                    }
                } catch (err) {
                    // console.warn('Detection error:', err);
                }
            }
        };

        intervalId = setInterval(detectFace, 200);

        return () => clearInterval(intervalId);
    }, [cameraReady, modelsLoaded, currentStep, isVerified, isSubmitting, nextStep, status]);


    // Progress handling
    useEffect(() => {
        if (currentStep === 'SUCCESS' && !hasCompleted.current) {
            hasCompleted.current = true; // Guard against double execution
            setProgress(100);
            toast.success('Face Verification Successful!');

            const timer = setTimeout(() => {
                if (webcamRef.current) {
                    const screenshot = webcamRef.current.getScreenshot();
                    if (screenshot) {
                        onComplete({
                            frame: screenshot,
                            score: 0.99,
                            logs
                        });
                    }
                }
            }, 500);
            return () => clearTimeout(timer);
        } else if (currentStep !== 'SUCCESS') {
            setProgress(stepsMeta[currentStep].progress);
        }
    }, [currentStep, onComplete, logs]);


    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center space-y-10 text-center"
        >
            <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tight text-foreground">Face Liveness Check</h2>
                <p className="text-muted-foreground">Follow the instructions to verify your identity.</p>
            </div>

            <div className="relative w-72 h-72 rounded-full flex items-center justify-center">
                {/* Visual Progress Ring */}
                <div className="absolute inset-0 -rotate-90 pointer-events-none z-10 scale-[1.05]">
                    <svg height={radius * 2} width={radius * 2} className="transition-all duration-300">
                        <circle
                            className="stroke-border"
                            fill="transparent"
                            strokeWidth={stroke}
                            r={normalizedRadius}
                            cx={radius}
                            cy={radius}
                        />
                        <circle
                            className="stroke-foreground transition-all duration-300 ease-out"
                            fill="transparent"
                            strokeWidth={stroke}
                            strokeDasharray={circumference + ' ' + circumference}
                            style={{ strokeDashoffset }}
                            r={normalizedRadius}
                            cx={radius}
                            cy={radius}
                        />
                    </svg>
                </div>

                {/* Camera Container */}
                <div className="relative w-full h-full rounded-full overflow-hidden border-4 border-secondary bg-card shadow-2xl shadow-foreground/5">
                    <Webcam
                        ref={webcamRef}
                        audio={false}
                        screenshotFormat="image/jpeg"
                        videoConstraints={{
                            width: 640,
                            height: 640,
                            facingMode: "user"
                        }}
                        onUserMedia={() => setCameraReady(true)}
                        onUserMediaError={(err) => {
                            setStatus('Camera Error');
                            toast.error('Could not access camera');
                        }}
                        className="w-full h-full object-cover transform scale-x-[-1]"
                        mirrored={true}
                    />

                    {/* Face Guide Overlay */}
                    <div className="absolute inset-0 rounded-full border-[20px] border-background/60 pointer-events-none" />

                    {/* Scanning Animation */}
                    {!isVerified && cameraReady && modelsLoaded && !hasCompleted.current && (
                        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-foreground/10 to-transparent translate-y-[-100%] animate-[scan_2s_ease-in-out_infinite]" />
                    )}

                    {/* Success Overlay */}
                    <AnimatePresence>
                        {isVerified && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="absolute inset-0 bg-green-500/20 flex items-center justify-center backdrop-blur-sm"
                            >
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="bg-green-500 text-white p-4 rounded-full"
                                >
                                    <Check className="w-10 h-10" />
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            <div className="h-20 flex flex-col items-center justify-center">
                {isSubmitting ? (
                    <div className="flex items-center gap-3 text-foreground">
                        <Loader2 className="animate-spin w-6 h-6" />
                        <span className="text-xl font-bold uppercase tracking-widest font-mono">Verifying...</span>
                    </div>
                ) : isVerified ? (
                    <div className="flex items-center gap-3 text-green-500">
                        <Check className="w-6 h-6" />
                        <span className="text-xl font-bold uppercase tracking-widest font-mono">Verified</span>
                    </div>
                ) : (
                    <motion.div
                        key={status}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="text-2xl font-mono font-bold text-foreground tracking-widest uppercase"
                    >
                        {status}
                    </motion.div>
                )}
            </div>

            {!isSubmitting && !isVerified && (
                <Button type="button" variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={onReset}>
                    Restart Scan
                </Button>
            )}
        </motion.div>
    );
}
