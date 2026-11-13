import { useEffect, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { userApi } from '@/services/api';
import { appendImage } from '@/services/uploads';
import { profilePhotoCache, type ProfilePhoto } from '@/services/profilePhoto';
import { useToast } from '@/components/toast/ToastProvider';

export function useProfilePhotoUpload(photo: ProfilePhoto | null) {
  const [busy, setBusy] = useState(false);
  const locked = useRef(false), mounted = useRef(true), current = useRef(photo);
  current.current = photo;
  const { showToast } = useToast();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const selectPhoto = async () => {
    if (locked.current || !photo) return;
    locked.current = true; setBusy(true);
    const account = photo.userId;
    const active = () => mounted.current && current.current?.userId === account;
    let finish: (() => void) | undefined, uploaded = false;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85,
      });
      if (result.canceled || !active()) return;
      const asset = result.assets?.[0];
      if (!asset?.uri || (asset.type && asset.type !== 'image')) throw new Error('Choose a JPG, PNG or WEBP photo.');
      const type = asset.mimeType?.toLowerCase();
      const extension = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
      const input = { uri: asset.uri, file: asset.file, mimeType: type, name: asset.fileName ?? `profile-photo.${extension}` };
      const form = new FormData();
      await appendImage(form, 'image', input, 5 * 1024 * 1024);
      if (!active()) return;
      finish = profilePhotoCache.beginUpdate(photo);
      const response = await userApi.uploadProfileImage(form);
      uploaded = true;
      if (typeof response.imageUrl !== 'string' || !response.imageUrl.trim())
        throw new Error('The server did not return the updated photo. Refresh your profile.');
      await profilePhotoCache.install(photo, response.imageUrl, input);
      if (active()) showToast({ kind: 'success', title: 'Profile photo updated', body: 'Saved to your account and cached on this device.' });
    } catch (cause) {
      if (active()) showToast({ kind: 'error',
        title: uploaded ? 'Photo uploaded, local cache needs retry' : 'Could not update profile photo',
        body: cause instanceof Error ? cause.message : 'Please try again.' });
    } finally {
      finish?.(); locked.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return { busy, selectPhoto };
}
