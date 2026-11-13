import React, { useEffect } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { NewsPost } from './NewsPost';
import type { NewsItem } from './posts';
import { newsApi, getMediaUrl } from '@/services/api';
import { useBackendResource } from '@/hooks/useBackendResource';
import { CACHE_POLICIES } from '@/services/cache';
import { useToast } from '@/components/toast/ToastProvider';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { BackendScreenState } from '@/components/BackendScreenState';

export function NewsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { data, error, loading, refreshing, reload } = useBackendResource<NewsItem[]>(async () => {
    const posts: NewsItem[] = [];
    let cursor: string | undefined;
    const visited = new Set<string>();
    do {
      const result = await newsApi.list(cursor);
      if (!Array.isArray(result.posts)) throw new Error('The backend returned an invalid news feed.');
      posts.push(...result.posts.map((post: any) => {
        const imageUrl = typeof post.image_url === 'string' ? post.image_url.trim() : '';
        return {
        id: String(post.id), title: post.title, description: post.description,
        category: 'News', image: imageUrl ? { uri: getMediaUrl(imageUrl) } : undefined,
        imageDescription: post.title,
        };
      }));
      cursor = result.pageState || undefined;
      if (cursor && visited.has(cursor)) throw new Error('The backend returned a repeated news page.');
      if (cursor) visited.add(cursor);
    } while (cursor);
    return posts;
  }, CACHE_POLICIES.news);
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
        refreshing={refreshing}
        onRefresh={() => { void reload(); }}
        keyExtractor={post => post.id}
        renderItem={({ item }) => <NewsPost post={item} />}
        ListEmptyComponent={loading || error ? (
          <BackendScreenState testID="news-status" error={loading ? null : error} onRetry={() => { void reload(); }} />
        ) : (
          <View testID="news-empty" style={styles.empty}>
            <Feather name="file-text" size={28} color={c.walletSubtle} />
            <Text style={[styles.emptyTitle, { color: c.walletInk }]}>No news available</Text>
            <Text style={[styles.emptyBody, { color: c.walletSubtle }]}>Check back later for updates.</Text>
          </View>
        )}
        ItemSeparatorComponent={() => <View testID="news-post-separator" style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.walletDisabled }} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        renderScrollComponent={props => <KeyboardAwareScrollViewCompat {...props} bottomOffset={70} />}
        contentContainerStyle={[styles.feed, { paddingBottom: Math.max(insets.bottom, 24) }, !data?.length && { flexGrow: 1 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: { height: 60, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  feed: { width: '100%', maxWidth: 640, alignSelf: 'center' },
  empty: { flex: 1, minHeight: 240, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  emptyTitle: { fontSize: 16, fontFamily: 'DMSans_600SemiBold', textAlign: 'center' },
  emptyBody: { fontSize: 13, lineHeight: 19, fontFamily: 'DMSans_400Regular', textAlign: 'center' },
});
