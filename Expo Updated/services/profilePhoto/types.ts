export type ProfilePhoto = { userId: string; url: string | null };
export type PhotoInput = { uri: string; file?: Blob };
export type CachedPhoto = { source: string; uri: string };
export interface PhotoStorage {
  get(owner: string): Promise<CachedPhoto | null>;
  put(owner: string, source: string, input?: PhotoInput): Promise<string>;
  remove(owner: string): Promise<void>;
}
