import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_EVM_NETWORKS, EVMNetwork } from "@/services/wallet/evmNetworks";

export type WalletMode = "aether" | "web3";

interface WalletModeContextType {
  mode: WalletMode;
  setMode: (mode: WalletMode) => Promise<void>;
  activeNetwork: EVMNetwork;
  setActiveNetwork: (network: EVMNetwork) => Promise<void>;
  showTestnets: boolean;
  setShowTestnets: (show: boolean) => Promise<void>;
  customNetworks: EVMNetwork[];
  addCustomNetwork: (net: EVMNetwork) => Promise<void>;
  removeCustomNetwork: (chainId: number) => Promise<void>;
  allNetworks: EVMNetwork[];
}

const STORAGE_KEY_MODE = "@wallet_mode";
const STORAGE_KEY_NETWORK = "@wallet_active_network_id";
const STORAGE_KEY_TESTNETS = "@wallet_show_testnets";
const STORAGE_KEY_CUSTOM_NETWORKS = "@wallet_custom_networks";

const WalletModeContext = createContext<WalletModeContextType | undefined>(undefined);

export const WalletModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<WalletMode>("aether");
  const [activeNetwork, setActiveNetworkState] = useState<EVMNetwork>(DEFAULT_EVM_NETWORKS[0]);
  const [showTestnets, setShowTestnetsState] = useState<boolean>(false);
  const [customNetworks, setCustomNetworks] = useState<EVMNetwork[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const savedMode = await AsyncStorage.getItem(STORAGE_KEY_MODE);
        if (savedMode === "web3" || savedMode === "aether") {
          setModeState(savedMode);
        }

        const savedTestnets = await AsyncStorage.getItem(STORAGE_KEY_TESTNETS);
        if (savedTestnets !== null) {
          setShowTestnetsState(savedTestnets === "true");
        }

        const savedCustom = await AsyncStorage.getItem(STORAGE_KEY_CUSTOM_NETWORKS);
        let parsedCustom: EVMNetwork[] = [];
        if (savedCustom) {
          try {
            parsedCustom = JSON.parse(savedCustom);
            setCustomNetworks(parsedCustom);
          } catch {}
        }

        const savedNetId = await AsyncStorage.getItem(STORAGE_KEY_NETWORK);
        if (savedNetId) {
          const chainId = parseInt(savedNetId, 10);
          const found = [...DEFAULT_EVM_NETWORKS, ...parsedCustom].find((n) => n.chainId === chainId);
          if (found) {
            setActiveNetworkState(found);
          }
        }
      } catch (err) {
        console.error("Failed loading wallet mode settings:", err);
      }
    })();
  }, []);

  const setMode = async (newMode: WalletMode) => {
    setModeState(newMode);
    await AsyncStorage.setItem(STORAGE_KEY_MODE, newMode);
  };

  const setActiveNetwork = async (net: EVMNetwork) => {
    setActiveNetworkState(net);
    await AsyncStorage.setItem(STORAGE_KEY_NETWORK, net.chainId.toString());
  };

  const setShowTestnets = async (show: boolean) => {
    setShowTestnetsState(show);
    await AsyncStorage.setItem(STORAGE_KEY_TESTNETS, show ? "true" : "false");
  };

  const addCustomNetwork = async (net: EVMNetwork) => {
    const updated = [...customNetworks.filter((n) => n.chainId !== net.chainId), net];
    setCustomNetworks(updated);
    await AsyncStorage.setItem(STORAGE_KEY_CUSTOM_NETWORKS, JSON.stringify(updated));
    setActiveNetwork(net);
  };

  const removeCustomNetwork = async (chainId: number) => {
    const updated = customNetworks.filter((n) => n.chainId !== chainId);
    setCustomNetworks(updated);
    await AsyncStorage.setItem(STORAGE_KEY_CUSTOM_NETWORKS, JSON.stringify(updated));
    if (activeNetwork.chainId === chainId) {
      setActiveNetwork(DEFAULT_EVM_NETWORKS[0]);
    }
  };

  const allNetworks = [
    ...DEFAULT_EVM_NETWORKS.filter((n) => !n.isTestnet),
    ...customNetworks,
  ];

  return (
    <WalletModeContext.Provider
      value={{
        mode,
        setMode,
        activeNetwork,
        setActiveNetwork,
        showTestnets,
        setShowTestnets,
        customNetworks,
        addCustomNetwork,
        removeCustomNetwork,
        allNetworks,
      }}
    >
      {children}
    </WalletModeContext.Provider>
  );
};

export const useWalletMode = () => {
  const context = useContext(WalletModeContext);
  if (!context) {
    throw new Error("useWalletMode must be used within a WalletModeProvider");
  }
  return context;
};
