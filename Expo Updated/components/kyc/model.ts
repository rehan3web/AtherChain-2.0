export type DocumentType = 'passport' | 'driving' | 'id';
export type KycReviewStatus = 'pending' | 'rejected' | 'approved';

export const DOCUMENTS = [
  { id: 'passport' as const, label: 'Passport', icon: 'book' as const },
  { id: 'driving' as const, label: 'Driving Licence', icon: 'credit-card' as const },
  { id: 'id' as const, label: 'ID Card', icon: 'user' as const },
];
export type Personal = { name: string; fatherName: string; dob: string; language: string; documentNumber?: string; idExpiry?: string };
export type Residence = { address: string; city: string; state: string; country: string };
export type Photo = { uri: string; name: string; size?: number; mimeType?: string; file?: Blob };
export type FacePhoto = { base64: string; mimeType: string };
export type FieldErrors = Record<string, string>;
export const EMPTY_PERSONAL: Personal = { name: '', fatherName: '', dob: '', language: '', documentNumber: '', idExpiry: '' };
export const EMPTY_RESIDENCE: Residence = { address: '', city: '', state: '', country: '' };

export function validatePersonal(value: Personal, today = new Date()): FieldErrors {
  const errors: FieldErrors = {};
  if (!value.name.trim()) errors.name = 'Enter your full name.';
  else if (value.name.trim().length > 100) errors.name = 'Use 100 characters or fewer.';
  if (!value.fatherName.trim()) errors.fatherName = "Enter your father's name.";
  else if (value.fatherName.trim().length > 100) errors.fatherName = 'Use 100 characters or fewer.';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.dob.trim());
  if (!match) errors.dob = 'Use YYYY-MM-DD, for example 1998-06-15.';
  else {
    const [, y, m, d] = match.map(Number);
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d ||
        date > today || y < today.getFullYear() - 120) {
      errors.dob = 'Enter a valid date of birth, not a future date.';
    }
  }
  if (!value.language) errors.language = 'Choose a language.';
  if (!value.documentNumber?.trim() || value.documentNumber.trim().length > 80)
    errors.documentNumber = 'Enter the document number printed on your ID.';
  if (!value.idExpiry || !/^\d{4}-\d{2}-\d{2}$/.test(value.idExpiry) ||
      !Number.isFinite(new Date(value.idExpiry).getTime()) ||
      new Date(value.idExpiry).toISOString().slice(0, 10) !== value.idExpiry ||
      new Date(`${value.idExpiry}T23:59:59Z`).getTime() < today.getTime())
    errors.idExpiry = 'Enter a valid, unexpired document expiry date (YYYY-MM-DD).';
  return errors;
}

export function validateResidence(value: Residence): FieldErrors {
  const errors: FieldErrors = {};
  for (const key of ['address', 'city', 'state', 'country'] as const) {
    if (!value[key].trim()) errors[key] = `Enter your ${key === 'state' ? 'state or province' : key}.`;
    else if (value[key].trim().length > (key === 'address' ? 240 : 100)) errors[key] = 'This entry is too long.';
  }
  return errors;
}

export function photoError(photo: Photo): string | null {
  if (!photo.uri) return 'Could not read this image. Please try another.';
  if (photo.size != null && photo.size > 5_000_000) return 'Choose an image under 5 MB.';
  if (photo.mimeType && !['image/jpeg', 'image/png', 'image/webp'].includes(photo.mimeType)) return 'Choose a JPG, PNG or WEBP image.';
  return null;
}

export function faceDataUri(photo: FacePhoto): string {
  const { base64, mimeType } = photo;
  const signature = mimeType === 'image/jpeg' ? '/9j/' : mimeType === 'image/png' ? 'iVBORw0KGgo' : mimeType === 'image/webp' ? 'UklGR' : null;
  if (!signature || !base64 || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || !base64.startsWith(signature))
    throw new Error('Could not read the live photo. Take a new photo.');
  if (base64.length * 3 / 4 - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0) > 5_000_000)
    throw new Error('The live photo is too large. Take a new photo.');
  return `data:${mimeType};base64,${base64}`;
}
