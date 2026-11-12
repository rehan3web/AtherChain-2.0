import React, { useEffect } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { NewsPost } from './NewsPost';
import type { NewsItem } from './posts';
import { newsApi, getMediaUrl } from '@/services/api';
import { useBackendResource } from '@/hooks/useBackendResource';
import { useToast } from '@/components/toast/ToastProvider';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';

export function NewsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { data, error, loading, reload } = useBackendResource<NewsItem[]>(async () => {
    const posts: NewsItem[] = [];
    let cursor: string | undefined;
    const visited = new Set<string>();
    do {
      const result = await newsApi.list(cursor);
      if (!Array.isArray(result.posts)) throw new Error('The backend returned an invalid news feed.');
      posts.push(...result.posts.map((post: any) => ({
        id: String(post.id), title: post.title, description: post.description,
        category: 'News', image: post.image_url ? { uri: getMediaUrl(post.image_url) } : {},
        imageDescription: post.title,
      })));
      cursor = result.pageState || undefined;
      if (cursor && visited.has(cursor)) throw new Error('The backend returned a repeated news page.');
      if (cursor) visited.add(cursor);
    } while (cursor);
    return posts;
  });
  useEffect(() => { if (error) showToast({ kind: 'error', title: 'News', body: error }); }, [error, showToast]);
  const back = () => router.canGoBack() ? router.back() : router.replace('/');
  return (
    <View testID="screen-news" style={[styles.page, { backgroundColor: c.walletCardTop, paddingTop: Platform.OS === 'web' ? 67 : insets.top }]}>
      <View style={[styles.header, { borderBottomColor: c.walletDisabled }]}>
        <Pressable
          onPress={back}
          testID="news-back"
          accessibilityRole="button"
          accessibilityLabel="Back to Home"
          style={({ pressed }) => [styles.back, { opacity: pressed ? .5 : 1 }]}
        >
          <Feather name="arrow-left" size={24} color={c.walletInk} />
        </Pressable>
      </View>
      <FlatList
        testID="news-feed"
        data={data ?? []}
        refreshing={loading}
        onRefresh={() => { void reload(); }}
        keyExtractor={post => post.id}
        renderItem={({ item }) => <NewsPost post={item} />}
        ItemSeparatorComponent={() => <View testID="news-post-separator" style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.walletDisabled }} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        renderScrollComponent={props => <KeyboardAwareScrollViewCompat {...props} bottomOffset={70} />}
        contentContainerStyle={[styles.feed, { paddingBottom: Math.max(insets.bottom, 24) }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: { height: 60, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  feed: { width: '100%', maxWidth: 640, alignSelf: 'center' },
});
