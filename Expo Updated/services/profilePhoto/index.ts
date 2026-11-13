import { getApiBaseUrl, getMediaUrl } from '@/services/api';
import { createProfilePhotoCache } from './cache';
import { photoStorage } from './storage';

export const profilePhotoCache = createProfilePhotoCache(photoStorage, getMediaUrl, getApiBaseUrl);
export type { ProfilePhoto } from './types';
