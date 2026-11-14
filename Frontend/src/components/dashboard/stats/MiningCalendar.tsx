"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Check, X, TrendingUp, Zap } from "lucide-react"

interface MiningCalendarProps {
    minedDates: { date: string; status: string }[];
}

export function MiningCalendar({ minedDates }: MiningCalendarProps) {
    const today = new Date();
    const currentMonthLabel = today.toLocaleString('default', { month: 'long' });
    const year = today.getFullYear();

    const formatDate = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    // Calculate days for the calendar grid
    const days = [];
    const todayStr = formatDate(today);

    // Add empty slots
    const startOfMonth = new Date(year, today.getMonth(), 1);
    const firstDayOfWeek = startOfMonth.getDay();
    for (let i = 0; i < firstDayOfWeek; i++) {
        days.push({ day: null, status: 'empty', isToday: false });
    }

    const endOfMonth = new Date(year, today.getMonth() + 1, 0);
    const daysInMonth = endOfMonth.getDate();

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const dateObj = new Date(year, today.getMonth(), day);
        const dateStr = formatDate(dateObj);
        const isMined = minedDates.some(d => d.date === dateStr);
        const isToday = dateStr === todayStr;
        const isFuture = dateObj.getTime() > today.getTime() && !isToday;

        let status: 'mined' | 'missed' | 'future' | 'today-not-mined';

        if (isMined) {
            status = 'mined';
        } else if (isFuture) {
            status = 'future';
        } else if (isToday) {
            status = 'today-not-mined';
        } else {
            status = 'missed';
        }

        days.push({
            day,
            status,
            isToday
        });
    }

    // Calculate current streak
    const sortedMinedDates = [...minedDates]
        .map(d => d.date)
        .sort((a, b) => b.localeCompare(a));

    let currentStreak = 0;
    let checkDate = new Date(today);

    // If if hasn't mined today, streak might still be active from yesterday
    if (!minedDates.some(d => d.date === todayStr)) {
        checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
        const dateStr = formatDate(checkDate);
        if (minedDates.some(d => d.date === dateStr)) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            break;
        }
    }

    return (
        <Card className="h-full border-primary/10 bg-gradient-to-br from-card to-background">
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-xl font-bold tracking-tight">Mining Calendar</CardTitle>
                        <CardDescription className="text-primary/60 font-medium">
                            {currentMonthLabel} {year}
                        </CardDescription>
                    </div>
                    <div className="px-3 py-1 bg-primary/10 rounded-full border border-primary/20 flex items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Live Streak</span>
                        <span className="text-xs font-black text-primary">{currentStreak}</span>
                    </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Track your daily mining streak and consistency.</p>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold text-muted-foreground/60 mb-3 uppercase tracking-tighter">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                        <div key={i} className="py-1">{d}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                    {days.map((d, i) => (
                        <div
                            key={i}
                            className={cn(
                                "aspect-square flex items-center justify-center rounded-lg border text-xs font-semibold relative transition-all duration-300",
                                d.status === 'mined' ? "bg-green-500/20 border-green-500/40 text-green-500 shadow-[0_0_10px_rgba(34,197,94,0.1)]" :
                                    d.status === 'missed' ? "bg-red-500/10 border-red-500/20 text-red-500/60" :
                                        d.status === 'empty' ? "border-transparent opacity-0" :
                                            d.status === 'future' ? "bg-secondary/10 border-border/30 text-transparent" : // Future days are empty
                                                "bg-secondary/30 border-border/50 text-muted-foreground/50",
                                d.isToday && "ring-2 ring-primary ring-offset-2 ring-offset-background scale-105 z-10"
                            )}
                        >
                            {d.status === 'mined' ? (
                                <Check className="w-4 h-4 stroke-[3]" />
                            ) : d.status === 'missed' ? (
                                <X className="w-4 h-4 stroke-[3]" />
                            ) : d.status === 'future' ? (
                                null // Empty for future
                            ) : (
                                <span>{d.day}</span>
                            )}

                            {d.isToday && (
                                <div className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
                            )}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-2 gap-4 mt-8 pt-6 border-t border-border/50">
                    <div className="relative p-3 rounded-xl bg-green-500/5 border border-green-500/10 overflow-hidden group">
                        <div className="absolute top-0 right-0 p-1 opacity-10 group-hover:opacity-20 transition-opacity">
                            <TrendingUp className="w-8 h-8" />
                        </div>
                        <p className="text-[10px] text-green-500/60 font-bold uppercase tracking-wider relative z-10">Network Vitality</p>
                        <p className="text-2xl font-black text-green-500 mt-1 relative z-10">98%</p>
                        <div className="w-full h-1 bg-green-500/10 rounded-full mt-2 relative z-10 overflow-hidden">
                            <div className="h-full bg-green-500 w-[98%] rounded-full" />
                        </div>
                    </div>
                    <div className="relative p-3 rounded-xl bg-primary/5 border border-primary/10 overflow-hidden group">
                        <div className="absolute top-0 right-0 p-1 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Zap className="w-8 h-8 text-primary" />
                        </div>
                        <p className="text-[10px] text-primary/60 font-bold uppercase tracking-wider relative z-10">Hash Efficiency</p>
                        <p className="text-2xl font-black text-primary mt-1 relative z-10">100%</p>
                        <div className="w-full h-1 bg-primary/10 rounded-full mt-2 relative z-10 overflow-hidden">
                            <div className="h-full bg-primary w-full rounded-full" />
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
