import { useCallback, useEffect, useRef, useState } from 'react';
import { profilePhotoCache, type ProfilePhoto } from '@/services/profilePhoto';

export function useProfilePhoto(photo: ProfilePhoto | null) {
  const key = JSON.stringify([photo?.userId, photo?.url]);
  const current = useRef(photo); current.current = photo;
  const mounted = useRef(false), generation = useRef(0), repaired = useRef(false);
  const [state, setState] = useState<{ key: string; uri: string | null; loading: boolean; error: string | null }>({
    key, uri: null, loading: !!photo?.url, error: null,
  });
  const load = useCallback(async (force = false) => {
    const identity = current.current;
    const run = ++generation.current, identityKey = JSON.stringify([identity?.userId, identity?.url]);
    if (!identity) { setState({ key: identityKey, uri: null, loading: false, error: null }); return; }
    setState({ key: identityKey, uri: null, loading: !!identity.url, error: null });
    try {
      const uri = await profilePhotoCache.resolve(identity, force);
      if (mounted.current && run === generation.current)
        setState({ key: identityKey, uri, loading: false, error: null });
    } catch (cause) {
      if (mounted.current && run === generation.current)
        setState({ key: identityKey, uri: null, loading: false,
          error: cause instanceof Error ? cause.message : 'Could not load the profile photo.' });
    }
  }, []);
  useEffect(() => {
    mounted.current = true; repaired.current = false;
    void load();
    return () => { mounted.current = false; generation.current++; };
  }, [key, load]);
  const onImageError = () => {
    if (repaired.current) {
      setState({ key, uri: null, loading: false, error: 'Could not display the profile photo. Tap to retry.' });
      return;
    }
    repaired.current = true;
    void load(true);
  };
  return { uri: state.key === key ? state.uri : null, loading: state.key === key ? state.loading : !!photo?.url,
    error: state.key === key ? state.error : null, onImageError,
    retry: () => { repaired.current = false; void load(true); } };
}
