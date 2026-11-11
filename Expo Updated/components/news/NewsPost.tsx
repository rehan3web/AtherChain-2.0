import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type { NewsItem } from './posts';

/** A borderless feed entry; only the separator belongs to the surrounding list. */
export function NewsPost({ post }: { post: NewsItem }) {
  const c = useColors();
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <View testID={`news-post-${post.id}`} style={styles.post}>
      <View style={[styles.avatar, { backgroundColor: c.walletInk }]}>
        <Text style={[styles.monogram, { color: c.walletOnInk }]}>AT</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.byline}>
          <Text style={[styles.name, { color: c.walletInk }]}>AtherChain</Text>
          <Text style={[styles.handle, { color: c.walletSubtle }]}>@atherchain</Text>
          <Text style={[styles.category, { color: c.walletSubtle }]}>· {post.category}</Text>
        </View>
        <Text style={[styles.body, { color: c.walletInk }]}>
          <Text style={styles.title}>{post.title}</Text>{'\n'}{post.description}
        </Text>
      {imageFailed ? (
        <View accessibilityRole="alert" style={[styles.image, styles.imageError, { backgroundColor: c.walletField }]}>
          <Feather name="image" size={24} color={c.walletSubtle} />
          <Text style={[styles.description, { color: c.walletSubtle }]}>Image unavailable</Text>
        </View>
      ) : (
        <Image
          source={post.image}
          accessibilityLabel={post.imageDescription}
          accessible
          contentFit="cover"
          style={[styles.image, { backgroundColor: c.walletField, borderColor: c.walletDisabled }]}
          onError={() => setImageFailed(true)}
        />
      )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  post: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  byline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 5, rowGap: 2 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  monogram: { fontSize: 12, fontFamily: 'DMSans_600SemiBold', letterSpacing: -.5 },
  content: { flex: 1, minWidth: 0, gap: 8 },
  name: { fontSize: 14, fontFamily: 'DMSans_600SemiBold' },
  handle: { fontSize: 12, fontFamily: 'DMSans_400Regular' },
  category: { fontSize: 12, fontFamily: 'DMSans_400Regular', flexShrink: 1 },
  image: { width: '100%', aspectRatio: 16 / 9, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  imageError: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  body: { fontSize: 15, lineHeight: 22, fontFamily: 'DMSans_400Regular' },
  title: { fontFamily: 'DMSans_500Medium' },
  description: { fontSize: 14, lineHeight: 23, fontFamily: 'DMSans_400Regular' },
});
