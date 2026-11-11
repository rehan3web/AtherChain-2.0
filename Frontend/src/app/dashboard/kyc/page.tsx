'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ShieldCheck, CheckCircle2, Clock, ChevronRight, User, Fingerprint,
    AlertCircle, ScanFace, FileText, MapPin, Loader2,
    Calendar,
    ArrowLeft,
    Check
} from 'lucide-react';
import api from '@/lib/api';

import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from '@/components/ui/card';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

// Custom Components
import { CountrySelect } from '@/components/ui/CountrySelect';
import { DocumentUpload } from './components/DocumentUpload';
import dynamic from 'next/dynamic';
const FaceVerification = dynamic(() => import('./components/FaceVerification').then(mod => mod.FaceVerification), {
    loading: () => (
        <div className="h-[400px] w-full flex flex-col items-center justify-center space-y-4 border border-dashed border-border rounded-xl bg-card/10">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Initializing Face Scan Engine...</p>
        </div>
    ),
    ssr: false
});
import { DatePicker } from '@/components/ui/date-picker';
import React from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { KYCReceipt } from './components/KYCReceipt';
import { KYCRequirements } from './components/KYCRequirements';

// Validation Schema
const kycSchema = z.object({
    // Step 1: Personal
    full_name: z.string().min(2, "Full name is required"),
    father_name: z.string().min(2, "Father/Spouse name is required"),
    country_code: z.string().min(1, "Country is required"),
    country: z.string().min(1, "Country is required"),
    city: z.string().min(2, "City is required"),
    address: z.string().min(5, "Full address is required"),

    // Step 2: ID
    id_type: z.string().min(1, "ID Type is required"),
    id_number: z.string().min(5, "ID Number is required"),
    id_expiry: z.string().min(1, "ID expiry date is required"),

    // New Fields
    dob: z.string().min(1, "Date of birth is required"),
    language: z.string().min(2, "Language is required"),

    // Step 3: Face (handled separately via state but validated before submit)
});

type KYCFormData = z.infer<typeof kycSchema>;

// Shared Minimal Input Component
const MinimalInput = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
    ({ className, ...props }, ref) => {
        return (
            <input
                className={cn(
                    "flex h-14 w-full border-b border-border bg-transparent px-0 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:border-foreground disabled:cursor-not-allowed disabled:opacity-50 text-foreground transition-colors",
                    className
                )}
                ref={ref}
                {...props}
            />
        )
    }
)
MinimalInput.displayName = "MinimalInput"

