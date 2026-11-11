import type { ImageSource } from 'expo-image';

export type NewsItem = {
  id: string;
  category: string;
  title: string;
  description: string;
  image: ImageSource;
  imageDescription: string;
};

/** Editorial demo content, not a live market-news service. */
export const NEWS_POSTS: NewsItem[] = [
  {
    id: 'wallet-overview',
    category: 'Wallet',
    title: 'Your wallet. Everything in one place.',
    description: 'Send, receive and explore swaps with a clear view of every detail. Your AtherChain wallet keeps balances and activity close, without the clutter.',
    image: require('../../assets/images/news/wallet.jpg'),
    imageDescription: 'Bitcoin and Ethereum coins resting on a laptop keyboard.',
  },
  {
    id: 'mining-companion',
    category: 'Mining',
    title: 'A little progress, every session.',
    description: 'Meet your mining companion, follow the filling meter and claim when your session is ready. Mining and boosts are device-local demos, not real network mining.',
    image: require('../../assets/images/news/mining.jpg'),
    imageDescription: 'Rows of server racks inside a softly lit data center.',
  },
];
