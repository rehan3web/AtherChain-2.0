import api from '@/lib/api';

/** Use the shared authenticated API client, never expose a stored filesystem path. */
export async function getKycEvidence(kind: 'photo' | 'document', id: string, signal?: AbortSignal): Promise<Blob> {
    const identifier = encodeURIComponent(id);
    const path = kind === 'photo'
        ? `/admin/kyc/${identifier}/face-scan`
        : `/admin/kyc/document/${identifier}`;
    const response = await api.get<Blob>(path, { responseType: 'blob', signal });
    if (!response.data.size || !['image/jpeg', 'image/png', 'image/webp'].includes(response.data.type.split(';')[0])) {
        throw new Error('The backend did not return a supported KYC image.');
    }
    return response.data;
}
