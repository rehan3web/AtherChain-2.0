import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Header from "@/components/Header";
import { useColors } from "@/hooks/useColors";
import { newsApi, getMediaUrl } from "@/services/api";

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_IMG_H = 180;

type NewsPost = {
  id: string;
  title: string;
  description: string;
  image_url?: string;
  created_at: string;
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return ""; }
}

function readTime(text: string): string {
  const words = text.trim().split(/\s+/).length;
  return `${Math.max(1, Math.ceil(words / 200))} min read`;
}

function imageUrl(post: NewsPost): string | undefined {
  if (!post.image_url) return undefined;
  if (post.image_url.startsWith("http")) return post.image_url;
  return getMediaUrl(`uploads/news/${post.image_url}`);
}

/* ── Full Article View ── */
function ArticleScreen({ post, colors, onBack }: { post: NewsPost; colors: any; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 0 : insets.top;
  const img = imageUrl(post);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <View style={styles.heroWrap}>
          {img ? (
            <Image source={{ uri: img }} style={styles.heroImage} contentFit="cover" />
          ) : (
            <View style={[styles.heroImage, { backgroundColor: colors.card }]} />
          )}
          <View style={styles.heroOverlay} />
          <Pressable
            onPress={onBack}
            style={[styles.heroBack, { top: topPad + 12, backgroundColor: "rgba(0,0,0,0.45)" }]}
          >
            <Feather name="arrow-left" size={20} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.articleBody}>
          <View style={styles.articleMeta}>
            <View style={[styles.tagPill, { backgroundColor: colors.primaryPale }]}>
              <Text style={[styles.tagText, { color: colors.primary }]}>Network</Text>
            </View>
            <Text style={[styles.articleDate, { color: colors.mutedForeground }]}>{formatDate(post.created_at)}</Text>
            <Text style={[styles.articleDate, { color: colors.mutedForeground }]}>·</Text>
            <Text style={[styles.articleDate, { color: colors.mutedForeground }]}>{readTime(post.description)}</Text>
          </View>

          <Text style={[styles.articleTitle, { color: colors.foreground }]}>{post.title}</Text>

          <View style={styles.authorRow}>
            <View style={[styles.authorAvatar, { backgroundColor: colors.primaryPale }]}>
              <Feather name="user" size={14} color={colors.primary} />
            </View>
            <View>
              <Text style={[styles.authorName, { color: colors.foreground }]}>Ather Network</Text>
              <Text style={[styles.authorRole, { color: colors.mutedForeground }]}>Official Team</Text>
            </View>
          </View>

          <View style={[styles.articleDivider, { backgroundColor: colors.border }]} />

          {post.description.split("\n\n").map((paragraph, i) => (
            <Text
              key={i}
              style={[
                styles.articleParagraph,
                { color: colors.foreground },
                paragraph.startsWith("•") && styles.articleList,
              ]}
            >
              {paragraph}
            </Text>
          ))}

          <View style={[styles.shareRow, { borderTopColor: colors.border }]}>
            <Pressable style={[styles.shareBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="heart" size={16} color={colors.mutedForeground} />
              <Text style={[styles.shareBtnText, { color: colors.mutedForeground }]}>Like</Text>
            </Pressable>
            <Pressable style={[styles.shareBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="share-2" size={16} color={colors.mutedForeground} />
              <Text style={[styles.shareBtnText, { color: colors.mutedForeground }]}>Share</Text>
            </Pressable>
            <Pressable style={[styles.shareBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="bookmark" size={16} color={colors.mutedForeground} />
              <Text style={[styles.shareBtnText, { color: colors.mutedForeground }]}>Save</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/* ── Main News Screen ── */
export default function NewsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 60 : insets.top;

  const [posts, setPosts]           = useState<NewsPost[]>([]);
  const [loading, setLoading]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [nextPage, setNextPage]     = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<NewsPost | null>(null);

  const fetchNews = async (pageState?: string) => {
    try {
      const res = await newsApi.list(pageState);
      if (pageState) {
        setPosts((prev) => [...prev, ...res.posts]);
      } else {
        setPosts(res.posts);
      }
      setNextPage(res.pageState);
    } catch (e: any) {
      setError("Failed to load news. Please try again.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => { fetchNews(); }, []);

  const loadMore = () => {
    if (!nextPage || loadingMore) return;
    setLoadingMore(true);
    fetchNews(nextPage);
  };

  if (selectedPost) {
    return <ArticleScreen post={selectedPost} colors={colors} onBack={() => setSelectedPost(null)} />;
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: topPad + 12, paddingBottom: 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Header />

        <View style={styles.titleRow}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Feather name="arrow-left" size={18} color={colors.foreground} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.pageTitle, { color: colors.foreground }]}>News & Updates</Text>
            <Text style={[styles.pageSub, { color: colors.mutedForeground }]}>
              Latest announcements from the Ather Network team.
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : error ? (
          <View style={styles.centerState}>
            <Feather name="wifi-off" size={36} color={colors.mutedForeground} />
            <Text style={[styles.errorText, { color: colors.mutedForeground }]}>{error}</Text>
            <Pressable onPress={() => { setError(null); setLoading(true); fetchNews(); }} style={[styles.retryBtn, { borderColor: colors.border }]}>
              <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>Retry</Text>
            </Pressable>
          </View>
        ) : posts.length === 0 ? (
          <View style={styles.centerState}>
            <Feather name="rss" size={36} color={colors.mutedForeground} />
            <Text style={[styles.errorText, { color: colors.mutedForeground }]}>No news posts yet.</Text>
          </View>
        ) : (
          <>
            {/* ── Featured Post (first) ── */}
            <Pressable onPress={() => setSelectedPost(posts[0])}>
              <View style={[styles.featuredCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {imageUrl(posts[0]) ? (
                  <Image source={{ uri: imageUrl(posts[0]) }} style={styles.featuredImg} contentFit="cover" />
                ) : (
                  <View style={[styles.featuredImg, { backgroundColor: colors.primaryPale }]} />
                )}
                <View style={styles.featuredBody}>
                  <View style={styles.featuredMeta}>
                    <View style={[styles.tagPill, { backgroundColor: colors.primaryPale }]}>
                      <Text style={[styles.tagText, { color: colors.primary }]}>Network</Text>
                    </View>
                    <Text style={[styles.postDate, { color: colors.mutedForeground }]}>{formatDate(posts[0].created_at)}</Text>
                  </View>
                  <Text style={[styles.featuredTitle, { color: colors.foreground }]}>{posts[0].title}</Text>
                  <Text style={[styles.featuredDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
                    {posts[0].description}
                  </Text>
                  <View style={styles.readMoreRow}>
                    <Text style={[styles.readMore, { color: colors.primary }]}>Read more</Text>
                    <Feather name="arrow-right" size={14} color={colors.primary} />
                  </View>
                </View>
              </View>
            </Pressable>

            {/* ── Section Title ── */}
            <View style={styles.sectionHead}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>All Posts</Text>
              <View style={[styles.countPill, { backgroundColor: colors.primaryPale }]}>
                <Text style={[styles.countText, { color: colors.primary }]}>{posts.length}</Text>
              </View>
            </View>

            {/* ── Post List ── */}
            {posts.map((post) => (
              <Pressable key={post.id} onPress={() => setSelectedPost(post)}>
                <View style={[styles.postCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {imageUrl(post) ? (
                    <Image source={{ uri: imageUrl(post) }} style={styles.postImg} contentFit="cover" />
                  ) : (
                    <View style={[styles.postImg, { backgroundColor: colors.primaryPale }]} />
                  )}
                  <View style={styles.postBody}>
                    <View style={styles.postMeta}>
                      <View style={[styles.tagPillSm, { backgroundColor: colors.primaryPale }]}>
                        <Text style={[styles.tagTextSm, { color: colors.primary }]}>Network</Text>
                      </View>
                      <Text style={[styles.postDateSm, { color: colors.mutedForeground }]}>{readTime(post.description)}</Text>
                    </View>
                    <Text style={[styles.postTitle, { color: colors.foreground }]} numberOfLines={2}>
                      {post.title}
                    </Text>
                    <Text style={[styles.postDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
                      {post.description}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}

            {/* ── Load More ── */}
            {nextPage && (
              <Pressable
                onPress={loadMore}
                style={[styles.loadMoreBtn, { borderColor: colors.border }]}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>Load more</Text>
                )}
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1 },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 20 },

  centerState: { alignItems: "center", paddingVertical: 60, gap: 14 },
  errorText:   { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  retryBtn:    { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },

  titleRow:  { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 24 },
  backBtn:   { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  pageTitle: { fontSize: 24, fontFamily: "Inter_700Bold" },
  pageSub:   { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },

  featuredCard:  { borderRadius: 20, borderWidth: 1, overflow: "hidden", marginBottom: 28 },
  featuredImg:   { width: "100%", height: CARD_IMG_H },
  featuredBody:  { padding: 18 },
  featuredMeta:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  featuredTitle: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 8, lineHeight: 24 },
  featuredDesc:  { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20, marginBottom: 12 },
  readMoreRow:   { flexDirection: "row", alignItems: "center", gap: 6 },
  readMore:      { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  tagPill:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  tagText:   { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.3 },
  tagPillSm: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999 },
  tagTextSm: { fontSize: 10, fontFamily: "Inter_600SemiBold" },

  sectionHead:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  countPill:    { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  countText:    { fontSize: 13, fontFamily: "Inter_700Bold" },

  postCard:   { flexDirection: "row", borderRadius: 16, borderWidth: 1, overflow: "hidden", marginBottom: 12 },
  postImg:    { width: 110, height: 110 },
  postBody:   { flex: 1, padding: 14, justifyContent: "center", gap: 6 },
  postMeta:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  postDate:   { fontSize: 12, fontFamily: "Inter_400Regular" },
  postDateSm: { fontSize: 10, fontFamily: "Inter_400Regular" },
  postTitle:  { fontSize: 14, fontFamily: "Inter_700Bold", lineHeight: 19 },
  postDesc:   { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },

  loadMoreBtn: { alignItems: "center", paddingVertical: 14, borderRadius: 14, borderWidth: 1, marginTop: 8 },

  heroWrap:    { position: "relative" },
  heroImage:   { width: "100%", height: 280 },
  heroOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, height: 100, backgroundColor: "rgba(0,0,0,0.3)" },
  heroBack:    { position: "absolute", left: 20, width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },

  articleBody:      { paddingHorizontal: 20, paddingTop: 24 },
  articleMeta:      { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  articleDate:      { fontSize: 12, fontFamily: "Inter_400Regular" },
  articleTitle:     { fontSize: 24, fontFamily: "Inter_700Bold", lineHeight: 32, marginBottom: 20 },

  authorRow:    { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 },
  authorAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  authorName:   { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  authorRole:   { fontSize: 12, fontFamily: "Inter_400Regular" },

  articleDivider:   { height: 1, marginBottom: 20 },
  articleParagraph: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 24, marginBottom: 16 },
  articleList:      { paddingLeft: 4 },

  shareRow:     { flexDirection: "row", gap: 10, paddingTop: 20, borderTopWidth: 1, marginTop: 10 },
  shareBtn:     { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 14, borderWidth: 1 },
  shareBtnText: { fontSize: 13, fontFamily: "Inter_500Medium" },
});
