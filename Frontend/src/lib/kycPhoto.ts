export const PHOTO_CAPTURE_LOGS = {
    capture: 'front_camera',
    photosCaptured: 1,
    automaticLivenessVerified: false
} as const;

export function validateLivePhoto(frame: string): string {
    // Browser capture produces JPEG, matching the backend's JPEG storage format.
    const encoded = /^data:image\/jpeg;base64,(\/9j\/[A-Za-z0-9+/]*={0,2})$/.exec(frame)?.[1];
    if (!encoded || encoded.length % 4 !== 0 || encoded.length * 3 / 4 > 5 * 1024 * 1024) {
        throw new Error('Could not read a valid live photo. Take a new photo.');
    }
    return frame;
}

export function captureLivePhoto(video: HTMLVideoElement): string {
    if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
        throw new Error('The camera is not ready. Wait a moment and try again.');
    }
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Photo capture is unavailable in this browser.');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return validateLivePhoto(canvas.toDataURL('image/jpeg', 0.6));
}

export function buildKycSubmission(
    values: Record<string, string>,
    files: { id_front: File | null; id_back: File | null },
    frame: string
): FormData {
    validateLivePhoto(frame);
    const form = new FormData();
    for (const [field, value] of Object.entries(values)) form.append(field, value);
    for (const field of ['id_front', 'id_back'] as const) {
        const file = files[field];
        if (!file || file.size === 0 || file.size > 5 * 1024 * 1024 ||
            !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            throw new Error('Select both ID images as JPG, PNG or WEBP files, up to 5 MB each.');
        }
        form.append(field, file);
    }
    // Preserve the API field used by Expo; this is a single photo, not a scan.
    form.append('face_scan_frame', frame);
    form.append('verification_logs', JSON.stringify(PHOTO_CAPTURE_LOGS));
    return form;
}
