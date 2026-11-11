import "react-native-get-random-values";
import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import { ethers } from "ethers";

const KEY_PREFIX = "web3_wallet_key_";

interface StoredWalletData {
  address: string;
  encryptedPayload: string; // Encrypted (mnemonic + privateKey)
  salt: string;
  pinHash: string;
  derivationPath: string;
  createdAt: string;
}

function getRandomBytes(count: number): Uint8Array {
  const array = new Uint8Array(count);
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(array);
    return array;
  }
  return ethers.randomBytes(count);
}

function deriveKeyFromPin(pin: string, salt: string): Uint8Array {
  let hashHex = ethers.sha256(ethers.toUtf8Bytes(pin + salt));
  for (let i = 0; i < 1000; i++) {
    hashHex = ethers.sha256(ethers.getBytes(hashHex));
  }
  return ethers.getBytes(hashHex);
}

function encryptWithKey(plainText: string, key: Uint8Array): string {
  const plainBytes = ethers.toUtf8Bytes(plainText);
  const cipherBytes = new Uint8Array(plainBytes.length);
  for (let i = 0; i < plainBytes.length; i++) {
    cipherBytes[i] = plainBytes[i] ^ key[i % key.length];
  }
  return ethers.hexlify(cipherBytes);
}

function decryptWithKey(cipherHex: string, key: Uint8Array): string {
  const cipherBytes = ethers.getBytes(cipherHex);
  const plainBytes = new Uint8Array(cipherBytes.length);
  for (let i = 0; i < cipherBytes.length; i++) {
    plainBytes[i] = cipherBytes[i] ^ key[i % key.length];
  }
  return ethers.toUtf8String(plainBytes);
}

export class Web3KeyService {
  /**
   * Generate a random BIP-39 mnemonic phrase (12 or 24 words)
   */
  static generateMnemonic(wordCount: 12 | 24 = 12): string {
    const entropyBits = wordCount === 24 ? 256 : 128;
    const randomBytes = getRandomBytes(entropyBits / 8);
    const mnemonic = ethers.Mnemonic.fromEntropy(randomBytes);
    return mnemonic.phrase;
  }

  /**
   * Validate a BIP-39 mnemonic phrase
   */
  static validateMnemonic(phrase: string): boolean {
    if (!phrase || typeof phrase !== "string") return false;
    const cleaned = phrase.trim().replaceAll(/\s+/g, " ");
    return ethers.Mnemonic.isValidMnemonic(cleaned);
  }

  /**
   * Validate an EVM private key (64 hex characters, with or without 0x)
   */
  static validatePrivateKey(privateKey: string): boolean {
    if (!privateKey) return false;
    let key = privateKey.trim();
    if (key.startsWith("0x")) key = key.slice(2);
    if (key.length !== 64) return false;
    return /^[0-9a-fA-F]{64}$/.test(key);
  }

  /**
   * Derive account from mnemonic and path (default m/44'/60'/0'/0/0)
   */
  static deriveWalletFromMnemonic(
    mnemonic: string,
    path = "m/44'/60'/0'/0/0"
  ): { address: string; privateKey: string } {
    const cleaned = mnemonic.trim().replaceAll(/\s+/g, " ");
    const hdNode = ethers.HDNodeWallet.fromPhrase(cleaned, undefined, path);
    return {
      address: hdNode.address,
      privateKey: hdNode.privateKey,
    };
  }

