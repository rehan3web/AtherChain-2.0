export interface EVMNetwork {
  chainId: number;
  name: string;
  symbol: string;
  rpcUrl: string;
  explorerUrl?: string;
  icon?: string;
  isTestnet?: boolean;
  isCustom?: boolean;
}

export const DEFAULT_EVM_NETWORKS: EVMNetwork[] = [
  // Mainnets
  {
    chainId: 1,
    name: "Ethereum",
    symbol: "ETH",
    rpcUrl: "https://cloudflare-eth.com",
    explorerUrl: "https://etherscan.io",
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
    isTestnet: false,
  },
  {
    chainId: 56,
    name: "BNB Smart Chain",
    symbol: "BNB",
    rpcUrl: "https://bsc-dataseed.binance.org",
    explorerUrl: "https://bscscan.com",
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/info/logo.png",
    isTestnet: false,
  },
  {
    chainId: 137,
    name: "Polygon",
    symbol: "POL",
    rpcUrl: "https://polygon-rpc.com",
    explorerUrl: "https://polygonscan.com",
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png",
    isTestnet: false,
  },
  {
    chainId: 42161,
    name: "Arbitrum One",
    symbol: "ETH",
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    explorerUrl: "https://arbiscan.io",
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png",
    isTestnet: false,
  },
  {
    chainId: 10,
    name: "Optimism",
    symbol: "ETH",
    rpcUrl: "https://mainnet.optimism.io",
    explorerUrl: "https://optimistic.etherscan.io",
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png",
    isTestnet: false,
  },
  {
    chainId: 8453,
    name: "Base",
    symbol: "ETH",
    rpcUrl: "https://mainnet.base.org",
    explorerUrl: "https://basescan.org",
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png",
    isTestnet: false,
  },
  {
    chainId: 43114,
    name: "Avalanche C-Chain",
    symbol: "AVAX",
    rpcUrl: "https://api.avax.network/ext/bc/C/rpc",
    explorerUrl: "https://snowtrace.io",
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/info/logo.png",
    isTestnet: false,
  },
  {
    chainId: 59144,
    name: "Linea",
    symbol: "ETH",
    rpcUrl: "https://rpc.linea.build",
    explorerUrl: "https://lineascan.build",
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/linea/info/logo.png",
    isTestnet: false,
  },

  // Testnets
  {
    chainId: 11155111,
    name: "Sepolia",
    symbol: "ETH",
    rpcUrl: "https://rpc.sepolia.org",
    explorerUrl: "https://sepolia.etherscan.io",
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
    isTestnet: true,
  },
  {
    chainId: 97,
    name: "BSC Testnet",
    symbol: "tBNB",
    rpcUrl: "https://data-seed-prebsc-1-s1.binance.org:8545",
    explorerUrl: "https://testnet.bscscan.com",
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/info/logo.png",
    isTestnet: true,
  },
  {
    chainId: 80002,
    name: "Polygon Amoy",
    symbol: "POL",
    rpcUrl: "https://rpc-amoy.polygon.technology",
    explorerUrl: "https://amoy.polygonscan.com",
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png",
    isTestnet: true,
  },
  {
    chainId: 84532,
    name: "Base Sepolia",
    symbol: "ETH",
    rpcUrl: "https://sepolia.base.org",
    explorerUrl: "https://sepolia.basescan.org",
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png",
    isTestnet: true,
  },
];

export async function validateRpcUrl(rpcUrl: string, expectedChainId?: number): Promise<{ valid: boolean; chainId?: number; error?: string }> {
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_chainId",
        params: [],
        id: 1,
      }),
    });

    if (!res.ok) {
      return { valid: false, error: `RPC endpoint returned HTTP status ${res.status}` };
    }

    const data = await res.json();
    if (!data.result) {
      return { valid: false, error: "Invalid RPC response" };
    }

    const remoteChainId = parseInt(data.result, 16);
    if (expectedChainId && remoteChainId !== expectedChainId) {
      return {
        valid: false,
        chainId: remoteChainId,
        error: `RPC chain ID (${remoteChainId}) does not match entered chain ID (${expectedChainId})`,
      };
    }

    return { valid: true, chainId: remoteChainId };
  } catch (err: any) {
    return { valid: false, error: err.message || "Failed to connect to RPC URL" };
  }
}
