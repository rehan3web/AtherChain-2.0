import { WalletService } from "@/services/wallet";
import useSWR from "swr";

export function useWallet() {
    const { data: stats, mutate: refreshStats } = useSWR('/wallet/stats', WalletService.getStats);

    return {
        walletAddress: stats?.wallet_address,
        balance: stats?.ath_balance,
        refreshStats
    };
}
