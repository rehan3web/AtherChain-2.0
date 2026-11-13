import React from 'react';
import { ActivityIndicator, Image, Pressable, StyleProp, View, ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/hooks/useColors';
import { useProfilePhoto } from '@/hooks/useProfilePhoto';
import type { ProfilePhoto } from '@/services/profilePhoto';

export function ProfileAvatar({ photo, size, style, testID }: {
  photo: ProfilePhoto | null; size: number; style?: StyleProp<ViewStyle>; testID: string;
}) {
  const c = useColors();
  const image = useProfilePhoto(photo);
  return <View style={[{ width: size, height: size, borderRadius: size / 2 }, style]}>
    {image.uri ? <Image testID={`${testID}-image`} source={{ uri: image.uri }} onError={image.onImageError}
      accessibilityLabel="Profile photo" resizeMode="cover" style={{ width: '100%', height: '100%', borderRadius: size / 2 }} />
      : <LinearGradient testID={testID} colors={['#f69a27', '#db5380', '#b700d6']} locations={[0, .5, 1]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: '100%', height: '100%', borderRadius: size / 2 }} />}
    {image.loading && <View testID={`${testID}-loading`} style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={c.walletInk} accessibilityLabel="Loading profile photo" />
    </View>}
    {image.error && <Pressable testID={`${testID}-retry`} onPress={image.retry}
      accessibilityRole="button" accessibilityLabel={`Retry profile photo: ${image.error}`}
      style={{ position: 'absolute', bottom: -2, right: -2, backgroundColor: c.background, borderRadius: 12, padding: 5 }}>
      <Feather name="refresh-cw" size={14} color={c.walletError} />
    </Pressable>}
  </View>;
}
