import AsyncStorage from "@react-native-async-storage/async-storage";
import { getMediaUrl } from "@/services/api";

const CACHE_PREFIX = "ather_profile_pic_cache_";

export async function getCachedProfilePic(userId: string, remotePath?: string | null): Promise<string | null> {
  if (!userId) return null;
  const cacheKey = `${CACHE_PREFIX}${userId}`;
  
  // 1. Check local cache
  const cached = await AsyncStorage.getItem(cacheKey);
  if (cached) {
    return cached;
  }
  
  // 2. If not cached but remote path exists, fetch and cache it
  if (remotePath) {
    try {
      const url = getMediaUrl(remotePath);
      const res = await fetch(url);
      const blob = await res.blob();
      
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result as string;
          if (base64) {
            await AsyncStorage.setItem(cacheKey, base64);
            resolve(base64);
          } else {
            resolve(null);
          }
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn("Failed to fetch and cache remote profile image:", e);
    }
  }
  
  return null;
}

export async function setCachedProfilePic(userId: string, base64OrUri: string): Promise<void> {
  if (!userId) return;
  const cacheKey = `${CACHE_PREFIX}${userId}`;
  await AsyncStorage.setItem(cacheKey, base64OrUri);
}

export async function removeCachedProfilePic(userId: string): Promise<void> {
  if (!userId) return;
  const cacheKey = `${CACHE_PREFIX}${userId}`;
  await AsyncStorage.removeItem(cacheKey);
}
