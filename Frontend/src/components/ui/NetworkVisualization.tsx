import { motion } from "framer-motion";
import { useMemo } from "react";

interface ReferralNode {
    username: string;
    kyc_status: string;
    join_date: string;
}

interface ReferralStats {
    referralCode: string;
    totalReferrals: number;
    totalEarned: number;
    referrals: ReferralNode[];
}

interface NetworkVisualizationProps {
    data?: ReferralStats | null;
    isLoading: boolean;
}

export function NetworkVisualization({ data, isLoading }: NetworkVisualizationProps) {
    const containerSize = 400;
    const centerX = containerSize / 2;
    const centerY = containerSize / 2;
    const radius = 120;

    // Calculate positions for satellites
    const nodes = useMemo(() => {
        if (!data || !data.referrals.length) return [];

        // In our new structure, all referrals are satellites
        const satellites = data.referrals;

        return satellites.map((ref, index) => {
            const angle = (index / satellites.length) * 2 * Math.PI - Math.PI / 2; // Start from top
            return {
                id: ref.username,
                type: 'satellite',
                status: ref.kyc_status === 'approved' ? 'active' : 'pending',
                x: centerX + radius * Math.cos(angle),
                y: centerY + radius * Math.sin(angle),
            };
        });
    }, [data]);

    if (isLoading) {
        return (
            <div className="w-full h-[400px] flex items-center justify-center bg-card/20 border border-border/40">
                <span className="font-mono text-xs animate-pulse text-muted-foreground">SCANNING NETWORK TOPOLOGY...</span>
            </div>
        );
    }

    // Always render the visualization container
    return (
        <div className="w-full h-[400px] bg-card/20 border border-border/40 relative overflow-hidden flex items-center justify-center">
            {/* Background Grid */}
            <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

            <svg width={containerSize} height={containerSize} viewBox={`0 0 ${containerSize} ${containerSize}`} className="max-w-full h-auto">
                {/* Links - Only if nodes exist */}
                {nodes.map((node) => (
                    <motion.line
                        key={`link-${node.id}`}
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 0.2 }}
                        transition={{ duration: 1, ease: "easeInOut" }}
                        x1={centerX}
                        y1={centerY}
                        x2={node.x}
                        y2={node.y}
                        className="stroke-muted-foreground/30"
                        strokeWidth="1"
                    />
                ))}

                {/* Central Node (You) - Always visible */}
                <motion.circle
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 12 }}
                    cx={centerX}
                    cy={centerY}
                    r="8"
                    className="fill-foreground cursor-pointer hover:opacity-80 transition-opacity"
                />
                <circle cx={centerX} cy={centerY} r="16" className="stroke-foreground/20" strokeWidth="1" fill="none" />

                {/* Satellite Nodes */}
                {nodes.map((node, i) => (
                    <g key={node.id}>
                        <motion.circle
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: i * 0.1, type: "spring" }}
                            cx={node.x}
                            cy={node.y}
                            r="4"
                            fill={node.status === 'active' ? 'white' : '#666'}
                            stroke="black"
                            strokeWidth="2"
                        />
                        {/* Pulsing effect for active nodes */}
                        {node.status === 'active' && (
                            <motion.circle
                                cx={node.x}
                                cy={node.y}
                                r="4"
                                className="stroke-foreground"
                                strokeWidth="1"
                                fill="none"
                                initial={{ scale: 1, opacity: 0.8 }}
                                animate={{ scale: 3, opacity: 0 }}
                                transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
                            />
                        )}

                        {/* Label */}
                        <motion.text
                            x={node.x}
                            y={node.y + 16}
                            textAnchor="middle"
                            className="fill-muted-foreground/70"
                            fontSize="8"
                            fontFamily="JetBrains Mono"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.1 + 0.5 }}
                        >
                            NODE_{node.id.slice(0, 4)}
                        </motion.text>
                    </g>
                ))}
            </svg>

            {/* Empty State Overlay */}
            {nodes.length === 0 && (
                <div className="absolute bottom-12 left-0 right-0 text-center z-10 pointer-events-none">
                    <span className="font-mono text-xs text-muted-foreground block mb-1">NO SATELLITE NODES DETECTED</span>
                    <span className="font-mono text-[10px] text-muted-foreground/50 block">THE NETWORK IS READY TO EXPAND</span>
                </div>
            )}

            {/* Overlay Info */}
            <div className="absolute top-4 right-4 text-right">
                <div className="text-[10px] font-mono text-muted-foreground">TOPOLOGY</div>
                <div className="text-xs font-mono text-foreground">STAR_NETWORK_L1</div>
            </div>
        </div>
    );
}
