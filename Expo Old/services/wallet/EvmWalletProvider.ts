import { ethers } from "ethers";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { IWalletProvider, TokenAsset, NFTAsset, WalletTransaction, FeeEstimate, SendParams } from "./types";
import { EVMNetwork } from "./evmNetworks";
import { Web3KeyService } from "./Web3KeyService";
import { TokenService, POPULAR_TOKENS_BY_CHAIN } from "./tokenService";

const STORAGE_PREFIX_TX_HISTORY = "@web3_tx_history_";

export class EvmWalletProvider implements IWalletProvider {
  private network: EVMNetwork;
  private userId: string;
  private provider: ethers.JsonRpcProvider;

  constructor(userId: string, network: EVMNetwork) {
    this.userId = userId;
    this.network = network;
    this.provider = new ethers.JsonRpcProvider(network.rpcUrl, network.chainId, { staticNetwork: true });
  }

  async getAddress(): Promise<string> {
    const address = await Web3KeyService.getWalletAddress(this.userId);
    if (!address) return "0x0000000000000000000000000000000000000000";
    return address;
  }

  async getBalance(): Promise<string> {
    try {
      const address = await this.getAddress();
      if (address === "0x0000000000000000000000000000000000000000") return "0.0000";
      const rawBal = await this.provider.getBalance(address);
      return parseFloat(ethers.formatEther(rawBal)).toFixed(4);
    } catch {
      return "0.0000";
    }
  }

  async getTokens(): Promise<TokenAsset[]> {
    const address = await this.getAddress();
    const nativeBal = await this.getBalance();

    const nativeAsset: TokenAsset = {
      symbol: this.network.symbol,
      name: `${this.network.name} Native`,
      balance: nativeBal,
      decimals: 18,
      icon: this.network.icon,
      fiatValue: parseFloat(nativeBal) * (this.network.symbol === "ETH" ? 3400 : this.network.symbol === "BNB" ? 580 : 0.6),
      change24h: 1.5,
    };

    const popularTokens = POPULAR_TOKENS_BY_CHAIN[this.network.chainId] || [];
    const customTokens = await TokenService.getCustomTokens(this.userId, this.network.chainId);
    const hiddenTokens = await TokenService.getHiddenTokens(this.userId, this.network.chainId);

    const allTokens = [...popularTokens, ...customTokens].filter(
      (t) => !hiddenTokens.includes(t.symbol) && (!t.address || !hiddenTokens.includes(t.address))
    );

    const tokenAssets: TokenAsset[] = await Promise.all(
      allTokens.map(async (t) => {
        let bal = "0";
        if (t.address && address !== "0x0000000000000000000000000000000000000000") {
          bal = await TokenService.fetchTokenBalance(t.address, address, t.decimals, this.provider);
        }
        const balNum = parseFloat(bal);
        return {
          ...t,
          balance: balNum.toFixed(4),
          fiatValue: (t.fiatValue || 1.0) * balNum,
        };
      })
    );

    return [nativeAsset, ...tokenAssets];
  }



  async estimateFee(params: { to: string; amount: string; tokenAddress?: string; data?: string }): Promise<{
    low: FeeEstimate;
    market: FeeEstimate;
    aggressive: FeeEstimate;
  }> {
    try {
      const address = await this.getAddress();
      const feeData = await this.provider.getFeeData();

      let gasLimit = BigInt(21000);
      if (params.tokenAddress && ethers.isAddress(params.tokenAddress)) {
        const erc20 = new ethers.Contract(
          params.tokenAddress,
          ["function transfer(address to, uint256 amount) returns (bool)"],
          this.provider
        );
        try {
          const estimated = await erc20.transfer.estimateGas(params.to, ethers.parseUnits(params.amount || "0", 18), {
            from: address,
          });
          gasLimit = (estimated * BigInt(120)) / BigInt(100);
        } catch {
          gasLimit = BigInt(65000);
        }
      } else if (params.data) {
        try {
          const estimated = await this.provider.estimateGas({
            from: address,
            to: params.to,
            data: params.data,
            value: params.amount ? ethers.parseEther(params.amount) : BigInt(0),
          });
          gasLimit = (estimated * BigInt(120)) / BigInt(100);
        } catch {
          gasLimit = BigInt(100000);
        }
      }

      const baseFee = feeData.gasPrice || feeData.maxFeePerGas || ethers.parseUnits("20", "gwei");

      const lowPrice = (baseFee * BigInt(90)) / BigInt(100);
      const marketPrice = baseFee;
      const aggPrice = (baseFee * BigInt(130)) / BigInt(100);

      const calcFee = (price: bigint, preset: "low" | "market" | "aggressive"): FeeEstimate => {
        const totalWei = gasLimit * price;
        const totalEth = parseFloat(ethers.formatEther(totalWei));
        return {
          gasLimit: gasLimit.toString(),
          gasPrice: price.toString(),
          maxFeePerGas: price.toString(),
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? feeData.maxPriorityFeePerGas.toString() : undefined,
          totalFeeNative: totalEth.toFixed(6),
          totalFeeFiat: totalEth * (this.network.symbol === "ETH" ? 3400 : 0.6),
          preset,
        };
      };

      return {
        low: calcFee(lowPrice, "low"),
        market: calcFee(marketPrice, "market"),
        aggressive: calcFee(aggPrice, "aggressive"),
      };
    } catch {
      const fallback: FeeEstimate = {
        gasLimit: "21000",
        gasPrice: ethers.parseUnits("20", "gwei").toString(),
        totalFeeNative: "0.00042",
        totalFeeFiat: 1.42,
        preset: "market",
      };
      return { low: fallback, market: fallback, aggressive: fallback };
    }
  }