export default function KYCPage() {
    const [statusData, setStatusData] = useState<any>(null);
    const [config, setConfig] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [step, setStep] = useState(1);
    const [submitting, setSubmitting] = useState(false);

    // File States (separate from RHF for now, easier to handle blobs)
    const [files, setFiles] = useState<{ [key: string]: File | null }>({
        id_front: null,
        id_back: null,
    });

    const [faceScanData, setFaceScanData] = useState<{ frame: string | null, score: number, logs: any[] }>({
        frame: null,
        score: 0,
        logs: []
    });

    const form = useForm<KYCFormData>({
        resolver: zodResolver(kycSchema),
        defaultValues: {
            full_name: '',
            father_name: '',
            country: 'Pakistan',
            country_code: 'PK',
            city: '',
            address: '',
            id_type: 'CNIC',
            id_number: '',
            id_expiry: '',
            dob: '',
            language: 'English'
        },
        mode: 'onChange'
    });

    const fetchStatus = async () => {
        try {
            const [statusRes, configRes] = await Promise.all([
                api.get('/user/kyc/status'),
                api.get('/user/kyc/config')
            ]);
            setStatusData(statusRes.data);
            setConfig(configRes.data);
            if (configRes.data.idTypes.length > 0) {
                form.setValue('id_type', configRes.data.idTypes[0].id);
            }
        } catch (error) {
            console.error('Failed to fetch KYC context');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
    }, []);

    const handleNextStep = async () => {
        let fieldsToValidate: (keyof KYCFormData)[] = [];
        if (step === 1) {
            fieldsToValidate = ['full_name', 'father_name', 'country_code', 'city', 'address', 'dob', 'language'];
        } else if (step === 2) {
            fieldsToValidate = ['id_type', 'id_number', 'id_expiry'];
            if (!files.id_front || !files.id_back) {
                alert("Please upload both ID documents.");
                return;
            }
        }

        const isValid = await form.trigger(fieldsToValidate);
        if (isValid) {
            setStep(prev => prev + 1);
        }
    };

    const handleFaceScanComplete = async (data: { frame: string, score: number, logs: any[] }) => {
        setFaceScanData(data);
        // Add a small delay for UX
        setTimeout(() => {
            handleSubmit(data);
        }, 1500);
    };

    const handleSubmit = async (finalFaceData?: typeof faceScanData) => {
        const faceData = finalFaceData || faceScanData;
        if (!files.id_front || !files.id_back || !faceData.frame) {
            return alert('All identity documents and face scan are required.');
        }

        setSubmitting(true);
        const data = new FormData();
        const values = form.getValues();

        Object.entries(values).forEach(([key, val]) => data.append(key, val));
        Object.entries(files).forEach(([key, val]) => {
            if (val) data.append(key, val);
        });

        data.append('face_scan_frame', faceData.frame!);
        data.append('verification_score', faceData.score.toString());
        data.append('verification_logs', JSON.stringify(faceData.logs));

        try {
            await api.post('/user/kyc/submit', data);
            fetchStatus();
            setStep(1); // Reset or let component re-render with pending status
        } catch (error: any) {
            console.error('KYC Submission Error:', error);
            alert(error.response?.data?.message || 'Submission failed. Please check your connection and try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center space-y-4 text-foreground">
                <Loader2 className="w-12 h-12 text-foreground animate-spin" />
                <p className="text-xs font-mono tracking-widest text-muted-foreground uppercase">Loading Profile Context...</p>
            </div>
        );
    }

    // Status View (Pending/Approved/Rejected)
    if ((statusData?.status === 'pending' || statusData?.status === 'approved' || statusData?.status === 'rejected') && step === 1 && !statusData?.isRetrying) {
        // If rejected and we are not retrying, show the receipt
        // If we are retrying (user clicked retry), we should show the form (which is below this block)
        if (statusData.status === 'rejected' && submitting) {
            // If submitting, show loading or form, handled below
        } else {
            return (
                <div className="min-h-screen bg-background text-foreground flex items-start justify-center pt-6 pb-4 px-4 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(var(--foreground-rgb),0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(var(--foreground-rgb),0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

                    <KYCReceipt
                        status={statusData.status}
                        data={statusData}
                        onRetry={() => {
                            // Reset state to allow retry
                            setStatusData((prev: any) => ({ ...prev, isRetrying: true }));
                            // Pre-fill form if needed, or clear it
                        }}
                    />
                </div>
            );
        }
    }

    // Eligibility Check (New)
    if (statusData?.eligibility && !statusData.eligibility.eligible) {
        return (
            <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-[linear-gradient(rgba(var(--foreground-rgb),0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(var(--foreground-rgb),0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
                <KYCRequirements
                    eligibility={statusData.eligibility}
                    onRefresh={fetchStatus}
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col">
            <header className="border-b border-border p-6 flex justify-between items-center bg-background/50 backdrop-blur sticky top-0 z-50">
                <div className="text-xl font-bold tracking-tight">KYC Verification</div>
                <div className="flex items-center gap-2">
                    {[1, 2, 3].map((s) => (
                        <div key={s} className="flex items-center">
                            <div className={cn(
                                "w-2.5 h-2.5 rounded-full transition-all duration-300",
                                step >= s ? "bg-foreground scale-110" : "bg-secondary"
                            )} />
                            {s < 3 && <div className={cn("w-8 h-[1px] mx-2", step > s ? "bg-muted-foreground" : "bg-muted")} />}
                        </div>
                    ))}
                </div>
            </header>

            <main className="flex-1 flex flex-col items-center justify-center p-6 relative">
                {/* Background Grid */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(var(--foreground-rgb),0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(var(--foreground-rgb),0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

                <div className="w-full max-w-2xl z-10">
                    {/* Rejection Notice - Only show when retrying */}
                    {statusData?.status === 'rejected' && statusData?.isRetrying && step === 1 && (
                        <div className="mb-8 p-6 bg-red-950/30 border border-red-900/50 rounded-lg flex items-start gap-4">
                            <AlertCircle className="text-red-500 w-6 h-6 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="text-base font-bold text-red-500 uppercase tracking-wide">Verification Failed</h4>
                                <p className="text-sm text-red-300/80 mt-1 leading-relaxed">{statusData.rejectionReason}</p>
                            </div>
                        </div>
                    )}

                    <Form {...form}>
                        <form className="space-y-6">
                            <AnimatePresence mode="wait">
                                {step === 1 && (
                                    <motion.div
                                        key="step1"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        transition={{ duration: 0.4 }}
                                        className="space-y-8"
                                    >
                                        <div className="space-y-2">
                                            <h2 className="text-3xl font-bold tracking-tight">Personal Information</h2>
                                            <p className="text-muted-foreground">Please enter your details exactly as they appear on your ID.</p>
                                        </div>

                                        <div className="space-y-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                <FormField
                                                    control={form.control}
                                                    name="full_name"
                                                    render={({ field }) => (
                                                        <FormItem className="space-y-1">
                                                            <FormLabel className="text-muted-foreground">Full Name</FormLabel>
                                                            <FormControl>
                                                                <MinimalInput placeholder="John Doe" {...field} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="father_name"
                                                    render={({ field }) => (
                                                        <FormItem className="space-y-1">
                                                            <FormLabel className="text-muted-foreground">Father/Spouse Name</FormLabel>
                                                            <FormControl>
                                                                <MinimalInput placeholder="Father Name" {...field} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                <FormField
                                                    control={form.control}
                                                    name="dob"
                                                    render={({ field }) => (
                                                        <FormItem className="space-y-1">
                                                            <FormLabel className="text-muted-foreground">Date of Birth</FormLabel>
                                                            <FormControl>
                                                                <DatePicker
                                                                    value={field.value}
                                                                    onChange={(date) => field.onChange(date?.toISOString().split('T')[0])}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="language"
                                                    render={({ field }) => (
                                                        <FormItem className="space-y-1">
                                                            <FormLabel className="text-muted-foreground">Preferred Language</FormLabel>
                                                            <FormControl>
                                                                <MinimalInput placeholder="e.g. English, French" {...field} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>

                                            <FormField
                                                control={form.control}
                                                name="country_code"
                                                render={({ field }) => (
                                                    <FormItem className="space-y-1">
                                                        <FormLabel className="text-muted-foreground">Nationality</FormLabel>
                                                        <FormControl>
                                                            <CountrySelect
                                                                value={field.value}
                                                                onChange={(c) => {
                                                                    form.setValue('country', c.name);
                                                                    form.setValue('country_code', c.code);
                                                                }}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                <FormField
                                                    control={form.control}
                                                    name="city"
                                                    render={({ field }) => (
                                                        <FormItem className="space-y-1">
                                                            <FormLabel className="text-muted-foreground">City</FormLabel>
                                                            <FormControl>
                                                                <MinimalInput placeholder="New York" {...field} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="address"
                                                    render={({ field }) => (
                                                        <FormItem className="space-y-1">
                                                            <FormLabel className="text-muted-foreground">Residential Address</FormLabel>
                                                            <FormControl>
                                                                <MinimalInput placeholder="123 Street Name" {...field} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {step === 2 && (
                                    <motion.div
                                        key="step2"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        transition={{ duration: 0.4 }}
                                        className="space-y-8"
                                    >
                                        <div className="space-y-2">
                                            <h2 className="text-3xl font-bold tracking-tight">Identity Documents</h2>
                                            <p className="text-muted-foreground">Provide official government documentation.</p>
                                        </div>

                                        <div className="space-y-8">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                <FormField
                                                    control={form.control}
                                                    name="id_type"
                                                    render={({ field }) => (
                                                        <FormItem className="space-y-1">
                                                            <FormLabel className="text-muted-foreground">Document Type</FormLabel>
                                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                                <FormControl>
                                                                    <SelectTrigger className="w-full border-b border-border rounded-none bg-transparent px-0 py-6 focus:ring-0 focus:border-foreground text-foreground">
                                                                        <SelectValue placeholder="Select ID Type" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent className="bg-card border-border text-foreground">
                                                                    {config?.idTypes.map((t: any) => (
                                                                        <SelectItem key={t.id} value={t.id} className="focus:bg-zinc-900 focus:text-white cursor-pointer">{t.label}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="id_number"
                                                    render={({ field }) => (
                                                        <FormItem className="space-y-1">
                                                            <FormLabel className="text-muted-foreground">Document Number</FormLabel>
                                                            <FormControl>
                                                                <MinimalInput placeholder="XXXXXXXX" {...field} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                <FormField
                                                    control={form.control}
                                                    name="id_expiry"
                                                    render={({ field }) => (
                                                        <FormItem className="space-y-1">
                                                            <FormLabel className="text-muted-foreground">ID Expiry Date</FormLabel>
                                                            <FormControl>
                                                                <DatePicker
                                                                    value={field.value}
                                                                    onChange={(date) => field.onChange(date?.toISOString().split('T')[0])}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>

                                            <div className="space-y-6">
                                                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                                    Document Scans
                                                </h3>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <DocumentUpload
                                                        label="Front Side"
                                                        file={files.id_front}
                                                        onFileChange={(f) => setFiles(prev => ({ ...prev, id_front: f }))}
                                                    />
                                                    <DocumentUpload
                                                        label="Back Side"
                                                        file={files.id_back}
                                                        onFileChange={(f) => setFiles(prev => ({ ...prev, id_back: f }))}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {step === 3 && (
                                    <motion.div
                                        key="step3"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                    >
                                        <FaceVerification
                                            onComplete={handleFaceScanComplete}
                                            onReset={() => setFaceScanData({ frame: null, score: 0, logs: [] })}
                                            isVerified={!!faceScanData.frame}
                                            isSubmitting={submitting}
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Bottom Navigation */}
                            <div className="pt-8 flex justify-between items-center border-t border-zinc-900/50 mt-8">
                                {step > 1 && !submitting && step < 3 ? (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setStep(prev => prev - 1)}
                                        className="rounded-none h-14 px-8 border-border text-muted-foreground hover:text-foreground hover:bg-secondary bg-transparent"
                                    >
                                        <ArrowLeft className="mr-2 w-5 h-5" /> Back
                                    </Button>
                                ) : <div />}

                                {step < 3 ? (
                                    <Button
                                        type="button"
                                        size="lg"
                                        onClick={handleNextStep}
                                        className="rounded-none bg-foreground text-background hover:opacity-90 h-14 px-8 text-lg font-medium tracking-wide"
                                    >
                                        Next Step <ChevronRight className="ml-2 w-5 h-5" />
                                    </Button>
                                ) : null}
                            </div>
                        </form>
                    </Form>
                </div>
            </main>

            {/* Overlay for submission */}
            {submitting && (
                <div className="fixed inset-0 bg-background/90 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-6 text-center space-y-8">
                    <div className="relative w-32 h-32">
                        <div className="absolute inset-0 border-4 border-secondary rounded-full" />
                        <div className="absolute inset-0 border-4 border-t-foreground rounded-full animate-spin" />
                        <ShieldCheck className="absolute inset-0 m-auto text-foreground" size={48} />
                    </div>
                    <div className="space-y-3">
                        <h3 className="text-3xl font-bold tracking-tighter text-foreground">Verifying Identity</h3>
                        <p className="text-xs text-muted-foreground uppercase tracking-[0.3em] font-mono">Securing Data Channel...</p>
                    </div>
                </div>
            )}
        </div>
    );
}
