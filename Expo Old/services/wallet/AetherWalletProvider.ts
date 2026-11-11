import { IWalletProvider, TokenAsset, NFTAsset, WalletTransaction, FeeEstimate, SendParams } from "./types";
import { walletApi, transactionApi } from "@/services/api";

export class AetherWalletProvider implements IWalletProvider {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async getAddress(): Promise<string> {
    try {
      const stats = await walletApi.stats();
      return stats?.wallet_address || "ath_1000000000000000";
    } catch {
      return "ath_1000000000000000";
    }
  }

  async getBalance(): Promise<string> {
    try {
      const stats = await walletApi.stats();
      return stats?.ath_balance || "0.0000";
    } catch {
      return "0.0000";
    }
  }

  async getTokens(): Promise<TokenAsset[]> {
    try {
      const stats = await walletApi.stats();
      return [
        {
          symbol: "ATH",
          name: "AetherChain Native",
          balance: stats?.ath_balance || "0.0000",
          decimals: 18,
          icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
          fiatValue: parseFloat(stats?.ath_balance || "0") * 0.5,
          change24h: 2.4,
        },
        {
          symbol: "AT",
          name: "Aether Reward Token",
          balance: stats?.at_balance || "0.0000",
          decimals: 18,
          icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
          fiatValue: parseFloat(stats?.at_balance || "0") * 0.1,
          change24h: 1.1,
        },
      ];
    } catch {
      return [];
    }
  }

  async getNFTs(): Promise<NFTAsset[]> {
    return [];
  }

  async estimateFee(params: { to: string; amount: string; tokenAddress?: string }): Promise<{
    low: FeeEstimate;
    market: FeeEstimate;
    aggressive: FeeEstimate;
  }> {
    const base: FeeEstimate = {
      gasLimit: "21000",
      gasPrice: "0",
      totalFeeNative: "0.0000",
      totalFeeFiat: 0,
      preset: "market",
    };
    return {
      low: { ...base, preset: "low" },
      market: { ...base, preset: "market" },
      aggressive: { ...base, preset: "aggressive" },
    };
  }

  async signAndSend(params: SendParams): Promise<string> {
    const amountNum = parseFloat(params.amount);
    const result = await walletApi.send(params.to, amountNum);
    return result?.hash || result?.id || "tx_ath_" + Date.now();
  }

  async getHistory(): Promise<WalletTransaction[]> {
    try {
      const data = await transactionApi.list(1, 20);
      const list = Array.isArray(data) ? data : data?.data || data?.transactions || [];
      return list.map((item: any) => ({
        id: item.id,
        type: item.type,
        amount: item.amount,
        symbol: "ATH",
        status: item.status || "confirmed",
        txHash: item.txHash || item.id,
        timestamp: item.timestamp || new Date().toISOString(),
        fromAddress: item.fromAddress || "",
        toAddress: item.toAddress || "",
      }));
    } catch {
      return [];
    }
  }
}