  async signAndSend(params: SendParams): Promise<string> {
    if (!params.pin) throw new Error("6-digit PIN required to sign transaction");

    const unlocked = await Web3KeyService.unlockWallet(this.userId, params.pin);
    const wallet = new ethers.Wallet(unlocked.privateKey, this.provider);

    let txResponse: ethers.TransactionResponse;

    if (params.tokenAddress && ethers.isAddress(params.tokenAddress)) {
      const erc20 = new ethers.Contract(
        params.tokenAddress,
        [
          "function decimals() view returns (uint8)",
          "function transfer(address to, uint256 amount) returns (bool)",
        ],
        wallet
      );
      const decimals = await erc20.decimals().catch(() => 18);
      const parsedAmount = ethers.parseUnits(params.amount, decimals);
      txResponse = await erc20.transfer(params.to, parsedAmount, {
        gasLimit: params.feeEstimate.gasLimit ? BigInt(params.feeEstimate.gasLimit) : undefined,
        gasPrice: params.feeEstimate.gasPrice ? BigInt(params.feeEstimate.gasPrice) : undefined,
        nonce: params.nonce,
      });
    } else {
      const txRequest: ethers.TransactionRequest = {
        to: params.to,
        value: ethers.parseEther(params.amount),
        gasLimit: params.feeEstimate.gasLimit ? BigInt(params.feeEstimate.gasLimit) : undefined,
        gasPrice: params.feeEstimate.gasPrice ? BigInt(params.feeEstimate.gasPrice) : undefined,
        nonce: params.nonce,
      };
      txResponse = await wallet.sendTransaction(txRequest);
    }

    const txRecord: WalletTransaction = {
      id: txResponse.hash,
      type: "send",
      amount: params.amount,
      symbol: params.tokenAddress ? "TOKEN" : this.network.symbol,
      status: "pending",
      txHash: txResponse.hash,
      timestamp: new Date().toISOString(),
      fromAddress: wallet.address,
      toAddress: params.to,
      fee: params.feeEstimate.totalFeeNative,
      chainId: this.network.chainId,
      nonce: txResponse.nonce,
    };

    await this.saveLocalTransaction(txRecord);
    return txResponse.hash;
  }

  async waitForTransaction(hash: string): Promise<ethers.TransactionReceipt | null> {
    try {
      return await this.provider.waitForTransaction(hash);
    } catch {
      return null;
    }
  }

  async getHistory(): Promise<WalletTransaction[]> {
    try {
      const key = `${STORAGE_PREFIX_TX_HISTORY}${this.userId}_${this.network.chainId}`;
      const raw = await AsyncStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  async updateTransaction(hash: string, updates: Partial<WalletTransaction>): Promise<void> {
    const history = await this.getHistory();
    const index = history.findIndex(h => h.txHash === hash);
    if (index !== -1) {
      history[index] = { ...history[index], ...updates };
      const key = `${STORAGE_PREFIX_TX_HISTORY}${this.userId}_${this.network.chainId}`;
      await AsyncStorage.setItem(key, JSON.stringify(history));
    }
  }

  private async saveLocalTransaction(tx: WalletTransaction): Promise<void> {
    const key = `${STORAGE_PREFIX_TX_HISTORY}${this.userId}_${this.network.chainId}`;
    const history = await this.getHistory();
    const updated = [tx, ...history.filter((h) => h.txHash !== tx.txHash)];
    await AsyncStorage.setItem(key, JSON.stringify(updated));
  }
}
