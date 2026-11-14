import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface StatusIndicatorProps {
    status: 'active' | 'idle' | 'warning' | 'offline';
    label?: string;
    className?: string;
}

export const StatusIndicator = ({ status, label, className }: StatusIndicatorProps) => {
    const getStatusColor = (s: string) => {
        switch (s) {
            case 'active': return 'bg-foreground'; // Visible in both dark/light (as opposite of bg)
            case 'warning': return 'bg-yellow-500';
            case 'offline': return 'bg-destructive';
            default: return 'bg-muted-foreground';
        }
    };

    return (
        <div className={cn("flex items-center gap-2", className)}>
            <div className="relative flex items-center justify-center w-3 h-3">
                {status === 'active' && (
                    <motion.div
                        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute inset-0 rounded-full bg-foreground opacity-20"
                    />
                )}
                <div className={cn("w-1.5 h-1.5 rounded-full", getStatusColor(status))} />
            </div>
            {label && <span className="text-xs font-mono text-muted-foreground uppercase">{label}</span>}
        </div>
    );
};