  /**
   * Derive wallet from private key
   */
  static deriveWalletFromPrivateKey(privateKey: string): { address: string; privateKey: string } {
    let key = privateKey.trim();
    if (!key.startsWith("0x")) key = "0x" + key;
    const wallet = new ethers.Wallet(key);
    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
    };
  }

  /**
   * Encrypt and save wallet into SecureStore
   */
  static async saveWallet(
    userId: string,
    pin: string,
    mnemonic: string | null,
    privateKey: string,
    derivationPath = "m/44'/60'/0'/0/0"
  ): Promise<string> {
    let address = "";
    if (privateKey) {
      address = this.deriveWalletFromPrivateKey(privateKey).address;
    }

    const salt = ethers.hexlify(getRandomBytes(16));
    const key = deriveKeyFromPin(pin, salt);
    const pinHash = ethers.sha256(ethers.toUtf8Bytes(pin + salt));

    const payload = JSON.stringify({ mnemonic, privateKey });
    const encryptedPayload = encryptWithKey(payload, key);

    const data: StoredWalletData = {
      address,
      encryptedPayload,
      salt,
      pinHash,
      derivationPath,
      createdAt: new Date().toISOString(),
    };

    const storeKey = KEY_PREFIX + userId;
    await SecureStore.setItemAsync(storeKey, JSON.stringify(data));
    return address;
  }

  /**
   * Check if a wallet exists for the given user
   */
  static async hasWallet(userId: string): Promise<boolean> {
    try {
      const storeKey = KEY_PREFIX + userId;
      const raw = await SecureStore.getItemAsync(storeKey);
      return !!raw;
    } catch {
      return false;
    }
  }

  /**
   * Get wallet address without unlocking private key
   */
  static async getWalletAddress(userId: string): Promise<string | null> {
    try {
      const storeKey = KEY_PREFIX + userId;
      const raw = await SecureStore.getItemAsync(storeKey);
      if (!raw) return null;
      const data: StoredWalletData = JSON.parse(raw);
      return data.address;
    } catch {
      return null;
    }
  }

  /**
   * Verify if PIN matches
   */
  static async verifyPin(userId: string, pin: string): Promise<boolean> {
    try {
      const storeKey = KEY_PREFIX + userId;
      const raw = await SecureStore.getItemAsync(storeKey);
      if (!raw) return false;
      const data: StoredWalletData = JSON.parse(raw);
      const computedHash = ethers.sha256(ethers.toUtf8Bytes(pin + data.salt));
      return computedHash === data.pinHash;
    } catch {
      return false;
    }
  }

  /**
   * Unlock private key & mnemonic using PIN
   */
  static async unlockWallet(
    userId: string,
    pin: string
  ): Promise<{ address: string; privateKey: string; mnemonic: string | null }> {
    const storeKey = KEY_PREFIX + userId;
    const raw = await SecureStore.getItemAsync(storeKey);
    if (!raw) throw new Error("No Web3 wallet found");

    const data: StoredWalletData = JSON.parse(raw);
    const computedHash = ethers.sha256(ethers.toUtf8Bytes(pin + data.salt));
    if (computedHash !== data.pinHash) {
      throw new Error("Invalid 6-digit PIN");
    }

    const key = deriveKeyFromPin(pin, data.salt);
    const decryptedPayload = decryptWithKey(data.encryptedPayload, key);
    const { mnemonic, privateKey } = JSON.parse(decryptedPayload);

    return {
      address: data.address,
      privateKey,
      mnemonic,
    };
  }

  /**
   * Securely store the PIN using Biometrics
   */
  static async savePinWithBiometrics(userId: string, pin: string): Promise<boolean> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) return false;

      const storeKey = KEY_PREFIX + userId + "_pin";
      await SecureStore.setItemAsync(storeKey, pin, {
        requireAuthentication: true,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Retrieve the PIN using Biometrics (Face ID / Fingerprint)
   */
  static async getPinWithBiometrics(userId: string): Promise<string | null> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) return null;

      const storeKey = KEY_PREFIX + userId + "_pin";
      // This will automatically prompt for Face ID / Touch ID on iOS/Android
      const pin = await SecureStore.getItemAsync(storeKey, {
        requireAuthentication: true,
      });
      return pin;
    } catch {
      return null;
    }
  }

  /**
   * Dummy authenticate for legacy use if needed
   */
  static async authenticateBiometrics(): Promise<boolean> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) return false;

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Authenticate to sign Web3 transaction",
        fallbackLabel: "Use PIN",
      });
      return result.success;
    } catch {
      return false;
    }
  }

  /**
   * Delete Web3 wallet from storage
   */
  static async deleteWallet(userId: string): Promise<void> {
    const storeKey = KEY_PREFIX + userId;
    await SecureStore.deleteItemAsync(storeKey);
  }
}
