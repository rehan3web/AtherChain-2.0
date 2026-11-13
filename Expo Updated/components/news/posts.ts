import type { ImageSource } from 'expo-image';

export type NewsItem = {
  id: string; category: string; title: string; description: string;
  image?: ImageSource; imageDescription: string;
};
