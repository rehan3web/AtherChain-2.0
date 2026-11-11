import React from 'react';
import { FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { NewsPost } from './NewsPost';
import { NEWS_POSTS } from './posts';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';

export function NewsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
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
        data={NEWS_POSTS}
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
