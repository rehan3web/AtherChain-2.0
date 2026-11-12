import * as ImagePicker from 'expo-image-picker';
import { photoError, type Photo } from './model';

/** Local image picking only. No uploads, identity analysis or face detection. */
export async function chooseKycPhoto(source: 'library' | 'camera', frontCamera = false): Promise<Photo | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Camera permission is needed. Allow it in device settings, then try again.');
    }
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'], quality: 0.8, allowsEditing: false,
    ...(source === 'camera' ? { cameraType: frontCamera ? ImagePicker.CameraType.front : ImagePicker.CameraType.back } : {}),
  };
  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled) return null;
  const asset = result.assets?.[0];
  if (!asset?.uri) throw new Error('Could not read the image. Please try again.');
  if (asset.type && asset.type !== 'image') throw new Error('Please choose an image, not a video.');
  const photo: Photo = { uri: asset.uri, name: asset.fileName ?? 'Photo', size: asset.fileSize,
    mimeType: asset.mimeType, file: asset.file };
  const error = photoError(photo);
  if (error) throw new Error(error);
  return photo;
}
