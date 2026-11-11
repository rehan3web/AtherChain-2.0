import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import type { Attachment } from './tickets';

// Pickers may return temporary cache/blob URIs. Keep a durable local copy.
export async function persistAttachments(files: Attachment[]): Promise<Attachment[]> {
  const saved: Attachment[] = [];
  for (const file of files) {
    if (!file.uri) { saved.push({ ...file }); continue; }
    if (file.size > 5e6) throw new Error('Choose attachments under 5 MB.');
    if (Platform.OS === 'web') {
      if (file.uri.startsWith('data:')) { saved.push({ ...file }); continue; }
      const response = await fetch(file.uri);
      if (!response.ok) throw new Error('Could not save the attachment on this device.');
      const blob = await response.blob();
      const uri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not save the attachment on this device.'));
        reader.readAsDataURL(blob);
      });
      saved.push({ ...file, uri });
    } else {
      if (!FileSystem.documentDirectory) throw new Error('Local attachment storage is unavailable.');
      const directory = `${FileSystem.documentDirectory}ticket-attachments/`;
      if (file.uri.startsWith(directory)) { saved.push({ ...file }); continue; }
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
      const extension = file.kind === 'MP4' ? 'mp4' : file.name.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
      const uri = `${directory}${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
      await FileSystem.copyAsync({ from: file.uri, to: uri });
      saved.push({ ...file, uri });
    }
  }
  return saved;
}
