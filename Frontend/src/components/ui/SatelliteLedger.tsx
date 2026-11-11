import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface ReferralNode {
    username: string;
    kyc_status: string;
    join_date: string;
    activity_status?: string;
    mining_progress?: string;
    last_mined_at: string | null;
}

interface SatelliteLedgerProps {
    referrals?: ReferralNode[];
    isLoading: boolean;
    unverifiedReward?: number;
    verifiedReward?: number;
}

export function SatelliteLedger({ referrals, isLoading, unverifiedReward = 0.3, verifiedReward = 2 }: SatelliteLedgerProps) {
    if (isLoading) {
        return (
            <div className="w-full h-32 flex items-center justify-center border border-border/40 bg-card/10">
                <span className="font-mono text-xs text-muted-foreground animate-pulse">ACCESSING LEDGER DATA...</span>
            </div>
        );
    }

    if (!referrals || referrals.length === 0) {
        return (
            <div className="w-full py-12 flex flex-col items-center justify-center border border-dashed border-border/40 bg-card/5">
                <span className="font-mono text-sm text-muted-foreground mb-1">NO NODES FOUND</span>
                <span className="font-mono text-xs text-muted-foreground/50">WAITING FOR NETWORK ACTIVITY</span>
            </div>
        );
    }

    return (
        <div className="rounded-none border border-border/40 bg-card/20 overflow-hidden">
            <Table>
                <TableHeader className="bg-muted/30">
                    <TableRow className="border-border/40 hover:bg-transparent">
                        <TableHead className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider h-10">Node Identity</TableHead>
                        <TableHead className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider h-10">Activation Date</TableHead>
                        <TableHead className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider h-10">Activity</TableHead>
                        <TableHead className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider h-10">Progress</TableHead>
                        <TableHead className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider h-10">Verification</TableHead>
                        <TableHead className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider h-10 text-right">Yield Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {referrals.map((item) => (
                        <TableRow key={item.username} className="border-border/40 hover:bg-muted/30 font-mono text-xs group transition-colors">
                            <TableCell className="font-medium text-foreground group-hover:text-primary transition-colors">
                                {item.username}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                                {item.join_date ? format(new Date(item.join_date), "yyyy-MM-dd HH:mm:ss") : "PENDING"}
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <div className={`w-1.5 h-1.5 rounded-full ${item.activity_status === 'Active' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`} />
                                    <span className={item.activity_status === 'Active' ? 'text-green-500' : 'text-red-500'}>
                                        {item.activity_status?.toUpperCase() || 'INACTIVE'}
                                    </span>
                                </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                                {item.mining_progress || '0/15'}
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <div className={`w-1.5 h-1.5 rounded-full ${item.kyc_status === 'approved' ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-gray-500'}`} />
                                    <span className="uppercase">{item.kyc_status}</span>
                                </div>
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                    {/* Activity Reward (Registration/First Mine) */}
                                    {!item.last_mined_at ? (
                                        <Badge variant="outline" className="rounded-none border-yellow-500/50 text-yellow-500 bg-yellow-500/10 font-mono text-[10px] whitespace-nowrap">
                                            WAIT FOR MINING
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="rounded-none border-green-500/50 text-green-500 bg-green-500/10 font-mono text-[10px] whitespace-nowrap">
                                            +{unverifiedReward} AT PAID
                                        </Badge>
                                    )}

                                    {/* Verification Reward (KYC) */}
                                    {item.kyc_status !== 'approved' ? (
                                        <Badge variant="outline" className="rounded-none border-muted-foreground/30 text-muted-foreground bg-muted/10 font-mono text-[10px] whitespace-nowrap">
                                            WAIT FOR KYC
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="rounded-none border-blue-500/50 text-blue-500 bg-blue-500/10 font-mono text-[10px] whitespace-nowrap">
                                            VERIFIED +{verifiedReward} AT PAID
                                        </Badge>
                                    )}
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
