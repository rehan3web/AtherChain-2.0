import { userApi } from '@/services/api';
import { createCredential } from '@/services/passkeys';
import { useBackendResource } from '@/hooks/useBackendResource';
import { CACHE_POLICIES } from '@/services/cache';

export type Passkey = {
  id: string; device: string; platform: 'android' | 'ios' | 'web' | 'other'; createdAt: string;
};
export function usePasskeys() {
  const resource = useBackendResource<Passkey[]>(async () => {
    const profile = await userApi.me({ force: true });
    return (profile.passkey_credentials ?? []).map((item: any) => ({
      id: item.id, device: item.transports?.includes('internal') ? 'Device passkey' : 'Security key',
      platform: 'other', createdAt: item.createdAt ?? '',
    }));
  }, CACHE_POLICIES.passkeys);
  return {
    passkeys: resource.data ?? [], error: resource.error,
    createPasskey: async () => {
      const options = await userApi.passkeyRegisterOptions();
      const credential = await createCredential(options);
      const result = await userApi.passkeyRegisterVerify(credential);
      if (result.verified !== true) throw new Error('The server did not verify this passkey.');
      return { device: 'Your device passkey' };
    },
    deletePasskey: async (id: string) => {
      await userApi.passkeyRemove(id);
      return true;
    },
  };
}
