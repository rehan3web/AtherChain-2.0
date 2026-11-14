'use client';

import React, { useState, useEffect } from 'react';

interface MaintenanceCountdownProps {
    untilDate: string | null;
}

export function MaintenanceCountdown({ untilDate }: MaintenanceCountdownProps) {
    const [timeLeft, setTimeLeft] = useState<{
        days: number;
        hours: number;
        minutes: number;
        seconds: number;
    }>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

    useEffect(() => {
        if (!untilDate) return;

        const timer = setInterval(() => {
            const now = new Date().getTime();
            const target = new Date(untilDate).getTime();
            const distance = target - now;

            if (distance < 0) {
                clearInterval(timer);
                setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
                return;
            }

            setTimeLeft({
                days: Math.floor(distance / (1000 * 60 * 60 * 24)),
                hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
                seconds: Math.floor((distance % (1000 * 60)) / 1000)
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [untilDate]);

    if (!untilDate) return null;

    return (
        <div className="flex gap-4 md:gap-8 justify-center items-center">
            <CountdownBlock value={timeLeft.days} label="Days" />
            <CountdownSeparator />
            <CountdownBlock value={timeLeft.hours} label="Hours" />
            <CountdownSeparator />
            <CountdownBlock value={timeLeft.minutes} label="Mins" />
            <CountdownSeparator />
            <CountdownBlock value={timeLeft.seconds} label="Secs" />
        </div>
    );
}

function CountdownBlock({ value, label }: { value: number, label: string }) {
    return (
        <div className="flex flex-col items-center">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-card border border-border flex items-center justify-center relative overflow-hidden group">
                <div className="absolute inset-0 bg-foreground/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <span className="text-2xl md:text-3xl font-black font-mono text-foreground tracking-tighter">
                    {value.toString().padStart(2, '0')}
                </span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mt-3 font-bold">{label}</span>
        </div>
    );
}

function CountdownSeparator() {
    return (
        <div className="flex flex-col gap-1.5 pt-2">
            <div className="w-1 h-1 bg-foreground/20 rounded-full" />
            <div className="w-1 h-1 bg-foreground/20 rounded-full" />
        </div>
    );
}
