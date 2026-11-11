export interface TokenAsset {
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  address?: string; // ERC-20 contract address if applicable
  icon?: string;
  fiatValue?: number;
  change24h?: number;
  isCustom?: boolean;
  isHidden?: boolean;
}

export interface NFTAsset {
  id: string;
  name: string;
  collection: string;
  imageUri: string;
  contractAddress: string;
  tokenId: string;
  description?: string;
}

export interface WalletTransaction {
  id: string;
  type: "send" | "receive" | "swap" | string;
  amount: string;
  symbol: string;
  status: "pending" | "confirmed" | "failed";
  txHash: string;
  timestamp: string;
  fromAddress: string;
  toAddress: string;
  fee?: string;
  chainId?: number;
  nonce?: number;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  metadata?: any;
}

export interface FeeEstimate {
  gasLimit: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  gasPrice?: string;
  totalFeeNative: string;
  totalFeeFiat?: number;
  preset: "low" | "market" | "aggressive";
}

export interface SendParams {
  to: string;
  amount: string;
  tokenAddress?: string;
  feeEstimate: FeeEstimate;
  pin?: string;
  nonce?: number;
}

export interface IWalletProvider {
  getAddress(): Promise<string>;
  getBalance(): Promise<string>;
  getTokens(): Promise<TokenAsset[]>;
  getNFTs?(): Promise<NFTAsset[]>;
  estimateFee(params: { to: string; amount: string; tokenAddress?: string; data?: string }): Promise<{
    low: FeeEstimate;
    market: FeeEstimate;
    aggressive: FeeEstimate;
  }>;
  signAndSend(params: SendParams): Promise<string>;
  getHistory(): Promise<WalletTransaction[]>;
}
