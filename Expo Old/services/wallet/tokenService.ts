import { ethers } from "ethers";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TokenAsset, NFTAsset } from "./types";
import { EVMNetwork } from "./evmNetworks";

const STORAGE_PREFIX_TOKENS = "@web3_imported_tokens_";
const STORAGE_PREFIX_HIDDEN = "@web3_hidden_tokens_";

export const POPULAR_TOKENS_BY_CHAIN: Record<number, Omit<TokenAsset, "balance">[]> = {
  // Ethereum Mainnet (1)
  1: [
    {
      symbol: "USDT",
      name: "Tether USD",
      address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      decimals: 6,
      icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png",
      fiatValue: 1.0,
      change24h: 0.01,
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      decimals: 6,
      icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png",
      fiatValue: 1.0,
      change24h: 0.0,
    },
    {
      symbol: "DAI",
      name: "Dai Stablecoin",
      address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      decimals: 18,
      icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png",
      fiatValue: 1.0,
      change24h: 0.02,
    },
    {
      symbol: "WBTC",
      name: "Wrapped BTC",
      address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
      decimals: 8,
      icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599/logo.png",
      fiatValue: 65000,
      change24h: 3.2,
    },
    {
      symbol: "LINK",
      name: "Chainlink",
      address: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
      decimals: 18,
      icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x514910771AF9Ca656af840dff83E8264EcF986CA/logo.png",
      fiatValue: 14.5,
      change24h: 1.8,
    },
    {
      symbol: "UNI",
      name: "Uniswap",
      address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
      decimals: 18,
      icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984/logo.png",
      fiatValue: 8.2,
      change24h: -0.5,
    },
  ],
  // BNB Smart Chain (56)
  56: [
    {
      symbol: "USDT",
      name: "Tether USD",
      address: "0x55d398326f99059fF775485246999027B3197955",
      decimals: 18,
      icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/0x55d398326f99059fF775485246999027B3197955/logo.png",
      fiatValue: 1.0,
      change24h: 0.01,
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
      decimals: 18,
      icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d/logo.png",
      fiatValue: 1.0,
      change24h: 0.0,
    },
  ],
  // Polygon (137)
  137: [
    {
      symbol: "USDT",
      name: "Tether USD",
      address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
      decimals: 6,
      icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/assets/0xc2132D05D31c914a87C6611C10748AEb04B58e8F/logo.png",
      fiatValue: 1.0,
      change24h: 0.01,
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      decimals: 6,
      icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/assets/0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359/logo.png",
      fiatValue: 1.0,
      change24h: 0.0,
    },
  ],
  // Arbitrum One (42161)
  42161: [
    {
      symbol: "USDC",
      name: "USD Coin",
      address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      decimals: 6,
      icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/assets/0xaf88d065e77c8cC2239327C5EDb3A432268e5831/logo.png",
      fiatValue: 1.0,
      change24h: 0.0,
    },
    {
      symbol: "USDT",
      name: "Tether USD",
      address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
      decimals: 6,
      icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/assets/0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9/logo.png",
      fiatValue: 1.0,
      change24h: 0.01,
    },
  ],
  // Base (8453)
  8453: [
    {
      symbol: "USDC",
      name: "USD Coin",
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      decimals: 6,
      icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/logo.png",
      fiatValue: 1.0,
      change24h: 0.0,
    },
  ],
};

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address owner) view returns (uint256)",
];

export class TokenService {
  /**
   * Fetch ERC-20 token info from contract address
   */
  static async fetchTokenInfo(
    contractAddress: string,
    provider: ethers.JsonRpcProvider
  ): Promise<{ symbol: string; name: string; decimals: number } | null> {
    try {
      if (!ethers.isAddress(contractAddress)) return null;
      const contract = new ethers.Contract(contractAddress, ERC20_ABI, provider);
      const [symbol, name, decimals] = await Promise.all([
        contract.symbol().catch(() => "UNKNOWN"),
        contract.name().catch(() => "Custom Token"),
        contract.decimals().catch(() => 18),
      ]);
      return { symbol, name, decimals: Number(decimals) };
    } catch {
      return null;
    }
  }

  /**
   * Fetch balance for an ERC-20 token
   */
  static async fetchTokenBalance(
    contractAddress: string,
    userAddress: string,
    decimals: number,
    provider: ethers.JsonRpcProvider
  ): Promise<string> {
    try {
      if (!ethers.isAddress(contractAddress) || !ethers.isAddress(userAddress)) return "0";
      const contract = new ethers.Contract(contractAddress, ERC20_ABI, provider);
      const rawBalance = await contract.balanceOf(userAddress);
      return ethers.formatUnits(rawBalance, decimals);
    } catch {
      return "0";
    }
  }

  /**
   * Get custom imported tokens for user + chain
   */
  static async getCustomTokens(userId: string, chainId: number): Promise<Omit<TokenAsset, "balance">[]> {
    try {
      const key = `${STORAGE_PREFIX_TOKENS}${userId}_${chainId}`;
      const raw = await AsyncStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Add custom token for user + chain
   */
  static async addCustomToken(
    userId: string,
    chainId: number,
    token: Omit<TokenAsset, "balance">
  ): Promise<void> {
    const existing = await this.getCustomTokens(userId, chainId);
    const updated = [...existing.filter((t) => t.address?.toLowerCase() !== token.address?.toLowerCase()), token];
    const key = `${STORAGE_PREFIX_TOKENS}${userId}_${chainId}`;
    await AsyncStorage.setItem(key, JSON.stringify(updated));
  }

  /**
   * Get hidden tokens list for user + chain
   */
  static async getHiddenTokens(userId: string, chainId: number): Promise<string[]> {
    try {
      const key = `${STORAGE_PREFIX_HIDDEN}${userId}_${chainId}`;
      const raw = await AsyncStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Toggle hide/show token
   */
  static async hideToken(userId: string, chainId: number, tokenSymbolOrAddress: string): Promise<void> {
    const hidden = await this.getHiddenTokens(userId, chainId);
    const key = `${STORAGE_PREFIX_HIDDEN}${userId}_${chainId}`;
    if (!hidden.includes(tokenSymbolOrAddress)) {
      await AsyncStorage.setItem(key, JSON.stringify([...hidden, tokenSymbolOrAddress]));
    }
  }

  /**
   * Sample NFT fetcher for chain
   */
  static async getNFTs(userAddress: string, chain: EVMNetwork): Promise<NFTAsset[]> {
    if (!userAddress || userAddress === "0x0000000000000000000000000000000000000000") return [];
    return [
      {
        id: "nft_1",
        name: `${chain.name} Genesis Pass #108`,
        collection: `${chain.name} Pass Collection`,
        imageUri: "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=500&q=80",
        contractAddress: "0x1234567890123456789012345678901234567890",
        tokenId: "108",
        description: "Official Genesis Pass for Web3 EVM Access",
      },
      {
        id: "nft_2",
        name: `Aether Voyager #${userAddress.slice(2, 6)}`,
        collection: "Aether NFT Collection",
        imageUri: "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=500&q=80",
        contractAddress: "0x0987654321098765432109876543210987654321",
        tokenId: userAddress.slice(2, 6),
        description: "Exclusive Web3 badge for active AtherChain mobile users.",
      },
    ];
  }
}
