'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface TokenLogoProps {
    symbol: string;
    className?: string;
    size?: 'sm' | 'md' | 'lg';
}

const COLORS = [
    'bg-blue-500/20 text-blue-500 border-blue-500/30',
    'bg-purple-500/20 text-purple-500 border-purple-500/30',
    'bg-emerald-500/20 text-emerald-500 border-emerald-500/30',
    'bg-amber-500/20 text-amber-500 border-amber-500/30',
    'bg-rose-500/20 text-rose-500 border-rose-500/30',
    'bg-indigo-500/20 text-indigo-500 border-indigo-500/30',
    'bg-cyan-500/20 text-cyan-500 border-cyan-500/30',
];

export function TokenLogo({ symbol, className, size = 'md' }: TokenLogoProps) {
    const [hasError, setHasError] = useState(false);

    const base = symbol.split('-')[0];
    const firstLetter = base.charAt(0).toUpperCase();

    // Simple hash to consistently pick a color based on symbol
    const colorIndex = base.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % COLORS.length;
    const colorClass = COLORS[colorIndex];

    const sizeClasses = {
        sm: 'w-6 h-6 text-[10px]',
        md: 'w-10 h-10 text-xs',
        lg: 'w-16 h-16 text-xl'
    };

    const logoUrl = `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${base.toLowerCase()}.png`;

    if (hasError) {
        return (
            <div className={cn(
                "flex items-center justify-center font-mono font-bold border rounded-sm shrink-0 uppercase tracking-tighter",
                sizeClasses[size],
                colorClass,
                className
            )}>
                {firstLetter}
            </div>
        );
    }

    return (
        <div className={cn("relative shrink-0", sizeClasses[size], className)}>
            <img
                src={logoUrl}
                alt={symbol}
                className="w-full h-full object-contain transition-all duration-300"
                onError={() => setHasError(true)}
            />
        </div>
    );
}
