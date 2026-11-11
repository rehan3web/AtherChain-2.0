import { useState, useRef, useCallback } from "react";

const REWARDS = [
    "1 AT", "2 AT", "5 AT", "10 AT", "20 AT", "50 AT",
    "75 AT", "100 AT", "150 AT", "200 AT", "500 AT", "1000 AT",
];

const SpinWheel = () => {
    const [currentRotation, setCurrentRotation] = useState(0);
    const [isSpinning, setIsSpinning] = useState(false);
    const [showResult, setShowResult] = useState(false);
    const [winner, setWinner] = useState("");
    const rotationRef = useRef(0);

    const spin = useCallback(() => {
        if (isSpinning) return;
        setIsSpinning(true);

        const extraDegrees = Math.floor(Math.random() * 360);
        const totalSpins = (5 + Math.floor(Math.random() * 5)) * 360;
        const newRotation = rotationRef.current + totalSpins + extraDegrees;
        rotationRef.current = newRotation;
        setCurrentRotation(newRotation);

        setTimeout(() => {
            setIsSpinning(false);
            const normalizedRotation = newRotation % 360;
            let index = Math.floor((360 - normalizedRotation) / 30) % 12;
            if (index < 0) index += 12;
            setWinner(REWARDS[index]);
            setShowResult(true);
        }, 5000);
    }, [isSpinning]);

    const closeResult = () => setShowResult(false);

    return (
        <>
            {/* Theme Toggle */}
            <ThemeToggle />

            <main className="flex-1 flex items-center justify-center relative w-full h-screen p-6">
                {/* Ambient Background Glows */}
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-white/5 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-white/5 rounded-full blur-[120px] pointer-events-none" />

                {/* Central Dashboard */}
                <div>
                    {/* Wheel Section */}
                    <div className="relative flex-1 w-full flex items-center justify-center my-8">
                        {/* Pointer */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[190px] z-30 drop-shadow-xl transition-colors duration-300">
                            <div
                                className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[24px]"
                                style={{ borderTopColor: "var(--pointer-color)" }}
                            />
                        </div>

                        {/* Wheel Container */}
                        <div className="relative size-[360px] md:size-[420px] rounded-full border-4 border-black/5 dark:border-white/10 shadow-2xl flex items-center justify-center overflow-hidden bg-white dark:bg-[#111] transition-colors duration-300">
                            {/* Rotating Wheel */}
                            <div
                                id="wheel"
                                className="absolute inset-0 rounded-full overflow-hidden"
                                style={{
                                    transform: `rotate(${currentRotation}deg)`,
                                    transition: "transform 5s cubic-bezier(0.15, 0, 0.15, 1)",
                                }}
                            >
                                {/* Segments Background */}
                                <div className="w-full h-full relative">
                                    <div
                                        className="w-full h-full rounded-full transition-all duration-300"
                                        style={{
                                            background: `repeating-conic-gradient(from 0deg, var(--wheel-color-1) 0deg 30deg, var(--wheel-color-2) 30deg 60deg)`,
                                            maskImage: "radial-gradient(circle, transparent 25%, black 26%)",
                                            WebkitMaskImage: "radial-gradient(circle, transparent 25%, black 26%)",
                                        }}
                                    />
                                    {/* Modern Gloss Overlay */}
                                    <div className="absolute inset-0 rounded-full wheel-glass" />
                                    {/* Separator Lines */}
                                    <div
                                        className="absolute inset-0 w-full h-full rounded-full transition-all duration-300"
                                        style={{
                                            background: `repeating-conic-gradient(from 0deg, transparent 0deg 29.5deg, var(--wheel-border) 29.5deg 30deg)`,
                                        }}
                                    />
                                </div>

                                {/* Reward Labels */}
                                <div
                                    className="absolute inset-0 pointer-events-none transition-colors duration-300"
                                    style={{ color: "var(--wheel-text)" }}
                                >
                                    {REWARDS.map((reward, i) => (
                                        <div
                                            key={reward}
                                            className="absolute top-[15%] left-1/2 -translate-x-1/2 origin-bottom h-[35%] flex items-start justify-center text-xs font-bold tracking-tighter"
                                            style={{ transform: `translateX(-50%) rotate(${15 + i * 30}deg)` }}
                                        >
                                            {reward}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Center Hub / Button */}
                            <div
                                className="absolute z-20 size-24 rounded-full border transition-all duration-300 flex items-center justify-center"
                                style={{
                                    backgroundColor: "var(--wheel-hub-bg)",
                                    borderColor: "var(--wheel-border)",
                                    boxShadow: "0 0 40px var(--wheel-hub-shadow)",
                                }}
                            >
                                <button
                                    onClick={spin}
                                    disabled={isSpinning}
                                    className="size-20 rounded-full border border-black/10 dark:border-white/30 text-slate-800 dark:text-white font-bold tracking-widest text-sm hover:scale-105 active:scale-95 transition-all duration-300 flex items-center justify-center group bg-white dark:bg-transparent shadow-lg dark:shadow-none"
                                >
                                    <span className="group-hover:scale-110 transition-transform">SPIN</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Result Modal */}
                    <div
                        className={`fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center transition-opacity duration-500 ${showResult ? "opacity-100" : "opacity-0 pointer-events-none"
                            }`}
                    >
                        <div className="glass-card p-12 rounded-3xl flex flex-col items-center gap-6 max-w-sm w-full border border-white/20 shadow-[0_0_100px_rgba(255,255,255,0.1)]">
                            <span className="material-symbols-outlined text-6xl text-white">workspace_premium</span>
                            <div className="text-center">
                                <h2 className="text-slate-400 uppercase tracking-widest text-sm mb-2">Congratulations</h2>
                                <p className="text-5xl font-bold text-white tracking-tight">{winner}</p>
                            </div>
                            <button
                                onClick={closeResult}
                                className="mt-4 px-8 py-3 bg-white text-black font-bold rounded-full hover:scale-105 transition-transform"
                            >
                                COLLECT
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </>
    );
};

const ThemeToggle = () => {
    const [isDark, setIsDark] = useState(() => {
        const saved = localStorage.getItem("theme");
        if (saved === "light") {
            document.documentElement.classList.remove("dark");
            return false;
        }
        document.documentElement.classList.add("dark");
        return true;
    });

    const toggle = () => {
        if (isDark) {
            document.documentElement.classList.remove("dark");
            localStorage.setItem("theme", "light");
        } else {
            document.documentElement.classList.add("dark");
            localStorage.setItem("theme", "dark");
        }
        setIsDark(!isDark);
    };

    return (
        <div className="fixed top-6 right-6 z-[60]">
            <button
                onClick={toggle}
                className="p-3 rounded-full glass-card hover:scale-110 transition-transform duration-300 flex items-center justify-center group"
            >
                <span className="material-symbols-outlined text-2xl text-primary">
                    {isDark ? "dark_mode" : "light_mode"}
                </span>
            </button>
        </div>
    );
};

export default SpinWheel;
