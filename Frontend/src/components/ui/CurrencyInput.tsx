import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { LucideIcon, ChevronDown, Check, Zap, ShieldCheck, Wallet } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { motion, AnimatePresence } from "framer-motion";

interface CurrencyInputProps {
    label: string;
    value: string;
    onChange?: (value: string) => void;
    icon?: LucideIcon;
    symbol: string;
    readOnly?: boolean;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    options?: string[];
    onSymbolChange?: (symbol: string) => void;
}

const TOKEN_ICONS: Record<string, LucideIcon> = {
    'AT': Zap,
    'ATH': ShieldCheck,
    'WATH': Wallet
};

export function CurrencyInput({
    label,
    value,
    onChange,
    icon: Icon,
    symbol,
    readOnly = false,
    placeholder = "0.00",
    className,
    disabled = false,
    options,
    onSymbolChange,
}: CurrencyInputProps) {
    const { user } = useAuth();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);

    // Determine balance based on symbol
    const getBalance = () => {
        if (symbol === "AT") return user?.at_balance || "0";
        if (symbol === "ATH") return user?.balance_ath || "0";
        if (symbol === "WATH") return user?.balance_wath || "0";
        return "0";
    };

    const rawBalance = getBalance();

    const balance = parseFloat(rawBalance || "0");
    const formattedBalance = balance.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: (symbol === "ATH" || symbol === "WATH") ? 6 : 2
    });

    const handlePercentage = (percent: number) => {
        if (!onChange) return;
        const amount = (balance * percent).toFixed(symbol === "ATH" ? 6 : 2);
        onChange(amount);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                setIsModalOpen(false);
            }
        };
        if (isModalOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isModalOpen]);

    return (
        <div className={cn(
            "group relative flex flex-col gap-3 p-5 rounded-2xl border transition-all duration-300",
            readOnly || disabled
                ? "bg-secondary/30 border-border opacity-60"
                : "bg-secondary/80 border-border hover:border-foreground/20 focus-within:border-foreground/30 focus-within:ring-1 focus-within:ring-border",
            className
        )}>
            <div className="flex justify-between items-center text-xs font-medium text-muted-foreground">
                <span>{label}</span>
                <span className="text-muted-foreground/80">Balance: {formattedBalance}</span>
            </div>

            <div className="flex items-center gap-4">
                <input
                    type="number"
                    min="0"
                    value={value}
                    onChange={(e) => {
                        const val = e.target.value;
                        if (val === "" || parseFloat(val) >= 0) {
                            onChange?.(val.replace(/-/g, ""));
                        }
                    }}
                    placeholder={placeholder}
                    readOnly={readOnly || disabled}
                    disabled={disabled}
                    className={cn(
                        "w-full bg-transparent text-3xl font-medium tracking-tight placeholder:text-muted-foreground focus:outline-none font-mono",
                        (readOnly || disabled) ? "text-muted-foreground cursor-default" : "text-foreground"
                    )}
                />

                <div className="relative flex items-center shrink-0">
                    {options && options.length > 0 && !readOnly ? (
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(!isModalOpen)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background border border-border hover:border-foreground/20 transition-all active:scale-95"
                            >
                                <div className="p-1 rounded-full bg-secondary">
                                    {TOKEN_ICONS[symbol] ? (
                                        (() => {
                                            const Icon = TOKEN_ICONS[symbol];
                                            return <Icon className="w-3 h-3 text-foreground" />;
                                        })()
                                    ) : (
                                        Icon && <Icon className="w-3 h-3 text-foreground" />
                                    )}
                                </div>
                                <span className="font-bold text-sm text-foreground">{symbol}</span>
                                <ChevronDown className={cn("w-3.5 h-3.5 text-zinc-500 transition-transform duration-300", isModalOpen && "rotate-180")} />
                            </button>

                            <AnimatePresence>
                                {isModalOpen && (
                                    <motion.div
                                        ref={modalRef}
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 5, scale: 0.95 }}
                                        transition={{ duration: 0.15, ease: "easeOut" }}
                                        className="absolute right-0 top-full mt-2 w-48 bg-card border border-border rounded-2xl shadow-2xl p-2 z-[100]"
                                    >
                                        <div className="text-[10px] font-bold text-muted-foreground px-3 py-2 uppercase tracking-wider">Select Token</div>
                                        <div className="flex flex-col gap-1">
                                            {options.map((opt) => {
                                                const OptIcon = TOKEN_ICONS[opt] || Zap;
                                                return (
                                                    <button
                                                        key={opt}
                                                        type="button"
                                                        onClick={() => {
                                                            onSymbolChange?.(opt);
                                                            setIsModalOpen(false);
                                                        }}
                                                        className={cn(
                                                            "flex justify-between items-center w-full px-3 py-2.5 rounded-xl transition-colors",
                                                            symbol === opt
                                                                ? "bg-zinc-800/50 text-white"
                                                                : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center">
                                                                <OptIcon className="w-4 h-4 text-foreground" />
                                                            </div>
                                                            <span className="font-bold text-sm">{opt}</span>
                                                        </div>
                                                        {symbol === opt && <Check className="w-4 h-4 text-foreground" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary border border-border shrink-0">
                            <div className="p-1 rounded-full bg-secondary">
                                {TOKEN_ICONS[symbol] ? (
                                    (() => {
                                        const Icon = TOKEN_ICONS[symbol];
                                        return <Icon className="w-3 h-3 text-foreground" />;
                                    })()
                                ) : (
                                    Icon && <Icon className="w-3 h-3 text-foreground" />
                                )}
                            </div>
                            <span className="font-bold text-sm text-foreground">{symbol}</span>
                        </div>
                    )}
                </div>
            </div>

            {!readOnly && !disabled && (
                <div className="flex gap-2 mt-1">
                    <button
                        type="button"
                        onClick={() => handlePercentage(0.25)}
                        className="text-[10px] font-medium text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-md bg-secondary/50 border border-transparent hover:border-border transition-colors"
                    >
                        25%
                    </button>
                    <button
                        type="button"
                        onClick={() => handlePercentage(0.50)}
                        className="text-[10px] font-medium text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-md bg-secondary/50 border border-transparent hover:border-border transition-colors"
                    >
                        50%
                    </button>
                    <button
                        type="button"
                        onClick={() => handlePercentage(1.0)}
                        className="text-[10px] font-medium text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-md bg-secondary/50 border border-transparent hover:border-border transition-colors"
                    >
                        MAX
                    </button>
                </div>
            )}
        </div>
    );
}
